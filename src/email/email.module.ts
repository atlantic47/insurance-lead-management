import { Module } from '@nestjs/common';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { EmailFetcherService } from './email-fetcher.service';
import { EmailQueueService } from './email-queue.service';
import { SmtpEmailService } from './smtp-email.service';
import { PrismaService } from '../common/services/prisma.service';
import { QueueService } from '../common/services/queue.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [EmailController],
  providers: [
    EmailService,
    EmailFetcherService,
    EmailQueueService,
    SmtpEmailService,
    PrismaService,
    QueueService
  ],
  exports: [EmailService, EmailFetcherService, EmailQueueService, SmtpEmailService],
})
export class EmailModule {}