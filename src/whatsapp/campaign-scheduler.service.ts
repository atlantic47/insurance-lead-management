import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/services/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { CampaignStatus, SendingSpeed, MessageStatus } from './enums/automation.enums';

/**
 * CampaignScheduler - Handles automated campaign message sending
 *
 * Key Features:
 * 1. Processes RUNNING campaigns
 * 2. Respects sending speed limits
 * 3. Honors working hours if configured
 * 4. Updates campaign statistics in real-time
 * 5. Handles failures gracefully
 */
@Injectable()
export class CampaignSchedulerService {
  private readonly logger = new Logger(CampaignSchedulerService.name);
  private readonly processingCampaigns = new Set<string>();

  // Sending speed delays (in milliseconds)
  private readonly SPEED_DELAYS = {
    SLOW: 5000, // 5 seconds
    NORMAL: 2000, // 2 seconds
    FAST: 1000, // 1 second
  };

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsAppService,
  ) {}

  /**
   * Run every 30 seconds to process campaign messages
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async processCampaigns() {
    this.logger.debug('📬 Processing campaign messages...');

    try {
      // Get all RUNNING campaigns
      const runningCampaigns = await this.prisma.whatsAppCampaign.findMany({
        where: {
          status: CampaignStatus.RUNNING,
        },
        include: {
          template: true,
        },
      });

      for (const campaign of runningCampaigns) {
        // Skip if already processing
        if (this.processingCampaigns.has(campaign.id)) {
          continue;
        }

        // Check working hours if enabled
        if (campaign.respectWorkingHours) {
          if (!this.isWithinWorkingHours(campaign)) {
            this.logger.debug(
              `Campaign ${campaign.id} is outside working hours, skipping`,
            );
            continue;
          }
        }

        // Process campaign in background
        this.processCampaignMessages(campaign).catch((error) => {
          this.logger.error(
            `Error processing campaign ${campaign.id}:`,
            error,
          );
          this.processingCampaigns.delete(campaign.id);
        });
      }
    } catch (error) {
      this.logger.error('Error in campaign processing:', error);
    }
  }

  /**
   * Process messages for a specific campaign
   */
  private async processCampaignMessages(campaign: any) {
    this.processingCampaigns.add(campaign.id);

    try {
      // Get pending messages for this campaign (batch of 10)
      const pendingMessages = await this.prisma.whatsAppCampaignMessage.findMany({
        where: {
          campaignId: campaign.id,
          status: MessageStatus.PENDING,
        },
        take: 10,
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (pendingMessages.length === 0) {
        // No more messages, mark campaign as completed
        if (campaign.sentCount >= campaign.totalContacts) {
          await this.prisma.whatsAppCampaign.update({
            where: { id: campaign.id },
            data: {
              status: CampaignStatus.COMPLETED,
              completedAt: new Date(),
            },
          });
          this.logger.log(`✅ Campaign ${campaign.id} completed`);
        }
        this.processingCampaigns.delete(campaign.id);
        return;
      }

      const delay = this.SPEED_DELAYS[campaign.sendingSpeed] || this.SPEED_DELAYS.NORMAL;

      // Send messages one by one with delay
      for (const message of pendingMessages) {
        try {
          await this.sendCampaignMessage(campaign, message);
          // Wait for the specified delay before next message
          await this.sleep(delay);
        } catch (error) {
          this.logger.error(
            `Failed to send message ${message.id}:`,
            error,
          );
        }
      }
    } finally {
      this.processingCampaigns.delete(campaign.id);
    }
  }

  /**
   * Send a single campaign message
   */
  private async sendCampaignMessage(campaign: any, message: any) {
    try {
      // Parse template parameters
      const templateParams = campaign.templateParams
        ? JSON.parse(campaign.templateParams)
        : {};

      // Send via WhatsApp service
      const result = await this.whatsappService.sendTemplateMessage(
        campaign.tenantId,
        message.phoneNumber,
        campaign.template.name,
        templateParams,
      );

      if (result.success) {
        // Update message status to SENT
        await this.prisma.whatsAppCampaignMessage.update({
          where: { id: message.id },
          data: {
            status: MessageStatus.SENT,
            sentAt: new Date(),
            metaMessageId: result.messageId,
          },
        });

        // Update campaign statistics
        await this.prisma.whatsAppCampaign.update({
          where: { id: campaign.id },
          data: {
            sentCount: { increment: 1 },
          },
        });

        this.logger.log(
          `✅ Sent campaign message to ${message.phoneNumber} (Campaign: ${campaign.name})`,
        );
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      // Mark message as FAILED
      await this.prisma.whatsAppCampaignMessage.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.FAILED,
          errorMessage: error.message,
        },
      });

      // Update campaign failed count
      await this.prisma.whatsAppCampaign.update({
        where: { id: campaign.id },
        data: {
          failedCount: { increment: 1 },
        },
      });

      this.logger.error(
        `❌ Failed to send campaign message to ${message.phoneNumber}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Check if current time is within working hours
   */
  private isWithinWorkingHours(campaign: any): boolean {
    if (
      campaign.workingHoursStart === null ||
      campaign.workingHoursStart === undefined ||
      campaign.workingHoursEnd === null ||
      campaign.workingHoursEnd === undefined
    ) {
      return true; // No restriction
    }

    const now = new Date();
    const currentHour = now.getHours();

    return (
      currentHour >= campaign.workingHoursStart &&
      currentHour < campaign.workingHoursEnd
    );
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Manual method to check scheduled campaigns and start them
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkScheduledCampaigns() {
    try {
      const now = new Date();

      // Find campaigns that are scheduled to start
      const scheduledCampaigns = await this.prisma.whatsAppCampaign.findMany({
        where: {
          status: CampaignStatus.SCHEDULED,
          scheduledAt: {
            lte: now,
          },
        },
      });

      for (const campaign of scheduledCampaigns) {
        await this.startCampaign(campaign.id);
      }
    } catch (error) {
      this.logger.error('Error checking scheduled campaigns:', error);
    }
  }

  /**
   * Start a campaign by creating pending messages
   */
  async startCampaign(campaignId: string) {
    try {
      const campaign = await this.prisma.whatsAppCampaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Parse contacts list
      const contactsList = campaign.contactsList
        ? JSON.parse(campaign.contactsList)
        : [];

      if (contactsList.length === 0) {
        this.logger.warn(`Campaign ${campaignId} has no contacts`);
        return;
      }

      // Create campaign messages for all contacts
      const messages = contactsList.map((phone: string) => ({
        campaignId: campaign.id,
        tenantId: campaign.tenantId,
        phoneNumber: phone,
        status: MessageStatus.PENDING,
      }));

      await this.prisma.whatsAppCampaignMessage.createMany({
        data: messages,
      });

      // Update campaign status to RUNNING
      await this.prisma.whatsAppCampaign.update({
        where: { id: campaignId },
        data: {
          status: CampaignStatus.RUNNING,
          startedAt: new Date(),
        },
      });

      this.logger.log(
        `🚀 Started campaign ${campaign.name} with ${contactsList.length} contacts`,
      );
    } catch (error) {
      this.logger.error(`Error starting campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Update campaign statistics based on message statuses
   * Called periodically or via webhook
   */
  async updateCampaignStats(campaignId: string) {
    try {
      const stats = await this.prisma.whatsAppCampaignMessage.groupBy({
        by: ['status'],
        where: { campaignId },
        _count: true,
      });

      const delivered = stats.find((s) => s.status === MessageStatus.DELIVERED)?._count || 0;
      const read = stats.find((s) => s.status === MessageStatus.READ)?._count || 0;

      await this.prisma.whatsAppCampaign.update({
        where: { id: campaignId },
        data: {
          deliveredCount: delivered,
          readCount: read,
        },
      });
    } catch (error) {
      this.logger.error(`Error updating campaign stats: ${error.message}`);
    }
  }
}
