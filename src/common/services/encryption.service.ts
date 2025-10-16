import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits
  private readonly saltLength = 64;
  private readonly iterations = 100000;
  private readonly digest = 'sha512';

  private encryptionKey: Buffer;

  constructor(private configService: ConfigService) {
    // Get encryption key from environment or generate one
    const envKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (envKey) {
      this.encryptionKey = Buffer.from(envKey, 'hex');
    } else {
      // Generate a key (this should be stored in .env in production)
      this.encryptionKey = crypto.randomBytes(this.keyLength);
      console.warn(
        '⚠️  No ENCRYPTION_KEY found in environment. Generated temporary key:',
        this.encryptionKey.toString('hex')
      );
      console.warn(
        '⚠️  Add this to your .env file as ENCRYPTION_KEY=' + this.encryptionKey.toString('hex')
      );
    }
  }

  /**
   * Encrypt sensitive data
   * @param plaintext - The data to encrypt
   * @returns Encrypted string with format: iv:encryptedData:authTag (all hex encoded)
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      return '';
    }

    try {
      // Generate random IV for each encryption
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Return format: iv:encryptedData:authTag (all hex encoded)
      return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt encrypted data
   * @param encryptedData - The encrypted string (format: iv:encryptedData:authTag)
   * @returns Decrypted plaintext string
   */
  decrypt(encryptedData: string): string {
    if (!encryptedData) {
      return '';
    }

    try {
      // Parse the encrypted data
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const authTag = Buffer.from(parts[2], 'hex');

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt the data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash a password with salt (for password storage)
   * @param password - Plain text password
   * @returns Hashed password with format: salt:hash (both hex encoded)
   */
  hashPassword(password: string): string {
    const salt = crypto.randomBytes(this.saltLength);
    const hash = crypto.pbkdf2Sync(
      password,
      salt,
      this.iterations,
      this.keyLength,
      this.digest
    );

    return `${salt.toString('hex')}:${hash.toString('hex')}`;
  }

  /**
   * Verify a password against a hash
   * @param password - Plain text password to verify
   * @param hashedPassword - Hashed password (format: salt:hash)
   * @returns True if password matches
   */
  verifyPassword(password: string, hashedPassword: string): boolean {
    try {
      const parts = hashedPassword.split(':');
      if (parts.length !== 2) {
        return false;
      }

      const salt = Buffer.from(parts[0], 'hex');
      const originalHash = parts[1];

      const hash = crypto.pbkdf2Sync(
        password,
        salt,
        this.iterations,
        this.keyLength,
        this.digest
      );

      return hash.toString('hex') === originalHash;
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Generate a secure random token (for API keys, etc.)
   * @param length - Length of the token in bytes (default: 32)
   * @returns Hex-encoded random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash data using SHA-256 (for checksums, etc.)
   * @param data - Data to hash
   * @returns Hex-encoded hash
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Encrypt an object (converts to JSON first)
   * @param obj - Object to encrypt
   * @returns Encrypted string
   */
  encryptObject<T>(obj: T): string {
    const json = JSON.stringify(obj);
    return this.encrypt(json);
  }

  /**
   * Decrypt to an object (parses JSON after decryption)
   * @param encryptedData - Encrypted string
   * @returns Decrypted object
   */
  decryptObject<T>(encryptedData: string): T {
    const json = this.decrypt(encryptedData);
    return JSON.parse(json) as T;
  }

  /**
   * Mask sensitive data for logging (shows first 4 and last 4 characters)
   * @param data - Sensitive data to mask
   * @returns Masked string
   */
  maskSensitiveData(data: string): string {
    if (!data || data.length <= 8) {
      return '****';
    }
    return `${data.substring(0, 4)}${'*'.repeat(data.length - 8)}${data.substring(data.length - 4)}`;
  }

  /**
   * Check if data is encrypted (based on format)
   * @param data - Data to check
   * @returns True if data appears to be encrypted
   */
  isEncrypted(data: string): boolean {
    if (!data) {
      return false;
    }
    // Check if it matches the encrypted format (3 parts separated by colons)
    const parts = data.split(':');
    return parts.length === 3 && parts.every(part => /^[0-9a-f]+$/i.test(part));
  }
}
