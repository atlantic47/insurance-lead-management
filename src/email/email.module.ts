import { Module } from '@nestjs/common';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { EmailFetcherService } from './email-fetcher.service';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  controllers: [EmailController],
  providers: [EmailService, EmailFetcherService, PrismaService],
  exports: [EmailService, EmailFetcherService],
})
export class EmailModule {}