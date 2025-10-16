import { Injectable, OnModuleInit, INestApplication, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { getTenantContext } from '../context/tenant-context';

// Models that require tenant isolation - CRITICAL FOR SECURITY
const TENANT_MODELS = [
  'lead',
  'client',
  'task',
  'product',
  'campaign',
  'campaignTemplate',
  'communication',
  'contactGroup',
  'aIConversation',
  'ticket',
  'chatMessage',      // SECURITY FIX: Added for WhatsApp message isolation
  'emailMessage',     // SECURITY FIX: Added for email message isolation
  'aITrainingData',   // SECURITY FIX: Added for AI training data isolation
];

// Models with explicit user relationship (not tenant-scoped)
const USER_MODEL = 'user';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Prisma connected - Using manual tenant filtering via addTenantFilter()');
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }

  // Helper to add tenant filter to where clause
  addTenantFilter(where: any = {}, forceTenantId?: string) {
    const context = getTenantContext();
    const tenantId = forceTenantId || context?.tenantId;
    const isSuperAdmin = context?.isSuperAdmin;

    // Super admins can see all data
    if (isSuperAdmin && !forceTenantId) {
      return where;
    }

    // CRITICAL: If no tenantId and not super admin, return impossible condition
    if (!tenantId) {
      console.warn('⚠️ No tenant context found! Blocking query for security.');
      return { ...where, tenantId: 'SECURITY_BLOCK_NO_TENANT' };
    }

    // Add tenant filter for regular users
    return { ...where, tenantId };
  }

  // Validate that a record belongs to the current tenant
  async validateTenantAccess(model: string, id: string): Promise<boolean> {
    const context = getTenantContext();
    const tenantId = context?.tenantId;
    const isSuperAdmin = context?.isSuperAdmin;

    // Super admins have access to everything
    if (isSuperAdmin) {
      return true;
    }

    // Check if model requires tenant validation
    if (!TENANT_MODELS.includes(model.toLowerCase())) {
      return true;
    }

    try {
      const record = await (this as any)[model].findUnique({
        where: { id },
        select: { tenantId: true },
      });

      return record && record.tenantId === tenantId;
    } catch (error) {
      return false;
    }
  }
}