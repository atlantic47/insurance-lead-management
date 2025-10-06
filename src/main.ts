import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);


  // Enable CORS for widget embedding
  app.enableCors({
    origin: true, // Allow all origins for widget functionality
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: false, // Don't send cookies to external sites
    preflightContinue: false,
    optionsSuccessStatus: 204
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Insurance Lead Management System')
    .setDescription('A comprehensive backend system for managing insurance leads, communications, and client relationships')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Users', 'User management and profiles')
    .addTag('Leads', 'Lead management and pipeline')
    .addTag('Communications', 'Multi-channel communication management')
    .addTag('Products', 'Insurance products and recommendations')
    .addTag('Clients', 'Client management and policy tracking')
    .addTag('Tasks', 'Task scheduling and follow-ups')
    .addTag('AI', 'AI-powered features and automation')
    .addTag('Reports', 'Analytics and reporting')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = configService.get('PORT', 3000);
  
  await app.listen(port);
  
  console.log(`🚀 Insurance Lead Management System running on port ${port}`);
  console.log(`📚 API Documentation available at http://localhost:${port}/api`);
}

bootstrap();
