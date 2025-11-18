import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { ConversationLabelService } from './conversation-label.service';
import {
  CreateConversationLabelDto,
  UpdateConversationLabelDto,
  AssignLabelDto,
} from './dto/conversation-label.dto';

@Controller('whatsapp/conversation-labels')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ConversationLabelController {
  constructor(private readonly labelService: ConversationLabelService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createLabel(
    @Request() req,
    @Body() createLabelDto: CreateConversationLabelDto,
  ) {
    const userId = req.user.id;
    return this.labelService.createLabel(createLabelDto, userId);
  }

  @Get()
  async getLabels() {
    return this.labelService.getLabels();
  }

  @Get(':id')
  async getLabel(@Param('id') labelId: string) {
    return this.labelService.getLabel(labelId);
  }

  @Patch(':id')
  async updateLabel(
    @Request() req,
    @Param('id') labelId: string,
    @Body() updateLabelDto: UpdateConversationLabelDto,
  ) {
    const userId = req.user.id;
    return this.labelService.updateLabel(labelId, updateLabelDto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteLabel(@Request() req, @Param('id') labelId: string) {
    const userId = req.user.id;
    await this.labelService.deleteLabel(labelId, userId);
  }

  @Post('assign')
  @HttpCode(HttpStatus.OK)
  async assignLabel(@Request() req, @Body() assignLabelDto: AssignLabelDto) {
    const userId = req.user.id;
    return this.labelService.assignLabel(assignLabelDto, userId);
  }

  @Delete('conversations/:conversationId/labels/:labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeLabel(
    @Request() req,
    @Param('conversationId') conversationId: string,
    @Param('labelId') labelId: string,
  ) {
    const userId = req.user.id;
    await this.labelService.removeLabel(conversationId, labelId, userId);
  }

  @Get('conversations/:conversationId')
  async getConversationLabels(@Param('conversationId') conversationId: string) {
    return this.labelService.getConversationLabels(conversationId);
  }
}
