import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { tenantContext, TenantContext } from '../context/tenant-context';

/**
 * TenantContextMiddleware - Sets tenant context for the current request
 *
 * CRITICAL: This middleware must run AFTER authentication middleware
 * It extracts tenant information from the authenticated user and stores it
 * in AsyncLocalStorage for the duration of the request.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user;

    // Create tenant context from authenticated user
    const context: TenantContext = {
      userId: user?.id || user?.sub,
      tenantId: user?.tenantId,
      isSuperAdmin: user?.isSuperAdmin || false,
    };

    // Run the rest of the request within this tenant context
    tenantContext.run(context, () => {
      if (user && user.tenantId) {
        this.logger.debug(
          `Tenant context set: userId=${context.userId}, tenantId=${context.tenantId}, isSuperAdmin=${context.isSuperAdmin}`
        );
      }
      next();
    });
  }
}
