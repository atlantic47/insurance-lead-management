import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppConversationService } from './whatsapp-conversation.service';
import { WhatsAppTokenService } from './whatsapp-token.service';
import { WhatsAppTokenManagerService } from './whatsapp-token-manager.service';
import { WhatsAppTemplateService } from './whatsapp-template.service';
import { WhatsAppTenantService } from './whatsapp-tenant.service';
import { OpenAIService } from '../ai/openai.service';
import { AIService } from '../ai/ai.service';
import { WidgetAuthService } from '../ai/widget-auth.service';
import { PrismaService } from '../common/services/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [ConfigModule, ScheduleModule, SettingsModule],
  controllers: [WhatsAppController],
  providers: [
    WhatsAppService,
    WhatsAppConversationService,
    WhatsAppTokenService,
    WhatsAppTokenManagerService,
    WhatsAppTemplateService,
    WhatsAppTenantService,
    OpenAIService,
    AIService,
    WidgetAuthService,
    PrismaService,
    EncryptionService,
  ],
  exports: [
    WhatsAppService,
    WhatsAppConversationService,
    WhatsAppTokenService,
    WhatsAppTokenManagerService,
    WhatsAppTemplateService,
    WhatsAppTenantService,
  ],
})
export class WhatsAppModule {}