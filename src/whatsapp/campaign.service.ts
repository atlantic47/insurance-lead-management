import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getTenantContext } from '../common/context/tenant-context';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { CampaignStatus } from './enums/automation.enums';
import { CampaignSchedulerService } from './campaign-scheduler.service';
import { forwardRef, Inject } from '@nestjs/common';

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => CampaignSchedulerService))
    private campaignScheduler: CampaignSchedulerService,
  ) {}

  /**
   * Create a new WhatsApp campaign
   * CRITICAL: Validates that the template is APPROVED before creating the campaign
   */
  async createCampaign(createCampaignDto: CreateCampaignDto, userId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    // CRITICAL VALIDATION: Ensure template exists and is APPROVED
    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: {
        id: createCampaignDto.templateId,
        tenantId,
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.status !== 'APPROVED') {
      throw new BadRequestException(
        `Template "${template.name}" must be APPROVED by Meta before it can be used in campaigns. Current status: ${template.status}`,
      );
    }

    // Validate target configuration
    if (
      createCampaignDto.targetType === 'CONTACT_GROUP' &&
      !createCampaignDto.targetGroupId
    ) {
      throw new BadRequestException(
        'targetGroupId is required when targetType is CONTACT_GROUP',
      );
    }

    if (
      createCampaignDto.targetType === 'SPECIFIC_CONTACTS' &&
      (!createCampaignDto.contactsList || createCampaignDto.contactsList.length === 0)
    ) {
      throw new BadRequestException(
        'contactsList is required when targetType is SPECIFIC_CONTACTS',
      );
    }

    // Validate working hours
    if (
      createCampaignDto.respectWorkingHours &&
      (createCampaignDto.workingHoursStart === undefined ||
        createCampaignDto.workingHoursEnd === undefined)
    ) {
      throw new BadRequestException(
        'workingHoursStart and workingHoursEnd are required when respectWorkingHours is true',
      );
    }

    if (
      createCampaignDto.workingHoursStart !== undefined &&
      createCampaignDto.workingHoursEnd !== undefined &&
      createCampaignDto.workingHoursStart >= createCampaignDto.workingHoursEnd
    ) {
      throw new BadRequestException(
        'workingHoursStart must be less than workingHoursEnd',
      );
    }

    // Calculate total contacts based on target type
    let totalContacts = 0;
    if (createCampaignDto.targetType === 'SPECIFIC_CONTACTS') {
      totalContacts = createCampaignDto.contactsList?.length || 0;
    } else if (createCampaignDto.targetType === 'CONTACT_GROUP') {
      const group = await this.prisma.contactGroup.findFirst({
        where: {
          id: createCampaignDto.targetGroupId,
          tenantId,
        },
      });

      if (!group) {
        throw new NotFoundException('Contact group not found');
      }

      // TODO: Calculate actual contact count when contact relations are defined
      totalContacts = 0;
    }

    const campaign = await this.prisma.whatsAppCampaign.create({
      data: {
        tenantId,
        createdById: userId,
        name: createCampaignDto.name,
        status: CampaignStatus.DRAFT,
        templateId: createCampaignDto.templateId,
        templateParams: createCampaignDto.templateParams
          ? JSON.stringify(createCampaignDto.templateParams)
          : null,
        targetType: createCampaignDto.targetType,
        targetGroupId: createCampaignDto.targetGroupId,
        targetFilters: createCampaignDto.targetFilters
          ? JSON.stringify(createCampaignDto.targetFilters)
          : null,
        contactsList: createCampaignDto.contactsList
          ? JSON.stringify(createCampaignDto.contactsList)
          : null,
        scheduledAt: createCampaignDto.scheduledAt
          ? new Date(createCampaignDto.scheduledAt)
          : null,
        sendingSpeed: createCampaignDto.sendingSpeed || 'NORMAL',
        respectWorkingHours: createCampaignDto.respectWorkingHours ?? true,
        workingHoursStart: createCampaignDto.workingHoursStart,
        workingHoursEnd: createCampaignDto.workingHoursEnd,
        totalContacts,
      },
      include: {
        template: true,
      },
    });

    this.logger.log(`Campaign created: ${campaign.id} by user ${userId}`);
    return this.parseCampaign(campaign);
  }

  /**
   * Get all campaigns for tenant
   */
  async getCampaigns(options?: { status?: CampaignStatus }) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const where: any = { tenantId };
    if (options?.status) {
      where.status = options.status;
    }

    const campaigns = await this.prisma.whatsAppCampaign.findMany({
      where,
      include: {
        template: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((campaign) => this.parseCampaign(campaign));
  }

  /**
   * Get a specific campaign
   */
  async getCampaign(campaignId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const campaign = await this.prisma.whatsAppCampaign.findFirst({
      where: {
        id: campaignId,
        tenantId,
      },
      include: {
        template: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return this.parseCampaign(campaign);
  }

  /**
   * Update a campaign
   */
  async updateCampaign(
    campaignId: string,
    updateCampaignDto: UpdateCampaignDto,
    userId: string,
  ) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const campaign = await this.prisma.whatsAppCampaign.findFirst({
      where: {
        id: campaignId,
        tenantId,
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Don't allow editing campaigns that are RUNNING or COMPLETED
    if (
      campaign.status === CampaignStatus.RUNNING ||
      campaign.status === CampaignStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Cannot edit campaign with status ${campaign.status}`,
      );
    }

    // If changing template, validate it's APPROVED
    if (
      updateCampaignDto.templateId &&
      updateCampaignDto.templateId !== campaign.templateId
    ) {
      const template = await this.prisma.whatsAppTemplate.findFirst({
        where: {
          id: updateCampaignDto.templateId,
          tenantId,
        },
      });

      if (!template) {
        throw new NotFoundException('Template not found');
      }

      if (template.status !== 'APPROVED') {
        throw new BadRequestException(
          `Template "${template.name}" must be APPROVED by Meta. Current status: ${template.status}`,
        );
      }
    }

    const updatedCampaign = await this.prisma.whatsAppCampaign.update({
      where: { id: campaignId },
      data: {
        ...updateCampaignDto,
        templateParams: updateCampaignDto.templateParams
          ? JSON.stringify(updateCampaignDto.templateParams)
          : undefined,
        targetFilters: updateCampaignDto.targetFilters
          ? JSON.stringify(updateCampaignDto.targetFilters)
          : undefined,
        contactsList: updateCampaignDto.contactsList
          ? JSON.stringify(updateCampaignDto.contactsList)
          : undefined,
        scheduledAt: updateCampaignDto.scheduledAt
          ? new Date(updateCampaignDto.scheduledAt)
          : undefined,
      },
      include: {
        template: true,
      },
    });

    this.logger.log(`Campaign updated: ${campaignId} by user ${userId}`);
    return this.parseCampaign(updatedCampaign);
  }

  /**
   * Delete a campaign
   */
  async deleteCampaign(campaignId: string, userId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const campaign = await this.prisma.whatsAppCampaign.findFirst({
      where: {
        id: campaignId,
        tenantId,
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Don't allow deleting campaigns that are RUNNING
    if (campaign.status === CampaignStatus.RUNNING) {
      throw new BadRequestException('Cannot delete a running campaign. Pause it first.');
    }

    await this.prisma.whatsAppCampaign.delete({
      where: { id: campaignId },
    });

    this.logger.log(`Campaign deleted: ${campaignId} by user ${userId}`);
  }

  /**
   * Start a campaign
   */
  async startCampaign(campaignId: string, userId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const campaign = await this.prisma.whatsAppCampaign.findFirst({
      where: {
        id: campaignId,
        tenantId,
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.status === CampaignStatus.RUNNING) {
      throw new BadRequestException('Campaign is already running');
    }

    if (campaign.status === CampaignStatus.COMPLETED) {
      throw new BadRequestException('Cannot restart a completed campaign');
    }

    // Use the campaign scheduler to start the campaign
    await this.campaignScheduler.startCampaign(campaignId);

    // Get updated campaign
    const updatedCampaign = await this.prisma.whatsAppCampaign.findUnique({
      where: { id: campaignId },
      include: {
        template: true,
      },
    });

    this.logger.log(`Campaign started: ${campaignId} by user ${userId}`);
    return this.parseCampaign(updatedCampaign);
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(campaignId: string, userId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const campaign = await this.prisma.whatsAppCampaign.findFirst({
      where: {
        id: campaignId,
        tenantId,
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.status !== CampaignStatus.RUNNING) {
      throw new BadRequestException('Only running campaigns can be paused');
    }

    const updatedCampaign = await this.prisma.whatsAppCampaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.PAUSED,
      },
      include: {
        template: true,
      },
    });

    this.logger.log(`Campaign paused: ${campaignId} by user ${userId}`);
    return this.parseCampaign(updatedCampaign);
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const campaign = await this.prisma.whatsAppCampaign.findFirst({
      where: {
        id: campaignId,
        tenantId,
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Get message status breakdown
    const messageStats = await this.prisma.whatsAppCampaignMessage.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    });

    const stats = {
      totalContacts: campaign.totalContacts,
      sentCount: campaign.sentCount,
      deliveredCount: campaign.deliveredCount,
      readCount: campaign.readCount,
      failedCount: campaign.failedCount,
      messageBreakdown: messageStats.reduce((acc, stat) => {
        acc[stat.status] = stat._count;
        return acc;
      }, {} as Record<string, number>),
      deliveryRate:
        campaign.sentCount > 0
          ? (campaign.deliveredCount / campaign.sentCount) * 100
          : 0,
      readRate:
        campaign.deliveredCount > 0
          ? (campaign.readCount / campaign.deliveredCount) * 100
          : 0,
    };

    return stats;
  }

  /**
   * Parse campaign JSON fields
   */
  private parseCampaign(campaign: any) {
    return {
      ...campaign,
      templateParams: campaign.templateParams
        ? JSON.parse(campaign.templateParams)
        : null,
      targetFilters: campaign.targetFilters
        ? JSON.parse(campaign.targetFilters)
        : null,
      contactsList: campaign.contactsList
        ? JSON.parse(campaign.contactsList)
        : null,
    };
  }
}
