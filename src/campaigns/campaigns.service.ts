import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getTenantContext } from '../common/context/tenant-context';
import { SmtpEmailService } from '../email/smtp-email.service';
import { CreateCampaignTemplateDto } from './dto/create-campaign-template.dto';
import { UpdateCampaignTemplateDto } from './dto/update-campaign-template.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private prisma: PrismaService,
    private smtpEmailService: SmtpEmailService,
  ) {}

  // Campaign Templates
  async createTemplate(dto: CreateCampaignTemplateDto, userId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId || 'default-tenant-000';

    return this.prisma.campaignTemplate.create({
      data: {
        ...dto,
        createdBy: { connect: { id: userId } },
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  async findAllTemplates(userId: string, type?: string) {
    let where: any = {
      createdById: userId,
      ...(type && { type: type as any }),
    };

    // Add tenant filter
    where = this.prisma.addTenantFilter(where);

    return this.prisma.campaignTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneTemplate(id: string, userId: string) {
    let where: any = { id, createdById: userId };

    // Add tenant filter
    where = this.prisma.addTenantFilter(where);

    const template = await this.prisma.campaignTemplate.findFirst({
      where,
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async updateTemplate(id: string, dto: UpdateCampaignTemplateDto, userId: string) {
    await this.findOneTemplate(id, userId);

    return this.prisma.campaignTemplate.update({
      where: { id },
      data: dto,
    });
  }

  async removeTemplate(id: string, userId: string) {
    await this.findOneTemplate(id, userId);

    await this.prisma.campaignTemplate.delete({
      where: { id },
    });

    return { message: 'Template deleted successfully' };
  }

  // Campaigns
  async create(dto: CreateCampaignDto, userId: string) {
    // Get contact group to count recipients - with tenant validation
    let where: any = { id: dto.contactGroupId };
    where = this.prisma.addTenantFilter(where);

    const contactGroup = await this.prisma.contactGroup.findFirst({
      where,
      include: { _count: { select: { leads: true } } },
    });

    if (!contactGroup) {
      throw new NotFoundException('Contact group not found');
    }

    // Validate contact group type matches campaign type
    if (dto.type === 'WHATSAPP' && contactGroup.type === 'EMAIL') {
      throw new Error('Cannot send WhatsApp campaign to Email-only group');
    }
    if (dto.type === 'EMAIL' && contactGroup.type === 'WHATSAPP') {
      throw new Error('Cannot send Email campaign to WhatsApp-only group');
    }

    // Convert scheduledAt to proper ISO-8601 format if provided
    const scheduledAt = dto.scheduledAt
      ? new Date(dto.scheduledAt).toISOString()
      : undefined;

    // Set status based on scheduledAt
    const status = scheduledAt ? 'SCHEDULED' : 'DRAFT';

    const context = getTenantContext();
    const tenantId = context?.tenantId || 'default-tenant-000';

    return this.prisma.campaign.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        template: dto.templateId ? { connect: { id: dto.templateId } } : undefined,
        subject: dto.subject,
        content: dto.content,
        scheduledAt,
        status,
        totalRecipients: contactGroup._count.leads,
        contactGroup: { connect: { id: dto.contactGroupId } },
        createdBy: { connect: { id: userId } },
        tenant: { connect: { id: tenantId } },
      },
      include: {
        template: true,
        contactGroup: {
          include: {
            _count: { select: { leads: true } },
          },
        },
      },
    });
  }

  async findAll(userId: string, type?: string, status?: string) {
    let where: any = {
      createdById: userId,
      ...(type && { type: type as any }),
      ...(status && { status: status as any }),
    };

    // Add tenant filter
    where = this.prisma.addTenantFilter(where);

    return this.prisma.campaign.findMany({
      where,
      include: {
        template: true,
        contactGroup: {
          include: {
            _count: { select: { leads: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    let where: any = { id, createdById: userId };

    // Add tenant filter
    where = this.prisma.addTenantFilter(where);

    const campaign = await this.prisma.campaign.findFirst({
      where,
      include: {
        template: true,
        contactGroup: {
          include: {
            leads: {
              include: {
                lead: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async update(id: string, dto: UpdateCampaignDto, userId: string) {
    await this.findOne(id, userId);

    // Convert scheduledAt to ISO-8601 DateTime if provided
    const data: any = { ...dto };
    if (data.scheduledAt) {
      // If it's a string without seconds, convert to full ISO-8601
      if (typeof data.scheduledAt === 'string' && !data.scheduledAt.includes(':00')) {
        data.scheduledAt = new Date(data.scheduledAt + ':00Z').toISOString();
      } else if (typeof data.scheduledAt === 'string') {
        data.scheduledAt = new Date(data.scheduledAt).toISOString();
      }

      // Set status to SCHEDULED if scheduledAt is provided
      if (!data.status) {
        data.status = 'SCHEDULED';
      }
    }

    return this.prisma.campaign.update({
      where: { id },
      data,
      include: {
        template: true,
        contactGroup: true,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    await this.prisma.campaign.delete({
      where: { id },
    });

    return { message: 'Campaign deleted successfully' };
  }

  async sendCampaign(id: string, userId: string) {
    const campaign = await this.findOne(id, userId);

    if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
      throw new Error('Campaign can only be sent from DRAFT or SCHEDULED status');
    }

    // Update status to SENDING
    await this.prisma.campaign.update({
      where: { id },
      data: {
        status: 'SENDING',
        sentAt: new Date(),
      },
    });

    const leads = campaign.contactGroup.leads.map(l => l.lead);
    let sentCount = 0;
    let failedCount = 0;

    for (const lead of leads) {
      try {
        if (campaign.type === 'EMAIL') {
          if (!lead.email) {
            console.warn(`Lead ${lead.id} has no email address, skipping`);
            failedCount++;
            continue;
          }

          // Use HTML content if available (from template), otherwise use plain content
          let htmlContent = campaign.template?.htmlContent || campaign.content || '';

          // Replace merge fields in HTML content
          htmlContent = htmlContent
            .replace(/{firstName}/g, lead.firstName || '')
            .replace(/{lastName}/g, lead.lastName || '')
            .replace(/{email}/g, lead.email || '')
            .replace(/{phone}/g, lead.phone || '');

          // Send email using SMTP service
          const emailResult = await this.smtpEmailService.sendEmail({
            to: lead.email,
            subject: campaign.subject || 'Message from us',
            html: htmlContent,
          });

          if (emailResult.success) {
            console.log(`Email sent successfully to ${lead.email}`);
            sentCount++;
          } else {
            console.error(`Failed to send email to ${lead.email}: ${emailResult.error}`);
            failedCount++;
          }

        } else if (campaign.type === 'WHATSAPP') {
          // WhatsApp: Use WhatsApp Business API template format
          const template = campaign.template;

          if (!template?.whatsappTemplateName || !template?.whatsappLanguageCode) {
            throw new Error('WhatsApp campaign requires approved template name and language code');
          }

          // Build parameters array based on template mapping
          const parameters: Array<{ type: string; text: string }> = [];
          if (template.whatsappParameters) {
            const paramMapping = template.whatsappParameters as Record<string, string>;

            // Sort by parameter number to ensure correct order
            const sortedKeys = Object.keys(paramMapping).sort((a, b) => {
              const numA = parseInt(a.replace('{{', '').replace('}}', ''));
              const numB = parseInt(b.replace('{{', '').replace('}}', ''));
              return numA - numB;
            });

            for (const key of sortedKeys) {
              const field = paramMapping[key];
              let value = '';

              // Map lead fields to parameter values
              if (field === 'firstName') value = lead.firstName || '';
              else if (field === 'lastName') value = lead.lastName || '';
              else if (field === 'email') value = lead.email || '';
              else if (field === 'phone') value = lead.phone || '';

              parameters.push({ type: 'text', text: value });
            }
          }

          // WhatsApp Business API message format
          const whatsappMessage = {
            messaging_product: 'whatsapp',
            to: lead.phone,
            type: 'template',
            template: {
              name: template.whatsappTemplateName,
              language: {
                code: template.whatsappLanguageCode,
              },
              components: parameters.length > 0 ? [
                {
                  type: 'body',
                  parameters: parameters,
                }
              ] : [],
            },
          };

          // TODO: Send WhatsApp message using WhatsApp Business API
          console.log(`Sending WhatsApp to ${lead.phone}:`, JSON.stringify(whatsappMessage, null, 2));
          sentCount++;
        }
      } catch (error) {
        console.error(`Failed to send to ${lead.email || lead.phone}:`, error);
        failedCount++;
      }
    }

    // Update campaign with results
    return this.prisma.campaign.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        sentCount,
        failedCount,
        deliveredCount: sentCount, // In production, track actual delivery
      },
      include: {
        template: true,
        contactGroup: true,
      },
    });
  }

  async getStats(userId: string) {
    let baseWhere: any = { createdById: userId };
    baseWhere = this.prisma.addTenantFilter(baseWhere);

    const totalCampaigns = await this.prisma.campaign.count({
      where: baseWhere,
    });

    const activeCampaigns = await this.prisma.campaign.count({
      where: {
        ...baseWhere,
        status: { in: ['SENDING', 'SCHEDULED'] },
      },
    });

    const completedCampaigns = await this.prisma.campaign.count({
      where: {
        ...baseWhere,
        status: 'COMPLETED',
      },
    });

    const totalSent = await this.prisma.campaign.aggregate({
      where: baseWhere,
      _sum: { sentCount: true },
    });

    const totalFailed = await this.prisma.campaign.aggregate({
      where: baseWhere,
      _sum: { failedCount: true },
    });

    return {
      totalCampaigns,
      activeCampaigns,
      completedCampaigns,
      totalSent: totalSent._sum.sentCount || 0,
      totalFailed: totalFailed._sum.failedCount || 0,
    };
  }
}
