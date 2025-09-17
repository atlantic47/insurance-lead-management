import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { UserRole, LeadStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getLeadConversionReport(startDate?: Date, endDate?: Date) {
    const dateFilter = this.getDateFilter(startDate, endDate);

    const [totalLeads, convertedLeads, leadsByStatus] = await Promise.all([
      this.prisma.lead.count({ where: { createdAt: dateFilter } }),
      this.prisma.lead.count({
        where: { status: LeadStatus.CLOSED_WON, createdAt: dateFilter },
      }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where: { createdAt: dateFilter },
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

    const agents = await this.prisma.user.findMany({
      where: { role: UserRole.AGENT, isActive: true },
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

    const [channelStats, responseTimeStats, communicationsByDay] = await Promise.all([
      this.prisma.communication.groupBy({
        by: ['channel'],
        where: { createdAt: dateFilter },
        _count: { id: true },
      }),
      this.prisma.communication.findMany({
        where: {
          createdAt: dateFilter,
          direction: 'OUTBOUND',
        },
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
        where: { createdAt: dateFilter },
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

    const [statusFlow, avgTimeInStages, sourcePerformance] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['status', 'source'],
        where: { createdAt: dateFilter },
        _count: { id: true },
      }),
      this.calculateAverageTimeInStages(dateFilter),
      this.prisma.lead.groupBy({
        by: ['source'],
        where: { createdAt: dateFilter, status: LeadStatus.CLOSED_WON },
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
    const [
      leadConversion,
      agentPerformance,
      communicationStats,
      pipelineAnalytics,
    ] = await Promise.all([
      this.getLeadConversionReport(startDate, endDate),
      this.getAgentPerformanceReport(startDate, endDate),
      this.getCommunicationEffectivenessReport(startDate, endDate),
      this.getPipelineAnalytics(startDate, endDate),
    ]);

    return {
      period: { startDate, endDate },
      leadConversion: {
        totalLeads: leadConversion.totalLeads,
        convertedLeads: leadConversion.convertedLeads,
        conversionRate: leadConversion.conversionRate,
      },
      agentPerformance: {
        totalAgents: agentPerformance.summary.totalAgents,
        averageConversionRate: agentPerformance.summary.averageConversionRate,
        totalLeadsAssigned: agentPerformance.summary.totalLeadsAssigned,
      },
      communications: {
        totalCommunications: communicationStats.totalCommunications,
        channelBreakdown: communicationStats.channelBreakdown,
      },
      pipeline: {
        statusFlow: pipelineAnalytics.statusFlow,
        sourcePerformance: pipelineAnalytics.sourcePerformance,
      },
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
}