import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { tenantContext } from '../context/tenant-context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Extract tenantId from authenticated user (set by JWT strategy)
    const user = req['user'] as any;

    console.log('🔍 TenantMiddleware - Path:', req.path);
    console.log('🔍 TenantMiddleware - User:', user ? { id: user.id, email: user.email, tenantId: user.tenantId } : 'NO USER');

    // Create tenant context for this request
    const context = {
      tenantId: user?.tenantId,
      isSuperAdmin: user?.isSuperAdmin || false,
      userId: user?.sub || user?.id,
    };

    console.log('🔍 TenantMiddleware - Context:', context);

    // Set on request for backwards compatibility
    req['tenantId'] = context.tenantId;
    req['isSuperAdmin'] = context.isSuperAdmin;

    // Run the entire request/response cycle within tenant context
    return tenantContext.run(context, () => next());
  }
}
