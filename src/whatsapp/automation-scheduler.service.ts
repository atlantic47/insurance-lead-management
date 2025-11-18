import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/services/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { AutomationTriggerType, SendingFrequency } from './enums/automation.enums';

/**
 * AutomationScheduler - Handles automated template sending based on triggers
 *
 * Key Features:
 * 1. Checks for expired conversation windows (24 hours)
 * 2. Executes automation rules based on triggers
 * 3. Respects sending frequency limits (ONCE, EVERY_WINDOW, etc.)
 * 4. Honors working hours and active days
 * 5. Logs all automation executions for audit trail
 */
@Injectable()
export class AutomationSchedulerService {
  private readonly logger = new Logger(AutomationSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsAppService,
  ) {}

  /**
   * Run every 15 minutes to check for automation triggers
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkAutomations() {
    this.logger.log('🤖 Running automation check...');

    try {
      // Get all active automation rules
      const rules = await this.prisma.whatsAppAutomationRule.findMany({
        where: {
          isActive: true,
        },
        include: {
          template: true,
          tenant: true,
        },
      });

      this.logger.log(`Found ${rules.length} active automation rules`);

      for (const rule of rules) {
        try {
          await this.processAutomationRule(rule);
        } catch (error) {
          this.logger.error(
            `Error processing automation rule ${rule.id}: ${error.message}`,
            error.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error in automation check:', error);
    }
  }

  /**
   * Process a single automation rule
   */
  private async processAutomationRule(rule: any) {
    // Skip if not within active hours
    if (!this.isWithinActiveHours(rule)) {
      return;
    }

    // Skip if not on active day
    if (!this.isActiveDay(rule)) {
      return;
    }

    // Handle different trigger types
    switch (rule.triggerType) {
      case AutomationTriggerType.CONVERSATION_WINDOW_EXPIRED:
        await this.handleConversationWindowExpired(rule);
        break;

      case AutomationTriggerType.LABEL_ASSIGNED:
        await this.handleLabelAssigned(rule);
        break;

      case AutomationTriggerType.TIME_DELAY:
        await this.handleTimeDelay(rule);
        break;

      default:
        this.logger.warn(`Unknown trigger type: ${rule.triggerType}`);
    }
  }

