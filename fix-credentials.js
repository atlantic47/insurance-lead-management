const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * This script checks and fixes WhatsApp credentials in the database
 * Run with: node fix-credentials.js
 */

async function fixCredentials() {
  try {
    console.log('\n=== WhatsApp Credentials Database Checker & Fixer ===\n');

    // Get all WhatsApp credentials
    const credentials = await prisma.whatsAppCredential.findMany({
      include: {
        tenant: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    if (credentials.length === 0) {
      console.log('❌ No WhatsApp credentials found in the database.\n');
      return;
    }

    console.log(`Found ${credentials.length} credential record(s):\n`);

    for (const cred of credentials) {
      console.log(`\nTenant: ${cred.tenant.companyName} (${cred.tenant.id})`);
      console.log(`  ID: ${cred.id}`);
      console.log(`  Is Active: ${cred.isActive}`);
      console.log(`  Is Default: ${cred.isDefault}`);
      console.log(`  Business Account ID: ${cred.businessAccountId}`);
      console.log(`  Phone Number ID: ${cred.phoneNumberId}`);

      // Check for whitespace issues
      const hasLeadingSpace = cred.accessToken?.startsWith(' ');
      const hasTrailingSpace = cred.accessToken?.endsWith(' ');
      const hasSpaces = hasLeadingSpace || hasTrailingSpace;

      if (hasSpaces) {
        console.log(`  ⚠️  Access Token has whitespace! (leading: ${hasLeadingSpace}, trailing: ${hasTrailingSpace})`);
        console.log(`  Token length before trim: ${cred.accessToken.length}`);
        console.log(`  Token length after trim: ${cred.accessToken.trim().length}`);

        // Ask if user wants to fix it
        console.log(`\n  Would you like to fix this? This will update the database.`);
        console.log(`  To fix automatically, run: node fix-credentials.js --auto-fix\n`);

        // If --auto-fix flag is provided, fix it
        if (process.argv.includes('--auto-fix')) {
          await prisma.whatsAppCredential.update({
            where: { id: cred.id },
            data: {
              accessToken: cred.accessToken.trim(),
              businessAccountId: cred.businessAccountId?.trim(),
              phoneNumberId: cred.phoneNumberId?.trim(),
            },
          });
          console.log(`  ✅ Fixed! Whitespace removed from credentials.\n`);
        }
      } else {
        console.log(`  ✅ No whitespace issues detected`);
        console.log(`  Token length: ${cred.accessToken?.length || 0}`);
      }

      // Show first 20 characters of token for verification
      if (cred.accessToken) {
        console.log(`  Token preview: ${cred.accessToken.substring(0, 20)}...`);
      }

      console.log('  ---');
    }

    console.log('\n✅ Check complete!\n');

    if (!process.argv.includes('--auto-fix')) {
      console.log('To automatically fix whitespace issues, run:');
      console.log('  node fix-credentials.js --auto-fix\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixCredentials();
