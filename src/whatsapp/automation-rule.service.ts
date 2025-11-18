import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getTenantContext } from '../common/context/tenant-context';
import {
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
} from './dto/automation-rule.dto';

@Injectable()
export class AutomationRuleService {
  private readonly logger = new Logger(AutomationRuleService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new automation rule
   * CRITICAL: Validates that the template is APPROVED before creating the rule
   */
  async createRule(createRuleDto: CreateAutomationRuleDto, userId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    // CRITICAL VALIDATION: Ensure template exists and is APPROVED
    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: {
        id: createRuleDto.templateId,
        tenantId,
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.status !== 'APPROVED') {
      throw new BadRequestException(
        `Template "${template.name}" must be APPROVED by Meta before it can be used in automation rules. Current status: ${template.status}`,
      );
    }

    // Validate working hours
    if (
      createRuleDto.activeHoursStart !== undefined &&
      createRuleDto.activeHoursEnd !== undefined
    ) {
      if (createRuleDto.activeHoursStart >= createRuleDto.activeHoursEnd) {
        throw new BadRequestException(
          'activeHoursStart must be less than activeHoursEnd',
        );
      }
    }

    const rule = await this.prisma.whatsAppAutomationRule.create({
      data: {
        tenantId,
        createdById: userId,
        name: createRuleDto.name,
        isActive: createRuleDto.isActive ?? true,
        triggerType: createRuleDto.triggerType,
        triggerConditions: createRuleDto.triggerConditions
          ? JSON.stringify(createRuleDto.triggerConditions)
          : null,
        templateId: createRuleDto.templateId,
        templateParams: createRuleDto.templateParams
          ? JSON.stringify(createRuleDto.templateParams)
          : null,
        sendingFrequency: createRuleDto.sendingFrequency,
        maxSendCount: createRuleDto.maxSendCount,
        sendAfterMinutes: createRuleDto.sendAfterMinutes ?? 0,
        activeDays: createRuleDto.activeDays
          ? JSON.stringify(createRuleDto.activeDays)
          : null,
        activeHoursStart: createRuleDto.activeHoursStart,
        activeHoursEnd: createRuleDto.activeHoursEnd,
      },
      include: {
        template: true,
      },
    });

    this.logger.log(`Automation rule created: ${rule.id} by user ${userId}`);
    return rule;
  }

  /**
   * Get all automation rules for tenant
   */
  async getRules(options?: { isActive?: boolean }) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const where: any = { tenantId };
    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    const rules = await this.prisma.whatsAppAutomationRule.findMany({
      where,
      include: {
        template: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: { executionLogs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Parse JSON fields
    return rules.map((rule) => ({
      ...rule,
      triggerConditions: rule.triggerConditions
        ? JSON.parse(rule.triggerConditions)
        : null,
      templateParams: rule.templateParams
        ? JSON.parse(rule.templateParams)
        : null,
      activeDays: rule.activeDays ? JSON.parse(rule.activeDays) : null,
    }));
  }

  /**
   * Get a specific automation rule
   */
  async getRule(ruleId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const rule = await this.prisma.whatsAppAutomationRule.findFirst({
      where: {
        id: ruleId,
        tenantId,
      },
      include: {
        template: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: { executionLogs: true },
        },
      },
    });

    if (!rule) {
      throw new NotFoundException('Automation rule not found');
    }

    // Parse JSON fields
    return {
      ...rule,
      triggerConditions: rule.triggerConditions
        ? JSON.parse(rule.triggerConditions)
        : null,
      templateParams: rule.templateParams
        ? JSON.parse(rule.templateParams)
        : null,
      activeDays: rule.activeDays ? JSON.parse(rule.activeDays) : null,
    };
  }

  /**
   * Update an automation rule
   */
  async updateRule(
    ruleId: string,
    updateRuleDto: UpdateAutomationRuleDto,
    userId: string,
  ) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    // Check if rule exists
    const rule = await this.prisma.whatsAppAutomationRule.findFirst({
      where: {
        id: ruleId,
        tenantId,
      },
    });

    if (!rule) {
      throw new NotFoundException('Automation rule not found');
    }

    // If changing template, validate it's APPROVED
    if (updateRuleDto.templateId && updateRuleDto.templateId !== rule.templateId) {
      const template = await this.prisma.whatsAppTemplate.findFirst({
        where: {
          id: updateRuleDto.templateId,
          tenantId,
        },
      });

      if (!template) {
        throw new NotFoundException('Template not found');
      }

      if (template.status !== 'APPROVED') {
        throw new BadRequestException(
          `Template "${template.name}" must be APPROVED by Meta before it can be used in automation rules. Current status: ${template.status}`,
        );
      }
    }

    // Validate working hours if being updated
    if (
      updateRuleDto.activeHoursStart !== undefined &&
      updateRuleDto.activeHoursEnd !== undefined
    ) {
      if (updateRuleDto.activeHoursStart >= updateRuleDto.activeHoursEnd) {
        throw new BadRequestException(
          'activeHoursStart must be less than activeHoursEnd',
        );
      }
    }

    const updatedRule = await this.prisma.whatsAppAutomationRule.update({
      where: { id: ruleId },
      data: {
        ...updateRuleDto,
        triggerConditions: updateRuleDto.triggerConditions
          ? JSON.stringify(updateRuleDto.triggerConditions)
          : undefined,
        templateParams: updateRuleDto.templateParams
          ? JSON.stringify(updateRuleDto.templateParams)
          : undefined,
        activeDays: updateRuleDto.activeDays
          ? JSON.stringify(updateRuleDto.activeDays)
          : undefined,
      },
      include: {
        template: true,
      },
    });

    this.logger.log(`Automation rule updated: ${ruleId} by user ${userId}`);

    // Parse JSON fields
    return {
      ...updatedRule,
      triggerConditions: updatedRule.triggerConditions
        ? JSON.parse(updatedRule.triggerConditions)
        : null,
      templateParams: updatedRule.templateParams
        ? JSON.parse(updatedRule.templateParams)
        : null,
      activeDays: updatedRule.activeDays
        ? JSON.parse(updatedRule.activeDays)
        : null,
    };
  }

  /**
   * Delete an automation rule
   */
  async deleteRule(ruleId: string, userId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const rule = await this.prisma.whatsAppAutomationRule.findFirst({
      where: {
        id: ruleId,
        tenantId,
      },
    });

    if (!rule) {
      throw new NotFoundException('Automation rule not found');
    }

    await this.prisma.whatsAppAutomationRule.delete({
      where: { id: ruleId },
    });

    this.logger.log(`Automation rule deleted: ${ruleId} by user ${userId}`);
  }

  /**
   * Get execution logs for a rule
   */
  async getExecutionLogs(ruleId: string, limit = 50) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    // Validate rule belongs to tenant
    const rule = await this.prisma.whatsAppAutomationRule.findFirst({
      where: {
        id: ruleId,
        tenantId,
      },
    });

    if (!rule) {
      throw new NotFoundException('Automation rule not found');
    }

    const logs = await this.prisma.whatsAppAutomationLog.findMany({
      where: { ruleId },
      orderBy: { executedAt: 'desc' },
      take: limit,
    });

    // Parse JSON fields
    return logs.map((log) => ({
      ...log,
      errorDetails: log.errorDetails ? JSON.parse(log.errorDetails) : null,
    }));
  }
}
