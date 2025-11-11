import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantContext, getTenantContext } from '../context/tenant-context';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantContextInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Check if tenant context was set by webhook middleware on the request object
    if (request.tenantId) {
      const webhookCtx = {
        tenantId: request.tenantId,
        isSuperAdmin: request.isSuperAdmin || false,
        userId: request.userId || 'webhook-system',
      };

      this.logger.log(`Using webhook tenant context: tenantId=${webhookCtx.tenantId}, userId=${webhookCtx.userId}`);

      // Run handler within tenant context from webhook
      return new Observable((observer) => {
        tenantContext.run(webhookCtx, () => {
          next.handle().subscribe({
            next: (value) => observer.next(value),
            error: (err) => observer.error(err),
            complete: () => observer.complete(),
          });
        });
      });
    }

    // Otherwise, set context from authenticated user
    const user = request.user;

    const tenantCtx = {
      tenantId: user?.tenantId,
      isSuperAdmin: user?.isSuperAdmin || false,
      userId: user?.sub || user?.id,
    };

    this.logger.log(`Setting tenant context: tenantId=${tenantCtx.tenantId}, userId=${tenantCtx.userId}, isSuperAdmin=${tenantCtx.isSuperAdmin}`);

    // Run handler within tenant context
    return new Observable((observer) => {
      tenantContext.run(tenantCtx, () => {
        next.handle().subscribe({
          next: (value) => observer.next(value),
          error: (err) => observer.error(err),
          complete: () => observer.complete(),
        });
      });
    });
  }
}
