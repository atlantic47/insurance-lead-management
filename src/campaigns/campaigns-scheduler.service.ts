import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/services/prisma.service';
import { CampaignsService } from './campaigns.service';
import { runWithTenantContext } from '../common/context/tenant-context';

@Injectable()
export class CampaignsSchedulerService {
  private readonly logger = new Logger(CampaignsSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private campaignsService: CampaignsService,
  ) {}

  // Run every minute to check for scheduled campaigns
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledCampaigns() {
    this.logger.debug('Checking for scheduled campaigns...');

    const now = new Date();

    // Find all scheduled campaigns where scheduledAt <= now
    const scheduledCampaigns = await this.prisma.campaign.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          lte: now,
        },
      },
      include: {
        contactGroup: {
          include: {
            leads: {
              include: {
                lead: true,
              },
            },
          },
        },
        template: true,
        createdBy: true,
      },
    });

    if (scheduledCampaigns.length === 0) {
      this.logger.debug('No scheduled campaigns found');
      return;
    }

    this.logger.log(`Found ${scheduledCampaigns.length} campaigns to send`);

    // Process each campaign
    for (const campaign of scheduledCampaigns) {
      try {
        this.logger.log(`Processing campaign: ${campaign.name} (${campaign.id})`);

        // Set tenant context for this campaign and call sendCampaign
        await runWithTenantContext(
          {
            tenantId: campaign.tenantId,
            userId: campaign.createdById,
            isSuperAdmin: false,
          },
          async () => {
            await this.campaignsService.sendCampaign(campaign.id, campaign.createdById);
          },
        );

        this.logger.log(`Successfully sent campaign: ${campaign.name}`);
      } catch (error) {
        this.logger.error(
          `Failed to send campaign ${campaign.name} (${campaign.id}): ${error.message}`,
          error.stack,
        );

        // Update campaign status to FAILED
        await this.prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'FAILED' },
        });
      }
    }
  }
}
