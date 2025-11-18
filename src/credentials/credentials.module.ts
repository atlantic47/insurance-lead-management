import { Module } from '@nestjs/common';
import { CredentialsController } from './credentials.controller';
import { CredentialsService } from './credentials.service';
import { PrismaService } from '../common/services/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';

@Module({
  imports: [],
  controllers: [CredentialsController],
  providers: [CredentialsService, PrismaService, EncryptionService],
  exports: [CredentialsService],
})
export class CredentialsModule {}
