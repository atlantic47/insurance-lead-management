import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { OpenAIService } from './openai.service';
import { PrismaService } from '../common/services/prisma.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    ConfigModule,
    SettingsModule,
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  ],
  controllers: [AIController],
  providers: [AIService, OpenAIService, PrismaService],
  exports: [AIService, OpenAIService],
})
export class AIModule {}