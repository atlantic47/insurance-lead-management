import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueService, Job } from '../common/services/queue.service';
import { EmailService } from './email.service';
import { EmailFetcherService } from './email-fetcher.service';
import { ConfigService } from '@nestjs/config';

export interface EmailFetchJobData {
  triggered: 'webhook' | 'scheduled' | 'manual';
  timestamp: Date;
}

export interface EmailProcessJobData {
  emailData: {
    from: string;
    to: string;
    subject: string;
    content: string;
    messageId?: string;
    inReplyTo?: string;
    threadId?: string;
    cc?: string[];
    bcc?: string[];
  };
  source: 'webhook' | 'imap';
}

@Injectable()
export class EmailQueueService implements OnModuleInit {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly emailService: EmailService,
    private readonly emailFetcherService: EmailFetcherService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.registerJobProcessors();
    this.startScheduledEmailFetching();
    this.startJobCleanup();
  }

  private registerJobProcessors() {
    // Register email fetch job processor
    this.queueService.registerProcessor('EMAIL_FETCH', async (job: Job<EmailFetchJobData>) => {
      this.logger.log(`Processing email fetch job: ${job.id}`);
      await this.processEmailFetchJob(job);
    });

    // Register email processing job processor
    this.queueService.registerProcessor('EMAIL_PROCESS', async (job: Job<EmailProcessJobData>) => {
      this.logger.log(`Processing email job: ${job.id}`);
      await this.processEmailJob(job);
    });

    this.logger.log('Email job processors registered successfully');
  }

  // Add email fetch job to queue
  async queueEmailFetch(source: 'webhook' | 'scheduled' | 'manual' = 'manual', delay = 0): Promise<string> {
    const jobData: EmailFetchJobData = {
      triggered: source,
      timestamp: new Date(),
    };

    const jobId = await this.queueService.addJob('EMAIL_FETCH', jobData, {
      delay,
      maxAttempts: 3,
    });

    this.logger.log(`Email fetch job queued: ${jobId} (source: ${source})`);
    return jobId;
  }

  // Add email processing job to queue
  async queueEmailProcess(emailData: EmailProcessJobData['emailData'], source: 'webhook' | 'imap' = 'imap'): Promise<string> {
    const jobData: EmailProcessJobData = {
      emailData,
      source,
    };

    const jobId = await this.queueService.addJob('EMAIL_PROCESS', jobData, {
      maxAttempts: 5, // Email processing is more critical
    });

    this.logger.log(`Email processing job queued: ${jobId} (from: ${emailData.from})`);
    return jobId;
  }

  // Process email fetch job
  private async processEmailFetchJob(job: Job<EmailFetchJobData>): Promise<void> {
    try {
      this.logger.log(`Fetching emails (triggered by: ${job.data.triggered})`);
      
      // Use the existing email fetcher service
      const result = await this.emailFetcherService.fetchEmailsNow();
      
      if (!result.success) {
        throw new Error(result.error || 'Email fetch failed');
      }

      this.logger.log(`Email fetch completed successfully (job: ${job.id})`);
    } catch (error) {
      this.logger.error(`Email fetch job failed: ${job.id}`, error);
      throw error;
    }
  }

  // Process individual email job
  private async processEmailJob(job: Job<EmailProcessJobData>): Promise<void> {
    try {
      const { emailData, source } = job.data;
      
      this.logger.log(`Processing email from ${emailData.from} (source: ${source})`);
      
      // Use the existing email service to handle incoming email
      const result = await this.emailService.handleIncomingEmail(emailData);
      
      this.logger.log(
        `Email processed successfully: ${result.emailMessage.id} ` +
        `(Lead: ${result.lead.id}, New Lead: ${result.isNewLead})`
      );
    } catch (error) {
      this.logger.error(`Email processing job failed: ${job.id}`, error);
      throw error;
    }
  }

  // Start scheduled email fetching
  private startScheduledEmailFetching() {
    const intervalMs = this.configService.get<number>('EMAIL_FETCH_INTERVAL') || 300000; // 5 minutes default
    
    // Queue immediate fetch on startup
    this.queueEmailFetch('scheduled', 5000); // 5 second delay on startup

    // Schedule regular fetching
    setInterval(async () => {
      try {
        await this.queueEmailFetch('scheduled');
      } catch (error) {
        this.logger.error('Failed to queue scheduled email fetch:', error);
      }
    }, intervalMs);

    this.logger.log(`Scheduled email fetching every ${intervalMs / 1000} seconds`);
  }

  // Start job cleanup
  private startJobCleanup() {
    const cleanupInterval = 60 * 60 * 1000; // 1 hour
    const maxJobAge = 24 * 60 * 60 * 1000; // 24 hours

    setInterval(() => {
      this.queueService.cleanupOldJobs(maxJobAge);
    }, cleanupInterval);

    this.logger.log('Job cleanup scheduled every hour');
  }

  // Get queue statistics
  getQueueStats() {
    return this.queueService.getJobStats();
  }

  // Get specific job details
  getJob(jobId: string) {
    return this.queueService.getJob(jobId);
  }

  // Manual methods for testing/admin use
  async triggerEmailFetchNow(): Promise<string> {
    return this.queueEmailFetch('manual');
  }

  async processWebhookEmail(emailData: EmailProcessJobData['emailData']): Promise<string> {
    return this.queueEmailProcess(emailData, 'webhook');
  }
}