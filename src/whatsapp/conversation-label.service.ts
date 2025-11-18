import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getTenantContext } from '../common/context/tenant-context';
import {
  CreateConversationLabelDto,
  UpdateConversationLabelDto,
  AssignLabelDto,
} from './dto/conversation-label.dto';

@Injectable()
export class ConversationLabelService {
  private readonly logger = new Logger(ConversationLabelService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new conversation label
   */
  async createLabel(
    createLabelDto: CreateConversationLabelDto,
    userId: string,
  ) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    // Check if label name already exists for this tenant
    const existingLabel = await this.prisma.whatsAppConversationLabel.findFirst({
      where: {
        tenantId,
        name: createLabelDto.name,
      },
    });

    if (existingLabel) {
      throw new ConflictException('Label with this name already exists');
    }

    const label = await this.prisma.whatsAppConversationLabel.create({
      data: {
        tenantId,
        name: createLabelDto.name,
        color: createLabelDto.color,
        description: createLabelDto.description,
        isSystemLabel: createLabelDto.isSystemLabel || false,
      },
    });

    this.logger.log(`Label created: ${label.id} by user ${userId}`);
    return label;
  }

  /**
   * Get all labels for tenant
   */
  async getLabels() {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    return this.prisma.whatsAppConversationLabel.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { conversations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a specific label
   */
  async getLabel(labelId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const label = await this.prisma.whatsAppConversationLabel.findFirst({
      where: {
        id: labelId,
        tenantId,
      },
      include: {
        _count: {
          select: { conversations: true },
        },
      },
    });

    if (!label) {
      throw new NotFoundException('Label not found');
    }

    return label;
  }

  /**
   * Update a label
   */
  async updateLabel(
    labelId: string,
    updateLabelDto: UpdateConversationLabelDto,
    userId: string,
  ) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    // Check if label exists
    const label = await this.prisma.whatsAppConversationLabel.findFirst({
      where: {
        id: labelId,
        tenantId,
      },
    });

    if (!label) {
      throw new NotFoundException('Label not found');
    }

    // Don't allow updating system labels
    if (label.isSystemLabel) {
      throw new BadRequestException('Cannot update system labels');
    }

    // Check if new name conflicts
    if (updateLabelDto.name && updateLabelDto.name !== label.name) {
      const existingLabel = await this.prisma.whatsAppConversationLabel.findFirst({
        where: {
          tenantId,
          name: updateLabelDto.name,
          id: { not: labelId },
        },
      });

      if (existingLabel) {
        throw new ConflictException('Label with this name already exists');
      }
    }

    const updatedLabel = await this.prisma.whatsAppConversationLabel.update({
      where: { id: labelId },
      data: updateLabelDto,
    });

    this.logger.log(`Label updated: ${labelId} by user ${userId}`);
    return updatedLabel;
  }

  /**
   * Delete a label
   */
  async deleteLabel(labelId: string, userId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const label = await this.prisma.whatsAppConversationLabel.findFirst({
      where: {
        id: labelId,
        tenantId,
      },
    });

    if (!label) {
      throw new NotFoundException('Label not found');
    }

    // Don't allow deleting system labels
    if (label.isSystemLabel) {
      throw new BadRequestException('Cannot delete system labels');
    }

    await this.prisma.whatsAppConversationLabel.delete({
      where: { id: labelId },
    });

    this.logger.log(`Label deleted: ${labelId} by user ${userId}`);
  }

  /**
   * Assign label to conversation
   * CRITICAL: This validates that if the label requires an approved template,
   * the user must have one before the label can be assigned
   */
  async assignLabel(assignLabelDto: AssignLabelDto, userId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const { conversationId, labelId } = assignLabelDto;

    // Validate label exists and belongs to tenant
    const label = await this.prisma.whatsAppConversationLabel.findFirst({
      where: {
        id: labelId,
        tenantId,
      },
    });

    if (!label) {
      throw new NotFoundException('Label not found');
    }

    // Validate conversation exists and belongs to tenant
    const conversation = await this.prisma.aIConversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check if there are automation rules associated with this label
    // Get all automation rules with LABEL_ASSIGNED trigger for this tenant
    const automationRules = await this.prisma.whatsAppAutomationRule.findMany({
      where: {
        tenantId,
        isActive: true,
        triggerType: 'LABEL_ASSIGNED',
      },
      include: {
        template: true,
      },
    });

    // Filter rules that target this specific label by parsing JSON
    const relevantRules = automationRules.filter((rule) => {
      if (!rule.triggerConditions) return false;
      try {
        const conditions = JSON.parse(rule.triggerConditions);
        return conditions.labelId === labelId;
      } catch {
        return false;
      }
    });

    // CRITICAL VALIDATION: If automation rules exist for this label,
    // ensure ALL templates are APPROVED
    if (relevantRules.length > 0) {
      const unapprovedTemplates = relevantRules.filter(
        (rule) => rule.template.status !== 'APPROVED',
      );

      if (unapprovedTemplates.length > 0) {
        const templateNames = unapprovedTemplates
          .map((rule) => rule.template.name)
          .join(', ');
        throw new BadRequestException(
          `Cannot assign label "${label.name}" because the following automation templates are not approved: ${templateNames}. Please ensure all templates are approved by Meta before using this label.`,
        );
      }
    }

    // Check if already assigned
    const existingAssignment =
      await this.prisma.whatsAppConversationLabelAssignment.findFirst({
        where: {
          conversationId,
          labelId,
        },
      });

    if (existingAssignment) {
      throw new ConflictException('Label already assigned to this conversation');
    }

    // Assign the label
    const assignment = await this.prisma.whatsAppConversationLabelAssignment.create({
      data: {
        tenantId,
        conversationId,
        labelId,
        assignedById: userId,
      },
      include: {
        label: true,
      },
    });

    this.logger.log(
      `Label ${labelId} assigned to conversation ${conversationId} by user ${userId}`,
    );

    return assignment;
  }

  /**
   * Remove label from conversation
   */
  async removeLabel(conversationId: string, labelId: string, userId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    // Validate the assignment exists and belongs to tenant
    const assignment =
      await this.prisma.whatsAppConversationLabelAssignment.findFirst({
        where: {
          conversationId,
          labelId,
          label: {
            tenantId,
          },
        },
      });

    if (!assignment) {
      throw new NotFoundException('Label assignment not found');
    }

    await this.prisma.whatsAppConversationLabelAssignment.delete({
      where: { id: assignment.id },
    });

    this.logger.log(
      `Label ${labelId} removed from conversation ${conversationId} by user ${userId}`,
    );
  }

  /**
   * Get all labels for a conversation
   */
  async getConversationLabels(conversationId: string) {
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    // Validate conversation belongs to tenant
    const conversation = await this.prisma.aIConversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.prisma.whatsAppConversationLabelAssignment.findMany({
      where: { conversationId },
      include: {
        label: true,
      },
      orderBy: { assignedAt: 'desc' },
    });
  }
}
