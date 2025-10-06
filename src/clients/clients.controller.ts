import { Controller, Get, Post, Param, Query, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all clients with pagination' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.clientsService.findAll(paginationDto);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new client' })
  create(@Body() createClientDto: any) {
    return this.clientsService.create(createClientDto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get client statistics' })
  getStats() {
    return this.clientsService.getClientStats();
  }

  @Get('renewals')
  @ApiOperation({ summary: 'Get upcoming renewals' })
  getUpcomingRenewals(@Query('days') days?: number) {
    return this.clientsService.getUpcomingRenewals(days);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get client by ID' })
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update client' })
  update(@Param('id') id: string, @Body() updateClientDto: any) {
    return this.clientsService.update(id, updateClientDto);
  }

  @Patch(':id/policy')
  @ApiOperation({ summary: 'Update client policy information' })
  updatePolicy(@Param('id') id: string, @Body() updateData: any) {
    return this.clientsService.updatePolicy(id, updateData);
  }
}