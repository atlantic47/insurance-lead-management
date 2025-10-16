import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { FlutterwaveService } from './flutterwave.service';
import { PrismaService } from '../common/services/prisma.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, FlutterwaveService, PrismaService],
  exports: [PaymentsService, FlutterwaveService],
})
export class PaymentsModule {}
