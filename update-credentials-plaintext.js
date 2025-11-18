const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * This script updates WhatsApp credentials to plain text format
 *
 * It will:
 * 1. Find the credential for your tenant
 * 2. Update it with the plain text access token and app secret you provide
 */

const TENANT_ID = '3524cf31-27c7-42ef-a93f-e622924bf613';
const ACCESS_TOKEN = 'EAAKXjqn05ioBPq08mChifKdeRwWiClQxPyc7ExZCJHCM2uQ3UacC6zkR0XBVGJRHGbeibOZBfg88LEr63HBsopO24IaaIDoKMBbeJtBUR6ly1ZB8b2GezajJVIOvLpEW1M8sJrUrrFeZA9V53OJwHG8kJO4YlHNbQ4jTf5wZAbXuLCi7vvocr7WTSi7kIa9yLiAZDZD';
const APP_SECRET = 'f3a5d532c1b722ef5bca0f0d45792209';

console.log('Token to be stored:');
console.log('Length:', ACCESS_TOKEN.length);
console.log('Full token:', ACCESS_TOKEN);

async function updateCredentials() {
  try {
    console.log('Finding WhatsApp credential for tenant:', TENANT_ID);

    const credential = await prisma.whatsAppCredential.findFirst({
      where: { tenantId: TENANT_ID }
    });

    if (!credential) {
      console.log('❌ No credential found for this tenant');
      return;
    }

    console.log('Found credential:', credential.id);
    console.log('Current access token (first 50 chars):', credential.accessToken.substring(0, 50) + '...');

    // Update with plain text credentials
    const updated = await prisma.whatsAppCredential.update({
      where: { id: credential.id },
      data: {
        accessToken: ACCESS_TOKEN,
        appSecret: APP_SECRET
      }
    });

    console.log('\n✅ Credentials updated successfully!');
    console.log('Access Token (first 50 chars):', updated.accessToken.substring(0, 50) + '...');
    console.log('Access Token Length:', updated.accessToken.length);
    console.log('App Secret:', updated.appSecret);
    console.log('\n📝 Credentials are now stored as PLAIN TEXT (not encrypted)');
    console.log('🔓 This is temporary until ENCRYPTION_KEY is properly configured');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateCredentials();
