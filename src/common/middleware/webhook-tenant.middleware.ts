import { Injectable, NestMiddleware, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { tenantContext } from '../context/tenant-context';
import { PrismaService } from '../services/prisma.service';

/**
 * Middleware to extract and validate tenant context for webhook endpoints
 * CRITICAL FOR SECURITY: Prevents cross-tenant data leakage on public webhook routes
 */
@Injectable()
export class WebhookTenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(WebhookTenantMiddleware.name);

  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      let tenantId: string | undefined;

      // Extract credentialId for WhatsApp webhooks or tenantId for other webhooks
      const credentialId = req.params['credentialId'];
      const directTenantId = req.params['tenantId'];

      if (credentialId) {
        // WhatsApp webhook - lookup tenant from credential
        this.logger.log(`Webhook request for credential: ${credentialId}`);

        const credential = await this.prisma.whatsAppCredential.findUnique({
          where: { id: credentialId },
          select: { tenantId: true, isActive: true },
        });

        if (!credential) {
          this.logger.error(`Invalid credential ID: ${credentialId}`);
          throw new UnauthorizedException('Invalid credential ID');
        }

        if (!credential.isActive) {
          this.logger.error(`Inactive credential: ${credentialId}`);
          throw new UnauthorizedException('Credential is not active');
        }

        tenantId = credential.tenantId;
        this.logger.log(`Resolved tenant from credential: ${tenantId}`);
      } else if (directTenantId) {
        // Email or other webhook with direct tenantId
        tenantId = directTenantId;
        this.logger.log(`Webhook request for tenant: ${tenantId}`);
      } else {
        this.logger.error('No tenant ID or credential ID in webhook URL');
        throw new UnauthorizedException('Tenant ID or Credential ID required in webhook URL');
      }

      // Verify tenant exists and is active
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, status: true, name: true }
      });

      if (!tenant) {
        this.logger.error(`Invalid tenant ID: ${tenantId}`);
        throw new UnauthorizedException('Invalid tenant ID');
      }

      // Allow webhooks for active and trial tenants
      if (tenant.status !== 'active' && tenant.status !== 'trial') {
        this.logger.error(`Inactive tenant: ${tenantId} (status: ${tenant.status})`);
        throw new UnauthorizedException('Tenant account is not active');
      }

      this.logger.log(`Validated tenant: ${tenant.name} (${tenantId})`);

      // Set tenant context for this webhook request
      const context = {
        tenantId,
        isSuperAdmin: false,
        userId: 'webhook-system',
      };

      // Run the request within the tenant context
      tenantContext.run(context, () => {
        // Also set on request for backwards compatibility
        req['tenantId'] = tenantId;
        req['isSuperAdmin'] = false;
        next();
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Error in webhook tenant middleware:', error);
      throw new UnauthorizedException('Failed to validate tenant context');
    }
  }
}
