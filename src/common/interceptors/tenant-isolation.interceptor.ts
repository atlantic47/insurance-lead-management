import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';

@Injectable()
export class TenantIsolationInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Skip for public routes
    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    if (isPublic) {
      return next.handle();
    }

    // Ensure user has tenantId (except super admins)
    if (!user?.tenantId && !user?.isSuperAdmin) {
      throw new ForbiddenException('No tenant context available');
    }

    // Add tenantId to request for easy access
    request.tenantId = user.tenantId;
    request.isSuperAdmin = user.isSuperAdmin || false;

    return next.handle();
  }
}
