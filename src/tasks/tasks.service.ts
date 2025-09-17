import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { PaginationDto, PaginationResult } from '../common/dto/pagination.dto';
import { UserRole, TaskStatus } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(createTaskDto: CreateTaskDto, currentUser: any) {
    if (currentUser.role === UserRole.AGENT && createTaskDto.assignedUserId !== currentUser.id) {
      throw new ForbiddenException('Agents can only create tasks for themselves');
    }

    return this.prisma.task.create({
      data: {
        ...createTaskDto,
        dueDate: createTaskDto.dueDate ? new Date(createTaskDto.dueDate) : undefined,
      },
      include: {
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findAll(paginationDto: PaginationDto, currentUser: any): Promise<PaginationResult<any>> {
    const { page, limit, search, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    let where: any = {};

    if (currentUser.role === UserRole.AGENT) {
      where.assignedUserId = currentUser.id;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const orderBy = sortBy ? { [sortBy]: sortOrder } : { dueDate: 'asc' as const };

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          assignedUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: tasks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };
  }

  async findOne(id: string, currentUser: any) {
    const where: any = { id };

    if (currentUser.role === UserRole.AGENT) {
      where.assignedUserId = currentUser.id;
    }

    const task = await this.prisma.task.findFirst({
      where,
      include: {
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async updateStatus(id: string, status: TaskStatus, currentUser: any) {
    const task = await this.findOne(id, currentUser);

    const updateData: any = { status };
    if (status === TaskStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    return this.prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async getTaskStats(currentUser: any) {
    const where = currentUser.role === UserRole.AGENT 
      ? { assignedUserId: currentUser.id } 
      : {};

    const [statusStats, priorityStats, totalTasks, overdueTasks] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      this.prisma.task.groupBy({
        by: ['priority'],
        where,
        _count: { id: true },
      }),
      this.prisma.task.count({ where }),
      this.prisma.task.count({
        where: {
          ...where,
          dueDate: { lt: new Date() },
          status: { not: TaskStatus.COMPLETED },
        },
      }),
    ]);

    const todayTasks = await this.prisma.task.count({
      where: {
        ...where,
        dueDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        status: { not: TaskStatus.COMPLETED },
      },
    });

    return {
      totalTasks,
      overdueTasks,
      todayTasks,
      statusBreakdown: statusStats.reduce((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {}),
      priorityBreakdown: priorityStats.reduce((acc, item) => {
        acc[`priority_${item.priority}`] = item._count.id;
        return acc;
      }, {}),
    };
  }

  async getUpcomingTasks(currentUser: any, days: number = 7) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const where: any = {
      dueDate: {
        gte: new Date(),
        lte: futureDate,
      },
      status: { not: TaskStatus.COMPLETED },
    };

    if (currentUser.role === UserRole.AGENT) {
      where.assignedUserId = currentUser.id;
    }

    return this.prisma.task.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}