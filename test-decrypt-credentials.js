const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * This script tests decryption of WhatsApp credentials
 * Run with: node test-decrypt-credentials.js
 */

// Simple encryption service implementation (matching EncryptionService)
class SimpleEncryption {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    // You should use the same encryption key from your .env
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key-here-must-be-32-chars!!';

    // Ensure key is 32 bytes
    if (this.encryptionKey.length !== 32) {
      console.warn('⚠️  ENCRYPTION_KEY must be exactly 32 characters. Padding/truncating...');
      this.encryptionKey = this.encryptionKey.padEnd(32, '0').substring(0, 32);
    }
  }

  isEncrypted(text) {
    // Check if the text matches the encrypted format: "iv:encryptedData"
    return text && text.includes(':') && text.split(':').length === 2;
  }

  decrypt(encryptedText) {
    try {
      const [ivHex, encryptedDataHex] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const encryptedData = Buffer.from(encryptedDataHex, 'hex');

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        Buffer.from(this.encryptionKey),
        iv
      );

      let decrypted = decipher.update(encryptedData);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString();
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
}

async function testDecryption() {
  try {
    console.log('\n=== WhatsApp Credentials Decryption Test ===\n');

    const encryption = new SimpleEncryption();

    // Get WhatsApp credentials
    const credentials = await prisma.whatsAppCredential.findMany({
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (credentials.length === 0) {
      console.log('❌ No WhatsApp credentials found in database.\n');
      return;
    }

    console.log(`Found ${credentials.length} credential record(s):\n`);

    for (const cred of credentials) {
      console.log(`\nTenant: ${cred.tenant.name} (${cred.tenant.id})`);
      console.log(`  Credential ID: ${cred.id}`);
      console.log(`  Phone Number: ${cred.phoneNumber}`);
      console.log(`  Business Account ID: ${cred.businessAccountId}`);
      console.log(`  Phone Number ID: ${cred.phoneNumberId}`);
      console.log(`  Is Active: ${cred.isActive}`);
      console.log(`  Is Default: ${cred.isDefault}`);

      // Check access token
      if (cred.accessToken) {
        const tokenPreview = cred.accessToken.substring(0, 40);
        console.log(`\n  Access Token Preview: ${tokenPreview}...`);
        console.log(`  Access Token Length: ${cred.accessToken.length}`);

        if (encryption.isEncrypted(cred.accessToken)) {
          console.log('  ✅ Token IS encrypted (format: iv:encryptedData)');

          try {
            const decrypted = encryption.decrypt(cred.accessToken.trim());
            console.log(`  ✅ Decryption successful!`);
            console.log(`  Decrypted Token Preview: ${decrypted.substring(0, 20)}...`);
            console.log(`  Decrypted Token Length: ${decrypted.length}`);
          } catch (error) {
            console.log(`  ❌ Decryption FAILED: ${error.message}`);
            console.log(`  This might mean:`);
            console.log(`    1. ENCRYPTION_KEY in .env is incorrect`);
            console.log(`    2. The token was encrypted with a different key`);
          }
        } else {
          console.log('  ⚠️  Token is NOT encrypted (plain text)');
          console.log(`  Token starts with: ${cred.accessToken.substring(0, 20)}...`);
        }
      } else {
        console.log('  ❌ No access token found');
      }

      console.log('  ---');
    }

    console.log('\n✅ Test complete!\n');
    console.log('Summary:');
    console.log('- Template service now uses whatsapp_credentials table');
    console.log('- Tokens are decrypted using EncryptionService');
    console.log('- Make sure ENCRYPTION_KEY in .env matches the key used to encrypt\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testDecryption();
