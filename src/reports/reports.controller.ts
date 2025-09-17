import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('lead-conversion')
  @ApiOperation({ summary: 'Get lead conversion report' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  getLeadConversionReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getLeadConversionReport(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('agent-performance')
  @ApiOperation({ summary: 'Get agent performance report' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  getAgentPerformanceReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getAgentPerformanceReport(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('communication-effectiveness')
  @ApiOperation({ summary: 'Get communication effectiveness report' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  getCommunicationEffectivenessReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getCommunicationEffectivenessReport(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('pipeline-analytics')
  @ApiOperation({ summary: 'Get pipeline analytics report' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  getPipelineAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getPipelineAnalytics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard summary with all key metrics' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  getDashboard(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getDashboard(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('export/:type')
  @ApiOperation({ summary: 'Export report to CSV' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  async exportReport(
    @Res() res: Response,
    @Query('type') type: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const report = await this.reportsService.exportToCsv(
      type,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    res.setHeader('Content-Type', report.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    res.send(report.content);
  }
}