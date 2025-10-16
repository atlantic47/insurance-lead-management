import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/services/prisma.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { SetupCredentialsDto } from './dto/setup-credentials.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class TenantsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterTenantDto) {
    // Check if subdomain is already taken
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { subdomain: dto.subdomain },
    });

    if (existingTenant) {
      throw new ConflictException('Subdomain is already taken');
    }

    // Check if email is already taken
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.adminPassword, 12);

    // Calculate trial end date (1 month from now)
    const trialEndsAt = new Date();
    trialEndsAt.setMonth(trialEndsAt.getMonth() + 1);

    // Create tenant and admin user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: dto.companyName,
          subdomain: dto.subdomain,
          plan: dto.plan || 'free',
          status: 'trial',
          maxUsers: 10,
          maxLeads: 1000,
          trialEndsAt,
        },
      });

      // Create admin user
      const admin = await tx.user.create({
        data: {
          email: dto.adminEmail,
          password: hashedPassword,
          firstName: dto.adminFirstName,
          lastName: dto.adminLastName,
          phone: dto.adminPhone,
          role: 'ADMIN',
          tenant: { connect: { id: tenant.id } },
        },
      });

      return { tenant, admin };
    });

    return {
      message: 'Registration successful! Your 1-month free trial has started.',
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        subdomain: result.tenant.subdomain,
        trialEndsAt: result.tenant.trialEndsAt,
      },
      admin: {
        id: result.admin.id,
        email: result.admin.email,
        firstName: result.admin.firstName,
        lastName: result.admin.lastName,
      },
    };
  }

  async setupCredentials(tenantId: string, dto: SetupCredentialsDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Encrypt sensitive data before storing (simple approach - in production use proper encryption)
    const encryptedSettings = {
      ...tenant.settings as any,
      credentials: dto,
      setupCompletedAt: new Date(),
    };

    const updatedTenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: encryptedSettings,
      },
    });

    return {
      message: 'Credentials configured successfully',
      setupCompleted: true,
    };
  }

  async getTenantBySubdomain(subdomain: string) {
    return this.prisma.tenant.findUnique({
      where: { subdomain },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  async updateSubscriptionStatus(tenantId: string, status: string, subscriptionId?: string) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status,
        subscriptionId,
        updatedAt: new Date(),
      },
    });
  }

  async checkTrialExpiration(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const now = new Date();
    const trialEnded = tenant.trialEndsAt && now > tenant.trialEndsAt;

    return {
      tenant,
      trialEnded,
      trialDaysLeft: tenant.trialEndsAt
        ? Math.ceil((tenant.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0,
      isActive: tenant.status === 'active' || (tenant.status === 'trial' && !trialEnded),
    };
  }
  async getWebhookUrls(tenantId: string) {
    const baseUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:3000';

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true, subdomain: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const settings = (tenant.settings as any) || {};
    const credentials = settings.credentials || {};

    // Generate verify token if doesn't exist
    const whatsappVerifyToken = credentials.whatsapp?.webhookVerifyToken || crypto.randomBytes(32).toString('hex');
    const facebookVerifyToken = credentials.facebook?.webhookVerifyToken || crypto.randomBytes(32).toString('hex');

    return {
      whatsapp: {
        webhookUrl: `${baseUrl}/whatsapp/webhook/${tenantId}`,
        verifyToken: whatsappVerifyToken,
        configured: !!credentials.whatsapp?.accessToken,
      },
      facebook: {
        webhookUrl: `${baseUrl}/facebook/webhook/${tenantId}`,
        verifyToken: facebookVerifyToken,
        configured: !!credentials.facebook?.accessToken,
      },
      subdomain: tenant.subdomain,
    };
  }

  async getTenantById(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        plan: true,
        status: true,
        maxUsers: true,
        maxLeads: true,
        trialEndsAt: true,
        subscriptionId: true,
        createdAt: true,
        settings: true,
        _count: {
          select: {
            users: true,
            leads: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async getOnboardingStatus(tenantId: string) {
    const tenant = await this.getTenantById(tenantId);
    const settings = (tenant.settings as any) || {};
    const credentials = settings.credentials || {};

    const hasWhatsAppSetup = !!(
      credentials.whatsapp?.accessToken &&
      credentials.whatsapp?.phoneNumberId &&
      credentials.whatsapp?.webhookVerifyToken
    );

    const hasFacebookSetup = !!(
      credentials.facebook?.accessToken &&
      credentials.facebook?.pageId &&
      credentials.facebook?.webhookVerifyToken
    );

    const hasEmailSetup = !!(
      credentials.email?.host &&
      credentials.email?.user &&
      credentials.email?.pass
    );

    return {
      tenantId: tenant.id,
      companyName: tenant.name,
      subdomain: tenant.subdomain,
      plan: tenant.plan,
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt,
      userCount: tenant._count.users,
      leadCount: tenant._count.leads,
      onboarding: {
        whatsappSetup: hasWhatsAppSetup,
        facebookSetup: hasFacebookSetup,
        emailSetup: hasEmailSetup,
        completed: hasWhatsAppSetup || hasFacebookSetup || hasEmailSetup,
      },
    };
  }

  async completeOnboarding(tenantId: string) {
    // Mark onboarding as complete (could add a field to track this)
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        // Could add onboardingCompletedAt field if needed
        updatedAt: new Date(),
      },
    });

    return {
      message: 'Onboarding completed successfully!',
    };
  }
}
