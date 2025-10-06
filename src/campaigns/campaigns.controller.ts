import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CampaignsService } from './campaigns.service';
import { EmailTemplatesService } from './email-templates.service';
import { TemplateUploadService } from './template-upload.service';
import { WhatsAppTemplateService, WhatsAppTemplate } from '../whatsapp/whatsapp-template.service';
import { CreateCampaignTemplateDto } from './dto/create-campaign-template.dto';
import { UpdateCampaignTemplateDto } from './dto/update-campaign-template.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { UploadTemplateDto } from './dto/upload-template.dto';

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly emailTemplatesService: EmailTemplatesService,
    private readonly templateUploadService: TemplateUploadService,
    private readonly whatsappTemplateService: WhatsAppTemplateService,
  ) {}

  // Campaign Templates
  @Post('templates')
  createTemplate(@Body() dto: CreateCampaignTemplateDto, @Request() req) {
    return this.campaignsService.createTemplate(dto, req.user.id);
  }

  @Get('templates')
  findAllTemplates(@Request() req, @Query('type') type?: string) {
    return this.campaignsService.findAllTemplates(req.user.id, type);
  }

  @Get('templates/:id')
  findOneTemplate(@Param('id') id: string, @Request() req) {
    return this.campaignsService.findOneTemplate(id, req.user.id);
  }

  @Patch('templates/:id')
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignTemplateDto,
    @Request() req,
  ) {
    return this.campaignsService.updateTemplate(id, dto, req.user.id);
  }

  @Delete('templates/:id')
  removeTemplate(@Param('id') id: string, @Request() req) {
    return this.campaignsService.removeTemplate(id, req.user.id);
  }

  // Campaigns
  @Post()
  create(@Body() dto: CreateCampaignDto, @Request() req) {
    return this.campaignsService.create(dto, req.user.id);
  }

  @Get()
  findAll(
    @Request() req,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.campaignsService.findAll(req.user.id, type, status);
  }

  @Get('stats')
  getStats(@Request() req) {
    return this.campaignsService.getStats(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.campaignsService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
    @Request() req,
  ) {
    return this.campaignsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.campaignsService.remove(id, req.user.id);
  }

  @Post(':id/send')
  sendCampaign(@Param('id') id: string, @Request() req) {
    return this.campaignsService.sendCampaign(id, req.user.id);
  }

  // Email Templates (Predefined)
  @Get('email/templates/predefined')
  getPredefinedEmailTemplates() {
    return this.emailTemplatesService.getPredefinedTemplates();
  }

  // Upload HTML Template (single file or ZIP)
  @Post('templates/upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
  }))
  async uploadHtmlTemplate(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadTemplateDto,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Process the HTML file
    const { htmlContent, plainText } = await this.templateUploadService.processHtmlFile(file);

    // Validate HTML
    const validation = this.templateUploadService.validateHtmlContent(htmlContent);
    if (!validation.valid) {
      throw new BadRequestException(`Invalid HTML: ${validation.errors.join(', ')}`);
    }

    // Create template in database
    return this.campaignsService.createTemplate({
      ...dto,
      content: plainText,
      htmlContent,
      isHtml: true,
    }, req.user.id);
  }

  // WhatsApp Templates from Meta
  @Get('whatsapp/templates')
  getWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
    return this.whatsappTemplateService.fetchApprovedTemplates();
  }

  @Get('whatsapp/templates/:name')
  getWhatsAppTemplateStructure(
    @Param('name') name: string,
    @Query('language') language: string = 'en',
  ) {
    return this.whatsappTemplateService.getTemplateStructure(name, language);
  }
}