  /**
   * Handle CONVERSATION_WINDOW_EXPIRED trigger
   * Sends template when the 24-hour conversation window expires
   */
  private async handleConversationWindowExpired(rule: any) {
    const now = new Date();
    const windowExpiryTime = new Date(
      now.getTime() - 24 * 60 * 60 * 1000 - rule.sendAfterMinutes * 60 * 1000,
    );

    // Find WhatsApp conversations where last message was ~24 hours ago
    // We look for messages that are in the window expiry range (with 30 min buffer)
    const expiredConversations = await this.prisma.chatMessage.findMany({
      where: {
        tenantId: rule.tenantId,
        platform: 'WHATSAPP',
        updatedAt: {
          gte: new Date(windowExpiryTime.getTime() - 30 * 60 * 1000), // 30 min before
          lte: new Date(windowExpiryTime.getTime() + 30 * 60 * 1000), // 30 min after
        },
      },
      distinct: ['leadId'],
      include: {
        lead: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    this.logger.log(
      `Rule ${rule.id}: Found ${expiredConversations.length} conversations with expired windows`,
    );

    for (const message of expiredConversations) {
      if (!message.lead?.phone) {
        continue;
      }

      try {
        // Use conversationId or leadId as the conversation identifier
        const conversationId = message.conversationId || message.leadId;

        // Check if we should send based on frequency
        const shouldSend = await this.checkSendingFrequency(
          rule,
          conversationId,
          message.lead.phone,
        );

        if (!shouldSend) {
          continue;
        }

        // Send the template
        await this.sendAutomatedTemplate(rule, conversationId, message.lead.phone);
      } catch (error) {
        this.logger.error(
          `Error sending automated template for lead ${message.leadId}:`,
          error,
        );
      }
    }
  }

  /**
   * Handle LABEL_ASSIGNED trigger
   * Sends template when a specific label is assigned to a conversation
   */
  private async handleLabelAssigned(rule: any) {
    const triggerConditions = rule.triggerConditions
      ? JSON.parse(rule.triggerConditions)
      : {};
    const labelId = triggerConditions.labelId;

    if (!labelId) {
      this.logger.warn(`Rule ${rule.id}: No labelId in trigger conditions`);
      return;
    }

    // Find recent label assignments (last 15 minutes to catch new assignments)
    const recentAssignments =
      await this.prisma.whatsAppConversationLabelAssignment.findMany({
        where: {
          labelId,
          assignedAt: {
            gte: new Date(Date.now() - 15 * 60 * 1000),
          },
        },
      });

    this.logger.log(
      `Rule ${rule.id}: Found ${recentAssignments.length} recent label assignments`,
    );

    for (const assignment of recentAssignments) {
      try {
        // Check if we already processed this assignment
        const existingLog = await this.prisma.whatsAppAutomationLog.findFirst({
          where: {
            ruleId: rule.id,
            conversationId: assignment.conversationId,
            executedAt: {
              gte: new Date(assignment.assignedAt.getTime() - 1000), // 1 second buffer
            },
          },
        });

        if (existingLog) {
          continue; // Already processed
        }

        // Wait for the delay if specified
        if (rule.sendAfterMinutes > 0) {
          const shouldWait =
            Date.now() - assignment.assignedAt.getTime() <
            rule.sendAfterMinutes * 60 * 1000;
          if (shouldWait) {
            continue; // Not time yet
          }
        }

        // Get the phone number from the conversation/lead
        // Try to find the lead associated with this conversation
        const conversation = await this.prisma.aIConversation.findFirst({
          where: {
            id: assignment.conversationId,
          },
          include: {
            lead: {
              select: {
                id: true,
                phone: true,
              },
            },
          },
        });

        if (!conversation?.lead?.phone) {
          this.logger.warn(
            `Conversation ${assignment.conversationId} has no associated phone number`,
          );
          continue;
        }

        // Send the template
        await this.sendAutomatedTemplate(
          rule,
          assignment.conversationId,
          conversation.lead.phone,
        );
      } catch (error) {
        this.logger.error(
          `Error sending automated template for label assignment ${assignment.id}:`,
          error,
        );
      }
    }
  }

  /**
   * Handle TIME_DELAY trigger
   * Sends template after a specific time delay from conversation start
   */
  private async handleTimeDelay(rule: any) {
    const triggerConditions = rule.triggerConditions
      ? JSON.parse(rule.triggerConditions)
      : {};
    const delayMinutes = triggerConditions.delayMinutes || rule.sendAfterMinutes;

    const targetTime = new Date(Date.now() - delayMinutes * 60 * 1000);

    // Find conversations that were created around the target time
    const conversations = await this.prisma.aIConversation.findMany({
      where: {
        tenantId: rule.tenantId,
        createdAt: {
          gte: new Date(targetTime.getTime() - 15 * 60 * 1000), // 15 min buffer
          lte: new Date(targetTime.getTime() + 15 * 60 * 1000),
        },
      },
      include: {
        lead: {
          select: {
            id: true,
            phone: true,
          },
        },
      },
    });

    this.logger.log(
      `Rule ${rule.id}: Found ${conversations.length} conversations matching time delay`,
    );

    for (const conversation of conversations) {
      if (!conversation.lead?.phone) {
        continue;
      }

      try {
        // Check if we already processed this conversation
        const shouldSend = await this.checkSendingFrequency(
          rule,
          conversation.id,
          conversation.lead.phone,
        );

        if (!shouldSend) {
          continue;
        }

        await this.sendAutomatedTemplate(rule, conversation.id, conversation.lead.phone);
      } catch (error) {
        this.logger.error(
          `Error sending automated template for conversation ${conversation.id}:`,
          error,
        );
      }
    }
  }

  /**
   * Send automated template message
   */
  private async sendAutomatedTemplate(rule: any, conversationId: string, phone: string) {
    if (!phone) {
      this.logger.warn(
        `Conversation ${conversationId} has no phone number, skipping`,
      );
      return;
    }

    try {
      // Parse template parameters
      const templateParams = rule.templateParams
        ? JSON.parse(rule.templateParams)
        : {};

      // Send via WhatsApp service
      const result = await this.whatsappService.sendTemplateMessage(
        rule.tenantId,
        phone,
        rule.template.name,
        templateParams,
      );

      // Log successful execution
      await this.prisma.whatsAppAutomationLog.create({
        data: {
          tenantId: rule.tenantId,
          ruleId: rule.id,
          conversationId: conversationId,
          phoneNumber: phone,
          success: true,
          status: 'SENT',
          messageId: result?.messageId,
        },
      });

      this.logger.log(
        `✅ Sent automated template "${rule.template.name}" to ${phone} (Rule: ${rule.name})`,
      );
    } catch (error) {
      // Log failed execution
      await this.prisma.whatsAppAutomationLog.create({
        data: {
          tenantId: rule.tenantId,
          ruleId: rule.id,
          conversationId: conversationId,
          phoneNumber: phone,
          success: false,
          status: 'FAILED',
          errorMessage: error.message,
          errorDetails: JSON.stringify({
            stack: error.stack,
            code: error.code,
          }),
        },
      });

      this.logger.error(
        `❌ Failed to send automated template to ${phone}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Check if we should send based on sending frequency
   */
  private async checkSendingFrequency(
    rule: any,
    conversationId: string,
    phoneNumber: string,
  ): Promise<boolean> {
    // Get execution count for this rule + conversation/phone
    const executionCount = await this.prisma.whatsAppAutomationLog.count({
      where: {
        ruleId: rule.id,
        OR: [{ conversationId }, { phoneNumber }],
        success: true,
      },
    });

    // Check max send count
    if (rule.maxSendCount && executionCount >= rule.maxSendCount) {
      return false;
    }

    // Check frequency
    switch (rule.sendingFrequency) {
      case SendingFrequency.ONCE:
        return executionCount === 0;

      case SendingFrequency.EVERY_WINDOW:
        // Allow if no send in last 24 hours
        const recentLog = await this.prisma.whatsAppAutomationLog.findFirst({
          where: {
            ruleId: rule.id,
            conversationId,
            success: true,
            executedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        });
        return !recentLog;

      case SendingFrequency.DAILY:
        // Allow if no send today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayLog = await this.prisma.whatsAppAutomationLog.findFirst({
          where: {
            ruleId: rule.id,
            conversationId,
            success: true,
            executedAt: { gte: today },
          },
        });
        return !todayLog;

      case SendingFrequency.WEEKLY:
        // Allow if no send in last 7 days
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const weekLog = await this.prisma.whatsAppAutomationLog.findFirst({
          where: {
            ruleId: rule.id,
            conversationId,
            success: true,
            executedAt: { gte: weekAgo },
          },
        });
        return !weekLog;

      default:
        return true;
    }
  }

  /**
   * Check if current time is within active hours
   */
  private isWithinActiveHours(rule: any): boolean {
    if (
      rule.activeHoursStart === null ||
      rule.activeHoursStart === undefined ||
      rule.activeHoursEnd === null ||
      rule.activeHoursEnd === undefined
    ) {
      return true; // No restriction
    }

    const now = new Date();
    const currentHour = now.getHours();

    return (
      currentHour >= rule.activeHoursStart && currentHour < rule.activeHoursEnd
    );
  }

  /**
   * Check if today is an active day
   */
  private isActiveDay(rule: any): boolean {
    if (!rule.activeDays) {
      return true; // No restriction
    }

    try {
      const activeDays = JSON.parse(rule.activeDays);
      const today = new Date().getDay(); // 0 = Sunday, 6 = Saturday
      return activeDays.includes(today);
    } catch (error) {
      this.logger.error(`Error parsing activeDays for rule ${rule.id}:`, error);
      return true;
    }
  }
}
