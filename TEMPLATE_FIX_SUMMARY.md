# WhatsApp Template OAuth Error Fix

## Problem
When trying to submit or resubmit WhatsApp templates to Meta for approval, the system was returning:
```
Failed to resubmit template to Meta: Request failed with status code 401
error: {
  message: 'Invalid OAuth access token - Cannot parse access token',
  type: 'OAuthException',
  code: 190,
  fbtrace_id: 'AtOsat2mVRF83YvoflkfOp4'
}
```

## Root Cause
The system had **two different credential storage mechanisms**:

### 1. Legacy System (WORKING)
- **Location**: `tenant.settings.credentials.whatsapp` (JSON field)
- **Used by**: Message sending, conversation management
- **Service**: `WhatsAppTenantService.getAccessToken()`
- **Status**: ✅ Working correctly

### 2. New System (NOT POPULATED)
- **Location**: `whatsapp_credentials` table
- **Used by**: Template submission (before fix)
- **Status**: ❌ Only 1 record, most tenants have no data here

The template service was trying to fetch credentials from the `whatsapp_credentials` table, which was empty for most tenants. This is why the same access token worked for sending messages but failed for template submission.

## Solution
Modified `WhatsAppTemplateService` to use `WhatsAppTenantService` instead of directly querying the `whatsapp_credentials` table.

### Changes Made

**File**: `src/whatsapp/whatsapp-template.service.ts`

#### 1. Added WhatsAppTenantService Injection
```typescript
import { WhatsAppTenantService } from './whatsapp-tenant.service';

constructor(
  private configService: ConfigService,
  private prisma: PrismaService,
  private whatsappTenantService: WhatsAppTenantService, // Added
) { }
```

#### 2. Updated `submitToMeta` Method
**Before:**
```typescript
const credential = await this.prisma.whatsAppCredential.findFirst({
  where: { tenantId, isActive: true, isDefault: true },
});
const accessToken = credential?.accessToken?.trim();
const businessAccountId = credential?.businessAccountId?.trim();
```

**After:**
```typescript
const accessToken = await this.whatsappTenantService.getAccessToken(tenantId);
if (!accessToken) {
  throw new BadRequestException('No active WhatsApp credentials found. Please configure WhatsApp in settings.');
}

const credentials = await this.whatsappTenantService.getTenantCredentials(tenantId);
const businessAccountId = credentials?.businessAccountId;
```

#### 3. Updated `resubmitToMeta` Method
Same pattern as `submitToMeta` - replaced direct database query with `WhatsAppTenantService` calls.

#### 4. Updated `getTemplateStatus` Method
Same pattern - now uses `WhatsAppTenantService.getAccessToken()`.

## Benefits
1. ✅ Template submission now uses the same credential source as message sending
2. ✅ No more OAuth token errors
3. ✅ Consistent credential handling across all WhatsApp features
4. ✅ Supports encrypted tokens (via `WhatsAppTenantService`)
5. ✅ No need to populate `whatsapp_credentials` table

## Testing
Run the test script to verify credentials are accessible:
```bash
node test-template-credentials.js
```

## Database State
- **tenant.settings.credentials.whatsapp**: Contains credentials for 2 tenants (ACTIVE)
- **whatsapp_credentials table**: Contains 1 record (NOT USED by template service anymore)

## Related Files
- `src/whatsapp/whatsapp-template.service.ts` - Main fix
- `src/whatsapp/whatsapp-tenant.service.ts` - Credential provider
- `src/whatsapp/whatsapp.module.ts` - Module configuration (already had WhatsAppTenantService)
- `test-template-credentials.js` - Verification script

## Next Steps
You can now:
1. Create WhatsApp templates
2. Submit them to Meta for approval
3. Resubmit rejected templates
4. Check template status

All operations will use the correct tenant-specific credentials from `tenant.settings`.
