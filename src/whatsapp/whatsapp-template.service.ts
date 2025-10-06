import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private readonly accessToken: string;
  private readonly wabaId: string;

  constructor(private configService: ConfigService) {
    this.whatsappApiUrl = 'https://graph.facebook.com/v18.0';
    this.accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN') || '';
    this.wabaId = this.configService.get<string>('WHATSAPP_BUSINESS_ACCOUNT_ID') || '';
  }

  /**
   * Fetch approved WhatsApp templates from Meta Graph API
   */
  async fetchApprovedTemplates(): Promise<WhatsAppTemplate[]> {
    try {
      if (!this.accessToken || !this.wabaId) {
        this.logger.warn('WhatsApp credentials not configured');
        return [];
      }

      const response = await axios.get(
        `${this.whatsappApiUrl}/${this.wabaId}/message_templates`,
        {
          params: {
            access_token: this.accessToken,
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

  /**
   * Get a specific template by name
   */
  async getTemplateByName(templateName: string, language: string = 'en'): Promise<WhatsAppTemplate | null> {
    try {
      const templates = await this.fetchApprovedTemplates();
      return templates.find(t => t.name === templateName && t.language === language) || null;
    } catch (error) {
      this.logger.error(`Failed to get template ${templateName}:`, error.message);
      return null;
    }
  }

  /**
   * Extract parameter placeholders from template body
   * Returns array like ['{{1}}', '{{2}}'] in order
   */
  extractTemplateParameters(template: WhatsAppTemplate): string[] {
    const bodyComponent = template.components.find(c => c.type === 'BODY');
    if (!bodyComponent?.text) return [];

    const matches = bodyComponent.text.match(/\{\{\d+\}\}/g);
    return matches || [];
  }

  /**
   * Validate if a template is properly configured
   */
  async validateTemplate(templateName: string, languageCode: string, paramMapping: Record<string, string>): Promise<{ valid: boolean; error?: string }> {
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

  /**
   * Get template components in a format suitable for the frontend
   */
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
}
