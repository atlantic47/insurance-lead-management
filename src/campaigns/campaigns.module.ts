import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignsSchedulerService } from './campaigns-scheduler.service';
import { EmailTemplatesService } from './email-templates.service';
import { TemplateUploadService } from './template-upload.service';
import { PrismaService } from '../common/services/prisma.service';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [WhatsAppModule, EmailModule],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    CampaignsSchedulerService,
    EmailTemplatesService,
    TemplateUploadService,
    PrismaService,
  ],
  exports: [CampaignsService, EmailTemplatesService, TemplateUploadService],
})
export class CampaignsModule {}
