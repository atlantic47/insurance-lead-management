import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { CommunicationQueryDto } from './dto/communication-query.dto';
import { PaginationResult } from '../common/dto/pagination.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class CommunicationsService {
  constructor(private prisma: PrismaService) {}

  async create(createCommunicationDto: CreateCommunicationDto, userId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: createCommunicationDto.leadId },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const communication = await this.prisma.communication.create({
      // @ts-ignore - tenantId added by Prisma middleware
      data: {
        ...createCommunicationDto,
        userId,
        sentAt: new Date(),
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await this.prisma.lead.update({
      where: { id: createCommunicationDto.leadId },
      data: { lastContactedAt: new Date() },
    });

    return communication;
  }

  async findAll(
    queryDto: CommunicationQueryDto,
    currentUser: any,
  ): Promise<PaginationResult<any>> {
    const { page, limit, search, sortBy, sortOrder, ...filters } = queryDto;
    const skip = (page - 1) * limit;

    let where: any = {};

    // Add tenant filter first
    where = this.prisma.addTenantFilter(where);

    if (currentUser.role === UserRole.AGENT) {
      where.lead = { assignedUserId: currentUser.id };
    }

    if (search) {
      where.OR = [
        { subject: { contains: search } },
        { content: { contains: search } },
      ];
    }

    if (filters.leadId) where.leadId = filters.leadId;
    if (filters.channel) where.channel = filters.channel;
    if (filters.direction) where.direction = filters.direction;
    if (filters.isRead !== undefined) where.isRead = filters.isRead;

    if (filters.startDate || filters.endDate) {
      where.sentAt = {};
      if (filters.startDate) where.sentAt.gte = filters.startDate;
      if (filters.endDate) where.sentAt.lte = filters.endDate;
    }

    const orderBy = sortBy ? { [sortBy]: sortOrder } : { sentAt: sortOrder };

    const [communications, total] = await Promise.all([
      this.prisma.communication.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              assignedUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.communication.count({ where }),
    ]);

    return {
      data: communications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };
  }

  async findOne(id: string, currentUser: any) {
    let where: any = { id };

    // Add tenant filter first
    where = this.prisma.addTenantFilter(where);

    if (currentUser.role === UserRole.AGENT) {
      where.lead = { assignedUserId: currentUser.id };
    }

    const communication = await this.prisma.communication.findFirst({
      where,
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!communication) {
      throw new NotFoundException('Communication not found');
    }

    return communication;
  }

  async markAsRead(id: string, currentUser: any) {
    const communication = await this.findOne(id, currentUser);

    return this.prisma.communication.update({
      where: { id },
      data: { isRead: true },
      include: {
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

  async getLeadCommunications(leadId: string, currentUser: any) {
    let leadWhere: any = { id: leadId };
    leadWhere = this.prisma.addTenantFilter(leadWhere);

    if (currentUser.role === UserRole.AGENT) {
      leadWhere.assignedUserId = currentUser.id;
    }

    const lead = await this.prisma.lead.findFirst({
      where: leadWhere,
    });

    if (!lead) {
      throw new NotFoundException('Lead not found or access denied');
    }

    let commWhere: any = { leadId };
    commWhere = this.prisma.addTenantFilter(commWhere);

    return this.prisma.communication.findMany({
      where: commWhere,
      orderBy: { sentAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async getCommunicationStats(currentUser: any) {
    let where: any = {};

    // Add tenant filter first
    where = this.prisma.addTenantFilter(where);

    if (currentUser.role === UserRole.AGENT) {
      where.lead = { assignedUserId: currentUser.id };
    }

    const [channelStats, directionStats, totalCommunications, unreadCount] = await Promise.all([
      this.prisma.communication.groupBy({
        by: ['channel'],
        where,
        _count: { id: true },
      }),
      this.prisma.communication.groupBy({
        by: ['direction'],
        where,
        _count: { id: true },
      }),
      this.prisma.communication.count({ where }),
      this.prisma.communication.count({
        where: { ...where, isRead: false },
      }),
    ]);

    return {
      totalCommunications,
      unreadCount,
      channelBreakdown: channelStats.reduce((acc, item) => {
        acc[item.channel] = item._count.id;
        return acc;
      }, {}),
      directionBreakdown: directionStats.reduce((acc, item) => {
        acc[item.direction] = item._count.id;
        return acc;
      }, {}),
    };
  }

  async createTemplate(name: string, content: string, channel: any, userId: string) {
    // This could be extended to store communication templates
    // For now, we'll implement a basic structure
    return {
      id: 'template-' + Date.now(),
      name,
      content,
      channel,
      createdBy: userId,
      createdAt: new Date(),
    };
  }

  async getTemplates(channel?: any) {
    // This would return stored templates
    // For now, returning some example templates
    const templates = [
      {
        id: '1',
        name: 'Welcome Email',
        content: 'Thank you for your interest in our insurance products...',
        channel: 'EMAIL',
      },
      {
        id: '2',
        name: 'Follow-up Call',
        content: 'Following up on our previous conversation...',
        channel: 'PHONE',
      },
      {
        id: '3',
        name: 'WhatsApp Follow-up',
        content: 'Hi! Just checking in regarding your insurance inquiry...',
        channel: 'WHATSAPP',
      },
    ];

    return channel 
      ? templates.filter(t => t.channel === channel)
      : templates;
  }
}