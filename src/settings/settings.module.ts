import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PrismaService } from '../common/services/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, PrismaService, EncryptionService],
  exports: [SettingsService],
})
export class SettingsModule {}
