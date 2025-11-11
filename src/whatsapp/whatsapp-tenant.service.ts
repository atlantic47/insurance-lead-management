import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import * as crypto from 'crypto';

@Injectable()
export class WhatsAppTenantService {
  private readonly logger = new Logger(WhatsAppTenantService.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

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
    const storedToken = credentials?.accessToken;

    if (!storedToken) {
      return null;
    }

    // Check if the token is encrypted using the EncryptionService's isEncrypted method
    if (this.encryptionService.isEncrypted(storedToken)) {
      try {
        this.logger.log('Decrypting WhatsApp access token');
        return this.encryptionService.decrypt(storedToken);
      } catch (error) {
        this.logger.error(`Failed to decrypt WhatsApp access token for tenant ${tenantId}:`, error.message);
        return null;
      }
    }

    // Token is not encrypted, return as-is
    this.logger.log('Using plain text WhatsApp access token');
    return storedToken;
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
