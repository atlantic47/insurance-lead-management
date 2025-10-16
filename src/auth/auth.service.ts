import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/services/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterTenantDto } from '../tenants/dto/register-tenant.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        ...registerDto,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        tenantId: true,
        createdAt: true,
      },
    });

    const token = this.generateJwtToken(user.id, user.email, user.role, user.tenantId || undefined);

    return {
      user,
      access_token: token,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Check tenant status and trial
    let tenantStatus = null;
    if (user.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { status: true, trialEndsAt: true, plan: true },
      });

      if (tenant) {
        tenantStatus = tenant;

        // Check if trial expired
        if (tenant.status === 'trial' && tenant.trialEndsAt && new Date() > tenant.trialEndsAt) {
          await this.prisma.tenant.update({
            where: { id: user.tenantId },
            data: { status: 'suspended' },
          });
          throw new UnauthorizedException('Trial period expired. Please subscribe to continue.');
        }

        if (tenant.status === 'suspended') {
          throw new UnauthorizedException('Account suspended. Please contact support or update payment.');
        }

        if (tenant.status === 'cancelled') {
          throw new UnauthorizedException('Account cancelled. Please contact support.');
        }
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = this.generateJwtToken(
      user.id,
      user.email,
      user.role,
      user.tenantId || undefined,
      user.isSuperAdmin || false
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        isSuperAdmin: user.isSuperAdmin,
      },
      tenant: tenantStatus,
      access_token: token,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    
    return null;
  }

  private generateJwtToken(userId: string, email: string, role: string, tenantId?: string, isSuperAdmin?: boolean): string {
    const payload = {
      sub: userId,
      email,
      role,
      tenantId,
      isSuperAdmin: isSuperAdmin || false
    };
    return this.jwtService.sign(payload);
  }

  async registerTenant(registerDto: RegisterTenantDto) {
    // Check if email exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.adminEmail },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Check if subdomain exists
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { subdomain: registerDto.subdomain },
    });

    if (existingTenant) {
      throw new ConflictException('Subdomain already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.adminPassword, 12);

    // Calculate trial end date (1 month from now)
    const trialEndsAt = new Date();
    trialEndsAt.setMonth(trialEndsAt.getMonth() + 1);

    // Create tenant and admin user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: registerDto.companyName,
          subdomain: registerDto.subdomain,
          status: 'trial',
          trialEndsAt,
          plan: registerDto.plan || 'free',
          maxUsers: 10,
          maxLeads: 10000,
        },
      });

      // Create admin user
      const admin = await tx.user.create({
        data: {
          email: registerDto.adminEmail,
          password: hashedPassword,
          firstName: registerDto.adminFirstName,
          lastName: registerDto.adminLastName,
          phone: registerDto.adminPhone,
          role: 'ADMIN',
          tenant: { connect: { id: tenant.id } },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          tenantId: true,
          createdAt: true,
        },
      });

      return { tenant, admin };
    });

    const token = this.generateJwtToken(
      result.admin.id,
      result.admin.email,
      result.admin.role,
      result.admin.tenantId || undefined
    );

    return {
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        subdomain: result.tenant.subdomain,
        status: result.tenant.status,
        trialEndsAt: result.tenant.trialEndsAt,
        plan: result.tenant.plan,
      },
      user: result.admin,
      access_token: token,
      message: 'Company registered successfully! You have 1 month free trial.',
    };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        tenantId: true,
      },
    });
  }
}