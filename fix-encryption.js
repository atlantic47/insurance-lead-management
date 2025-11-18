const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * This script helps fix the encryption key issue for WhatsApp credentials
 *
 * TWO OPTIONS:
 *
 * Option 1: Re-save credentials with current ENCRYPTION_KEY
 *   - Will decrypt using old format, re-encrypt with new format
 *
 * Option 2: Just save plain text credentials (no encryption)
 *   - Simpler but less secure
 */

async function main() {
  try {
    console.log('\n=== WhatsApp Credentials Encryption Fix ===\n');

    // Get current credentials
    const credentials = await prisma.whatsAppCredential.findMany();

    if (credentials.length === 0) {
      console.log('❌ No credentials found in database');
      return;
    }

    console.log(`Found ${credentials.length} credential(s):\n`);

    for (const cred of credentials) {
      console.log(`ID: ${cred.id}`);
      console.log(`Tenant ID: ${cred.tenantId}`);
      console.log(`Business Account ID: ${cred.businessAccountId}`);
      console.log(`Phone Number ID: ${cred.phoneNumberId}`);
      console.log(`Is Active: ${cred.isActive}`);
      console.log(`Is Default: ${cred.isDefault}`);
      console.log(`Access Token (encrypted): ${cred.accessToken.substring(0, 50)}...`);
      console.log(`Token length: ${cred.accessToken.length}`);
      console.log(`Token parts: ${cred.accessToken.split(':').length} (${cred.accessToken.split(':').length === 2 ? 'OLD FORMAT' : 'NEW FORMAT'})`);
      console.log('---');
    }

    console.log('\n📋 OPTIONS:\n');
    console.log('1. Save PLAIN TEXT credentials (no encryption)');
    console.log('   - You will manually enter the plain text access token');
    console.log('   - Token will be stored as-is in the database');
    console.log('   - Simplest option, works immediately\n');
    console.log('2. Re-encrypt credentials with current ENCRYPTION_KEY');
    console.log('   - Requires correct ENCRYPTION_KEY in .env');
    console.log('   - Will decrypt old format and re-encrypt with new format');
    console.log('   - More secure but needs correct key\n');
    console.log('3. Cancel\n');

    const choice = await question('Choose option (1, 2, or 3): ');

    if (choice === '1') {
      await savePlainTextCredentials(credentials[0]);
    } else if (choice === '2') {
      await reencryptCredentials(credentials[0]);
    } else {
      console.log('Cancelled');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

async function savePlainTextCredentials(currentCred) {
  console.log('\n=== Save Plain Text Credentials ===\n');
  console.log('This will update the access token with a plain text value.\n');

  const accessToken = await question('Enter your WhatsApp Access Token (from Meta Developer Console): ');

  if (!accessToken || accessToken.trim().length < 10) {
    console.log('❌ Invalid access token');
    return;
  }

  const confirm = await question(`\nUpdate credential ${currentCred.id} with this token? (yes/no): `);

  if (confirm.toLowerCase() !== 'yes') {
    console.log('Cancelled');
    return;
  }

  // Update the credential with plain text token
  await prisma.whatsAppCredential.update({
    where: { id: currentCred.id },
    data: { accessToken: accessToken.trim() }
  });

  console.log('\n✅ Credentials updated successfully!');
  console.log('🔓 Token is stored as plain text (not encrypted)');
  console.log('\n📝 Next steps:');
  console.log('1. Test WhatsApp template submission');
  console.log('2. If it works, you can optionally encrypt later');
}

async function reencryptCredentials(currentCred) {
  console.log('\n=== Re-encrypt Credentials ===\n');

  const envKey = process.env.ENCRYPTION_KEY;

  if (!envKey) {
    console.log('❌ ENCRYPTION_KEY not found in environment');
    console.log('Please add ENCRYPTION_KEY to your .env file and try again');
    return;
  }

  const encryptionKey = Buffer.from(envKey, 'hex');
  console.log(`Using ENCRYPTION_KEY: ${envKey.substring(0, 20)}...`);

  // Try to decrypt the current token
  console.log('\nAttempting to decrypt current token...');

  try {
    const parts = currentCred.accessToken.split(':');

    if (parts.length !== 2) {
      console.log('❌ Token format is not old format (2 parts)');
      return;
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    // Old format used aes-256-cbc
    const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKey, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    console.log('✅ Decryption successful!');
    console.log(`Decrypted token preview: ${decrypted.substring(0, 30)}...`);

    // Now re-encrypt with new format (aes-256-gcm)
    console.log('\nRe-encrypting with new format (aes-256-gcm)...');

    const newIv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, newIv);

    let newEncrypted = cipher.update(decrypted, 'utf8', 'hex');
    newEncrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:encryptedData:authTag
    const newToken = `${newIv.toString('hex')}:${newEncrypted}:${authTag.toString('hex')}`;

    console.log('✅ Re-encryption successful!');
    console.log(`New token format: ${newToken.split(':').length} parts (NEW FORMAT)`);

    const confirm = await question('\nUpdate database with re-encrypted token? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled');
      return;
    }

    // Update the credential
    await prisma.whatsAppCredential.update({
      where: { id: currentCred.id },
      data: { accessToken: newToken }
    });

    console.log('\n✅ Credentials re-encrypted successfully!');
    console.log('🔒 Token is now encrypted with new format (aes-256-gcm)');

  } catch (error) {
    console.log('❌ Decryption failed:', error.message);
    console.log('\nThis means the ENCRYPTION_KEY in your .env does not match the key used to encrypt this token.');
    console.log('\n📝 Options:');
    console.log('1. Find the correct ENCRYPTION_KEY that was used originally');
    console.log('2. Use Option 1 (plain text) to save new credentials');
  }
}

main();
