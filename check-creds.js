const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCredentials() {
  try {
    const cred = await prisma.whatsAppCredential.findFirst({
      where: { tenantId: '3524cf31-27c7-42ef-a93f-e622924bf613' }
    });

    if (!cred) {
      console.log('No credentials found for this tenant');
      return;
    }

    console.log('Credential ID:', cred.id);
    console.log('Access Token:', cred.accessToken);
    console.log('Token Length:', cred.accessToken.length);
    console.log('Token Parts:', cred.accessToken.split(':').length);
    console.log('First 50 chars:', cred.accessToken.substring(0, 50));

    // Check if it looks encrypted
    const parts = cred.accessToken.split(':');
    if (parts.length === 2) {
      console.log('\nFormat: OLD (2 parts - aes-256-cbc)');
      console.log('IV length:', parts[0].length);
      console.log('Encrypted data length:', parts[1].length);
    } else if (parts.length === 3) {
      console.log('\nFormat: NEW (3 parts - aes-256-gcm)');
      console.log('IV length:', parts[0].length);
      console.log('Encrypted data length:', parts[1].length);
      console.log('Auth tag length:', parts[2].length);
    } else {
      console.log('\nFormat: PLAIN TEXT or UNKNOWN');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCredentials();
