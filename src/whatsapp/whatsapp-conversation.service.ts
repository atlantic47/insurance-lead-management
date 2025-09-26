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
  leadId?: string;
  lead?: any;
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
      this.logger.log(`🤖 Starting AI response generation for message: "${message.text?.body}"`);
      
      // Send typing indicator
      try {
        await this.whatsappService.sendTypingIndicator(message.from);
        this.logger.log('✅ Typing indicator sent');
      } catch (typingError) {
        this.logger.warn('⚠️ Typing indicator failed:', typingError.message);
      }

      // Get conversation history
      const history = await this.getConversationHistory(conversation.id, 10);
      const historyTexts = history.map(msg => msg.content);
      this.logger.log(`📚 Retrieved ${history.length} messages from conversation history`);

      // Generate AI response
      this.logger.log(`🧠 Calling OpenAI service with message: "${message.text?.body}"`);
      const aiResponse = await this.openaiService.generateResponse(
        message.text?.body || '',
        conversation.customerName,
        historyTexts
      );
      
      this.logger.log(`🤖 AI Response generated:`, {
        message: aiResponse.message?.substring(0, 100) + '...',
        shouldEscalate: aiResponse.shouldEscalate,
        confidence: aiResponse.confidence,
        intent: aiResponse.intent
      });

      // Check if escalation is needed
      if (aiResponse.shouldEscalate || aiResponse.confidence < 0.5) {
        this.logger.log(`🚨 Escalating conversation due to: shouldEscalate=${aiResponse.shouldEscalate}, confidence=${aiResponse.confidence}`);
        await this.escalateConversation(conversation, aiResponse.message);
        return;
      }

      // Send AI response
      this.logger.log(`📤 Attempting to send AI response to ${message.from}`);
      const success = await this.whatsappService.sendMessage(
        message.from,
        aiResponse.message
      );

      if (success) {
        this.logger.log(`✅ AI response sent successfully to ${message.from}`);
        
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

        this.logger.log(`💾 AI response message saved to database`);
      } else {
        this.logger.error(`❌ Failed to send AI response to ${message.from}`);
      }

    } catch (error) {
      this.logger.error('❌ Error in generateAndSendAIResponse:', error);
      this.logger.error('Error stack:', error.stack);
      
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
    try {
      // Find all WhatsApp conversations and filter by phone number
      const conversations = await this.prisma.aIConversation.findMany({
        where: {
          type: 'WHATSAPP_CHAT'
        },
        orderBy: { createdAt: 'desc' },
        include: {
          chatMessages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      // Filter by phone number in the metadata
      const conversation = conversations.find(conv => 
        conv.metadata && 
        typeof conv.metadata === 'object' && 
        'phoneNumber' in conv.metadata && 
        conv.metadata.phoneNumber === phoneNumber
      );

      if (!conversation) return null;

      // Get the linked lead if it exists
      const leadId = conversation.metadata?.['leadId'] as string;
      let linkedLead: any = null;
      if (leadId) {
        linkedLead = await this.prisma.lead.findUnique({ where: { id: leadId } });
      }

      // Convert to WhatsAppConversation format
      return {
        id: conversation.id,
        phoneNumber: phoneNumber,
        customerName: conversation.metadata?.['customerName'] as string,
        status: (conversation.metadata?.['status'] as 'active' | 'escalated' | 'closed') || 'active',
        assignedAgentId: conversation.metadata?.['assignedAgentId'] as string,
        createdAt: conversation.createdAt,
        updatedAt: conversation.chatMessages[conversation.chatMessages.length - 1]?.updatedAt || conversation.createdAt,
        leadId: leadId,
        lead: linkedLead,
        messages: conversation.chatMessages.map(msg => ({
          id: msg.id,
          conversationId: conversation.id,
          messageId: msg.platformMessageId || msg.id,
          content: msg.content,
          direction: msg.sender === 'CUSTOMER' ? 'inbound' : 'outbound',
          messageType: 'text',
          isFromAI: msg.sender === 'AI_ASSISTANT',
          timestamp: msg.createdAt,
        }))
      };
    } catch (error) {
      this.logger.error('Error finding conversation by phone number:', error);
      return null;
    }
  }

  private async createConversation(phoneNumber: string, customerName?: string): Promise<WhatsAppConversation> {
    try {
      // First, create or get the lead for this conversation
      const lead = await this.createOrGetLead(phoneNumber, customerName);
      this.logger.log(`Lead created/found for phone ${phoneNumber}: ${lead.id}`);

      // Create conversation in database
      const conversation = await this.prisma.aIConversation.create({
        data: {
          type: 'WHATSAPP_CHAT',
          input: 'New WhatsApp conversation started',
          output: 'Conversation initialized',
          confidence: 1.0,
          metadata: {
            phoneNumber,
            customerName,
            status: 'active',
            platform: 'WHATSAPP',
            createdBy: 'webhook',
            leadId: lead.id // Link to the lead
          }
        }
      });

      this.logger.log(`Created new WhatsApp conversation: ${conversation.id} linked to lead: ${lead.id}`);
      
      return {
        id: conversation.id,
        phoneNumber,
        customerName,
        status: 'active',
        createdAt: conversation.createdAt,
        updatedAt: conversation.createdAt,
        messages: [],
      };
    } catch (error) {
      this.logger.error('Error creating conversation:', error);
      throw error;
    }
  }

  private async saveMessage(messageData: Omit<WhatsAppConversationMessage, 'id'>): Promise<void> {
    try {
      // Save message to database using ChatMessage model
      await this.prisma.chatMessage.create({
        data: {
          content: messageData.content,
          sender: messageData.isFromAI 
            ? 'AI_ASSISTANT' 
            : messageData.direction === 'inbound' 
              ? 'CUSTOMER' 
              : 'HUMAN_AGENT',
          platform: 'WHATSAPP',
          platformMessageId: messageData.messageId,
          conversationId: messageData.conversationId,
          metadata: {
            direction: messageData.direction,
            messageType: messageData.messageType,
            timestamp: messageData.timestamp
          },
          isRead: false
        }
      });

      this.logger.log(`Saved message: ${messageData.direction} - ${messageData.content.substring(0, 50)}...`);
    } catch (error) {
      this.logger.error('Error saving message:', error);
      throw error;
    }
  }

  private async updateConversationStatus(conversationId: string, status: 'active' | 'escalated' | 'closed'): Promise<void> {
    try {
      // Update conversation status in database - Get current metadata and update it
      const conversation = await this.prisma.aIConversation.findUnique({
        where: { id: conversationId }
      });
      
      if (conversation) {
        const updatedMetadata = { 
          ...conversation.metadata as any, 
          status 
        };
        
        await this.prisma.aIConversation.update({
          where: { id: conversationId },
          data: {
            metadata: updatedMetadata
          }
        });
      }
      
      this.logger.log(`Updated conversation ${conversationId} status to ${status}`);
    } catch (error) {
      this.logger.error('Error updating conversation status:', error);
      throw error;
    }
  }

  private async getConversationHistory(conversationId: string, limit: number): Promise<WhatsAppConversationMessage[]> {
    try {
      // Get conversation history from database
      const messages = await this.prisma.chatMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return messages.map(msg => ({
        id: msg.id,
        conversationId,
        messageId: msg.platformMessageId || msg.id,
        content: msg.content,
        direction: msg.sender === 'CUSTOMER' ? 'inbound' : 'outbound',
        messageType: 'text',
        isFromAI: msg.sender === 'AI_ASSISTANT',
        timestamp: msg.createdAt,
      }));
    } catch (error) {
      this.logger.error('Error getting conversation history:', error);
      return [];
    }
  }

  private async createOrGetLead(phoneNumber: string, customerName?: string): Promise<any> {
    try {
      // Extract phone number without country code for storage
      const cleanPhoneNumber = phoneNumber.replace(/^\+1/, '').replace(/\D/g, '');
      
      // Check if lead already exists
      const existingLead = await this.prisma.lead.findFirst({
        where: {
          OR: [
            { phone: cleanPhoneNumber },
            { phone: phoneNumber },
          ]
        }
      });

      if (existingLead) {
        this.logger.log(`Found existing lead for phone number: ${phoneNumber}`);
        return existingLead;
      }

      // Create new lead
      const leadData = {
        firstName: customerName || 'WhatsApp',
        lastName: 'Customer',
        email: `whatsapp_${cleanPhoneNumber}@temp.com`, // Temporary email
        phone: cleanPhoneNumber,
        status: LeadStatus.NEW,
        source: LeadSource.WHATSAPP,
        insuranceType: InsuranceType.AUTO, // Default insurance type
        inquiryDetails: `Auto-created from WhatsApp conversation`,
      };

      const newLead = await this.prisma.lead.create({
        data: leadData
      });

      this.logger.log(`Created new lead ${newLead.id} for WhatsApp phone: ${phoneNumber}`);
      return newLead;

    } catch (error) {
      this.logger.error('Error creating/getting lead:', error);
      throw error;
    }
  }

  private async createLeadFromConversation(conversation: WhatsAppConversation): Promise<void> {
    try {
      // This method now just calls createOrGetLead
      await this.createOrGetLead(conversation.phoneNumber, conversation.customerName);
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

  async findConversationById(conversationId: string): Promise<WhatsAppConversation | null> {
    try {
      // Find conversation by ID in database
      const conversation = await this.prisma.aIConversation.findUnique({
        where: { id: conversationId },
        include: {
          chatMessages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      if (!conversation) return null;

      const phoneNumber = conversation.metadata?.['phoneNumber'] as string;
      const leadId = conversation.metadata?.['leadId'] as string;
      
      // Get the linked lead if it exists
      let linkedLead: any = null;
      if (leadId) {
        linkedLead = await this.prisma.lead.findUnique({ where: { id: leadId } });
      }
      
      return {
        id: conversation.id,
        phoneNumber,
        customerName: conversation.metadata?.['customerName'] as string,
        status: (conversation.metadata?.['status'] as 'active' | 'escalated' | 'closed') || 'active',
        assignedAgentId: conversation.metadata?.['assignedAgentId'] as string,
        createdAt: conversation.createdAt,
        updatedAt: conversation.chatMessages[conversation.chatMessages.length - 1]?.updatedAt || conversation.createdAt,
        leadId: leadId,
        lead: linkedLead,
        messages: conversation.chatMessages.map(msg => ({
          id: msg.id,
          conversationId: conversation.id,
          messageId: msg.platformMessageId || msg.id,
          content: msg.content,
          direction: msg.sender === 'CUSTOMER' ? 'inbound' : 'outbound',
          messageType: 'text',
          isFromAI: msg.sender === 'AI_ASSISTANT',
          timestamp: msg.createdAt,
        }))
      };
    } catch (error) {
      this.logger.error('Error finding conversation by ID:', error);
      return null;
    }
  }

  async getConversations(): Promise<{ conversations: any[] }> {
    try {
      // Get all WhatsApp conversations from database
      const conversations = await this.prisma.aIConversation.findMany({
        where: {
          type: 'WHATSAPP_CHAT'
        },
        include: {
          chatMessages: {
            orderBy: { createdAt: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const formattedConversations = conversations.map(conv => {
        const phoneNumber = conv.metadata?.['phoneNumber'] as string;
        const customerName = conv.metadata?.['customerName'] as string;
        const status = conv.metadata?.['status'] as string || 'active';

        return {
          id: conv.id,
          phoneNumber,
          customerName: customerName || 'WhatsApp User',
          status,
          createdAt: conv.createdAt,
          updatedAt: conv.chatMessages[conv.chatMessages.length - 1]?.updatedAt || conv.createdAt,
          messages: conv.chatMessages.map(msg => ({
            id: msg.id,
            content: msg.content,
            direction: msg.sender === 'CUSTOMER' ? 'inbound' : 'outbound',
            messageType: 'text',
            isFromAI: msg.sender === 'AI_ASSISTANT',
            timestamp: msg.createdAt,
            status: 'delivered' // Default status
          }))
        };
      });

      return { conversations: formattedConversations };
    } catch (error) {
      this.logger.error('Error getting conversations:', error);
      return { conversations: [] };
    }
  }

  // Public method to create or get lead for a conversation
  async createOrGetLeadForConversation(phoneNumber: string, customerName?: string): Promise<any> {
    return await this.createOrGetLead(phoneNumber, customerName);
  }

  // Public method to link a conversation to a lead
  async linkConversationToLead(conversationId: string, leadId: string): Promise<void> {
    try {
      // Get current conversation metadata
      const conversation = await this.prisma.aIConversation.findUnique({
        where: { id: conversationId }
      });
      
      if (conversation) {
        const updatedMetadata = { 
          ...conversation.metadata as any, 
          leadId 
        };
        
        await this.prisma.aIConversation.update({
          where: { id: conversationId },
          data: {
            metadata: updatedMetadata
          }
        });
        
        this.logger.log(`Linked conversation ${conversationId} to lead ${leadId}`);
      }
    } catch (error) {
      this.logger.error('Error linking conversation to lead:', error);
      throw error;
    }
  }
}