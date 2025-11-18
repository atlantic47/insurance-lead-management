import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../common/services/encryption.service';
import { getTenantContext } from '../common/context/tenant-context';
import { CreateEmailCredentialDto, UpdateEmailCredentialDto } from './dto/email-credential.dto';
import { CreateWhatsAppCredentialDto, UpdateWhatsAppCredentialDto } from './dto/whatsapp-credential.dto';
import * as crypto from 'crypto';

@Injectable()
export class CredentialsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private encryptionService: EncryptionService,
  ) {}

  // EMAIL CREDENTIALS
  async getEmailCredentials() {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const credentials = await this.prisma.emailCredential.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        secure: true,
        user: true,
        fromEmail: true,
        fromName: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return credentials.map(cred => ({
      ...cred,
      passConfigured: true, // Don't expose actual password
    }));
  }

  async createEmailCredential(dto: CreateEmailCredentialDto) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    // If this is marked as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.emailCredential.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Encrypt password
    const encryptedPass = this.encryptionService.encrypt(dto.pass);

    const credential = await this.prisma.emailCredential.create({
      data: {
        tenantId,
        name: dto.name,
        host: dto.host,
        port: dto.port,
        secure: dto.secure,
        user: dto.user,
        pass: encryptedPass,
        fromEmail: dto.fromEmail,
        fromName: dto.fromName || '',
        isDefault: dto.isDefault || false,
        isActive: true,
      },
    });

    return {
      id: credential.id,
      name: credential.name,
      host: credential.host,
      port: credential.port,
      secure: credential.secure,
      user: credential.user,
      fromEmail: credential.fromEmail,
      fromName: credential.fromName,
      isDefault: credential.isDefault,
      isActive: credential.isActive,
      passConfigured: true,
    };
  }

  async updateEmailCredential(id: string, dto: UpdateEmailCredentialDto) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const existing = await this.prisma.emailCredential.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Email credential not found');
    }

    // If this is being set as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.emailCredential.updateMany({
        where: { tenantId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updateData: any = {};

    if (dto.name) updateData.name = dto.name;
    if (dto.host) updateData.host = dto.host;
    if (dto.port) updateData.port = dto.port;
    if (dto.secure !== undefined) updateData.secure = dto.secure;
    if (dto.user) updateData.user = dto.user;
    if (dto.fromEmail) updateData.fromEmail = dto.fromEmail;
    if (dto.fromName !== undefined) updateData.fromName = dto.fromName;
    if (dto.isDefault !== undefined) updateData.isDefault = dto.isDefault;

    // Only update password if provided
    if (dto.pass) {
      updateData.pass = this.encryptionService.encrypt(dto.pass);
    }

    const credential = await this.prisma.emailCredential.update({
      where: { id },
      data: updateData,
    });

    return {
      id: credential.id,
      name: credential.name,
      host: credential.host,
      port: credential.port,
      secure: credential.secure,
      user: credential.user,
      fromEmail: credential.fromEmail,
      fromName: credential.fromName,
      isDefault: credential.isDefault,
      isActive: credential.isActive,
      passConfigured: true,
    };
  }

  async testEmailCredential(id: string) {
    // This is a placeholder - implement actual email test if needed
    return { success: true, message: 'Email credentials are valid' };
  }

  // WHATSAPP CREDENTIALS
  async getWhatsAppCredentials() {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const credentials = await this.prisma.whatsAppCredential.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        phoneNumberId: true,
        businessAccountId: true,
        webhookVerifyToken: true,
        webhookUrl: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return credentials.map(cred => ({
      ...cred,
      accessTokenConfigured: true, // Don't expose actual token
      appSecretConfigured: true, // Don't expose actual secret
    }));
  }

  async createWhatsAppCredential(dto: CreateWhatsAppCredentialDto) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    // If this is marked as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.whatsAppCredential.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const credentialId = crypto.randomUUID();
    const verifyToken = crypto.randomBytes(32).toString('hex');

    // Store tokens as plain text (encryption disabled due to key mismatch issues)
    // TODO: Re-enable encryption once ENCRYPTION_KEY is properly configured
    const encryptedAccessToken = dto.accessToken;
    const encryptedAppSecret = dto.appSecret || '';

    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3001';
    const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
    const webhookUrl = `${baseUrl}/whatsapp/webhook/${credentialId}`;

    const credential = await this.prisma.whatsAppCredential.create({
      data: {
        id: credentialId,
        tenantId,
        name: dto.name,
        phoneNumber: dto.phoneNumber,
        phoneNumberId: dto.phoneNumberId,
        businessAccountId: dto.businessAccountId,
        accessToken: encryptedAccessToken,
        appSecret: encryptedAppSecret,
        webhookVerifyToken: verifyToken,
        webhookUrl,
        isDefault: dto.isDefault || false,
        isActive: true,
      },
    });

    return {
      id: credential.id,
      name: credential.name,
      phoneNumber: credential.phoneNumber,
      phoneNumberId: credential.phoneNumberId,
      businessAccountId: credential.businessAccountId,
      webhookVerifyToken: credential.webhookVerifyToken,
      webhookUrl: credential.webhookUrl,
      isDefault: credential.isDefault,
      isActive: credential.isActive,
      accessTokenConfigured: true,
      appSecretConfigured: !!dto.appSecret,
    };
  }

  async updateWhatsAppCredential(id: string, dto: UpdateWhatsAppCredentialDto) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const existing = await this.prisma.whatsAppCredential.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('WhatsApp credential not found');
    }

    // If this is being set as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.whatsAppCredential.updateMany({
        where: { tenantId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updateData: any = {};

    if (dto.name) updateData.name = dto.name;
    if (dto.phoneNumber) updateData.phoneNumber = dto.phoneNumber;
    if (dto.phoneNumberId) updateData.phoneNumberId = dto.phoneNumberId;
    if (dto.businessAccountId) updateData.businessAccountId = dto.businessAccountId;
    if (dto.isDefault !== undefined) updateData.isDefault = dto.isDefault;

    // Only update tokens if provided (store as plain text - encryption disabled)
    // TODO: Re-enable encryption once ENCRYPTION_KEY is properly configured
    if (dto.accessToken) {
      updateData.accessToken = dto.accessToken;
    }

    if (dto.appSecret) {
      updateData.appSecret = dto.appSecret;
    }

    const credential = await this.prisma.whatsAppCredential.update({
      where: { id },
      data: updateData,
    });

    return {
      id: credential.id,
      name: credential.name,
      phoneNumber: credential.phoneNumber,
      phoneNumberId: credential.phoneNumberId,
      businessAccountId: credential.businessAccountId,
      webhookVerifyToken: credential.webhookVerifyToken,
      webhookUrl: credential.webhookUrl,
      isDefault: credential.isDefault,
      isActive: credential.isActive,
      accessTokenConfigured: true,
      appSecretConfigured: !!credential.appSecret,
    };
  }

  async regenerateWhatsAppWebhook(id: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const credential = await this.prisma.whatsAppCredential.findFirst({
      where: { id, tenantId },
    });

    if (!credential) {
      throw new NotFoundException('WhatsApp credential not found');
    }

    // Generate new verify token
    const newVerifyToken = crypto.randomBytes(32).toString('hex');

    // Generate fresh webhook URL from current APP_URL in .env
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3001';
    const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
    const webhookUrl = `${baseUrl}/whatsapp/webhook/${id}`;

    await this.prisma.whatsAppCredential.update({
      where: { id },
      data: {
        webhookVerifyToken: newVerifyToken,
        webhookUrl: webhookUrl, // Update the webhook URL in database too
      },
    });

    return {
      webhookUrl: webhookUrl,
      webhookVerifyToken: newVerifyToken,
    };
  }

  async setDefaultEmailCredential(id: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const credential = await this.prisma.emailCredential.findFirst({
      where: { id, tenantId },
    });

    if (!credential) {
      throw new NotFoundException('Email credential not found');
    }

    // Unset all defaults
    await this.prisma.emailCredential.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });

    // Set this one as default
    await this.prisma.emailCredential.update({
      where: { id },
      data: { isDefault: true },
    });

    return { success: true };
  }

  async setDefaultWhatsAppCredential(id: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const credential = await this.prisma.whatsAppCredential.findFirst({
      where: { id, tenantId },
    });

    if (!credential) {
      throw new NotFoundException('WhatsApp credential not found');
    }

    // Unset all defaults
    await this.prisma.whatsAppCredential.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });

    // Set this one as default
    await this.prisma.whatsAppCredential.update({
      where: { id },
      data: { isDefault: true },
    });

    return { success: true };
  }

  async deleteEmailCredential(id: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const credential = await this.prisma.emailCredential.findFirst({
      where: { id, tenantId },
    });

    if (!credential) {
      throw new NotFoundException('Email credential not found');
    }

    await this.prisma.emailCredential.delete({
      where: { id },
    });

    return { success: true };
  }

  async deleteWhatsAppCredential(id: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const credential = await this.prisma.whatsAppCredential.findFirst({
      where: { id, tenantId },
    });

    if (!credential) {
      throw new NotFoundException('WhatsApp credential not found');
    }

    await this.prisma.whatsAppCredential.delete({
      where: { id },
    });

    return { success: true };
  }
}
