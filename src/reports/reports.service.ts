import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { UserRole, LeadStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getLeadConversionReport(startDate?: Date, endDate?: Date) {
    const dateFilter = this.getDateFilter(startDate, endDate);

    let where: any = dateFilter ? { createdAt: dateFilter } : {};
    where = this.prisma.addTenantFilter(where);

    let whereWon: any = { status: LeadStatus.CLOSED_WON };
    if (dateFilter) whereWon.createdAt = dateFilter;
    whereWon = this.prisma.addTenantFilter(whereWon);

    const [totalLeads, convertedLeads, leadsByStatus] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.count({ where: whereWon }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
    ]);

    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    return {
      period: { startDate, endDate },
      totalLeads,
      convertedLeads,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
      leadsByStatus: leadsByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {}),
    };
  }

  async getAgentPerformanceReport(startDate?: Date, endDate?: Date) {
    const dateFilter = this.getDateFilter(startDate, endDate);

    let userWhere: any = { role: UserRole.AGENT, isActive: true };
    userWhere = this.prisma.addTenantFilter(userWhere);

    const agents = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        assignedLeads: {
          where: { createdAt: dateFilter },
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
        communications: {
          where: { createdAt: dateFilter },
          select: { id: true },
        },
        tasks: {
          where: { createdAt: dateFilter },
          select: { id: true, status: true },
        },
      },
    });

    const agentStats = agents.map(agent => {
      const leads = agent.assignedLeads;
      const convertedLeads = leads.filter(lead => lead.status === LeadStatus.CLOSED_WON).length;
      const conversionRate = leads.length > 0 ? (convertedLeads / leads.length) * 100 : 0;
      const completedTasks = agent.tasks.filter(task => task.status === 'COMPLETED').length;

      return {
        agent: {
          id: agent.id,
          name: `${agent.firstName} ${agent.lastName}`,
          email: agent.email,
        },
        totalLeads: leads.length,
        convertedLeads,
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        totalCommunications: agent.communications.length,
        totalTasks: agent.tasks.length,
        completedTasks,
        taskCompletionRate: agent.tasks.length > 0 ? parseFloat(((completedTasks / agent.tasks.length) * 100).toFixed(2)) : 0,
      };
    });

    return {
      period: { startDate, endDate },
      agents: agentStats,
      summary: {
        totalAgents: agentStats.length,
        averageConversionRate: parseFloat((agentStats.reduce((sum, agent) => sum + agent.conversionRate, 0) / agentStats.length || 0).toFixed(2)),
        totalLeadsAssigned: agentStats.reduce((sum, agent) => sum + agent.totalLeads, 0),
        totalConversions: agentStats.reduce((sum, agent) => sum + agent.convertedLeads, 0),
      },
    };
  }

  async getCommunicationEffectivenessReport(startDate?: Date, endDate?: Date) {
    const dateFilter = this.getDateFilter(startDate, endDate);

    let where: any = dateFilter ? { createdAt: dateFilter } : {};
    where = this.prisma.addTenantFilter(where);

    const [channelStats, responseTimeStats, communicationsByDay] = await Promise.all([
      this.prisma.communication.groupBy({
        by: ['channel'],
        where,
        _count: { id: true },
      }),
      this.prisma.communication.findMany({
        where: this.prisma.addTenantFilter({
          createdAt: dateFilter,
          direction: 'OUTBOUND',
        }),
        include: {
          lead: {
            select: {
              communications: {
                where: {
                  direction: 'INBOUND',
                  createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      }),
      this.prisma.communication.groupBy({
        by: ['createdAt'],
        where,
        _count: { id: true },
      }),
    ]);

    return {
      period: { startDate, endDate },
      channelBreakdown: channelStats.reduce((acc, item) => {
        acc[item.channel] = item._count.id;
        return acc;
      }, {}),
      totalCommunications: channelStats.reduce((sum, item) => sum + item._count.id, 0),
      averageResponseTime: '2.5 hours', // Mock data - would calculate from actual data
      communicationTrends: communicationsByDay.slice(0, 30), // Last 30 days
    };
  }

  async getPipelineAnalytics(startDate?: Date, endDate?: Date) {
    const dateFilter = this.getDateFilter(startDate, endDate);

    let where: any = dateFilter ? { createdAt: dateFilter } : {};
    where = this.prisma.addTenantFilter(where);

    let whereWon: any = { status: LeadStatus.CLOSED_WON };
    if (dateFilter) whereWon.createdAt = dateFilter;
    whereWon = this.prisma.addTenantFilter(whereWon);

    const [statusFlow, avgTimeInStages, sourcePerformance] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['status', 'source'],
        where,
        _count: { id: true },
      }),
      this.calculateAverageTimeInStages(dateFilter),
      this.prisma.lead.groupBy({
        by: ['source'],
        where: whereWon,
        _count: { id: true },
      }),
    ]);

    return {
      period: { startDate, endDate },
      statusFlow: statusFlow.reduce((acc, item) => {
        if (!acc[item.status]) acc[item.status] = {};
        acc[item.status][item.source] = item._count.id;
        return acc;
      }, {}),
      avgTimeInStages,
      sourcePerformance: sourcePerformance.reduce((acc, item) => {
        acc[item.source] = item._count.id;
        return acc;
      }, {}),
    };
  }

  async getDashboard(startDate?: Date, endDate?: Date) {
    let baseWhere: any = {};
    baseWhere = this.prisma.addTenantFilter(baseWhere);

    let inProgressWhere: any = { status: 'IN_PROGRESS' };
    inProgressWhere = this.prisma.addTenantFilter(inProgressWhere);

    let pendingWhere: any = { status: 'PENDING' };
    pendingWhere = this.prisma.addTenantFilter(pendingWhere);

    const [
      totalLeads,
      totalClients,
      activeTasks,
      pendingTasks,
      recentLeads,
      pipelineData,
      revenue,
    ] = await Promise.all([
      this.prisma.lead.count({ where: baseWhere }),
      this.prisma.client.count({ where: baseWhere }),
      this.prisma.task.count({ where: inProgressWhere }),
      this.prisma.task.count({ where: pendingWhere }),
      this.prisma.lead.findMany({
        where: baseWhere,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedUser: {
            select: {
              firstName: true,
              lastName: true,
            }
          }
        },
      }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { id: true },
      }),
      this.prisma.client.aggregate({
        where: baseWhere,
        _sum: {
          premium: true,
        },
      }),
    ]);

    const conversionRate = totalLeads > 0
      ? parseFloat(((totalClients / totalLeads) * 100).toFixed(2))
      : 0;

    return {
      totalLeads,
      totalClients,
      conversionRate,
      activeTasks,
      pendingTasks,
      revenue: revenue._sum.premium ? parseFloat(revenue._sum.premium.toString()) : 0,
      recentActivity: recentLeads.map(lead => ({
        id: lead.id,
        type: 'lead_created',
        message: `New lead: ${lead.firstName} ${lead.lastName}`,
        timestamp: lead.createdAt,
        user: lead.assignedUser ? `${lead.assignedUser.firstName} ${lead.assignedUser.lastName}` : null,
      })),
      pipelineData: pipelineData.map(item => ({
        status: item.status,
        count: item._count.id,
      })),
    };
  }

  async exportToCsv(reportType: string, startDate?: Date, endDate?: Date) {
    let data;
    
    switch (reportType) {
      case 'leads':
        data = await this.getLeadConversionReport(startDate, endDate);
        break;
      case 'agents':
        data = await this.getAgentPerformanceReport(startDate, endDate);
        break;
      case 'communications':
        data = await this.getCommunicationEffectivenessReport(startDate, endDate);
        break;
      default:
        throw new Error('Invalid report type');
    }

    // Mock CSV generation - in real implementation, use a CSV library
    const csvContent = JSON.stringify(data, null, 2);
    
    return {
      filename: `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`,
      content: csvContent,
      mimeType: 'text/csv',
    };
  }

  private getDateFilter(startDate?: Date, endDate?: Date) {
    const filter: any = {};
    
    if (startDate || endDate) {
      if (startDate) filter.gte = startDate;
      if (endDate) filter.lte = endDate;
      return filter;
    }
    
    return undefined;
  }

  private async calculateAverageTimeInStages(dateFilter: any) {
    // Mock implementation - would calculate actual stage transition times
    return {
      'NEW_TO_CONTACTED': '1.2 days',
      'CONTACTED_TO_ENGAGED': '2.5 days',
      'ENGAGED_TO_QUALIFIED': '3.1 days',
      'QUALIFIED_TO_PROPOSAL': '1.8 days',
      'PROPOSAL_TO_CLOSED': '5.2 days',
    };
  }

  async getLeadMetrics(startDate?: Date, endDate?: Date) {
    let whereClause: any = this.buildDateWhereClause(startDate, endDate);
    whereClause = this.prisma.addTenantFilter(whereClause);

    const [totalLeads, statusBreakdown, sourceBreakdown, trends] = await Promise.all([
      this.prisma.lead.count({ where: whereClause }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where: whereClause,
        _count: { id: true },
      }),
      this.prisma.lead.groupBy({
        by: ['source'],
        where: whereClause,
        _count: { id: true },
      }),
      this.getLeadTrends(startDate, endDate),
    ]);

    return {
      totalLeads,
      statusBreakdown: statusBreakdown.map(item => ({
        status: item.status,
        count: item._count.id,
      })),
      sourceBreakdown: sourceBreakdown.map(item => ({
        source: item.source,
        count: item._count.id,
      })),
      trends,
    };
  }

  async getPerformanceMetrics(startDate?: Date, endDate?: Date) {
    const whereClause = this.buildDateWhereClause(startDate, endDate);

    let userWhere: any = { role: { in: [UserRole.AGENT, UserRole.MANAGER] } };
    userWhere = this.prisma.addTenantFilter(userWhere);

    const agents = await this.prisma.user.findMany({
      where: userWhere,
      include: {
        assignedLeads: {
          where: whereClause,
          include: { client: true },
        },
        tasks: {
          where: whereClause,
        },
      },
    });

    return agents.map(agent => ({
      id: agent.id,
      name: `${agent.firstName} ${agent.lastName}`,
      totalLeads: agent.assignedLeads.length,
      convertedLeads: agent.assignedLeads.filter(l => l.client).length,
      conversionRate: agent.assignedLeads.length > 0
        ? parseFloat(((agent.assignedLeads.filter(l => l.client).length / agent.assignedLeads.length) * 100).toFixed(2))
        : 0,
      tasksCompleted: agent.tasks.filter(t => t.status === 'COMPLETED').length,
      tasksTotal: agent.tasks.length,
    }));
  }

  private buildDateWhereClause(startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }
    return where;
  }

  private async getLeadTrends(startDate?: Date, endDate?: Date) {
    let whereClause: any = this.buildDateWhereClause(startDate, endDate);
    whereClause = this.prisma.addTenantFilter(whereClause);

    // Group leads by day for trend analysis
    const leads = await this.prisma.lead.findMany({
      where: whereClause,
      select: {
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const trendsMap = new Map<string, number>();
    leads.forEach(lead => {
      const dateKey = lead.createdAt.toISOString().split('T')[0];
      trendsMap.set(dateKey, (trendsMap.get(dateKey) || 0) + 1);
    });

    return Array.from(trendsMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  }
}