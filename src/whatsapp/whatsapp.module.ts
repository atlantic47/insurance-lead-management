import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppTemplateController } from './whatsapp-template.controller';
import { ConversationLabelController } from './conversation-label.controller';
import { AutomationRuleController } from './automation-rule.controller';
import { CampaignController } from './campaign.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppConversationService } from './whatsapp-conversation.service';
import { WhatsAppTokenService } from './whatsapp-token.service';
import { WhatsAppTokenManagerService } from './whatsapp-token-manager.service';
import { WhatsAppTemplateService } from './whatsapp-template.service';
import { WhatsAppTenantService } from './whatsapp-tenant.service';
import { ConversationLabelService } from './conversation-label.service';
import { AutomationRuleService } from './automation-rule.service';
import { CampaignService } from './campaign.service';
import { AutomationSchedulerService } from './automation-scheduler.service';
import { CampaignSchedulerService } from './campaign-scheduler.service';
import { OpenAIService } from '../ai/openai.service';
import { AIService } from '../ai/ai.service';
import { WidgetAuthService } from '../ai/widget-auth.service';
import { PrismaService } from '../common/services/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [ConfigModule, ScheduleModule, SettingsModule],
  controllers: [
    WhatsAppController,
    WhatsAppTemplateController,
    ConversationLabelController,
    AutomationRuleController,
    CampaignController,
  ],
  providers: [
    WhatsAppService,
    WhatsAppConversationService,
    WhatsAppTokenService,
    WhatsAppTokenManagerService,
    WhatsAppTemplateService,
    WhatsAppTenantService,
    ConversationLabelService,
    AutomationRuleService,
    CampaignService,
    AutomationSchedulerService,
    CampaignSchedulerService,
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
    ConversationLabelService,
    AutomationRuleService,
    CampaignService,
  ],
})
export class WhatsAppModule {}