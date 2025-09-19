import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { WhatsAppService, WhatsAppMessage, WhatsAppContact } from './whatsapp.service';
import { OpenAIService } from '../ai/openai.service';
import { LeadSource, LeadStatus, InsuranceType } from '@prisma/client';

export interface WhatsAppConversation {
  id: string;
  phoneNumber: string;
  customerName?: string;
  status: 'active' | 'escalated' | 'closed';
  assignedAgentId?: string;
  createdAt: Date;
  updatedAt: Date;
  messages: WhatsAppConversationMessage[];
}

export interface WhatsAppConversationMessage {
  id: string;
  conversationId: string;
  messageId: string;
  content: string;
  direction: 'inbound' | 'outbound';
  messageType: 'text' | 'image' | 'audio' | 'video' | 'document';
  isFromAI: boolean;
  timestamp: Date;
}

@Injectable()
export class WhatsAppConversationService {
  private readonly logger = new Logger(WhatsAppConversationService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsAppService,
    private openaiService: OpenAIService,
  ) {}

  async processIncomingMessage(
    message: WhatsAppMessage,
    contact: WhatsAppContact
  ): Promise<void> {
    try {
      this.logger.log(`Processing incoming WhatsApp message from ${message.from}`);

      // Mark message as read
      await this.whatsappService.markMessageAsRead(message.id);

      // Find or create conversation
      let conversation = await this.findConversationByPhoneNumber(message.from);
      if (!conversation) {
        conversation = await this.createConversation(message.from, contact.profile?.name);
      }

      // Save incoming message
      await this.saveMessage({
        conversationId: conversation.id,
        messageId: message.id,
        content: message.text?.body || '',
        direction: 'inbound',
        messageType: message.type,
        isFromAI: false,
        timestamp: new Date(parseInt(message.timestamp) * 1000),
      });

      // Check if conversation is escalated
      if (conversation.status === 'escalated') {
        await this.handleEscalatedConversation(conversation, message);
        return;
      }

      // Generate AI response if conversation is active
      if (conversation.status === 'active') {
        await this.generateAndSendAIResponse(conversation, message);
      }

    } catch (error) {
      this.logger.error('Error processing incoming WhatsApp message:', error);
    }
  }

  private async generateAndSendAIResponse(
    conversation: WhatsAppConversation,
    message: WhatsAppMessage
  ): Promise<void> {
    try {
      // Send typing indicator
      await this.whatsappService.sendTypingIndicator(message.from);

      // Get conversation history
      const history = await this.getConversationHistory(conversation.id, 10);
      const historyTexts = history.map(msg => msg.content);

      // Generate AI response
      const aiResponse = await this.openaiService.generateResponse(
        message.text?.body || '',
        conversation.customerName,
        historyTexts
      );

      // Check if escalation is needed
      if (aiResponse.shouldEscalate || aiResponse.confidence < 0.5) {
        await this.escalateConversation(conversation, aiResponse.message);
        return;
      }

      // Send AI response
      const success = await this.whatsappService.sendMessage(
        message.from,
        aiResponse.message
      );

      if (success) {
        // Save AI response message
        await this.saveMessage({
          conversationId: conversation.id,
          messageId: `ai_${Date.now()}`,
          content: aiResponse.message,
          direction: 'outbound',
          messageType: 'text',
          isFromAI: true,
          timestamp: new Date(),
        });

        this.logger.log(`AI response sent to ${message.from}`);
      }

    } catch (error) {
      this.logger.error('Error generating AI response:', error);
      
      // Fallback to escalation
      await this.escalateConversation(
        conversation,
        'I apologize, but I cannot process your request right now. Let me connect you with a human agent.'
      );
    }
  }

  private async escalateConversation(
    conversation: WhatsAppConversation,
    escalationMessage: string
  ): Promise<void> {
    try {
      // Update conversation status
      await this.updateConversationStatus(conversation.id, 'escalated');

      // Send escalation message
      await this.whatsappService.sendMessage(
        conversation.phoneNumber,
        escalationMessage + '\n\nA human agent will respond to you shortly during business hours (Monday-Friday 9AM-6PM).'
      );

      // Save escalation message
      await this.saveMessage({
        conversationId: conversation.id,
        messageId: `escalation_${Date.now()}`,
        content: escalationMessage,
        direction: 'outbound',
        messageType: 'text',
        isFromAI: true,
        timestamp: new Date(),
      });

      // Create a lead if this is a new conversation
      await this.createLeadFromConversation(conversation);

      this.logger.log(`Conversation ${conversation.id} escalated to human agent`);

    } catch (error) {
      this.logger.error('Error escalating conversation:', error);
    }
  }

