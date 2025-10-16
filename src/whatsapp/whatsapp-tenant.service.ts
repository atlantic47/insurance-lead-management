import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class WhatsAppTenantService {
  private readonly logger = new Logger(WhatsAppTenantService.name);

  constructor(private prisma: PrismaService) {}

  async getTenantCredentials(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    if (!tenant || !tenant.settings) {
      return null;
    }

    const settings = tenant.settings as any;
    return settings.credentials?.whatsapp || null;
  }

  async verifyWebhookToken(tenantId: string, token: string): Promise<boolean> {
    const credentials = await this.getTenantCredentials(tenantId);

    if (!credentials || !credentials.webhookVerifyToken) {
      this.logger.warn(`No webhook verify token found for tenant ${tenantId}`);
      return false;
    }

    return credentials.webhookVerifyToken === token;
  }

  async validateSignature(tenantId: string, signature: string, payload: string): Promise<boolean> {
    const credentials = await this.getTenantCredentials(tenantId);

    if (!credentials || !credentials.appSecret) {
      this.logger.warn(`No app secret found for tenant ${tenantId}`);
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', credentials.appSecret)
      .update(payload)
      .digest('hex');

    return `sha256=${expectedSignature}` === signature;
  }

  async getAccessToken(tenantId: string): Promise<string | null> {
    const credentials = await this.getTenantCredentials(tenantId);
    return credentials?.accessToken || null;
  }

  async getPhoneNumberId(tenantId: string): Promise<string | null> {
    const credentials = await this.getTenantCredentials(tenantId);
    return credentials?.phoneNumberId || null;
  }

  // Generate webhook URL for tenant
  getWebhookUrl(tenantId: string, baseUrl: string): string {
    return `${baseUrl}/whatsapp/webhook/${tenantId}`;
  }

  // Get tenant's webhook verify token for display
  async getWebhookInfo(tenantId: string, baseUrl: string) {
    const credentials = await this.getTenantCredentials(tenantId);

    if (!credentials) {
      return null;
    }

    return {
      webhookUrl: this.getWebhookUrl(tenantId, baseUrl),
      verifyToken: credentials.webhookVerifyToken,
      configured: !!credentials.accessToken && !!credentials.phoneNumberId,
    };
  }
}
