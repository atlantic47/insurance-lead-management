# Multi-Tenancy Implementation Guide

## Overview

This insurance lead management system implements comprehensive multi-tenancy with strict data isolation to ensure each agency (tenant) can only access and manage their own data.

## Architecture

### Core Components

1. **Tenant Context (AsyncLocalStorage)**
   - Location: `src/common/context/tenant-context.ts`
   - Stores tenant information for the duration of each request
   - Used by all database operations to enforce tenant isolation

2. **Prisma Middleware**
   - Location: `src/common/services/prisma.service.ts`
   - Automatically injects `tenantId` into all create operations
   - Automatically filters all read operations by `tenantId`
   - Blocks operations without tenant context (security)

3. **TenantGuard**
   - Location: `src/auth/guards/tenant.guard.ts`
   - Enforces tenant boundaries at the request level
   - Prevents users from accessing other tenants' data
   - Allows super admins to bypass restrictions

4. **Tenant Middleware**
   - Location: `src/common/middleware/tenant.middleware.ts`
   - Extracts tenant info from authenticated user (JWT)
   - Sets tenant context for the request lifecycle

5. **Webhook Tenant Middleware**
   - Location: `src/common/middleware/webhook-tenant.middleware.ts`
   - Handles tenant context for public webhook endpoints
   - Validates tenant ID from URL parameters
   - Used for WhatsApp and email webhooks

## Security Features

### 1. Database-Level Isolation

All tenant-scoped models include a `tenantId` field:
- leads
- clients
- tasks
- products
- campaigns
- communications
- contacts
- aiConversations
- chatMessages (WhatsApp, etc.)
- emailMessages
- aiTrainingData
- users (special case - see below)

### 2. Automatic Query Scoping

The Prisma middleware automatically:
- Adds `tenantId` to WHERE clauses for find operations
- Injects `tenantId` into create operations
- Validates tenant ownership for update/delete operations

### 3. Encrypted Settings

Sensitive credentials (SMTP, Facebook, WhatsApp) are:
- Stored per-tenant in `tenant.settings` JSON field
- Encrypted at rest using AES-256-GCM
- Automatically decrypted when retrieved
- Auto-encrypted when keys contain: password, secret, token, key, apiKey, clientSecret, appSecret

### 4. Widget Authentication

AI chat widgets use signed tokens to verify tenant context:
- Widgets get a signed token from the backend
- Token includes tenantId, widgetId, and optional domain restriction
- Backend validates token signature before processing messages
- Prevents cross-tenant data leakage from public widgets

## Deployment Instructions

### 1. Environment Variables

Add to `.env`:

```bash
# Database
DATABASE_URL="mysql://user:password@localhost:3306/insurance_crm"

# JWT Authentication
JWT_SECRET="your-secure-jwt-secret-here"
JWT_EXPIRATION="7d"

# Encryption (CRITICAL - Generate a secure key)
ENCRYPTION_KEY="generate-with: node -e 'console.log(require(\"crypto\").randomBytes(32).toString(\"hex\"))'"

# Widget Authentication
WIDGET_SECRET="generate-with: node -e 'console.log(require(\"crypto\").randomBytes(32).toString(\"hex\"))'"

# API Configuration
API_URL="https://your-api-domain.com"
```

### 2. Generate Encryption Keys

```bash
# Generate ENCRYPTION_KEY
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate WIDGET_SECRET
node -e "console.log('WIDGET_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Database Migration

```bash
# Generate Prisma client
npm run prisma:generate

# Create migration for tenantId on AITrainingData
npx prisma migrate dev --name add-tenant-to-ai-training-data

