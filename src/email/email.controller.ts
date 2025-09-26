import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { EmailService } from './email.service';
import { EmailFetcherService } from './email-fetcher.service';
import { EmailQueueService } from './email-queue.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Email')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly emailFetcherService: EmailFetcherService,
    private readonly emailQueueService: EmailQueueService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all emails with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'direction', required: false, enum: ['INBOUND', 'OUTBOUND'] })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  async getEmails(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('direction') direction?: 'INBOUND' | 'OUTBOUND',
    @Query('isRead') isRead?: boolean,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const filters: any = {};
    if (direction) filters.direction = direction;
    if (isRead !== undefined) filters.isRead = isRead === true;
    if (fromDate) filters.fromDate = new Date(fromDate);
    if (toDate) filters.toDate = new Date(toDate);

    return this.emailService.getAllEmails(+page, +limit, filters);
  }

  @Get('lead/:leadId')
  @ApiOperation({ summary: 'Get emails for a specific lead' })
  async getEmailsByLead(@Param('leadId') leadId: string) {
    return this.emailService.getEmailsByLead(leadId);
  }

  @Get('threads')
  @ApiOperation({ summary: 'Get email threads with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'leadId', required: false, type: String })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  async getEmailThreads(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('leadId') leadId?: string,
    @Query('isRead') isRead?: boolean,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const filters: any = {};
    if (leadId) filters.leadId = leadId;
    if (isRead !== undefined) filters.isRead = isRead === true;
    if (fromDate) filters.fromDate = new Date(fromDate);
    if (toDate) filters.toDate = new Date(toDate);

    return this.emailService.getEmailThreads(+page, +limit, filters);
  }

  @Get('thread/:threadId')
  @ApiOperation({ summary: 'Get email thread' })
  async getEmailThread(@Param('threadId') threadId: string) {
    return this.emailService.getEmailThread(threadId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get email statistics' })
  async getEmailStats() {
    return this.emailService.getEmailStats();
  }

  @Patch(':emailId/read')
  @ApiOperation({ summary: 'Mark email as read' })
  async markAsRead(@Param('emailId') emailId: string) {
    return this.emailService.markEmailAsRead(emailId);
  }

  @Post('send')
  @ApiOperation({ summary: 'Send email reply' })
  async sendEmail(
    @Body() data: {
      toEmail: string;
      subject: string;
      content: string;
      inReplyTo?: string;
      threadId?: string;
      leadId?: string;
      ccEmails?: string[];
      bccEmails?: string[];
    },
    @CurrentUser() user: any,
  ) {
    return this.emailService.sendEmailReply(data);
  }

  @Post('fetch')
  @ApiOperation({ summary: 'Queue email fetching job (runs in background)' })
  async fetchEmails() {
    const jobId = await this.emailQueueService.triggerEmailFetchNow();
    return {
      success: true,
      message: 'Email fetch job queued successfully',
      jobId,
    };
  }

  @Post('test-connection')
  @ApiOperation({ summary: 'Test IMAP server connection' })
  async testConnection() {
    const isConnected = await this.emailFetcherService.testConnection();
    return {
      success: isConnected,
      message: isConnected ? 'Connection successful' : 'Connection failed',
    };
  }

  @Public()
  @Post('webhook/incoming')
  @ApiOperation({ summary: 'Queue incoming email for processing (webhook)' })
  async handleIncomingEmail(
    @Body() data: {
      from: string;
      to: string;
      subject: string;
      content: string;
      messageId?: string;
      inReplyTo?: string;
      threadId?: string;
      cc?: string[];
      bcc?: string[];
    },
  ) {
    const jobId = await this.emailQueueService.processWebhookEmail(data);
    return {
      success: true,
      message: 'Email processing job queued successfully',
      jobId,
    };
  }

  @Public()
  @Post('webhook/fetch')
  @ApiOperation({ summary: 'Webhook endpoint to queue email fetching' })
  async webhookFetchEmails() {
    const jobId = await this.emailQueueService.queueEmailFetch('webhook');
    return {
      success: true,
      message: 'Email fetch job queued successfully',
      jobId,
    };
  }

  @Get('queue/stats')
  @ApiOperation({ summary: 'Get email queue statistics' })
  async getQueueStats() {
    return this.emailQueueService.getQueueStats();
  }

  @Post('queue/clear')
  @ApiOperation({ summary: 'Clear all queue jobs' })
  async clearQueue() {
    return this.emailQueueService.clearAllJobs();
  }

  @Get('queue/job/:jobId')
  @ApiOperation({ summary: 'Get specific job details' })
  async getJobDetails(@Param('jobId') jobId: string) {
    const job = this.emailQueueService.getJob(jobId);
    if (!job) {
      return { error: 'Job not found' };
    }
    return job;
  }

  @Get('contacts')
  @ApiOperation({ summary: 'Get email contacts from history' })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getEmailContacts(@Query('search') search?: string) {
    return this.emailService.getEmailContacts(search);
  }
}