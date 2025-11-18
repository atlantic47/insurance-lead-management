import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CampaignService } from './campaign.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { CampaignStatus } from './enums/automation.enums';

@Controller('whatsapp/campaigns')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCampaign(
    @Request() req,
    @Body() createCampaignDto: CreateCampaignDto,
  ) {
    const userId = req.user.id;
    return this.campaignService.createCampaign(createCampaignDto, userId);
  }

  @Get()
  async getCampaigns(@Query('status') status?: CampaignStatus) {
    const options = status ? { status } : {};
    return this.campaignService.getCampaigns(options);
  }

  @Get(':id')
  async getCampaign(@Param('id') campaignId: string) {
    return this.campaignService.getCampaign(campaignId);
  }

  @Patch(':id')
  async updateCampaign(
    @Request() req,
    @Param('id') campaignId: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ) {
    const userId = req.user.id;
    return this.campaignService.updateCampaign(campaignId, updateCampaignDto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCampaign(@Request() req, @Param('id') campaignId: string) {
    const userId = req.user.id;
    await this.campaignService.deleteCampaign(campaignId, userId);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  async startCampaign(@Request() req, @Param('id') campaignId: string) {
    const userId = req.user.id;
    return this.campaignService.startCampaign(campaignId, userId);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  async pauseCampaign(@Request() req, @Param('id') campaignId: string) {
    const userId = req.user.id;
    return this.campaignService.pauseCampaign(campaignId, userId);
  }

  @Get(':id/stats')
  async getCampaignStats(@Param('id') campaignId: string) {
    return this.campaignService.getCampaignStats(campaignId);
  }
}
