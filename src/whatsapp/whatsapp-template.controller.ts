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
import { WhatsAppTemplateService } from './whatsapp-template.service';
import { CreateWhatsAppTemplateDto } from './dto/create-whatsapp-template.dto';

@Controller('whatsapp/templates')
@UseGuards(JwtAuthGuard, TenantGuard)
export class WhatsAppTemplateController {
  constructor(private readonly templateService: WhatsAppTemplateService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTemplate(
    @Request() req,
    @Body() createTemplateDto: CreateWhatsAppTemplateDto,
  ) {
    const userId = req.user.id;
    return this.templateService.createTemplate(createTemplateDto, userId);
  }

  @Get()
  async getTemplates(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const userId = req.user.id;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return this.templateService.getTemplates(userId, {
      page: pageNum,
      limit: limitNum,
      status,
      search,
    });
  }

  @Get(':id')
  async getTemplate(@Request() req, @Param('id') templateId: string) {
    const userId = req.user.id;
    return this.templateService.getTemplate(templateId, userId);
  }

  @Get(':id/status')
  async getTemplateStatus(@Request() req, @Param('id') templateId: string) {
    const userId = req.user.id;
    return this.templateService.getTemplateStatus(templateId, userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateTemplate(
    @Request() req,
    @Param('id') templateId: string,
    @Body() updateTemplateDto: Partial<CreateWhatsAppTemplateDto>,
  ) {
    const userId = req.user.id;
    return this.templateService.updateTemplate(templateId, updateTemplateDto, userId);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  async submitTemplate(@Request() req, @Param('id') templateId: string) {
    const userId = req.user.id;
    return this.templateService.submitToMeta(templateId, userId);
  }

  @Post(':id/resubmit')
  @HttpCode(HttpStatus.OK)
  async resubmitTemplate(@Request() req, @Param('id') templateId: string) {
    const userId = req.user.id;
    return this.templateService.resubmitToMeta(templateId, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(@Request() req, @Param('id') templateId: string) {
    const userId = req.user.id;
    await this.templateService.deleteTemplate(templateId, userId);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncExistingTemplates(@Request() req) {
    const userId = req.user.id;
    return this.templateService.syncExistingTemplates(userId);
  }
}
