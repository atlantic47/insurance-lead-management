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
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TaskStatus } from '@prisma/client';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  create(@Body() createTaskDto: CreateTaskDto, @CurrentUser() user: any) {
    return this.tasksService.create(createTaskDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tasks with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(@Query() paginationDto: PaginationDto, @CurrentUser() user: any) {
    return this.tasksService.findAll(paginationDto, user);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get task statistics' })
  @ApiResponse({ status: 200, description: 'Task statistics retrieved' })
  getStats(@CurrentUser() user: any) {
    return this.tasksService.getTaskStats(user);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming tasks' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getUpcomingTasks(
    @CurrentUser() user: any,
    @Query('days') days?: number,
  ) {
    return this.tasksService.getUpcomingTasks(user, days);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiResponse({ status: 200, description: 'Task found' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tasksService.findOne(id, user);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update task status' })
  @ApiResponse({ status: 200, description: 'Task status updated successfully' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: TaskStatus,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.updateStatus(id, status, user);
  }
}