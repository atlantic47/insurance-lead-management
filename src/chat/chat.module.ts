import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { OpenAIService } from '../ai/openai.service';
import { AIService } from '../ai/ai.service';
import { WidgetAuthService } from '../ai/widget-auth.service';
import { PrismaService } from '../common/services/prisma.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule, WhatsAppModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    OpenAIService,
    AIService,
    WidgetAuthService,
    PrismaService
  ],
  exports: [ChatService],
})
export class ChatModule {}