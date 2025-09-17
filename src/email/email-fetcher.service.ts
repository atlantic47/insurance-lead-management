import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
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

  constructor(
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  private getImapConfig(): ImapConfig {
    return {
      user: this.configService.get<string>('EMAIL_USER') || 'sales@pestraid.co.ke',
      password: this.configService.get<string>('EMAIL_PASSWORD') || 'yQzMzSjF[2I%',
      host: this.configService.get<string>('EMAIL_HOST') || 'mail.pestraid.co.ke',
      port: this.configService.get<number>('EMAIL_IMAP_PORT') || 993,
      tls: true,
      tlsOptions: {
        rejectUnauthorized: false, // Set to true in production with proper SSL
      },
    };
  }

  async connectToImap(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const config = this.getImapConfig();
        this.imap = new Imap(config);

        this.imap.once('ready', () => {
          this.logger.log('IMAP connection ready');
          this.isConnected = true;
          resolve(true);
        });

        this.imap.once('error', (err: Error) => {
          this.logger.error('IMAP connection error:', err);
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

  async fetchNewEmails(): Promise<void> {
    if (!this.isConnected || !this.imap) {
      const connected = await this.connectToImap();
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
        
        const searchCriteria = ['UNSEEN']; // Only fetch unseen (new) emails
        // Alternative: ['SINCE', since] to fetch emails since a specific date

        this.imap!.search(searchCriteria, (err, results) => {
          if (err) {
            this.logger.error('Error searching emails:', err);
            reject(err);
            return;
          }

          if (!results || results.length === 0) {
            this.logger.log('No new emails found');
            resolve();
            return;
          }

          this.logger.log(`Found ${results.length} new emails`);
          
          const fetch = this.imap!.fetch(results, {
            bodies: '',
            markSeen: true, // Mark as seen after fetching
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
            reject(fetchErr);
          });

          fetch.once('end', () => {
            this.logger.log('Finished fetching emails');
          });
        });
      });
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

      await this.emailService.handleIncomingEmail({
        ...emailData,
        threadId,
      });

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

  async testConnection(): Promise<boolean> {
    const connected = await this.connectToImap();
    if (connected) {
      await this.disconnectImap();
    }
    return connected;
  }

  // Method to manually trigger email fetching (useful for testing)
  async fetchEmailsNow(): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      await this.fetchNewEmails();
      return { success: true };
    } catch (error) {
      this.logger.error('Manual email fetch failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Schedule regular email fetching (can be called by a cron job)
  async scheduleEmailFetching(): Promise<void> {
    const intervalMs = this.configService.get<number>('EMAIL_FETCH_INTERVAL') || 300000; // 5 minutes default
    
    setInterval(async () => {
      this.logger.log('Starting scheduled email fetch...');
      try {
        await this.fetchNewEmails();
        this.logger.log('Scheduled email fetch completed successfully');
      } catch (error) {
        this.logger.error('Scheduled email fetch failed:', error);
      }
    }, intervalMs);

    this.logger.log(`Email fetching scheduled every ${intervalMs / 1000} seconds`);
  }
}