import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LeadsModule } from './leads/leads.module';
import { CommunicationsModule } from './communications/communications.module';
import { ProductsModule } from './products/products.module';
import { ClientsModule } from './clients/clients.module';
import { TasksModule } from './tasks/tasks.module';
import { AIModule } from './ai/ai.module';
import { ReportsModule } from './reports/reports.module';
import { ChatModule } from './chat/chat.module';
import { EmailModule } from './email/email.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaService } from './common/services/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    UsersModule,
    LeadsModule,
    CommunicationsModule,
    ProductsModule,
    ClientsModule,
    TasksModule,
    AIModule,
    ReportsModule,
    ChatModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
