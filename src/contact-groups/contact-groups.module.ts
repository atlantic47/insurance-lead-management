import { Module } from '@nestjs/common';
import { ContactGroupsService } from './contact-groups.service';
import { ContactGroupsController } from './contact-groups.controller';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  controllers: [ContactGroupsController],
  providers: [ContactGroupsService, PrismaService],
  exports: [ContactGroupsService],
})
export class ContactGroupsModule {}
