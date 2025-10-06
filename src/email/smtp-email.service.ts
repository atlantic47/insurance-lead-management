import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class SmtpEmailService {
  private readonly logger = new Logger(SmtpEmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
  ) {
    this.createTransporter();
  }

  private async createTransporter() {
    // Try to get settings from database first, fallback to env variables
    const smtpHost = await this.settingsService.getSetting('SMTP', 'host') || this.configService.get<string>('SMTP_HOST');
    const smtpPort = await this.settingsService.getSetting('SMTP', 'port') || this.configService.get<string>('SMTP_PORT', '465');
    const smtpSecure = await this.settingsService.getSetting('SMTP', 'secure') || this.configService.get<string>('SMTP_SECURE', 'true');
    const smtpUser = await this.settingsService.getSetting('SMTP', 'user') || this.configService.get<string>('SMTP_USER');
    const smtpPass = await this.settingsService.getSetting('SMTP', 'pass') || this.configService.get<string>('SMTP_PASS');

    // Use custom SMTP server configuration
    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpSecure === 'true', // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        // Do not fail on invalid certs for development
        rejectUnauthorized: false,
      },
    });
  }

  async refreshTransporter() {
    // Call this method to refresh SMTP settings after user updates them
    await this.createTransporter();
  }

  async sendEmail(emailData: {
    to: string;
    subject: string;
    html: string;
    from?: string;
    cc?: string[];
    bcc?: string[];
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType?: string;
    }>;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const smtpFrom = await this.settingsService.getSetting('SMTP', 'from') || this.configService.get<string>('SMTP_FROM') || 'noreply@insurance.com';

      const mailOptions = {
        from: emailData.from || smtpFrom,
        to: emailData.to,
        cc: emailData.cc,
        bcc: emailData.bcc,
        subject: emailData.subject,
        html: emailData.html,
        attachments: emailData.attachments,
      };

      this.logger.log(`Sending email to ${emailData.to} with subject: ${emailData.subject}`);

      const info = await this.transporter.sendMail(mailOptions);

      this.logger.log(`Email sent successfully: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection successful');
      return true;
    } catch (error) {
      this.logger.error(`SMTP connection failed: ${error.message}`);
      return false;
    }
  }
}