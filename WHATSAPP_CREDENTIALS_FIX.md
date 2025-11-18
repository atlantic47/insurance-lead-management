# WhatsApp Template OAuth Error - Solution

## Problem
Template submission is failing with OAuth error because:
1. The access token in `whatsapp_credentials` table is encrypted with OLD encryption format (2 parts: `iv:encryptedData`)
2. Current `EncryptionService` expects NEW format (3 parts: `iv:encryptedData:authTag`)
3. The `isEncrypted()` method returns `false` for old format, so the encrypted token is sent as-is to Meta API, causing OAuth error

## Why This Happened
Your credentials were likely saved with an older version of the encryption service that used a different algorithm (probably `aes-256-cbc` instead of current `aes-256-gcm`).

## Solution
**Re-save your WhatsApp credentials in the Settings page**. This will:
1. Re-encrypt the token with the NEW encryption format
2. Make it compatible with the current `EncryptionService.decrypt()` method
3. Fix template submission

## Steps
1. Go to Settings > WhatsApp Configuration
2. Re-enter your WhatsApp credentials:
   - Business Account ID: `237160286155883`
   - Phone Number ID: `271219419402280`
   - Access Token: Your current Meta access token
3. Save the settings

This will re-encrypt the credentials with the current encryption format.

## Alternative: Manual Database Update
If you have the plain text access token, you can update it directly in the database. The system will encrypt it automatically when you save it through the settings page.

## Technical Details
**Current token in database:**
```
Format: iv:encryptedData (2 parts)
Length: 191 characters
Example: 1af7a0fcad49238400c25bef71438f57:a65a45050fbdbb37c...
```

**Expected format:**
```
Format: iv:encryptedData:authTag (3 parts)
Encryption: aes-256-gcm
```

**Current `EncryptionService.isEncrypted()` check:**
```typescript
isEncrypted(data: string): boolean {
  const parts = data.split(':');
  return parts.length === 3 && parts.every(part => /^[0-9a-f]+$/i.test(part));
}
```

Your token has 2 parts, so `isEncrypted()` returns `false`, and the system tries to use the encrypted string as a plain token.

## Files Modified
- `src/whatsapp/whatsapp-template.service.ts` - Now uses `whatsapp_credentials` table with decryption
- All three methods updated: `submitToMeta`, `resubmitToMeta`, `getTemplateStatus`

## After Re-saving Credentials
Template submission will work because:
1. `isEncrypted()` will return `true` (3 parts detected)
2. `decrypt()` will successfully decrypt the token
3. Meta API will receive the correct plain text access token
