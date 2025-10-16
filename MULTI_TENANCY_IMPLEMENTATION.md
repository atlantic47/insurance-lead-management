# Multi-Tenancy Architecture Implementation Guide

## Overview
This document outlines the implementation of multi-tenancy architecture for the Insurance CRM system, transforming it into a SaaS platform where multiple organizations can use the system in complete isolation.

## Architecture Approach: Row-Level Tenancy

We use **Row-Level Tenancy** (shared database, shared schema) with a `tenantId` field on all tenant-specific tables.

### Advantages:
- Cost-effective (single database)
- Easy to maintain and update
- Simple backup and recovery
- Good performance for most use cases

### Security Measures:
- Prisma middleware enforces tenant isolation
- JWT tokens contain tenantId
- All queries automatically filtered by tenantId
- Admin super-tenant for system-wide operations

## Database Schema Changes

### 1. Add Tenant Model
```prisma
model Tenant {
  id            String   @id @default(uuid())
  name          String
  subdomain     String   @unique  // e.g., "acme" for acme.insurancecrm.com
  domain        String?  @unique  // Custom domain support
  plan          String   @default("free") // free, basic, pro, enterprise
  status        String   @default("active") // active, suspended, cancelled
  maxUsers      Int      @default(5)
  maxLeads      Int      @default(1000)
  settings      Json?    // Tenant-specific settings
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  users         User[]
  leads         Lead[]
  clients       Client[]
  tasks         Task[]
  products      Product[]
  campaigns     Campaign[]

  @@map("tenants")
}
```

### 2. Update User Model
```prisma
model User {
  // ... existing fields
  tenantId      String?
  tenant        Tenant?  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  isSuperAdmin  Boolean  @default(false) // System-wide admin

  @@index([tenantId])
}
```

### 3. Update All Tenant-Specific Models
Add to Lead, Client, Task, Product, Campaign, etc.:
```prisma
tenantId  String
tenant    Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

@@index([tenantId])
```

## Backend Implementation

### 1. Tenant Context Middleware
```typescript
// src/common/middleware/tenant.middleware.ts
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private jwtService: JwtService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Extract tenant from subdomain or JWT
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      try {
        const payload = this.jwtService.verify(token);
        req['tenantId'] = payload.tenantId;
        req['user'] = payload;
      } catch (error) {
        throw new UnauthorizedException('Invalid token');
      }
    }

    // Also support subdomain-based tenant detection
    const host = req.headers.host;
    const subdomain = host?.split('.')[0];

    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      req['subdomain'] = subdomain;
    }

    next();
  }
}
```

### 2. Prisma Tenant Middleware
```typescript
// src/common/services/prisma.service.ts - Add to onModuleInit()

this.$use(async (params, next) => {
  const tenantId = AsyncLocalStorage.getStore()?.tenantId;

  // Skip tenant filtering for Tenant model and super admin operations
  if (params.model === 'Tenant' || !tenantId || tenantId === 'SUPER_ADMIN') {
    return next(params);
  }

  // Models that require tenant isolation
  const tenantModels = [
    'Lead', 'Client', 'Task', 'Product', 'Campaign',
    'Contact', 'Policy', 'ChatMessage', 'AIConversation'
  ];

  if (tenantModels.includes(params.model)) {
    // Add tenantId to all queries
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args = params.args || {};
      params.args.where = params.args.where || {};
      params.args.where.tenantId = tenantId;
    }

    if (params.action === 'create' || params.action === 'createMany') {
      params.args = params.args || {};
      if (params.action === 'create') {
        params.args.data.tenantId = tenantId;
      } else {
        params.args.data = params.args.data.map((item) => ({
          ...item,
          tenantId,
        }));
      }
    }

    if (params.action === 'update' || params.action === 'updateMany') {
      params.args = params.args || {};
      params.args.where = params.args.where || {};
      params.args.where.tenantId = tenantId;
    }

    if (params.action === 'delete' || params.action === 'deleteMany') {
      params.args = params.args || {};
      params.args.where = params.args.where || {};
      params.args.where.tenantId = tenantId;
    }
  }

  return next(params);
});
```

