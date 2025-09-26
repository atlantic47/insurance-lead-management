import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppConversationService } from './whatsapp-conversation.service';
import { WhatsAppTokenService } from './whatsapp-token.service';
import { WhatsAppTokenManagerService } from './whatsapp-token-manager.service';
import { OpenAIService } from '../ai/openai.service';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  imports: [ConfigModule, ScheduleModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, WhatsAppConversationService, WhatsAppTokenService, WhatsAppTokenManagerService, OpenAIService, PrismaService],
  exports: [WhatsAppService, WhatsAppConversationService, WhatsAppTokenService, WhatsAppTokenManagerService],
})
export class WhatsAppModule {}