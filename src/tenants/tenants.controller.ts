import { Controller, Post, Body, Get, Param, Put, UseGuards, Request } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { SetupCredentialsDto } from './dto/setup-credentials.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post('register')
  async register(@Body() dto: RegisterTenantDto) {
    return this.tenantsService.register(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('setup-credentials')
  async setupCredentials(@Request() req, @Body() dto: SetupCredentialsDto) {
    const tenantId = req.user.tenantId;
    return this.tenantsService.setupCredentials(tenantId, dto);
  }

  @Get('subdomain/:subdomain')
  async getTenantBySubdomain(@Param('subdomain') subdomain: string) {
    return this.tenantsService.getTenantBySubdomain(subdomain);
  }

  @UseGuards(JwtAuthGuard)
  @Get('trial-status')
  async getTrialStatus(@Request() req) {
    const tenantId = req.user.tenantId;
    return this.tenantsService.checkTrialExpiration(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("webhook-urls")
  async getWebhookUrls(@Request() req) {
    const tenantId = req.user.tenantId;
    return this.tenantsService.getWebhookUrls(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('onboarding-status')
  async getOnboardingStatus(@Request() req) {
    const tenantId = req.user.tenantId;
    const tenant = await this.tenantsService.getTenantBySubdomain(''); // Will fix this

    // Get tenant by ID
    return this.tenantsService.getOnboardingStatus(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('complete-onboarding')
  async completeOnboarding(@Request() req) {
    const tenantId = req.user.tenantId;
    return this.tenantsService.completeOnboarding(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('current')
  async getCurrentTenant(@Request() req) {
    const tenantId = req.user.tenantId;
    return this.tenantsService.getTenantById(tenantId);
  }
}
