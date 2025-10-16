import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { PrismaService } from '../common/services/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import Imap = require('node-imap');
import { simpleParser } from 'mailparser';
import { Readable } from 'stream';

interface ImapConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
  tlsOptions: {
    rejectUnauthorized: boolean;
  };
}

@Injectable()
export class EmailFetcherService {
  private readonly logger = new Logger(EmailFetcherService.name);
  private imap: Imap | null = null;
  private isConnected = false;
  private currentTenantId: string | null = null;

  constructor(
    private configService: ConfigService,
    private emailService: EmailService,
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  private async getImapConfig(tenantId: string): Promise<ImapConfig | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    if (!tenant || !tenant.settings) {
      this.logger.warn(`No tenant found or no settings for tenant ${tenantId}`);
      return null;
    }

    const settings = tenant.settings as any;

    // Try IMAP settings first, then fall back to SMTP/email settings
    let emailCreds = settings.credentials?.imap || settings.credentials?.email || settings.credentials?.smtp;

    if (!emailCreds || !emailCreds.user || !emailCreds.pass || !emailCreds.host) {
      this.logger.warn(`Incomplete email credentials for tenant ${tenantId}. Available: ${Object.keys(settings.credentials || {}).join(', ')}`);
      return null;
    }

    // DECRYPT the password if it's encrypted
    let password = emailCreds.pass;
    if (this.encryptionService.isEncrypted(password)) {
      try {
        password = this.encryptionService.decrypt(password);
        this.logger.log(`Password decrypted successfully for ${emailCreds.user}`);
      } catch (error) {
        this.logger.error(`Failed to decrypt password for tenant ${tenantId}:`, error);
        return null;
      }
    }

    // For SMTP settings, IMAP typically uses same host
    const imapHost = emailCreds.imapHost || emailCreds.host;
    const imapPort = emailCreds.imapPort || 993; // Default IMAP SSL port

    this.logger.log(`IMAP Config: ${emailCreds.user}@${imapHost}:${imapPort}`);

    return {
      user: emailCreds.user,
      password: password,
      host: imapHost,
      port: imapPort,
      tls: true,
      tlsOptions: {
        rejectUnauthorized: false,
      },
    };
  }

