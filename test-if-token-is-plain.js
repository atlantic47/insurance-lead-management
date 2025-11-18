const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testToken() {
  try {
    console.log('\n=== Testing if "encrypted" token is actually plain text ===\n');

    const credential = await prisma.whatsAppCredential.findFirst();

    if (!credential) {
      console.log('No credentials found');
      return;
    }

    const token = credential.accessToken;
    const businessAccountId = credential.businessAccountId;

    console.log('Token (looks encrypted):', token.substring(0, 60) + '...');
    console.log('Business Account ID:', businessAccountId);
    console.log('\nTrying to use this token AS-IS (without decryption) with Facebook API...\n');

    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${businessAccountId}`,
        {
          params: {
            access_token: token,  // Using the "encrypted" token directly
            fields: 'id,name',
          },
        }
      );

      console.log('✅ SUCCESS! The token works WITHOUT decryption!');
      console.log('Account Name:', response.data.name);
      console.log('Account ID:', response.data.id);
      console.log('\n🎉 The "encrypted-looking" token is actually a VALID PLAIN TEXT Facebook token!');
      console.log('   It just HAPPENS to have a colon in it, making it look like encrypted format.');

    } catch (error) {
      console.log('❌ FAILED: Token does not work as plain text');
      console.log('Error:', error.response?.data?.error?.message || error.message);
      console.log('\nThis means the token IS encrypted and needs proper decryption.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testToken();