# Apply migrations
npm run prisma:migrate
```

### 4. Update Existing Data (if applicable)

If you have existing data without `tenantId`, you'll need to assign records to tenants:

```sql
-- Example: Assign all existing training data to a specific tenant
UPDATE ai_training_data
SET tenantId = 'your-tenant-id-here'
WHERE tenantId IS NULL;
```

## Usage Guide

### Creating a New Tenant

```typescript
const tenant = await prisma.tenant.create({
  data: {
    name: 'Acme Insurance Agency',
    subdomain: 'acme',
    plan: 'pro',
    status: 'active',
    maxUsers: 50,
    maxLeads: 50000,
  },
});
```

### Creating a Tenant Admin User

```typescript
const adminUser = await prisma.user.create({
  data: {
    email: 'admin@acme.com',
    password: hashedPassword,
    firstName: 'John',
    lastName: 'Doe',
    role: 'ADMIN',
    tenantId: tenant.id,
    isSuperAdmin: false, // Regular tenant admin
  },
});
```

### Creating a Super Admin (Platform Admin)

```typescript
const superAdmin = await prisma.user.create({
  data: {
    email: 'platform-admin@system.com',
    password: hashedPassword,
    firstName: 'Platform',
    lastName: 'Admin',
    role: 'ADMIN',
    tenantId: null, // No tenant association
    isSuperAdmin: true, // Can access all tenants
  },
});
```

### Configuring Tenant Settings

```typescript
// Via API endpoint: POST /settings/multiple
{
  "settings": [
    {
      "category": "SMTP",
      "key": "host",
      "value": "smtp.gmail.com"
    },
    {
      "category": "SMTP",
      "key": "password",
      "value": "app-specific-password", // Auto-encrypted
      "isEncrypted": true
    },
    {
      "category": "WHATSAPP",
      "key": "phoneNumberId",
      "value": "1234567890"
    },
    {
      "category": "WHATSAPP",
      "key": "accessToken",
      "value": "EAABsbCS1iHgBO...", // Auto-encrypted
      "isEncrypted": true
    }
  ]
}
```

### Setting Up Widget

1. **Generate Widget Token (Backend)**:

```typescript
// Via API: GET /ai/widget/config/settings
// This returns the widget configuration with signed token
```

2. **Embed Widget (Frontend)**:

```html
<script>
  window.insuranceChatWidget = {
    widgetId: 'default',
    widgetToken: 'eyJhbGc...', // From backend
    apiUrl: 'https://your-api-domain.com',
  };
</script>
<script src="https://your-api-domain.com/widget/chatbot-widget.js"></script>
```

### WhatsApp Webhook Setup

Each tenant gets their own webhook URL:

```
GET/POST https://your-api-domain.com/whatsapp/webhook/{tenantId}
```

**Webhook Verification Token**: Store in tenant settings under `WHATSAPP.verifyToken`

**Facebook Configuration**:
1. Go to Meta Developer Console
2. Configure webhook URL: `https://your-api-domain.com/whatsapp/webhook/{tenantId}`
3. Set verify token (from tenant settings)
4. Subscribe to `messages` events

## User Roles and Permissions

### Super Admin
- `isSuperAdmin: true`
- Can access ALL tenants
- Can create/manage tenants
- Can view/edit all data across tenants

### Tenant Admin (ADMIN role)
- `role: ADMIN`, `isSuperAdmin: false`
- Can access only their tenant's data
- Can manage users within their tenant
- Can configure tenant settings

### Manager (MANAGER role)
- Can view/edit leads, tasks, campaigns
- Cannot manage users or settings

### Agent (AGENT role)
- Can view assigned leads
- Can update lead status
- Limited access to reports

## API Security Checklist

- [x] All database models have `tenantId` (except system tables)
- [x] Prisma middleware enforces tenant scoping
- [x] TenantGuard validates tenant boundaries
- [x] JWT tokens include `tenantId` claim
- [x] Public endpoints (webhooks) validate tenant from URL
- [x] Widget endpoints validate signed tokens
- [x] Sensitive settings encrypted at rest
- [x] User management scoped to tenant
- [x] No default/fallback tenant IDs in code

## Testing Multi-Tenancy

### Test Cross-Tenant Access (Should Fail)

