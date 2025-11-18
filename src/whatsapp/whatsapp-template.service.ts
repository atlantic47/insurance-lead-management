import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/services/prisma.service';
import { getTenantContext } from '../common/context/tenant-context';
import { CreateWhatsAppTemplateDto, WhatsAppButtonType, WhatsAppHeaderFormat, WhatsAppTemplateCategory } from './dto/create-whatsapp-template.dto';
import { EncryptionService } from '../common/services/encryption.service';
import axios from 'axios';

export interface WhatsAppTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: string;
  text?: string;
  buttons?: Array<{
    type: string;
    text: string;
  }>;
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  status: string;
  category: string;
  components: WhatsAppTemplateComponent[];
}

@Injectable()
export class WhatsAppTemplateService {
  private readonly logger = new Logger(WhatsAppTemplateService.name);
  private readonly whatsappApiUrl: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {
    this.whatsappApiUrl = 'https://graph.facebook.com/v18.0';
  }

  // Validate template against Meta requirements
  private validateTemplate(dto: CreateWhatsAppTemplateDto): void {
    // Validate button count (max 10 for quick reply, max 2 for call-to-action)
    if (dto.buttons && dto.buttons.length > 0) {
      const quickReplyButtons = dto.buttons.filter(b => b.type === WhatsAppButtonType.QUICK_REPLY);
      const ctaButtons = dto.buttons.filter(b => b.type !== WhatsAppButtonType.QUICK_REPLY);

      if (quickReplyButtons.length > 10) {
        throw new BadRequestException('Quick reply buttons cannot exceed 10');
      }

      if (ctaButtons.length > 2) {
        throw new BadRequestException('Call-to-action buttons cannot exceed 2');
      }
    }

    // Validate variable count in body
    const bodyVariables = (dto.body.match(/\{\{(\d+)\}\}/g) || []).length;
    if (bodyVariables > 0 && (!dto.bodyExamples || dto.bodyExamples.length !== bodyVariables)) {
      throw new BadRequestException(`Body has ${bodyVariables} variables but ${dto.bodyExamples?.length || 0} examples provided`);
    }

    // Validate header if present
    if (dto.header) {
      if (dto.header.format === WhatsAppHeaderFormat.TEXT) {
        const headerVariables = (dto.header.text?.match(/\{\{(\d+)\}\}/g) || []).length;
        if (headerVariables > 0 && (!dto.headerExamples || dto.headerExamples.length !== headerVariables)) {
          throw new BadRequestException(`Header has ${headerVariables} variables but ${dto.headerExamples?.length || 0} examples provided`);
        }
      } else {
        // Media header must have example
        if (!dto.header.example) {
          throw new BadRequestException('Media header must have an example URL');
        }
      }
    }
  }

  // Convert DTO to Meta API format
  private convertToMetaFormat(dto: CreateWhatsAppTemplateDto): any {
    const components: any[] = [];

    // Header component
    if (dto.header) {
      const headerComponent: any = {
        type: 'HEADER',
        format: dto.header.format,
      };

      if (dto.header.format === WhatsAppHeaderFormat.TEXT) {
        headerComponent.text = dto.header.text;
        if (dto.headerExamples && dto.headerExamples.length > 0) {
          headerComponent.example = {
            header_text: dto.headerExamples,
          };
        }
      } else {
        // Media header
        headerComponent.example = {
          header_handle: [dto.header.example],
        };
      }

      components.push(headerComponent);
    }

    // Body component
    const bodyComponent: any = {
      type: 'BODY',
      text: dto.body,
    };

    if (dto.bodyExamples && dto.bodyExamples.length > 0) {
      bodyComponent.example = {
        body_text: [dto.bodyExamples],
      };
    }

    components.push(bodyComponent);

    // Footer component
    if (dto.footer) {
      components.push({
        type: 'FOOTER',
        text: dto.footer,
      });
    }

    // Buttons component
    if (dto.buttons && dto.buttons.length > 0) {
      const buttonsComponent: any = {
        type: 'BUTTONS',
        buttons: dto.buttons.map((btn) => {
          if (btn.type === WhatsAppButtonType.QUICK_REPLY) {
            return {
              type: 'QUICK_REPLY',
              text: btn.text,
            };
          } else if (btn.type === WhatsAppButtonType.PHONE_NUMBER) {
            return {
              type: 'PHONE_NUMBER',
              text: btn.text,
              phone_number: btn.phoneNumber,
            };
          } else if (btn.type === WhatsAppButtonType.URL) {
            return {
              type: 'URL',
              text: btn.text,
              url: btn.url,
            };
          }
        }),
      };

      components.push(buttonsComponent);
    }

    return {
      name: dto.name,
      category: dto.category,
      language: dto.language,
      components,
    };
  }

