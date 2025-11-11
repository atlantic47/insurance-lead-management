import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { join } from 'path';
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
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { ContactGroupsModule } from './contact-groups/contact-groups.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { SettingsModule } from './settings/settings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TenantsModule } from './tenants/tenants.module';
import { PaymentsModule } from './payments/payments.module';
import { CredentialsModule } from './credentials/credentials.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { TenantGuard } from './auth/guards/tenant.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { PrismaService } from './common/services/prisma.service';
import { AIService } from './ai/ai.service';
import { OpenAIService } from './ai/openai.service';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { WebhookTenantMiddleware } from './common/middleware/webhook-tenant.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public', 'widget'),
      serveRoot: '/widget',
      serveStaticOptions: {
        setHeaders: (res) => {
          res.set('Access-Control-Allow-Origin', '*');
          res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        },
      },
    }),
    ScheduleModule.forRoot(),
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
    WhatsAppModule,
    ContactGroupsModule,
    CampaignsModule,
    SettingsModule,
    NotificationsModule,
    TenantsModule,
    PaymentsModule,
    CredentialsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    AIService,
    OpenAIService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // SECURITY FIX: Apply webhook tenant middleware to public webhook endpoints FIRST
    // This extracts and validates tenant context from credential ID for webhooks
    consumer
      .apply(WebhookTenantMiddleware)
      .forRoutes(
        { path: 'whatsapp/webhook/:credentialId', method: RequestMethod.ALL },
        { path: 'email/webhook/:tenantId', method: RequestMethod.ALL }
      );

    // Apply regular tenant middleware to all other routes EXCEPT webhooks
    // This extracts tenant context from authenticated user (JWT)
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'whatsapp/webhook/:credentialId', method: RequestMethod.ALL },
        { path: 'email/webhook/:tenantId', method: RequestMethod.ALL }
      )
      .forRoutes('*');
  }
}
