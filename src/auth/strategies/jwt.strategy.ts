import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../common/services/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tenantId?: string;
  isSuperAdmin?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET') || 'fallback-secret',
    });
  }

  async validate(payload: JwtPayload) {
    console.log('🔍 JWT Strategy - Payload:', payload);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        tenantId: true,
        isSuperAdmin: true,
      },
    });

    // console.log('🔍 JWT Strategy - User from DB:', user ? { id: user.id, email: user.email, tenantId: user.tenantId } : 'NOT FOUND');

    if (!user || !user.isActive) {
      return null;
    }

    // Return user with tenant info - middleware will set context
    const result = {
      ...user,
      sub: user.id, // Add sub for middleware
      tenantId: payload.tenantId || user.tenantId,
      isSuperAdmin: payload.isSuperAdmin || user.isSuperAdmin,
    };

    // console.log('🔍 JWT Strategy - Returning user:', { id: result.id, email: result.email, tenantId: result.tenantId });

    return result;
  }
}