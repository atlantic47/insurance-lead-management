import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { WhatsAppConversationService } from '../whatsapp/whatsapp-conversation.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { WhatsAppTokenManagerService } from '../whatsapp/whatsapp-token-manager.service';
import { OpenAIService } from '../ai/openai.service';
import { AIService } from '../ai/ai.service';
import { PrismaService } from '../common/services/prisma.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    WhatsAppConversationService,
    WhatsAppService,
    WhatsAppTokenManagerService,
    OpenAIService,
    AIService,
    PrismaService
  ],
  exports: [ChatService],
})
export class ChatModule {}