```bash
# Login as Tenant A user
TOKEN_A=$(curl -X POST /auth/login -d '{"email":"tenanta@example.com","password":"pass"}' | jq -r .token)

# Try to access Tenant B's lead (Should return 404 or 403)
curl -H "Authorization: Bearer $TOKEN_A" /leads/{tenant-b-lead-id}
# Expected: 404 Not Found or 403 Forbidden
```

### Test Widget Token Validation

```bash
# Try to use widget without token
curl -X POST /ai/widget/chat -d '{"message":"hello","conversationId":"test"}'
# Expected: 400 Bad Request (missing token)

# Try with invalid token
curl -X POST /ai/widget/chat -d '{"message":"hello","conversationId":"test","widgetToken":"invalid"}'
# Expected: 401 Unauthorized
```

### Test Settings Encryption

```bash
# Set a password setting
curl -X POST /settings -H "Authorization: Bearer $TOKEN" -d '{
  "category": "SMTP",
  "key": "password",
  "value": "my-secret-password",
  "isEncrypted": true
}'

# Check database - password should be encrypted
SELECT * FROM tenants WHERE id = 'tenant-id';
# settings.credentials.smtp.password should be in format: "iv:encrypted:tag"
```

## Troubleshooting

### Error: "Tenant context required for this operation"

**Cause**: Prisma middleware blocking query without tenant context

**Solution**:
1. Ensure user is authenticated
2. Verify JWT includes `tenantId` claim
3. Check TenantMiddleware is applied to route
4. For webhooks, ensure WebhookTenantMiddleware is configured

### Error: "Invalid widget token"

**Cause**: Widget token verification failed

**Solution**:
1. Regenerate widget token from backend
2. Ensure `WIDGET_SECRET` is set in .env
3. Check token hasn't expired (24hr default TTL)
4. Verify domain restriction matches

### Settings Not Decrypting

**Cause**: Encryption key mismatch

**Solution**:
1. Ensure `ENCRYPTION_KEY` in .env is the same as when data was encrypted
2. Never change `ENCRYPTION_KEY` without re-encrypting existing data
3. Check encryption service logs for errors

### Users Seeing Wrong Data

**Cause**: Tenant middleware not running or JWT missing tenantId

**Solution**:
1. Check user's JWT payload includes `tenantId`
2. Verify TenantMiddleware is in app.module.ts middleware chain
3. Check Prisma middleware is enabled (logs "✅ Tenant middleware enabled")

## Migration from Single-Tenant

If you're migrating from a single-tenant system:

1. **Backup your database**
2. **Create a default tenant**:
   ```sql
   INSERT INTO tenants (id, name, subdomain, status)
   VALUES ('default-tenant-001', 'Default Agency', 'default', 'active');
   ```

3. **Update all existing records**:
   ```sql
   UPDATE users SET tenantId = 'default-tenant-001' WHERE tenantId IS NULL;
   UPDATE leads SET tenantId = 'default-tenant-001' WHERE tenantId IS NULL;
   UPDATE clients SET tenantId = 'default-tenant-001' WHERE tenantId IS NULL;
   -- ... repeat for all tenant-scoped tables
   ```

4. **Make tenantId NOT NULL** (after data migration):
   ```sql
   ALTER TABLE leads MODIFY tenantId VARCHAR(191) NOT NULL;
   ALTER TABLE clients MODIFY tenantId VARCHAR(191) NOT NULL;
   -- ... repeat for all tenant-scoped tables
   ```

## Support

For issues or questions about multi-tenancy:
1. Check this guide first
2. Review error logs for security violations
3. Test with a super admin account to isolate tenant-specific issues
4. Verify environment variables are set correctly

## Security Best Practices

1. **Never** expose tenantId in frontend URLs
2. **Always** validate tenant ownership on the backend
3. **Rotate** encryption keys periodically
4. **Monitor** logs for "SECURITY VIOLATION" messages
5. **Test** cross-tenant access regularly
6. **Use** super admin accounts only for platform administration
7. **Encrypt** all sensitive settings
8. **Validate** webhook signatures to prevent spoofing