  private async handleEscalatedConversation(
    conversation: WhatsAppConversation,
    message: WhatsAppMessage
  ): Promise<void> {
    // For escalated conversations, just save the message and send an acknowledgment
    const acknowledgment = 'Thank you for your message. Your conversation has been escalated to our team. An agent will respond during business hours.';
    
    await this.whatsappService.sendMessage(conversation.phoneNumber, acknowledgment);
    
    await this.saveMessage({
      conversationId: conversation.id,
      messageId: `ack_${Date.now()}`,
      content: acknowledgment,
      direction: 'outbound',
      messageType: 'text',
      isFromAI: true,
      timestamp: new Date(),
    });
  }

  private async findConversationByPhoneNumber(phoneNumber: string): Promise<WhatsAppConversation | null> {
    // This would be implemented with your database
    // For now, return null to always create new conversations
    return null;
  }

  private async createConversation(phoneNumber: string, customerName?: string): Promise<WhatsAppConversation> {
    // Create conversation in database
    const conversation: WhatsAppConversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      phoneNumber,
      customerName,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };

    this.logger.log(`Created new WhatsApp conversation: ${conversation.id}`);
    return conversation;
  }

  private async saveMessage(messageData: Omit<WhatsAppConversationMessage, 'id'>): Promise<void> {
    // Save message to database
    this.logger.log(`Saved message: ${messageData.direction} - ${messageData.content.substring(0, 50)}...`);
  }

  private async updateConversationStatus(conversationId: string, status: 'active' | 'escalated' | 'closed'): Promise<void> {
    // Update conversation status in database
    this.logger.log(`Updated conversation ${conversationId} status to ${status}`);
  }

  private async getConversationHistory(conversationId: string, limit: number): Promise<WhatsAppConversationMessage[]> {
    // Get conversation history from database
    // For now, return empty array
    return [];
  }

  private async createLeadFromConversation(conversation: WhatsAppConversation): Promise<void> {
    try {
      // Extract phone number without country code
      const phoneNumber = conversation.phoneNumber.replace(/^\+1/, '').replace(/\D/g, '');
      
      // Check if lead already exists
      const existingLead = await this.prisma.lead.findFirst({
        where: {
          OR: [
            { phone: phoneNumber },
            { phone: conversation.phoneNumber },
          ]
        }
      });

      if (existingLead) {
        this.logger.log(`Lead already exists for phone number: ${conversation.phoneNumber}`);
        return;
      }

      // Create new lead
      const leadData = {
        firstName: conversation.customerName || 'WhatsApp',
        lastName: 'Customer',
        email: `whatsapp_${phoneNumber}@temp.com`, // Temporary email
        phone: phoneNumber,
        status: LeadStatus.NEW,
        source: LeadSource.WHATSAPP,
        insuranceType: InsuranceType.AUTO, // Default insurance type
        notes: `Auto-created from WhatsApp conversation ${conversation.id}`,
      };

      const newLead = await this.prisma.lead.create({
        data: leadData
      });

      this.logger.log(`Created lead ${newLead.id} from WhatsApp conversation ${conversation.id}`);

    } catch (error) {
      this.logger.error('Error creating lead from conversation:', error);
    }
  }

  // Method for human agents to send messages
  async sendMessageAsAgent(conversationId: string, message: string, agentId: string): Promise<boolean> {
    try {
      const conversation = await this.findConversationById(conversationId);
      if (!conversation) {
        this.logger.error(`Conversation not found: ${conversationId}`);
        return false;
      }

      // Send message via WhatsApp API
      const success = await this.whatsappService.sendMessage(conversation.phoneNumber, message);

      if (success) {
        // Save agent message
        await this.saveMessage({
          conversationId: conversation.id,
          messageId: `agent_${Date.now()}`,
          content: message,
          direction: 'outbound',
          messageType: 'text',
          isFromAI: false,
          timestamp: new Date(),
        });

        // Update conversation status to active (in case it was escalated)
        await this.updateConversationStatus(conversationId, 'active');

        this.logger.log(`Agent message sent for conversation ${conversationId}`);
      }

      return success;
    } catch (error) {
      this.logger.error('Error sending agent message:', error);
      return false;
    }
  }

  private async findConversationById(conversationId: string): Promise<WhatsAppConversation | null> {
    // Find conversation by ID in database
    // For now, return null
    return null;
  }
}