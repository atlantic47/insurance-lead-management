import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { EmailTemplatesService } from './email-templates.service';
import { TemplateUploadService } from './template-upload.service';
import { PrismaService } from '../common/services/prisma.service';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WhatsAppModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, EmailTemplatesService, TemplateUploadService, PrismaService],
  exports: [CampaignsService, EmailTemplatesService, TemplateUploadService],
})
export class CampaignsModule {}
