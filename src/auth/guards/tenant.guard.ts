import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

/**
 * TenantGuard - Enforces multi-tenancy boundaries
 *
 * CRITICAL SECURITY: This guard ensures that:
 * 1. All authenticated requests have a valid tenantId
 * 2. Users cannot access resources from other tenants
 * 3. Super admins can bypass tenant restrictions when needed
 * 4. Public endpoints are exempted from tenant checks
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user, let JwtAuthGuard handle it
    if (!user) {
      return true;
    }

    // Super admins bypass tenant restrictions
    if (user.isSuperAdmin) {
      this.logger.debug(`Super admin ${user.id} accessing resource - tenant check bypassed`);
      return true;
    }

    // CRITICAL: All non-super-admin users MUST have a tenantId
    if (!user.tenantId) {
      this.logger.error(`🚨 SECURITY VIOLATION: User ${user.id} has no tenantId!`);
      throw new ForbiddenException('User must be associated with a tenant');
    }

    // Check if route has tenant-specific parameter
    const params = request.params || {};
    const query = request.query || {};
    const body = request.body || {};

    // If tenantId is in params, query, or body, validate it matches user's tenantId
    const requestTenantId = params.tenantId || query.tenantId || body.tenantId;

    if (requestTenantId && requestTenantId !== user.tenantId) {
      this.logger.warn(
        `🚨 TENANT BOUNDARY VIOLATION: User ${user.id} (tenant: ${user.tenantId}) attempted to access tenant ${requestTenantId}`
      );
      throw new ForbiddenException('Access denied: tenant boundary violation');
    }

    // All checks passed
    return true;
  }
}