  // Submit template to Meta for approval
  async submitToMeta(templateId: string, userId: string): Promise<any> {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    // Get template
    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: {
        id: templateId,
        tenantId,
        createdById: userId,
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Get WhatsApp credentials from whatsapp_credentials table
    const credential = await this.prisma.whatsAppCredential.findFirst({
      where: { tenantId, isActive: true, isDefault: true },
    });

    if (!credential) {
      throw new BadRequestException('No active WhatsApp credentials found. Please configure WhatsApp in settings.');
    }

    // Decrypt access token if it's encrypted
    let accessToken = credential.accessToken?.trim();
    if (accessToken && this.encryptionService.isEncrypted(accessToken)) {
      // New encryption format (3 parts: iv:encryptedData:authTag)
      try {
        this.logger.log('Decrypting WhatsApp access token (new format)');
        accessToken = this.encryptionService.decrypt(accessToken);
      } catch (error) {
        this.logger.error(`Failed to decrypt WhatsApp access token: ${error.message}`);
        throw new BadRequestException('Failed to decrypt WhatsApp credentials. Please reconfigure in settings.');
      }
    } else if (accessToken && this.encryptionService.isOldEncryptionFormat(accessToken)) {
      // Old encryption format (2 parts: iv:encryptedData)
      try {
        this.logger.log('Decrypting WhatsApp access token (old format)');
        accessToken = this.encryptionService.decryptOldFormat(accessToken);
      } catch (error) {
        this.logger.error(`Failed to decrypt WhatsApp access token with old format: ${error.message}`);
        throw new BadRequestException('Failed to decrypt WhatsApp credentials. Please reconfigure in settings.');
      }
    } else if (accessToken) {
      // Plain text token
      this.logger.log('Using plain text WhatsApp access token');
    }

    const businessAccountId = credential.businessAccountId?.trim();

    if (!businessAccountId) {
      throw new BadRequestException('WhatsApp Business Account ID not configured. Please check your settings.');
    }

    this.logger.log(`Using WhatsApp Business Account: ${businessAccountId}`);

    try {
      // Parse metaPayload to ensure it's valid JSON
      const metaPayload = typeof template.metaPayload === 'string'
        ? JSON.parse(template.metaPayload)
        : template.metaPayload;

      this.logger.log(`Submitting template to Meta: ${JSON.stringify(metaPayload, null, 2)}`);

      // Submit to Meta Graph API
      const response = await axios.post(
        `${this.whatsappApiUrl}/${businessAccountId}/message_templates`,
        metaPayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // Update template with Meta template ID
      await this.prisma.whatsAppTemplate.update({
        where: { id: templateId },
        data: {
          metaTemplateId: response.data.id,
          status: 'PENDING',
          submittedAt: new Date(),
        },
      });

      this.logger.log(`Template ${template.name} submitted to Meta. ID: ${response.data.id}`);

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to submit template to Meta: ${error.message}`, error.response?.data);

      await this.prisma.whatsAppTemplate.update({
        where: { id: templateId },
        data: {
          status: 'REJECTED',
          rejectionReason: error.response?.data?.error?.message || error.message,
        },
      });

      throw new BadRequestException(`Failed to submit template: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // Resubmit template to Meta for approval (for rejected or draft templates after update)
  async resubmitToMeta(templateId: string, userId: string): Promise<any> {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    // Get template
    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: {
        id: templateId,
        tenantId,
        createdById: userId,
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Only allow resubmitting DRAFT or REJECTED templates
    if (template.status !== 'DRAFT' && template.status !== 'REJECTED') {
      throw new BadRequestException(`Cannot resubmit template with status ${template.status}. Only DRAFT or REJECTED templates can be resubmitted.`);
    }

    // Get WhatsApp credentials from whatsapp_credentials table
    const credential = await this.prisma.whatsAppCredential.findFirst({
      where: { tenantId, isActive: true, isDefault: true },
    });

    if (!credential) {
      throw new BadRequestException('No active WhatsApp credentials found. Please configure WhatsApp in settings.');
    }

    // Decrypt access token if it's encrypted
    let accessToken = credential.accessToken?.trim();
    if (accessToken && this.encryptionService.isEncrypted(accessToken)) {
      // New encryption format (3 parts: iv:encryptedData:authTag)
      try {
        this.logger.log('Decrypting WhatsApp access token (new format)');
        accessToken = this.encryptionService.decrypt(accessToken);
      } catch (error) {
        this.logger.error(`Failed to decrypt WhatsApp access token: ${error.message}`);
        throw new BadRequestException('Failed to decrypt WhatsApp credentials. Please reconfigure in settings.');
      }
    } else if (accessToken && this.encryptionService.isOldEncryptionFormat(accessToken)) {
      // Old encryption format (2 parts: iv:encryptedData)
      try {
        this.logger.log('Decrypting WhatsApp access token (old format)');
        accessToken = this.encryptionService.decryptOldFormat(accessToken);
      } catch (error) {
        this.logger.error(`Failed to decrypt WhatsApp access token with old format: ${error.message}`);
        throw new BadRequestException('Failed to decrypt WhatsApp credentials. Please reconfigure in settings.');
      }
    } else if (accessToken) {
      // Plain text token
      this.logger.log('Using plain text WhatsApp access token');
    }

    const businessAccountId = credential.businessAccountId?.trim();

    if (!businessAccountId) {
      throw new BadRequestException('WhatsApp Business Account ID not configured. Please check your settings.');
    }

    this.logger.log(`Using WhatsApp Business Account: ${businessAccountId}`);

    try {
      // Parse metaPayload to ensure it's valid JSON
      const metaPayload = typeof template.metaPayload === 'string'
        ? JSON.parse(template.metaPayload)
        : template.metaPayload;

      // If template was previously submitted and rejected, we may need to delete it first
      if (template.metaTemplateId && template.status === 'REJECTED') {
        try {
          // Try to delete the old template from Meta
          await axios.delete(
            `${this.whatsappApiUrl}/${businessAccountId}/message_templates`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              params: {
                name: template.name,
              },
            },
          );
          this.logger.log(`Deleted old rejected template ${template.name} from Meta`);
        } catch (deleteError) {
          // If deletion fails, that's okay - template might not exist on Meta anymore
          this.logger.warn(`Could not delete old template from Meta: ${deleteError.message}`);
        }
      }

      this.logger.log(`Submitting template to Meta: ${JSON.stringify(metaPayload, null, 2)}`);

      // Submit to Meta Graph API
      const response = await axios.post(
        `${this.whatsappApiUrl}/${businessAccountId}/message_templates`,
        metaPayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // Update template with new Meta template ID and status
      await this.prisma.whatsAppTemplate.update({
        where: { id: templateId },
        data: {
          metaTemplateId: response.data.id,
          status: 'PENDING',
          submittedAt: new Date(),
          rejectionReason: null, // Clear previous rejection reason
        },
      });

      this.logger.log(`Template ${template.name} resubmitted to Meta. New ID: ${response.data.id}`);

      return {
        ...response.data,
        message: 'Template successfully resubmitted for approval',
      };
    } catch (error) {
      this.logger.error(`Failed to resubmit template to Meta: ${error.message}`, error.response?.data);

      await this.prisma.whatsAppTemplate.update({
        where: { id: templateId },
        data: {
          status: 'REJECTED',
          rejectionReason: error.response?.data?.error?.message || error.message,
        },
      });

      throw new BadRequestException(`Failed to resubmit template: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // Create template
  async createTemplate(dto: CreateWhatsAppTemplateDto, userId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    // Validate template
    this.validateTemplate(dto);

    // Convert to Meta format
    const metaPayload = this.convertToMetaFormat(dto);

    // Save to database
    const template = await this.prisma.whatsAppTemplate.create({
      data: {
        name: dto.name,
        category: dto.category,
        language: dto.language,
        headerFormat: dto.header?.format,
        headerText: dto.header?.text,
        body: dto.body,
        footer: dto.footer,
        buttons: dto.buttons ? JSON.stringify(dto.buttons) : null,
        metaPayload: JSON.stringify(metaPayload),
        status: dto.submitToMeta ? 'PENDING' : 'DRAFT',
        tenant: { connect: { id: tenantId } },
        createdBy: { connect: { id: userId } },
      },
    });

    // Submit to Meta if requested
    if (dto.submitToMeta) {
      try {
        await this.submitToMeta(template.id, userId);
      } catch (error) {
        // Template is saved but submission failed
        this.logger.error(`Template saved but submission failed: ${error.message}`);
      }
    }

    return template;
  }

  // Get all templates
  async getTemplates(userId: string, options: { page?: number; limit?: number; status?: string; search?: string }) {
    const { page = 1, limit = 20, status, search } = options;
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const where: any = {
      tenantId,
      createdById: userId,
    };

    if (status) {
      where.status = status;
    }

    const [templates, total] = await Promise.all([
      this.prisma.whatsAppTemplate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.whatsAppTemplate.count({ where }),
    ]);

    return {
      templates,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get single template
  async getTemplate(templateId: string, userId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: {
        id: templateId,
        tenantId,
        createdById: userId,
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  // Get template status from Meta
  async getTemplateStatus(templateId: string, userId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: {
        id: templateId,
        tenantId,
        createdById: userId,
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (!template.metaTemplateId) {
      return { status: template.status, message: 'Not submitted to Meta yet' };
    }

    // Get WhatsApp credentials from whatsapp_credentials table
    const credential = await this.prisma.whatsAppCredential.findFirst({
      where: { tenantId, isActive: true, isDefault: true },
    });

    if (!credential) {
      throw new BadRequestException('No active WhatsApp credentials found. Please configure WhatsApp in settings.');
    }

    // Decrypt access token if it's encrypted
    let accessToken = credential.accessToken?.trim();
    if (accessToken && this.encryptionService.isEncrypted(accessToken)) {
      // New encryption format (3 parts: iv:encryptedData:authTag)
      try {
        this.logger.log('Decrypting WhatsApp access token (new format)');
        accessToken = this.encryptionService.decrypt(accessToken);
      } catch (error) {
        this.logger.error(`Failed to decrypt WhatsApp access token: ${error.message}`);
        throw new BadRequestException('Failed to decrypt WhatsApp credentials. Please reconfigure in settings.');
      }
    } else if (accessToken && this.encryptionService.isOldEncryptionFormat(accessToken)) {
      // Old encryption format (2 parts: iv:encryptedData)
      try {
        this.logger.log('Decrypting WhatsApp access token (old format)');
        accessToken = this.encryptionService.decryptOldFormat(accessToken);
      } catch (error) {
        this.logger.error(`Failed to decrypt WhatsApp access token with old format: ${error.message}`);
        throw new BadRequestException('Failed to decrypt WhatsApp credentials. Please reconfigure in settings.');
      }
    } else if (accessToken) {
      // Plain text token
      this.logger.log('Using plain text WhatsApp access token');
    }

    try {
      // Get status from Meta
      const response = await axios.get(
        `${this.whatsappApiUrl}/${template.metaTemplateId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            fields: 'name,status,category,language',
          },
        },
      );

      // Update local status
      await this.prisma.whatsAppTemplate.update({
        where: { id: templateId },
        data: {
          status: response.data.status,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get template status from Meta: ${error.message}`);
      return { status: template.status, message: 'Could not fetch from Meta' };
    }
  }

  // Update template
  async updateTemplate(templateId: string, updateDto: Partial<CreateWhatsAppTemplateDto>, userId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: {
        id: templateId,
        tenantId,
        createdById: userId,
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Don't allow updating templates that have been submitted or approved
    if (template.status === 'APPROVED' || template.status === 'PENDING') {
      throw new BadRequestException('Cannot update templates that have been submitted to Meta. Please create a new template instead.');
    }

    // Build a complete DTO by merging current template data with updates
    const currentDto: CreateWhatsAppTemplateDto = {
      name: template.name,
      category: template.category as WhatsAppTemplateCategory,
      language: template.language,
      body: template.body,
      footer: template.footer || undefined,
      header: template.headerFormat ? {
        format: template.headerFormat as WhatsAppHeaderFormat,
        text: template.headerText || undefined,
        example: undefined,
      } : undefined,
      buttons: template.buttons ? JSON.parse(template.buttons) : undefined,
      bodyExamples: [],
      headerExamples: [],
    };

    // Merge with update DTO
    const mergedDto: CreateWhatsAppTemplateDto = {
      ...currentDto,
      ...updateDto,
    };

    // Validate the updated template
    this.validateTemplate(mergedDto);

    // Convert to Meta format to regenerate metaPayload
    const metaPayload = this.convertToMetaFormat(mergedDto);

    // Build update data for Prisma
    const updateData: any = {
      metaPayload: JSON.stringify(metaPayload),
    };

    if (updateDto.name !== undefined) updateData.name = updateDto.name;
    if (updateDto.category !== undefined) updateData.category = updateDto.category;
    if (updateDto.language !== undefined) updateData.language = updateDto.language;
    if (updateDto.body !== undefined) updateData.body = updateDto.body;
    if (updateDto.footer !== undefined) updateData.footer = updateDto.footer;

    // Handle header update
    if (updateDto.header !== undefined) {
      updateData.headerFormat = updateDto.header.format;
      if (updateDto.header.format === WhatsAppHeaderFormat.TEXT) {
        updateData.headerText = updateDto.header.text;
      }
    }

    // Handle buttons update - store as JSON string
    if (updateDto.buttons !== undefined) {
      updateData.buttons = JSON.stringify(updateDto.buttons);
    }

    const updatedTemplate = await this.prisma.whatsAppTemplate.update({
      where: { id: templateId },
      data: updateData,
    });

    this.logger.log(`Template ${templateId} updated by user ${userId}`);
    return updatedTemplate;
  }

  // Delete template
  async deleteTemplate(templateId: string, userId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: {
        id: templateId,
        tenantId,
        createdById: userId,
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.prisma.whatsAppTemplate.delete({
      where: { id: templateId },
    });

    return { message: 'Template deleted successfully' };
  }

  // Legacy methods for backward compatibility
  async fetchApprovedTemplates(): Promise<WhatsAppTemplate[]> {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      return [];
    }

    const credential = await this.prisma.whatsAppCredential.findFirst({
      where: {
        tenantId,
        isActive: true,
        isDefault: true,
      },
    });

    if (!credential) {
      this.logger.warn('WhatsApp credentials not configured');
      return [];
    }

    try {
      const response = await axios.get(
        `${this.whatsappApiUrl}/${credential.businessAccountId}/message_templates`,
        {
          params: {
            access_token: credential.accessToken,
            limit: 100,
            status: 'APPROVED',
          },
        },
      );

      const templates: WhatsAppTemplate[] = response.data.data || [];
      this.logger.log(`Fetched ${templates.length} approved WhatsApp templates`);

      return templates;
    } catch (error) {
      this.logger.error('Failed to fetch WhatsApp templates:', error.response?.data || error.message);
      throw new Error('Failed to fetch WhatsApp templates from Meta');
    }
  }

  async getTemplateByName(templateName: string, language: string = 'en'): Promise<WhatsAppTemplate | null> {
    try {
      const templates = await this.fetchApprovedTemplates();
      return templates.find(t => t.name === templateName && t.language === language) || null;
    } catch (error) {
      this.logger.error(`Failed to get template ${templateName}:`, error.message);
      return null;
    }
  }

  extractTemplateParameters(template: WhatsAppTemplate): string[] {
    const bodyComponent = template.components.find(c => c.type === 'BODY');
    if (!bodyComponent?.text) return [];

    const matches = bodyComponent.text.match(/\{\{\d+\}\}/g);
    return matches || [];
  }

  async validateTemplateParams(templateName: string, languageCode: string, paramMapping: Record<string, string>): Promise<{ valid: boolean; error?: string }> {
    const template = await this.getTemplateByName(templateName, languageCode);

    if (!template) {
      return { valid: false, error: `Template "${templateName}" not found or not approved` };
    }

    const requiredParams = this.extractTemplateParameters(template);
    const providedParams = Object.keys(paramMapping);

    // Check if all required parameters are mapped
    for (const param of requiredParams) {
      if (!providedParams.includes(param)) {
        return { valid: false, error: `Missing mapping for parameter ${param}` };
      }
    }

    return { valid: true };
  }

  async getTemplateStructure(templateName: string, languageCode: string): Promise<any> {
    const template = await this.getTemplateByName(templateName, languageCode);

    if (!template) {
      return null;
    }

    const parameters = this.extractTemplateParameters(template);

    return {
      name: template.name,
      language: template.language,
      category: template.category,
      components: template.components,
      parameters: parameters,
      parameterCount: parameters.length,
    };
  }

  /**
   * Sync existing templates from Facebook for the current tenant
   * This fetches all templates from the business account and stores them in the database
   */
  async syncExistingTemplates(userId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    this.logger.log(`Syncing templates from Facebook for tenant ${tenantId}`);

    // Get WhatsApp credentials from whatsapp_credentials table
    const credential = await this.prisma.whatsAppCredential.findFirst({
      where: { tenantId, isActive: true, isDefault: true },
    });

    if (!credential) {
      throw new BadRequestException('No active WhatsApp credentials found. Please configure WhatsApp in settings.');
    }

    // Decrypt access token if it's encrypted
    let accessToken = credential.accessToken?.trim();
    if (accessToken && this.encryptionService.isEncrypted(accessToken)) {
      try {
        this.logger.log('Decrypting WhatsApp access token (new format)');
        accessToken = this.encryptionService.decrypt(accessToken);
      } catch (error) {
        this.logger.error(`Failed to decrypt WhatsApp access token: ${error.message}`);
        throw new BadRequestException('Failed to decrypt WhatsApp credentials. Please reconfigure in settings.');
      }
    } else if (accessToken && this.encryptionService.isOldEncryptionFormat(accessToken)) {
      try {
        this.logger.log('Decrypting WhatsApp access token (old format)');
        accessToken = this.encryptionService.decryptOldFormat(accessToken);
      } catch (error) {
        this.logger.error(`Failed to decrypt WhatsApp access token with old format: ${error.message}`);
        throw new BadRequestException('Failed to decrypt WhatsApp credentials. Please reconfigure in settings.');
      }
    } else if (accessToken) {
      this.logger.log('Using plain text WhatsApp access token');
    }

    const businessAccountId = credential.businessAccountId?.trim();

    if (!businessAccountId) {
      throw new BadRequestException('WhatsApp Business Account ID not configured. Please check your settings.');
    }

    try {
      // Fetch templates from Meta Graph API
      this.logger.log(`Fetching templates from Meta for Business Account: ${businessAccountId}`);

      const response = await axios.get(
        `${this.whatsappApiUrl}/${businessAccountId}/message_templates`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            limit: 1000, // Fetch up to 1000 templates
          },
        },
      );

      const metaTemplates = response.data.data || [];
      this.logger.log(`Found ${metaTemplates.length} templates from Facebook`);

      let syncedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const metaTemplate of metaTemplates) {
        try {
          // Check if template already exists in database for this tenant
          const existingTemplate = await this.prisma.whatsAppTemplate.findFirst({
            where: {
              tenantId,
              name: metaTemplate.name,
              language: metaTemplate.language,
            },
          });

          // Extract components from Meta template
          const components = metaTemplate.components || [];

          // Extract header, body, footer, buttons
          const headerComponent = components.find((c: any) => c.type === 'HEADER');
          const bodyComponent = components.find((c: any) => c.type === 'BODY');
          const footerComponent = components.find((c: any) => c.type === 'FOOTER');
          const buttonComponent = components.find((c: any) => c.type === 'BUTTONS');

          const buttons = buttonComponent?.buttons ? buttonComponent.buttons.map((btn: any) => ({
            type: btn.type,
            text: btn.text,
            url: btn.url,
            phoneNumber: btn.phone_number,
          })) : null;

          const templateData = {
            name: metaTemplate.name,
            category: metaTemplate.category,
            language: metaTemplate.language,
            headerFormat: headerComponent?.format || null,
            headerText: headerComponent?.text || null,
            body: bodyComponent?.text || '',
            footer: footerComponent?.text || null,
            buttons: buttons ? JSON.stringify(buttons) : null,
            metaPayload: JSON.stringify(metaTemplate),
            metaTemplateId: metaTemplate.id,
            status: metaTemplate.status,
            submittedAt: existingTemplate?.submittedAt || new Date(),
            tenantId,
            createdById: userId,
          };

          if (existingTemplate) {
            // Update existing template
            await this.prisma.whatsAppTemplate.update({
              where: { id: existingTemplate.id },
              data: {
                category: templateData.category,
                headerFormat: templateData.headerFormat,
                headerText: templateData.headerText,
                body: templateData.body,
                footer: templateData.footer,
                buttons: templateData.buttons,
                metaPayload: templateData.metaPayload,
                metaTemplateId: templateData.metaTemplateId,
                status: templateData.status,
              },
            });
            updatedCount++;
            this.logger.log(`Updated template: ${metaTemplate.name} (${metaTemplate.language})`);
          } else {
            // Create new template
            await this.prisma.whatsAppTemplate.create({
              data: templateData,
            });
            syncedCount++;
            this.logger.log(`Synced new template: ${metaTemplate.name} (${metaTemplate.language})`);
          }
        } catch (error) {
          this.logger.error(`Failed to sync template ${metaTemplate.name}: ${error.message}`);
          skippedCount++;
        }
      }

      this.logger.log(`Sync complete: ${syncedCount} new, ${updatedCount} updated, ${skippedCount} skipped`);

      return {
        success: true,
        total: metaTemplates.length,
        synced: syncedCount,
        updated: updatedCount,
        skipped: skippedCount,
        message: `Successfully synced ${syncedCount} new templates and updated ${updatedCount} existing templates`,
      };
    } catch (error) {
      this.logger.error(`Failed to sync templates from Facebook: ${error.message}`);

      if (error.response?.data) {
        this.logger.error('Facebook API Error:', JSON.stringify(error.response.data, null, 2));
        throw new BadRequestException(
          `Failed to fetch templates from Facebook: ${error.response.data.error?.message || error.message}`,
        );
      }

      throw new BadRequestException(`Failed to sync templates: ${error.message}`);
    }
  }
}
