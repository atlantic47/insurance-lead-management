# Multi-Tenancy Implementation - Completion Guide

## Current Status

### ✅ Completed
1. **Tenant Model Added** - Base tenant/organization model created in schema
2. **User Model Updated** - Added tenantId, isSuperAdmin fields
3. **Lead Model Updated** - Added tenantId with indexes
4. **SQL Migration Script** - Created for adding tenantId to existing tables
5. **Encryption Service** - Implemented for sensitive tenant settings
6. **Documentation** - Comprehensive multi-tenancy architecture guide

### ⚠️ Remaining Work

## Step 1: Update All Prisma Models (30 minutes)

Add these fields to each model that needs tenant isolation:

```prisma
// Add to: Communication, Client, Task, Product, Campaign, Policy,
// AIConversation, ContactGroup, CampaignTemplate models

  tenantId  String
  tenant    Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
```

### Models Requiring tenantId:
- ✅ User (done)
- ✅ Lead (done)
- ⚠️ Communication
- ⚠️ Client
- ⚠️ Task
- ⚠️ Product
- ⚠️ Campaign
- ⚠️ Policy
- ⚠️ AIConversation
- ⚠️ ContactGroup
- ⚠️ CampaignTemplate

### Models NOT Requiring tenantId (System-wide):
- ChatMessage (belongs to AIConversation which has tenantId)
- EmailMessage (belongs to Lead which has tenantId)
- LeadProduct (join table, inherits from Lead)
- LeadContactGroup (join table, inherits from Lead)
- AITrainingData (belongs to AIConversation)
- AuditLog (system-wide audit)
- SystemSettings (system-wide settings)

## Step 2: Run Database Migration (5 minutes)

```bash
# Option A: Using Prisma (recommended)
npx prisma migrate dev --name add_multi_tenancy

# Option B: Using SQL script directly
mysql -u your_user -p your_database < add-tenancy-fields.sql
```

## Step 3: Create Tenant Middleware (15 minutes)

