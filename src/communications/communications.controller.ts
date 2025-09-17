import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CommunicationsService } from './communications.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { CommunicationQueryDto } from './dto/communication-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Communications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('communications')
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new communication' })
  @ApiResponse({ status: 201, description: 'Communication created successfully' })
  create(
    @Body() createCommunicationDto: CreateCommunicationDto,
    @CurrentUser() user: any,
  ) {
    return this.communicationsService.create(createCommunicationDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all communications with filtering and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'leadId', required: false, type: String })
  @ApiQuery({ name: 'channel', required: false })
  @ApiQuery({ name: 'direction', required: false, type: String })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  findAll(@Query() queryDto: CommunicationQueryDto, @CurrentUser() user: any) {
    return this.communicationsService.findAll(queryDto, user);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get communication statistics' })
  @ApiResponse({ status: 200, description: 'Communication statistics retrieved' })
  getStats(@CurrentUser() user: any) {
    return this.communicationsService.getCommunicationStats(user);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get communication templates' })
  @ApiQuery({ name: 'channel', required: false })
  getTemplates(@Query('channel') channel?: string) {
    return this.communicationsService.getTemplates(channel);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a communication template' })
  createTemplate(
    @Body('name') name: string,
    @Body('content') content: string,
    @Body('channel') channel: string,
    @CurrentUser() user: any,
  ) {
    return this.communicationsService.createTemplate(name, content, channel, user.id);
  }

  @Get('lead/:leadId')
  @ApiOperation({ summary: 'Get all communications for a specific lead' })
  @ApiResponse({ status: 200, description: 'Lead communications retrieved' })
  getLeadCommunications(
    @Param('leadId') leadId: string,
    @CurrentUser() user: any,
  ) {
    return this.communicationsService.getLeadCommunications(leadId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get communication by ID' })
  @ApiResponse({ status: 200, description: 'Communication found' })
  @ApiResponse({ status: 404, description: 'Communication not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.communicationsService.findOne(id, user);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark communication as read' })
  @ApiResponse({ status: 200, description: 'Communication marked as read' })
  markAsRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.communicationsService.markAsRead(id, user);
  }
}