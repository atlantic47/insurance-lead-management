import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { getTenantContext } from '../common/context/tenant-context';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  async getSetting(category: string, key: string): Promise<string | null> {
    const context = getTenantContext();
    if (!context?.tenantId) {
      throw new Error('Tenant context required');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: { settings: true },
    });

    if (!tenant?.settings) {
      return null;
    }

    const settings = tenant.settings as any;
    const categoryKey = category.toLowerCase();
    const value = settings.credentials?.[categoryKey]?.[key];

    if (!value) {
      return null;
    }

    // Decrypt if the value is encrypted
    if (this.encryptionService.isEncrypted(value)) {
      try {
        return this.encryptionService.decrypt(value);
      } catch (error) {
        console.error(`Failed to decrypt setting ${category}.${key}:`, error);
        return null;
      }
    }

    return value;
  }

  async getSettingsByCategory(category: string) {
    const context = getTenantContext();
    if (!context?.tenantId) {
      throw new Error('Tenant context required');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: { settings: true },
    });

    if (!tenant?.settings) {
      return [];
    }

    const settings = tenant.settings as any;
    const categoryKey = category.toLowerCase();
    const categorySettings = settings.credentials?.[categoryKey] || {};

    return Object.entries(categorySettings).map(([key, value]) => {
      const strValue = value as string;
      const isEncrypted = this.encryptionService.isEncrypted(strValue);

      // Decrypt if encrypted
      const decryptedValue = isEncrypted
        ? this.encryptionService.decrypt(strValue)
        : strValue;

      return {
        key,
        value: decryptedValue,
        description: null,
        isEncrypted,
      };
    });
  }

  async getAllSettings() {
    const context = getTenantContext();
    if (!context?.tenantId) {
      throw new Error('Tenant context required');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: { settings: true },
    });

    if (!tenant?.settings) {
      return {};
    }

    const settings = tenant.settings as any;
    const credentials = settings.credentials || {};

    const grouped = {};
    for (const [category, categorySettings] of Object.entries(credentials)) {
      grouped[category.toUpperCase()] = {};
      for (const [key, value] of Object.entries(categorySettings as any)) {
        grouped[category.toUpperCase()][key] = {
          value,
          description: null,
          isEncrypted: false,
        };
      }
    }

    return grouped;
  }

  async updateSetting(
    category: string,
    key: string,
    value: string,
    isEncrypted = false,
    description?: string,
  ) {
    const context = getTenantContext();
    if (!context?.tenantId) {
      throw new Error('Tenant context required');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: { settings: true },
    });

    const settings = (tenant?.settings as any) || { credentials: {} };
    if (!settings.credentials) {
      settings.credentials = {};
    }

    const categoryKey = category.toLowerCase();
    if (!settings.credentials[categoryKey]) {
      settings.credentials[categoryKey] = {};
    }

    // Encrypt sensitive settings based on category and key
    const sensitiveKeys = ['password', 'secret', 'token', 'key', 'apiKey', 'clientSecret', 'appSecret'];
    const shouldEncrypt = isEncrypted || sensitiveKeys.some(k => key.toLowerCase().includes(k));

    const storedValue = shouldEncrypt && value
      ? this.encryptionService.encrypt(value)
      : value;

    settings.credentials[categoryKey][key] = storedValue;

    await this.prisma.tenant.update({
      where: { id: context.tenantId },
      data: { settings },
    });

    return { category, key, value: shouldEncrypt ? '***encrypted***' : value };
  }

  async updateMultipleSettings(settings: Array<{
    category: string;
    key: string;
    value: string;
    isEncrypted?: boolean;
    description?: string;
  }>) {
    const context = getTenantContext();
    if (!context?.tenantId) {
      throw new Error('Tenant context required');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: { settings: true },
    });

    const tenantSettings = (tenant?.settings as any) || { credentials: {} };
    if (!tenantSettings.credentials) {
      tenantSettings.credentials = {};
    }

    const sensitiveKeys = ['password', 'secret', 'token', 'key', 'apiKey', 'clientSecret', 'appSecret'];

    for (const setting of settings) {
      const categoryKey = setting.category.toLowerCase();
      if (!tenantSettings.credentials[categoryKey]) {
        tenantSettings.credentials[categoryKey] = {};
      }

      // Encrypt sensitive settings
      const shouldEncrypt = setting.isEncrypted || sensitiveKeys.some(k => setting.key.toLowerCase().includes(k));
      const storedValue = shouldEncrypt && setting.value
        ? this.encryptionService.encrypt(setting.value)
        : setting.value;

      tenantSettings.credentials[categoryKey][setting.key] = storedValue;
    }

    await this.prisma.tenant.update({
      where: { id: context.tenantId },
      data: { settings: tenantSettings },
    });

    return settings.map(s => ({
      ...s,
      value: (s.isEncrypted || sensitiveKeys.some(k => s.key.toLowerCase().includes(k))) ? '***encrypted***' : s.value,
    }));
  }

  async deleteSetting(category: string, key: string) {
    const context = getTenantContext();
    if (!context?.tenantId) {
      throw new Error('Tenant context required');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: { settings: true },
    });

    const settings = (tenant?.settings as any) || { credentials: {} };
    const categoryKey = category.toLowerCase();

    if (settings.credentials?.[categoryKey]?.[key]) {
      delete settings.credentials[categoryKey][key];
      await this.prisma.tenant.update({
        where: { id: context.tenantId },
        data: { settings },
      });
    }

    return { deleted: true };
  }

  async getServiceConfig(category: string): Promise<Record<string, string>> {
    const settings = await this.getSettingsByCategory(category);
    return settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);
  }
}