Create `src/common/middleware/tenant.middleware.ts`:

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Extract tenantId from JWT token (set in auth)
    const user = req['user'];
    if (user && user.tenantId) {
      req['tenantId'] = user.tenantId;
    }
    next();
  }
}
```

Register in `app.module.ts`:

```typescript
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*');
  }
}
```

## Step 4: Update PrismaService with Tenant Filtering (20 minutes)

Add to `src/common/services/prisma.service.ts` in `onModuleInit()`:

```typescript
async onModuleInit() {
  await this.$connect();

  // Tenant isolation middleware
  this.$use(async (params, next) => {
    // Get tenantId from context (set by TenantMiddleware)
    const tenantId = (global as any).tenantId;

    // Models that require tenant isolation
    const tenantModels = [
      'Lead', 'Client', 'Task', 'Product', 'Campaign', 'Policy',
      'Communication', 'AIConversation', 'ContactGroup', 'CampaignTemplate'
    ];

    // Skip for non-tenant models or super admin
    if (!tenantModels.includes(params.model) || !tenantId || tenantId === 'SUPER_ADMIN') {
      return next(params);
    }

    // Automatically add tenantId to all queries
    if (params.action === 'findMany' || params.action === 'findFirst' || params.action === 'findUnique') {
      params.args = params.args || {};
      params.args.where = params.args.where || {};
      params.args.where.tenantId = tenantId;
    }

    if (params.action === 'create') {
      params.args.data.tenantId = tenantId;
    }

    if (params.action === 'createMany') {
      params.args.data = params.args.data.map((item: any) => ({
        ...item,
        tenantId,
      }));
    }

    if (params.action === 'update' || params.action === 'updateMany') {
      params.args.where = params.args.where || {};
      params.args.where.tenantId = tenantId;
    }

    if (params.action === 'delete' || params.action === 'deleteMany') {
      params.args.where = params.args.where || {};
      params.args.where.tenantId = tenantId;
    }

    return next(params);
  });
}
```

## Step 5: Update AuthService (15 minutes)

Update `src/auth/auth.service.ts`:

```typescript
async login(loginDto: LoginDto) {
  const { email, password, subdomain } = loginDto;

  let user;

  if (subdomain) {
    // Tenant-specific login
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain },
    });

    if (!tenant || tenant.status !== 'active') {
      throw new UnauthorizedException('Organization not found or inactive');
    }

    user = await this.prisma.user.findFirst({
      where: { email, tenantId: tenant.id },
      include: { tenant: true },
    });
  } else {
    // Super admin login (no tenant)
    user = await this.prisma.user.findFirst({
      where: { email, isSuperAdmin: true },
    });
  }

  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    isSuperAdmin: user.isSuperAdmin,
  };

  return {
    access_token: this.jwtService.sign(payload),
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      tenant: user.tenant,
    },
  };
}
```

## Step 6: Create TenantService (20 minutes)

Create `src/tenant/tenant.service.ts`, `tenant.controller.ts`, `tenant.module.ts`:

```bash
cd "/home/shem/Desktop/nest js/insurance-lead-management"
nest g module tenant
nest g service tenant
nest g controller tenant
```

Implement tenant management (create, update, get, check limits).

## Step 7: Frontend Updates (30 minutes)

### 1. Tenant Detection (`src/lib/tenant.ts`):
```typescript
export function getTenantFromHostname(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname;
  if (hostname === 'localhost') return 'default';
  return hostname.split('.')[0];
}
```

### 2. Update API Client:
```typescript
// src/lib/api.ts
api.interceptors.request.use((config) => {
  const tenant = getTenantFromHostname();
  if (tenant) {
    config.headers['X-Tenant-Subdomain'] = tenant;
  }
  return config;
});
```

### 3. Update Login:
```typescript
// Include subdomain in login request
const subdomain = getTenantFromHostname();
await authApi.login({ email, password, subdomain });
```

## Step 8: Testing (30 minutes)

1. **Create Test Tenants**:
   - Create 2-3 test tenants via API
   - Assign users to different tenants

2. **Test Data Isolation**:
   - Login as User A (Tenant 1)
   - Create leads/tasks
   - Login as User B (Tenant 2)
   - Verify User B cannot see User A's data

3. **Test Super Admin**:
   - Login as super admin
   - Verify access to all tenants

## Step 9: Environment Configuration (5 minutes)

Add to `.env`:
```env
# Multi-Tenancy
ENCRYPTION_KEY=<generate-with-encryption-service>
DEFAULT_TENANT_ID=default-tenant-id
ALLOW_TENANT_SIGNUP=true
MULTI_TENANCY_ENABLED=true
```

## Timeline

- **Immediate (1 hour)**: Complete Prisma schema updates + run migration
- **Short-term (2 hours)**: Implement middleware + update services
- **Medium-term (2 hours)**: Frontend updates + testing
- **Total**: ~5 hours of focused development

## Critical Notes

1. **Data Loss Prevention**: Run the SQL script to assign existing data to default tenant BEFORE making tenantId NOT NULL
2. **Backup First**: Always backup database before running migrations
3. **Test Thoroughly**: Tenant isolation is security-critical
4. **Index Performance**: tenantId indexes are crucial for query performance
5. **Super Admin**: Always keep at least one super admin account (isSuperAdmin=true, tenantId=null)

## Quick Start Commands

```bash
# 1. Update Prisma schema (add tenantId to remaining models)
# 2. Generate migration
npx prisma migrate dev --name add_multi_tenancy

# 3. Or apply SQL directly
mysql -u root -p insurance_crm < add-tenancy-fields.sql

# 4. Generate Prisma client
npx prisma generate

# 5. Restart backend
npm run start:dev

# 6. Test
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password","subdomain":"default"}'
```

## Verification Checklist

- [ ] All tenant-specific models have tenantId field
- [ ] Prisma migration completed successfully
- [ ] Existing data assigned to default tenant
- [ ] Tenant middleware registered
- [ ] PrismaService middleware filters by tenantId
- [ ] AuthService includes tenantId in JWT
- [ ] Frontend detects tenant from subdomain
- [ ] API client sends tenant info
- [ ] Created 2+ test tenants
- [ ] Verified data isolation between tenants
- [ ] Super admin can access all tenants
- [ ] Performance acceptable with tenant indexes

## Support

If you encounter issues:
1. Check Prisma client is regenerated: `npx prisma generate`
2. Verify JWT includes tenantId: Decode token at jwt.io
3. Check middleware logs: Add console.log in tenant middleware
4. Test queries directly: Use Prisma Studio (`npx prisma studio`)
