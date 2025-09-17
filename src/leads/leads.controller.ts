import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadQueryDto } from './dto/lead-query.dto';
import { MoveToPipelineStageDto } from './dto/pipeline-stage.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new lead' })
  @ApiResponse({ status: 201, description: 'Lead created successfully' })
  create(@Body() createLeadDto: CreateLeadDto, @CurrentUser() user: any) {
    return this.leadsService.create(createLeadDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all leads with filtering and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'insuranceType', required: false })
  @ApiQuery({ name: 'assignedUserId', required: false, type: String })
  @ApiQuery({ name: 'urgency', required: false })
  findAll(@Query() queryDto: LeadQueryDto, @CurrentUser() user: any) {
    return this.leadsService.findAll(queryDto, user);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get lead statistics' })
  @ApiResponse({ status: 200, description: 'Lead statistics retrieved' })
  getStats(@CurrentUser() user: any) {
    return this.leadsService.getLeadStats(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead by ID' })
  @ApiResponse({ status: 200, description: 'Lead found' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.leadsService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lead' })
  @ApiResponse({ status: 200, description: 'Lead updated successfully' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  update(
    @Param('id') id: string,
    @Body() updateLeadDto: UpdateLeadDto,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.update(id, updateLeadDto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete lead' })
  @ApiResponse({ status: 200, description: 'Lead deleted successfully' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.leadsService.remove(id, user);
  }

  @Patch(':id/assign/:userId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Assign lead to user' })
  @ApiResponse({ status: 200, description: 'Lead assigned successfully' })
  @ApiResponse({ status: 404, description: 'Lead or user not found' })
  assignLead(
    @Param('id') id: string,
    @Param('userId') assignedUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.assignLead(id, assignedUserId, user);
  }

  @Patch(':id/score')
  @ApiOperation({ summary: 'Update lead score' })
  @ApiResponse({ status: 200, description: 'Lead score updated successfully' })
  updateScore(
    @Param('id') id: string,
    @Body('score') score: number,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.updateLeadScore(id, score, user);
  }

  @Post(':id/convert')
  @ApiOperation({ summary: 'Convert lead to client' })
  @ApiResponse({ status: 201, description: 'Lead converted to client successfully' })
  @ApiResponse({ status: 400, description: 'Lead cannot be converted' })
  convertToClient(@Param('id') id: string, @CurrentUser() user: any) {
    return this.leadsService.convertToClient(id, user);
  }

  @Get('pipeline/view')
  @ApiOperation({ summary: 'Get complete pipeline view with all stages' })
  @ApiResponse({ status: 200, description: 'Pipeline view retrieved successfully' })
  getPipelineView(@CurrentUser() user: any) {
    return this.leadsService.getPipelineView(user);
  }

  @Get('pipeline/metrics')
  @ApiOperation({ summary: 'Get pipeline performance metrics' })
  @ApiResponse({ status: 200, description: 'Pipeline metrics retrieved successfully' })
  getPipelineMetrics(@CurrentUser() user: any) {
    return this.leadsService.getPipelineMetrics(user);
  }

  @Patch(':id/pipeline/move')
  @ApiOperation({ summary: 'Move lead to different pipeline stage' })
  @ApiResponse({ status: 200, description: 'Lead moved to new stage successfully' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  moveToPipelineStage(
    @Param('id') id: string,
    @Body() moveStageDto: MoveToPipelineStageDto,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.moveToPipelineStage(
      id,
      moveStageDto.status,
      moveStageDto.notes || '',
      user,
    );
  }
}