const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Test old format decryption
 */

class OldDecryption {
  constructor() {
    // Get encryption key from environment
    const envKey = process.env.ENCRYPTION_KEY;
    if (envKey) {
      this.encryptionKey = Buffer.from(envKey, 'hex');
    } else {
      console.error('❌ ENCRYPTION_KEY not found in environment');
      process.exit(1);
    }
  }

  decryptOldFormat(encryptedData) {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid old encryption format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      // Old format used aes-256-cbc
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
}

async function test() {
  try {
    console.log('\n=== Testing Old Format Decryption ===\n');

    const decryptor = new OldDecryption();

    // Get credential from database
    const credential = await prisma.whatsAppCredential.findFirst();

    if (!credential) {
      console.log('❌ No credentials found');
      return;
    }

    console.log('Encrypted token:', credential.accessToken.substring(0, 60) + '...');
    console.log('Token format: 2 parts (old format)\n');

    try {
      const decrypted = decryptor.decryptOldFormat(credential.accessToken);
      console.log('✅ Decryption successful!');
      console.log('Decrypted token preview:', decrypted.substring(0, 30) + '...');
      console.log('Decrypted token length:', decrypted.length);
      console.log('\nThis token should now work with Meta API!');
    } catch (error) {
      console.log('❌ Decryption failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
