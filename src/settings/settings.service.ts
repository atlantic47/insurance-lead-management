import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class SettingsService {
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-gcm';

  constructor(private prisma: PrismaService) {
    // Use JWT_SECRET as encryption key (must be 32 bytes for aes-256)
    const secret = process.env.JWT_SECRET || 'default-secret-key-change-this';
    this.encryptionKey = crypto.createHash('sha256').update(secret).digest('hex').substring(0, 32);
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  async getSetting(category: string, key: string): Promise<string | null> {
    const setting = await this.prisma.systemSettings.findUnique({
      where: { category_key: { category, key } },
    });

    if (!setting) {
      return null;
    }

    if (setting.isEncrypted) {
      return this.decrypt(setting.value);
    }

    return setting.value;
  }

  async getSettingsByCategory(category: string) {
    const settings = await this.prisma.systemSettings.findMany({
      where: { category },
    });

    return settings.map(setting => ({
      key: setting.key,
      value: setting.isEncrypted ? this.decrypt(setting.value) : setting.value,
      description: setting.description,
      isEncrypted: setting.isEncrypted,
    }));
  }

  async getAllSettings() {
    const settings = await this.prisma.systemSettings.findMany();

    const grouped = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = {};
      }

      acc[setting.category][setting.key] = {
        value: setting.isEncrypted ? this.decrypt(setting.value) : setting.value,
        description: setting.description,
        isEncrypted: setting.isEncrypted,
      };

      return acc;
    }, {});

    return grouped;
  }

  async updateSetting(
    category: string,
    key: string,
    value: string,
    isEncrypted = false,
    description?: string,
  ) {
    const finalValue = isEncrypted ? this.encrypt(value) : value;

    return this.prisma.systemSettings.upsert({
      where: { category_key: { category, key } },
      update: {
        value: finalValue,
        isEncrypted,
        description,
      },
      create: {
        category,
        key,
        value: finalValue,
        isEncrypted,
        description,
      },
    });
  }

  async updateMultipleSettings(settings: Array<{
    category: string;
    key: string;
    value: string;
    isEncrypted?: boolean;
    description?: string;
  }>) {
    const promises = settings.map(setting =>
      this.updateSetting(
        setting.category,
        setting.key,
        setting.value,
        setting.isEncrypted,
        setting.description,
      ),
    );

    return Promise.all(promises);
  }

  async deleteSetting(category: string, key: string) {
    return this.prisma.systemSettings.delete({
      where: { category_key: { category, key } },
    });
  }

  // Helper method to get all settings for a specific service
  async getServiceConfig(category: string): Promise<Record<string, string>> {
    const settings = await this.getSettingsByCategory(category);
    return settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);
  }
}
