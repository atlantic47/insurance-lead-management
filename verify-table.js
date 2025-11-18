const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = '3524cf31-27c7-42ef-a93f-e622924bf613';

async function verifyTable() {
  try {
    console.log('\n=== CHECKING whatsapp_credentials TABLE ===\n');

    const credentials = await prisma.whatsAppCredential.findMany({
      where: { tenantId: TENANT_ID }
    });

    if (credentials.length === 0) {
      console.log('❌ NO CREDENTIALS FOUND in whatsapp_credentials table for this tenant!');
      console.log('This is the problem - the table is empty or has wrong tenantId');
      return;
    }

    console.log(`✅ Found ${credentials.length} credential(s) in whatsapp_credentials table:\n`);

    for (const cred of credentials) {
      console.log('---');
      console.log('ID:', cred.id);
      console.log('Tenant ID:', cred.tenantId);
      console.log('Name:', cred.name);
      console.log('Phone Number:', cred.phoneNumber);
      console.log('Phone Number ID:', cred.phoneNumberId);
      console.log('Business Account ID:', cred.businessAccountId);
      console.log('Is Default:', cred.isDefault);
      console.log('Is Active:', cred.isActive);
      console.log('Access Token (first 50):', cred.accessToken?.substring(0, 50) + '...');
      console.log('Access Token Length:', cred.accessToken?.length);
      console.log('App Secret:', cred.appSecret);
      console.log('Webhook URL:', cred.webhookUrl);
      console.log('Webhook Verify Token:', cred.webhookVerifyToken);
      console.log('---\n');
    }

    // Now check what the service would actually fetch
    console.log('=== SIMULATING SERVICE QUERY ===\n');
    const activeDefault = await prisma.whatsAppCredential.findFirst({
      where: {
        tenantId: TENANT_ID,
        isActive: true,
        isDefault: true
      },
    });

    if (activeDefault) {
      console.log('✅ Service WILL find this credential:');
      console.log('ID:', activeDefault.id);
      console.log('Access Token (first 50):', activeDefault.accessToken?.substring(0, 50) + '...');
      console.log('Access Token Length:', activeDefault.accessToken?.length);
      console.log('Business Account ID:', activeDefault.businessAccountId);
    } else {
      console.log('❌ Service WILL NOT find any credential!');
      console.log('Reason: No credential with isActive=true AND isDefault=true');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTable();
