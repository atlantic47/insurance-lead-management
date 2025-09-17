import { Module } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { CommunicationsController } from './communications.controller';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  controllers: [CommunicationsController],
  providers: [CommunicationsService, PrismaService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}