  async connectToImap(tenantId: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      try {
        const config = await this.getImapConfig(tenantId);
        if (!config) {
          this.logger.error(`Cannot connect to IMAP: No valid credentials for tenant ${tenantId}`);
          resolve(false);
          return;
        }

        this.currentTenantId = tenantId;
        this.logger.log('Attempting IMAP connection with config:', {
          user: config.user,
          host: config.host,
          port: config.port,
          tls: config.tls,
        });

        this.imap = new Imap(config);

        this.imap.once('ready', () => {
          this.logger.log('IMAP connection ready');
          this.isConnected = true;
          resolve(true);
        });

        this.imap.once('error', (err: Error) => {
          this.logger.error('IMAP connection error:', err.message);
          this.logger.error('Full error details:', err);
          this.isConnected = false;
          resolve(false);
        });

        this.imap.once('end', () => {
          this.logger.log('IMAP connection ended');
          this.isConnected = false;
        });

        this.imap.connect();
      } catch (error) {
        this.logger.error('Failed to initialize IMAP connection:', error);
        resolve(false);
      }
    });
  }

  async fetchNewEmails(tenantId: string): Promise<void> {
    if (!this.isConnected || !this.imap || this.currentTenantId !== tenantId) {
      const connected = await this.connectToImap(tenantId);
      if (!connected) {
        this.logger.error('Could not connect to IMAP server');
        return;
      }
    }

    return new Promise((resolve, reject) => {
      this.imap!.openBox('INBOX', false, (err, box) => {
        if (err) {
          this.logger.error('Error opening INBOX:', err);
          reject(err);
          return;
        }

        // Fetch emails from the last 7 days
        const since = new Date();
        since.setDate(since.getDate() - 7);
        
        // First try to get unseen emails, if none found, get recent emails
        const searchCriteria = ['UNSEEN']; // Only fetch unseen (new) emails
        // Alternative: ['SINCE', since] to fetch emails since a specific date

        this.imap!.search(searchCriteria, (err, results) => {
          if (err) {
            this.logger.error('Error searching emails:', err.message);
            this.logger.error('Search error details:', err);
            reject(err);
            return;
          }

          if (!results || results.length === 0) {
            this.logger.log('No unseen emails found, checking recent emails...');
            
            // Fallback: search for ALL emails and filter by date locally
            this.imap!.search(['ALL'], (recentErr, recentResults) => {
              if (recentErr) {
                this.logger.error('Error searching all emails:', recentErr.message);
                resolve();
                return;
              }
              
              if (!recentResults || recentResults.length === 0) {
                this.logger.log('No emails found in mailbox');
                resolve();
                return;
              }
              
              // Get last 10 emails to check if any are recent and not yet processed
              const recentEmailIds = recentResults.slice(-10);
              this.logger.log(`Found ${recentResults.length} total emails, checking last ${recentEmailIds.length} emails`);
              this.processEmailResults(recentEmailIds, resolve);
            });
            return;
          }

          this.logger.log(`Found ${results.length} new emails`);
          this.processEmailResults(results, resolve);
        });
      });
    });
  }

  private processEmailResults(results: number[], resolve: () => void): void {
    const fetch = this.imap!.fetch(results, {
      bodies: '',
      markSeen: false, // Don't mark as seen to avoid duplicates when checking for recent emails
    });

    let processedCount = 0;

    fetch.on('message', (msg, seqno) => {
      this.logger.log(`Processing email ${seqno}`);
      
      msg.on('body', (stream, info) => {
        this.parseEmailStream(stream)
          .then(() => {
            processedCount++;
            if (processedCount === results.length) {
              resolve();
            }
          })
          .catch((parseErr) => {
            this.logger.error('Error parsing email:', parseErr);
            processedCount++;
            if (processedCount === results.length) {
              resolve();
            }
          });
      });

      msg.once('attributes', (attrs) => {
        this.logger.debug(`Email attributes:`, attrs);
      });

      msg.once('end', () => {
        this.logger.debug(`Finished processing email ${seqno}`);
      });
    });

    fetch.once('error', (fetchErr) => {
      this.logger.error('Fetch error:', fetchErr);
      resolve(); // Still resolve to avoid hanging
    });

    fetch.once('end', () => {
      this.logger.log('Finished fetching emails');
    });
  }

  private async parseEmailStream(stream: NodeJS.ReadableStream): Promise<void> {
    try {
      const parsed = await simpleParser(stream as Readable);

      const emailData = {
        from: parsed.from?.text || '',
        to: parsed.to?.text || '',
        subject: parsed.subject || 'No Subject',
        content: parsed.html || parsed.text || '',
        messageId: parsed.messageId,
        inReplyTo: parsed.inReplyTo,
        cc: parsed.cc?.text ? [parsed.cc.text] : undefined,
        bcc: parsed.bcc?.text ? [parsed.bcc.text] : undefined,
        date: parsed.date,
      };

      // Extract thread ID from references or generate one
      let threadId = parsed.references ? parsed.references[0] : undefined;
      if (parsed.inReplyTo && !threadId) {
        threadId = parsed.inReplyTo;
      }

      // Import tenant context
      const { tenantContext } = require('../common/context/tenant-context');

      // Run in tenant context
      await tenantContext.run(
        {
          tenantId: this.currentTenantId,
          userId: null,
          isSuperAdmin: false
        },
        async () => {
          await this.emailService.handleIncomingEmail({
            ...emailData,
            threadId,
          });
        }
      );

      this.logger.log(`Successfully processed email: ${emailData.subject}`);
    } catch (error) {
      this.logger.error('Error parsing email:', error);
      throw error;
    }
  }

  async disconnectImap(): Promise<void> {
    if (this.imap && this.isConnected) {
      return new Promise((resolve) => {
        this.imap!.once('end', () => {
          this.logger.log('IMAP disconnected');
          this.isConnected = false;
          resolve();
        });
        this.imap!.end();
      });
    }
  }

  async testConnection(tenantId: string): Promise<boolean> {
    const connected = await this.connectToImap(tenantId);
    if (connected) {
      await this.disconnectImap();
    }
    return connected;
  }

  // Method to manually trigger email fetching (useful for testing)
  async fetchEmailsNow(tenantId: string): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      await this.fetchNewEmails(tenantId);
      return { success: true };
    } catch (error) {
      this.logger.error('Manual email fetch failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

}