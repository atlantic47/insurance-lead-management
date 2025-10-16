import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../common/services/prisma.service';
import { getTenantContext } from '../common/context/tenant-context';

@Injectable()
export class SmtpEmailService {
  private readonly logger = new Logger(SmtpEmailService.name);
  private transporters: Map<string, nodemailer.Transporter> = new Map();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  private async createTransporter(tenantId: string): Promise<nodemailer.Transporter | null> {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true },
      });

      if (!tenant || !tenant.settings) {
        this.logger.warn(`No tenant settings found for tenant ${tenantId}`);
        return null;
      }

      const settings = tenant.settings as any;
      const emailCreds = settings.credentials?.email;

      if (!emailCreds || !emailCreds.smtpHost || !emailCreds.smtpUser || !emailCreds.smtpPass) {
        this.logger.warn(`Incomplete SMTP credentials for tenant ${tenantId}`);
        return null;
      }

      const transporter = nodemailer.createTransport({
        host: emailCreds.smtpHost,
        port: parseInt(emailCreds.smtpPort || '465'),
        secure: emailCreds.smtpSecure !== 'false',
        auth: {
          user: emailCreds.smtpUser,
          pass: emailCreds.smtpPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      this.transporters.set(tenantId, transporter);
      return transporter;
    } catch (error) {
      this.logger.error(`Error creating transporter for tenant ${tenantId}:`, error);
      return null;
    }
  }

  private async getTransporter(tenantId: string): Promise<nodemailer.Transporter | null> {
    if (this.transporters.has(tenantId)) {
      return this.transporters.get(tenantId)!;
    }
    return await this.createTransporter(tenantId);
  }

  async refreshTransporter(tenantId: string) {
    this.transporters.delete(tenantId);
    await this.createTransporter(tenantId);
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
      const context = getTenantContext();
      const tenantId = context?.tenantId;

      if (!tenantId) {
        throw new Error('Tenant context required to send email');
      }

      const transporter = await this.getTransporter(tenantId);
      if (!transporter) {
        throw new Error('Unable to create email transporter for tenant');
      }

      // Get tenant email settings for "from" address
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true },
      });

      const settings = tenant?.settings as any;
      const emailCreds = settings?.credentials?.email;
      const smtpFrom = emailCreds?.smtpFrom || emailCreds?.smtpUser || 'noreply@insurance.com';

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

      const info = await transporter.sendMail(mailOptions);

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

  async testConnection(tenantId: string): Promise<boolean> {
    try {
      const transporter = await this.getTransporter(tenantId);
      if (!transporter) {
        this.logger.error(`No transporter available for tenant ${tenantId}`);
        return false;
      }
      await transporter.verify();
      this.logger.log('SMTP connection successful');
      return true;
    } catch (error) {
      this.logger.error(`SMTP connection failed: ${error.message}`);
      return false;
    }
  }
}