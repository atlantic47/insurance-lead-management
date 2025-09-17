import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadQueryDto } from './dto/lead-query.dto';
import { PaginationResult } from '../common/dto/pagination.dto';
import { UserRole, LeadStatus } from '@prisma/client';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async create(createLeadDto: CreateLeadDto, userId?: string) {
    const leadData = {
      ...createLeadDto,
      assignedUserId: createLeadDto.assignedUserId || userId,
      score: this.calculateInitialScore(createLeadDto),
    };

    return this.prisma.lead.create({
      data: leadData,
      include: {
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async findAll(
    queryDto: LeadQueryDto,
    currentUser: any,
  ): Promise<PaginationResult<any>> {
    const { page, limit, search, sortBy, sortOrder, ...filters } = queryDto;
    const skip = (page - 1) * limit;

    let where: any = {};

    if (currentUser.role === UserRole.AGENT) {
      where.assignedUserId = currentUser.id;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { inquiryDetails: { contains: search } },
      ];
    }

    if (filters.status) where.status = filters.status;
    if (filters.source) where.source = filters.source;
    if (filters.insuranceType) where.insuranceType = filters.insuranceType;
    if (filters.assignedUserId) where.assignedUserId = filters.assignedUserId;

    if (filters.urgency) {
      const urgencyMap = { low: [1, 2], medium: [3], high: [4, 5] };
      where.urgency = { in: urgencyMap[filters.urgency] || [1, 2, 3, 4, 5] };
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const orderBy = sortBy ? { [sortBy]: sortOrder } : { createdAt: sortOrder };

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
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
              email: true,
            },
          },
          _count: {
            select: {
              communications: true,
              tasks: true,
            },
          },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      data: leads,
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

    const lead = await this.prisma.lead.findFirst({
      where,
      include: {
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        communications: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        tasks: {
          where: { status: { not: 'COMPLETED' } },
          orderBy: { dueDate: 'asc' },
          include: {
            assignedUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        leadProducts: {
          include: {
            product: true,
          },
        },
        client: {
          select: {
            id: true,
            policyNumber: true,
            premium: true,
            startDate: true,
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  async update(id: string, updateLeadDto: UpdateLeadDto, currentUser: any) {
    const existingLead = await this.findOne(id, currentUser);

    if (
      currentUser.role === UserRole.AGENT &&
      existingLead.assignedUserId !== currentUser.id
    ) {
      throw new ForbiddenException('You can only update your own leads');
    }

    const updateData: any = { ...updateLeadDto };

    if (updateLeadDto.status && updateLeadDto.status !== existingLead.status) {
      updateData.lastContactedAt = new Date();
    }

    return this.prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async remove(id: string, currentUser: any) {
    const lead = await this.findOne(id, currentUser);

    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can delete leads');
    }

    return this.prisma.lead.delete({
      where: { id },
    });
  }

  async assignLead(id: string, assignedUserId: string, currentUser: any) {
    if (currentUser.role === UserRole.AGENT) {
      throw new ForbiddenException('Agents cannot reassign leads');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: assignedUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.lead.update({
      where: { id },
      data: {
        assignedUserId,
        updatedAt: new Date(),
      },
      include: {
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async updateLeadScore(id: string, score: number, currentUser: any) {
    const lead = await this.findOne(id, currentUser);

    return this.prisma.lead.update({
      where: { id },
      data: {
        manualScore: score,
        updatedAt: new Date(),
      },
    });
  }

  async convertToClient(id: string, currentUser: any) {
    const lead = await this.findOne(id, currentUser);

    if (lead.client) {
      throw new BadRequestException('Lead already converted to client');
    }

    if (lead.status !== LeadStatus.CLOSED_WON) {
      throw new BadRequestException(
        'Lead must be in CLOSED_WON status to convert to client',
      );
    }

    return this.prisma.client.create({
      data: {
        leadId: id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
      },
      include: {
        lead: true,
      },
    });
  }

  async getLeadStats(currentUser: any) {
    const where = currentUser.role === UserRole.AGENT 
      ? { assignedUserId: currentUser.id } 
      : {};

    const [statusStats, sourceStats, typeStats, totalLeads] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      this.prisma.lead.groupBy({
        by: ['source'],
        where,
        _count: { id: true },
      }),
      this.prisma.lead.groupBy({
        by: ['insuranceType'],
        where,
        _count: { id: true },
      }),
      this.prisma.lead.count({ where }),
    ]);

    const conversionRate = await this.calculateConversionRate(where);

    return {
      totalLeads,
      conversionRate,
      statusBreakdown: statusStats.reduce((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {}),
      sourceBreakdown: sourceStats.reduce((acc, item) => {
        acc[item.source] = item._count.id;
        return acc;
      }, {}),
      typeBreakdown: typeStats.reduce((acc, item) => {
        acc[item.insuranceType] = item._count.id;
        return acc;
      }, {}),
    };
  }

  private calculateInitialScore(leadData: CreateLeadDto): number {
    let score = 10;

    if (leadData.email) score += 15;
    if (leadData.phone) score += 15;
    if (leadData.budget) score += 20;
    if (leadData.inquiryDetails && leadData.inquiryDetails.length > 50) score += 10;
    if (leadData.expectedCloseDate) score += 15;

    score += (leadData.urgency || 1) * 5;

    return Math.min(score, 100);
  }

  async getPipelineView(currentUser: any) {
    const where = currentUser.role === UserRole.AGENT 
      ? { assignedUserId: currentUser.id } 
      : {};

    const statusOrder = [
      LeadStatus.NEW,
      LeadStatus.CONTACTED,
      LeadStatus.ENGAGED,
      LeadStatus.QUALIFIED,
      LeadStatus.PROPOSAL_SENT,
      LeadStatus.NEGOTIATION,
      LeadStatus.CLOSED_WON,
      LeadStatus.CLOSED_LOST,
      LeadStatus.FOLLOW_UP,
    ];

    const pipelineStages = await Promise.all(
      statusOrder.map(async (status) => {
        const leads = await this.prisma.lead.findMany({
          where: { ...where, status },
          include: {
            assignedUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        });

        const avgTimeInStage = await this.calculateAverageTimeInStage(status, where);

        return {
          stage: status,
          leads,
          count: leads.length,
          averageTimeInStage: avgTimeInStage,
        };
      })
    );

    const totalLeads = pipelineStages.reduce((sum, stage) => sum + stage.count, 0);
    const conversionRate = await this.calculateConversionRate(where);

    return {
      pipeline: pipelineStages,
      summary: {
        totalLeads,
        conversionRate,
        activeStages: pipelineStages.filter(stage => stage.count > 0).length,
      },
    };
  }

  async moveToPipelineStage(
    leadId: string,
    newStatus: LeadStatus,
    notes: string,
    currentUser: any
  ) {
    const lead = await this.findOne(leadId, currentUser);
    const oldStatus = lead.status;

    const updatedLead = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        status: newStatus,
        lastContactedAt: new Date(),
        updatedAt: new Date(),
      },
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

    // Log the stage transition
    if (notes) {
      await this.prisma.communication.create({
        data: {
          leadId,
          channel: 'IN_APP',
          direction: 'OUTBOUND',
          subject: `Pipeline Stage Change: ${oldStatus} → ${newStatus}`,
          content: notes,
          userId: currentUser.id,
        },
      });
    }

    // Auto-create follow-up task based on new stage
    await this.createAutoFollowUpTask(leadId, newStatus, currentUser.id);

    return updatedLead;
  }

  async getPipelineMetrics(currentUser: any) {
    const where = currentUser.role === UserRole.AGENT 
      ? { assignedUserId: currentUser.id } 
      : {};

    const [
      stageDistribution,
      avgTimeByStage,
      conversionFunnel,
      recentTransitions
    ] = await Promise.all([
      this.getStageDistribution(where),
      this.getAverageTimeByStage(where),
      this.getConversionFunnel(where),
      this.getRecentStageTransitions(where),
    ]);

    return {
      stageDistribution,
      avgTimeByStage,
      conversionFunnel,
      recentTransitions,
    };
  }

  private async calculateAverageTimeInStage(stage: LeadStatus, where: any): Promise<string> {
    // Mock implementation - in real scenario, you'd track stage transition timestamps
    const stageTimings = {
      [LeadStatus.NEW]: '1.2 days',
      [LeadStatus.CONTACTED]: '2.1 days',
      [LeadStatus.ENGAGED]: '3.5 days',
      [LeadStatus.QUALIFIED]: '2.8 days',
      [LeadStatus.PROPOSAL_SENT]: '4.2 days',
      [LeadStatus.NEGOTIATION]: '5.1 days',
      [LeadStatus.CLOSED_WON]: '0 days',
      [LeadStatus.CLOSED_LOST]: '0 days',
      [LeadStatus.FOLLOW_UP]: '7.3 days',
    };
    
    return stageTimings[stage] || '0 days';
  }

  private async createAutoFollowUpTask(leadId: string, newStatus: LeadStatus, userId: string) {
    const taskTemplates = {
      [LeadStatus.CONTACTED]: {
        title: 'Follow up on initial contact',
        type: 'FOLLOW_UP',
        daysFromNow: 1,
        priority: 3,
      },
      [LeadStatus.ENGAGED]: {
        title: 'Send product information',
        type: 'EMAIL',
        daysFromNow: 1,
        priority: 4,
      },
      [LeadStatus.QUALIFIED]: {
        title: 'Prepare and send proposal',
        type: 'PROPOSAL',
        daysFromNow: 2,
        priority: 5,
      },
      [LeadStatus.PROPOSAL_SENT]: {
        title: 'Follow up on proposal',
        type: 'FOLLOW_UP',
        daysFromNow: 3,
        priority: 4,
      },
      [LeadStatus.NEGOTIATION]: {
        title: 'Schedule negotiation call',
        type: 'CALL',
        daysFromNow: 1,
        priority: 5,
      },
    };

    const template = taskTemplates[newStatus];
    if (template) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + template.daysFromNow);

      await this.prisma.task.create({
        data: {
          title: template.title,
          type: template.type,
          priority: template.priority,
          dueDate,
          leadId,
          assignedUserId: userId,
        },
      });
    }
  }

  private async getStageDistribution(where: any) {
    return this.prisma.lead.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });
  }

  private async getAverageTimeByStage(where: any) {
    // Mock implementation - would calculate actual stage durations
    return {
      [LeadStatus.NEW]: 1.2,
      [LeadStatus.CONTACTED]: 2.1,
      [LeadStatus.ENGAGED]: 3.5,
      [LeadStatus.QUALIFIED]: 2.8,
      [LeadStatus.PROPOSAL_SENT]: 4.2,
      [LeadStatus.NEGOTIATION]: 5.1,
    };
  }

  private async getConversionFunnel(where: any) {
    const statusOrder = [
      LeadStatus.NEW,
      LeadStatus.CONTACTED,
      LeadStatus.ENGAGED,
      LeadStatus.QUALIFIED,
      LeadStatus.PROPOSAL_SENT,
      LeadStatus.NEGOTIATION,
      LeadStatus.CLOSED_WON,
    ];

    const funnel = await Promise.all(
      statusOrder.map(async (status) => {
        const count = await this.prisma.lead.count({
          where: { ...where, status },
        });
        return { status, count };
      })
    );

    return funnel.map((stage, index) => ({
      ...stage,
      conversionRate: index > 0 
        ? funnel[0].count > 0 
          ? (stage.count / funnel[0].count) * 100 
          : 0
        : 100,
    }));
  }

  private async getRecentStageTransitions(where: any) {
    // Mock implementation - would query actual stage transition logs
    return this.prisma.lead.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        updatedAt: true,
        assignedUser: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  private async calculateConversionRate(where: any): Promise<number> {
    const [total, converted] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.count({
        where: {
          ...where,
          status: LeadStatus.CLOSED_WON,
        },
      }),
    ]);

    return total > 0 ? (converted / total) * 100 : 0;
  }
}