### 3. Tenant Service
```typescript
// src/tenant/tenant.service.ts
@Injectable()
export class TenantService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  async createTenant(data: {
    name: string;
    subdomain: string;
    adminEmail: string;
    adminPassword: string;
    plan?: string;
  }) {
    // Check subdomain availability
    const existing = await this.prisma.tenant.findUnique({
      where: { subdomain: data.subdomain },
    });

    if (existing) {
      throw new BadRequestException('Subdomain already taken');
    }

    // Create tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        name: data.name,
        subdomain: data.subdomain,
        plan: data.plan || 'free',
        status: 'active',
      },
    });

    // Create admin user for tenant
    const hashedPassword = await bcrypt.hash(data.adminPassword, 10);
    const adminUser = await this.prisma.user.create({
      data: {
        email: data.adminEmail,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        tenantId: tenant.id,
      },
    });

    return { tenant, adminUser };
  }

  async getTenant(tenantId: string) {
    return this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            users: true,
            leads: true,
            clients: true,
          },
        },
      },
    });
  }

  async updateTenant(tenantId: string, data: Partial<Tenant>) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data,
    });
  }

  async getTenantBySubdomain(subdomain: string) {
    return this.prisma.tenant.findUnique({
      where: { subdomain },
    });
  }

  async checkTenantLimits(tenantId: string) {
    const tenant = await this.getTenant(tenantId);

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const userCount = await this.prisma.user.count({
      where: { tenantId },
    });

    const leadCount = await this.prisma.lead.count({
      where: { tenantId },
    });

    return {
      users: {
        current: userCount,
        max: tenant.maxUsers,
        canAdd: userCount < tenant.maxUsers,
      },
      leads: {
        current: leadCount,
        max: tenant.maxLeads,
        canAdd: leadCount < tenant.maxLeads,
      },
    };
  }
}
```

### 4. Authentication Updates
```typescript
// src/auth/auth.service.ts - Update login()
async login(email: string, password: string, subdomain?: string) {
  let user;

  if (subdomain) {
    // Tenant-specific login
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain },
    });

    if (!tenant || tenant.status !== 'active') {
      throw new UnauthorizedException('Tenant not found or inactive');
    }

    user = await this.prisma.user.findFirst({
      where: { email, tenantId: tenant.id },
    });
  } else {
    // Super admin login
    user = await this.prisma.user.findFirst({
      where: { email, isSuperAdmin: true },
    });
  }

  // ... rest of login logic

  return {
    access_token: this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      isSuperAdmin: user.isSuperAdmin,
    }),
  };
}
```

## Frontend Implementation

### 1. Tenant Detection
```typescript
// src/lib/tenant.ts
export function getTenantFromHostname(): string | null {
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  // If localhost or IP, no tenant
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  // First part is subdomain (tenant identifier)
  if (parts.length >= 3) {
    return parts[0];
  }

  return null;
}
```

### 2. API Client Updates
```typescript
// src/lib/api.ts
const tenant = getTenantFromHostname();

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    ...(tenant && { 'X-Tenant-ID': tenant }),
  },
});

// Add tenant to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const tenant = getTenantFromHostname();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (tenant) {
    config.headers['X-Tenant-ID'] = tenant;
  }

  return config;
});
```

### 3. Tenant Signup Page
Create `/signup` page for new tenant registration.

## Migration Steps

1. **Database Changes**
   ```bash
   # Add Tenant model and tenantId to all tables
   npx prisma migrate dev --name add_multi_tenancy
   ```

2. **Create Default Tenant**
   ```bash
   # Run migration script to assign existing data to a default tenant
   npm run migrate:assign-default-tenant
   ```

3. **Update Environment Variables**
   ```env
   # Add encryption key for tenant-specific settings
   ENCRYPTION_KEY=<generated-key-from-encryption-service>

   # Add tenant-specific configurations
   DEFAULT_TENANT_SUBDOMAIN=default
   ALLOW_TENANT_SIGNUP=true
   ```

4. **Deploy Changes**
   - Deploy backend with tenant middleware
   - Deploy frontend with tenant detection
   - Configure DNS for wildcard subdomains (*.yourapp.com)

## Security Considerations

1. **Data Isolation**: Prisma middleware ensures no cross-tenant data access
2. **JWT Tokens**: Include tenantId in all tokens
3. **Rate Limiting**: Per-tenant rate limiting
4. **Backup Strategy**: Tenant-specific backup capabilities
5. **Audit Logs**: Track all tenant-specific operations

## Testing

1. Test tenant isolation - ensure queries don't leak data
2. Test tenant limits - verify maxUsers and maxLeads enforcement
3. Test subdomain routing
4. Test super admin access to all tenants
5. Performance testing with multiple tenants

## Status

- ✅ Encryption service implemented
- ✅ Base architecture documented
- ⏳ Database schema updates needed
- ⏳ Middleware implementation needed
- ⏳ Frontend tenant detection needed
- ⏳ Migration scripts needed

## Estimated Time

Full implementation: 2-3 days of development work
- Day 1: Database migrations and Prisma middleware
- Day 2: Backend services and authentication updates
- Day 3: Frontend updates and testing
