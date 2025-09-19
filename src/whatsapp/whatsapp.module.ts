import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppConversationService } from './whatsapp-conversation.service';
import { OpenAIService } from '../ai/openai.service';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  imports: [ConfigModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, WhatsAppConversationService, OpenAIService, PrismaService],
  exports: [WhatsAppService, WhatsAppConversationService],
})
export class WhatsAppModule {}