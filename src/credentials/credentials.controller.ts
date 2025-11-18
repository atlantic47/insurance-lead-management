import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CredentialsService } from './credentials.service';
import { CreateEmailCredentialDto, UpdateEmailCredentialDto } from './dto/email-credential.dto';
import { CreateWhatsAppCredentialDto, UpdateWhatsAppCredentialDto } from './dto/whatsapp-credential.dto';

@Controller('credentials')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  // EMAIL CREDENTIALS
  @Get('email')
  async getEmailCredentials() {
    return this.credentialsService.getEmailCredentials();
  }

  @Post('email')
  @HttpCode(HttpStatus.CREATED)
  async createEmailCredential(@Body() dto: CreateEmailCredentialDto) {
    return this.credentialsService.createEmailCredential(dto);
  }

  @Patch('email/:id')
  async updateEmailCredential(
    @Param('id') id: string,
    @Body() dto: UpdateEmailCredentialDto,
  ) {
    return this.credentialsService.updateEmailCredential(id, dto);
  }

  @Delete('email/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEmailCredential(@Param('id') id: string) {
    await this.credentialsService.deleteEmailCredential(id);
  }

  @Post('email/:id/set-default')
  async setDefaultEmailCredential(@Param('id') id: string) {
    return this.credentialsService.setDefaultEmailCredential(id);
  }

  @Post('email/:id/test')
  async testEmailCredential(@Param('id') id: string) {
    return this.credentialsService.testEmailCredential(id);
  }

  // WHATSAPP CREDENTIALS
  @Get('whatsapp')
  async getWhatsAppCredentials() {
    return this.credentialsService.getWhatsAppCredentials();
  }

  @Post('whatsapp')
  @HttpCode(HttpStatus.CREATED)
  async createWhatsAppCredential(@Body() dto: CreateWhatsAppCredentialDto) {
    return this.credentialsService.createWhatsAppCredential(dto);
  }

  @Patch('whatsapp/:id')
  async updateWhatsAppCredential(
    @Param('id') id: string,
    @Body() dto: UpdateWhatsAppCredentialDto,
  ) {
    return this.credentialsService.updateWhatsAppCredential(id, dto);
  }

  @Delete('whatsapp/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWhatsAppCredential(@Param('id') id: string) {
    await this.credentialsService.deleteWhatsAppCredential(id);
  }

  @Post('whatsapp/:id/set-default')
  async setDefaultWhatsAppCredential(@Param('id') id: string) {
    return this.credentialsService.setDefaultWhatsAppCredential(id);
  }

  @Post('whatsapp/:id/regenerate-webhook')
  async regenerateWhatsAppWebhook(@Param('id') id: string) {
    return this.credentialsService.regenerateWhatsAppWebhook(id);
  }
}
