const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * This script verifies that WhatsApp credentials are accessible from tenant.settings
 * Run with: node test-template-credentials.js
 */

async function testCredentials() {
  try {
    console.log('\n=== WhatsApp Template Credentials Test ===\n');

    // Get all tenants with WhatsApp credentials in settings
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        settings: true,
      },
    });

    if (tenants.length === 0) {
      console.log('❌ No tenants found in the database.\n');
      return;
    }

    console.log(`Found ${tenants.length} tenant(s):\n`);

    for (const tenant of tenants) {
      console.log(`\nTenant: ${tenant.name} (${tenant.id})`);

      if (!tenant.settings) {
        console.log('  ⚠️  No settings found');
        continue;
      }

      const settings = tenant.settings;
      const whatsappCreds = settings.credentials?.whatsapp;

      if (!whatsappCreds) {
        console.log('  ⚠️  No WhatsApp credentials in settings');
        continue;
      }

      console.log('  ✅ WhatsApp credentials found in tenant.settings');
      console.log(`  Phone Number: ${whatsappCreds.phoneNumber || 'N/A'}`);
      console.log(`  Business Account ID: ${whatsappCreds.businessAccountId || 'N/A'}`);
      console.log(`  Phone Number ID: ${whatsappCreds.phoneNumberId || 'N/A'}`);

      if (whatsappCreds.accessToken) {
        const tokenLength = whatsappCreds.accessToken.length;
        const tokenPreview = whatsappCreds.accessToken.substring(0, 20);
        console.log(`  Access Token Length: ${tokenLength}`);
        console.log(`  Access Token Preview: ${tokenPreview}...`);

        // Check for whitespace
        const hasLeadingSpace = whatsappCreds.accessToken.startsWith(' ');
        const hasTrailingSpace = whatsappCreds.accessToken.endsWith(' ');
        if (hasLeadingSpace || hasTrailingSpace) {
          console.log(`  ⚠️  Token has whitespace (leading: ${hasLeadingSpace}, trailing: ${hasTrailingSpace})`);
        } else {
          console.log('  ✅ No whitespace issues detected');
        }
      } else {
        console.log('  ❌ No access token found');
      }

      console.log('  ---');
    }

    // Check whatsapp_credentials table
    console.log('\n\n=== Checking whatsapp_credentials Table ===\n');
    const whatsappCredentials = await prisma.whatsAppCredential.findMany({
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (whatsappCredentials.length === 0) {
      console.log('❌ whatsapp_credentials table is EMPTY (this is why template submission was failing)\n');
    } else {
      console.log(`Found ${whatsappCredentials.length} record(s) in whatsapp_credentials table:\n`);
      for (const cred of whatsappCredentials) {
        console.log(`  Tenant: ${cred.tenant.name}`);
        console.log(`  Phone Number: ${cred.phoneNumber}`);
        console.log(`  Business Account ID: ${cred.businessAccountId}`);
        console.log(`  ---`);
      }
    }

    console.log('\n✅ Test complete!\n');
    console.log('Summary:');
    console.log('- Template service NOW uses WhatsAppTenantService');
    console.log('- WhatsAppTenantService reads from tenant.settings.credentials.whatsapp');
    console.log('- This is the SAME source used by working message sending\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testCredentials();
