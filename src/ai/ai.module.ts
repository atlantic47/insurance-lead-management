import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { OpenAIService } from './openai.service';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  imports: [ConfigModule],
  controllers: [AIController],
  providers: [AIService, OpenAIService, PrismaService],
  exports: [AIService, OpenAIService],
})
export class AIModule {}