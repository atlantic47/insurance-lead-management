import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { LeadSource, LeadStatus, InsuranceType } from '@prisma/client';
import { getTenantContext } from '../common/context/tenant-context';
import { WhatsAppTenantService } from '../whatsapp/whatsapp-tenant.service';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatService {
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private whatsappTenantService: WhatsAppTenantService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY') || 'dummy-key',
    });
  }

  async getLeadById(leadId: string) {
    return this.prisma.lead.findUnique({
      where: { id: leadId },
    });
  }

  async createOrGetLead(phoneNumber: string, name?: string) {
    // Check if lead exists by phone number
    let lead = await this.prisma.lead.findFirst({
      where: {
        OR: [
          { phone: phoneNumber },
          { alternatePhone: phoneNumber },
        ],
      },
    });

    if (!lead) {
      // Create new lead from WhatsApp contact
      const nameParts = name ? name.split(' ') : ['Unknown', 'Contact'];
      const context = getTenantContext();
      const tenantId = context?.tenantId || 'default-tenant-000';

      lead = await this.prisma.lead.create({
        data: {
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' ') || 'Contact',
          phone: phoneNumber,
          source: LeadSource.WHATSAPP,
          status: LeadStatus.NEW,
          insuranceType: InsuranceType.OTHER,
          tenant: { connect: { id: tenantId } },
        },
      });
    }

    return lead;
  }

  async createChatMessage(data: {
    content: string;
    sender: 'CUSTOMER' | 'AI_ASSISTANT' | 'HUMAN_AGENT';
    platform: 'WHATSAPP' | 'EMAIL' | 'SMS';
    platformMessageId?: string;
    metadata?: any;
    leadId?: string;
    conversationId?: string;
  }) {
    // CRITICAL: Get tenant context for security
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new Error('Tenant context required to create chat message');
    }

    return this.prisma.chatMessage.create({
      data: {
        ...data,
        tenantId, // CRITICAL: Add tenant isolation
      },
    });
  }

  async getConversation(leadId: string) {
    // CRITICAL: Get tenant context to filter chat messages
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new Error('Tenant context required to fetch conversation');
    }

    return this.prisma.aIConversation.findFirst({
      where: { leadId },
      include: {
        chatMessages: {
          where: { tenantId }, // SECURITY: Always filter messages by tenant
          orderBy: { createdAt: 'asc' },
        },
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            status: true,
          },
        },
      },
    });
  }

  async getAllConversations(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    // CRITICAL: Get tenant context to filter chat messages
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new Error('Tenant context required to fetch conversations');
    }

    // CRITICAL SECURITY FIX: Filter conversations by tenant
    let where: any = { type: 'WHATSAPP_CHAT' };
    where = this.prisma.addTenantFilter(where);

    // Get WhatsApp conversations specifically
    const [whatsappConversations, total] = await Promise.all([
      this.prisma.aIConversation.findMany({
        where,
        skip,
        take: limit,
        include: {
          chatMessages: {
            where: { tenantId }, // SECURITY: Always filter messages by tenant
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.aIConversation.count({
        where
      }),
    ]);

    // Format conversations and fetch associated leads
    const formattedConversations = await Promise.all(
      whatsappConversations.map(async (conv) => {
        const phoneNumber = conv.metadata?.['phoneNumber'] as string;
        const customerName = conv.metadata?.['customerName'] as string;
        const leadId = conv.metadata?.['leadId'] as string;
        
        // Try to fetch the associated lead
        let lead: any = null;
        if (leadId) {
          lead = await this.prisma.lead.findUnique({
            where: { id: leadId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              status: true,
            },
          });
        }

        // If no lead found but we have phone number, try to find/create one
        if (!lead && phoneNumber) {
          lead = await this.createOrGetLead(phoneNumber, customerName);
          
          // Link this conversation to the found/created lead
          if (lead) {
            await this.prisma.aIConversation.update({
              where: { id: conv.id },
      // @ts-ignore - tenantId added by Prisma middleware
              data: {
                metadata: {
                  ...conv.metadata as any,
                  leadId: lead.id
                }
              }
            });
          }
        }
        
        return {
          id: conv.id,
          isEscalated: conv.isEscalated,
          escalatedAt: conv.escalatedAt,
          lead: {
            id: lead?.id || `temp_lead_${conv.id}`,
            firstName: lead?.firstName || customerName || 'WhatsApp',
            lastName: lead?.lastName || 'Customer',
            phone: lead?.phone || phoneNumber || '+15550935798',
            email: lead?.email,
            status: lead?.status || 'NEW',
          },
          chatMessages: conv.chatMessages.map(msg => ({
            id: msg.id,
            content: msg.content,
            sender: msg.sender,
            platform: msg.platform,
            createdAt: msg.createdAt.toISOString(),
            isRead: msg.isRead,
          }))
        };
      })
    );

    return {
      data: {
        conversations: formattedConversations,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  async escalateConversation(conversationId: string, userId?: string) {
    const updateData: any = {
      isEscalated: true,
      escalatedAt: new Date(),
    };
    
    if (userId) {
      updateData.userId = userId;
    }
    
    return this.prisma.aIConversation.update({
      where: { id: conversationId },
      data: updateData,
    });
  }

  async processAIResponse(input: string, leadId: string, conversationHistory: any[] = []): Promise<{ response: string; confidence: number; shouldEscalate: boolean }> {
    try {
      // Get lead information for context
      const lead = await this.prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          leadProducts: {
            include: {
              product: true,
            },
          },
        },
      });

      // Prepare conversation context
      const systemPrompt = `You are an AI assistant for an insurance company. Your role is to:
1. Help customers with insurance inquiries
2. Collect basic information to qualify leads
3. Provide general information about insurance products
4. Escalate to human agents when needed

Lead information:
- Name: ${lead?.firstName} ${lead?.lastName}
- Phone: ${lead?.phone}
- Insurance Interest: ${lead?.insuranceType}
- Current Status: ${lead?.status}

Guidelines:
- Be helpful, professional, and empathetic
- Ask relevant questions to understand their needs
- If you cannot help or customer requests human agent, say you'll connect them with a specialist
- Keep responses concise and conversational
- If customer seems frustrated or has complex requests, escalate to human agent`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(msg => ({
          role: msg.sender === 'CUSTOMER' ? 'user' : 'assistant',
          content: msg.content,
        })),
        { role: 'user', content: input },
      ];

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages as any,
        max_tokens: 150,
        temperature: 0.7,
      });

      const aiResponse = completion.choices[0]?.message?.content || 'I apologize, but I\'m having trouble responding right now. Let me connect you with one of our specialists.';
      
      // Analyze if we should escalate
      const shouldEscalate = this.shouldEscalateBasedOnResponse(aiResponse, input);
      
      const confidence = completion.choices[0]?.finish_reason === 'stop' ? 0.9 : 0.6;

      // Save AI conversation
      const context = getTenantContext();
      const tenantId = context?.tenantId || 'default-tenant-000';

      await this.prisma.aIConversation.create({
        data: {
          type: 'CHATBOT',
          input,
          output: aiResponse,
          confidence,
          lead: leadId ? { connect: { id: leadId } } : undefined,
          metadata: {
            timestamp: new Date(),
            platform: 'WHATSAPP',
            model: 'gpt-3.5-turbo',
            tokens: completion.usage?.total_tokens || 0,
          },
          tenant: { connect: { id: tenantId } },
        },
      });

      return {
        response: aiResponse,
        confidence,
        shouldEscalate: shouldEscalate || confidence < 0.7,
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      
      // Fallback response
      const fallbackResponse = "I'm having trouble processing your request right now. Let me connect you with one of our insurance specialists who can help you immediately.";

      const context = getTenantContext();
      const tenantId = context?.tenantId || 'default-tenant-000';

      await this.prisma.aIConversation.create({
        data: {
          type: 'CHATBOT',
          input,
          output: fallbackResponse,
          confidence: 0.3,
          lead: leadId ? { connect: { id: leadId } } : undefined,
          metadata: {
            timestamp: new Date(),
            platform: 'WHATSAPP',
            error: error.message,
          },
          tenant: { connect: { id: tenantId } },
        },
      });

      return {
        response: fallbackResponse,
        confidence: 0.3,
        shouldEscalate: true,
      };
    }
  }

  async sendWhatsAppMessage(phoneNumber: string, message: string, tenantId?: string) {
    try {
      // Get tenant ID from context if not provided
      if (!tenantId) {
        const context = getTenantContext();
        tenantId = context?.tenantId;
      }

      if (!tenantId) {
        console.error('No tenant ID available for sending WhatsApp message');
        return {
          success: false,
          error: 'No tenant ID available',
          messageId: `wa_failed_${Date.now()}`,
        };
      }

      // Get credentials from whatsapp_credentials table via WhatsAppTenantService
      const accessToken = await this.whatsappTenantService.getAccessToken(tenantId);
      const phoneNumberId = await this.whatsappTenantService.getPhoneNumberId(tenantId);

      if (!accessToken || !phoneNumberId) {
        console.log(`[DEV MODE] No WhatsApp credentials found for tenant ${tenantId}. Sending message to ${phoneNumber}: ${message}`);
        return {
          success: true,
          messageId: `wa_dev_${Date.now()}`,
        };
      }

      // Send via Facebook Graph API (WhatsApp Business API)
      const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'text',
          text: {
            body: message,
          },
        }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log(`WhatsApp message sent successfully to ${phoneNumber}`);
        return {
          success: true,
          messageId: result.messages[0].id,
        };
      } else {
        console.error('WhatsApp API error:', result);
        throw new Error(`WhatsApp API error: ${result.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      // Fallback to logging in dev mode
      console.log(`[FALLBACK] Would send WhatsApp message to ${phoneNumber}: ${message}`);
      return {
        success: false,
        error: error.message,
        messageId: `wa_failed_${Date.now()}`,
      };
    }
  }

  async handleIncomingWhatsAppMessage(phoneNumber: string, message: string, senderName?: string) {
    try {
      // Create or get lead
      const lead = await this.createOrGetLead(phoneNumber, senderName);

      // Save incoming message
      await this.createChatMessage({
        content: message,
        sender: 'CUSTOMER',
        platform: 'WHATSAPP',
        metadata: { phoneNumber, senderName },
        leadId: lead.id,
      });

      // CRITICAL: Get tenant context to filter chat messages
      const context = getTenantContext();
      const tenantId = context?.tenantId;

      // Get or create conversation - look for any existing conversation for this lead
      let conversation = await this.prisma.aIConversation.findFirst({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'desc' }, // Get the most recent conversation
        include: {
          chatMessages: {
            where: tenantId ? { tenantId } : {}, // SECURITY FIX: Filter messages by tenant
            orderBy: { createdAt: 'asc' },
            take: 10, // Last 10 messages for context
          },
        },
      });

      if (!conversation) {
        const tenantIdOrDefault = tenantId || 'default-tenant-000';

        conversation = await this.prisma.aIConversation.create({
          data: {
            type: 'CHATBOT',
            input: message,
            output: '',
            lead: { connect: { id: lead.id } },
            tenant: { connect: { id: tenantIdOrDefault } },
          },
          include: {
            chatMessages: {
              where: tenantId ? { tenantId } : {}, // SECURITY FIX: Filter messages by tenant
            },
          },
        });
      }

      // If conversation is already escalated, just add the message without AI processing
      if (conversation.isEscalated) {
        return { 
          escalated: true, 
          message: 'Message received - a human agent will respond shortly.', 
          conversationId: conversation.id,
          reason: 'already_escalated'
        };
      }

      // Check for keyword-based escalation first
      const keywordEscalation = await this.shouldEscalateConversation(conversation.id, message);
      
      if (keywordEscalation) {
        await this.escalateConversation(conversation.id);
        const escalationMessage = "I understand you'd like to speak with a specialist. I'm connecting you with one of our insurance experts who can provide personalized assistance. They'll be with you shortly.";
        
        await this.createChatMessage({
          content: escalationMessage,
          sender: 'AI_ASSISTANT',
          platform: 'WHATSAPP',
          leadId: lead.id,
          conversationId: conversation.id,
        });

        await this.sendWhatsAppMessage(phoneNumber, escalationMessage);
        return { escalated: true, message: escalationMessage, reason: 'keyword_trigger' };
      }

      // Generate AI response with conversation history
      const aiResult = await this.processAIResponse(message, lead.id, conversation.chatMessages);

      // Check if AI thinks it should escalate
      if (aiResult.shouldEscalate) {
        await this.escalateConversation(conversation.id);
        const escalationMessage = "Let me connect you with one of our insurance specialists who can provide more detailed assistance. They'll be able to help you with your specific needs.";
        
        await this.createChatMessage({
          content: escalationMessage,
          sender: 'AI_ASSISTANT',
          platform: 'WHATSAPP',
          leadId: lead.id,
          conversationId: conversation.id,
        });

        await this.sendWhatsAppMessage(phoneNumber, escalationMessage);
        return { escalated: true, message: escalationMessage, reason: 'ai_confidence_low' };
      }

      // Save AI response
      await this.createChatMessage({
        content: aiResult.response,
        sender: 'AI_ASSISTANT',
        platform: 'WHATSAPP',
        leadId: lead.id,
        conversationId: conversation.id,
      });

      // Send AI response
      await this.sendWhatsAppMessage(phoneNumber, aiResult.response);

      return { 
        escalated: false, 
        message: aiResult.response, 
        confidence: aiResult.confidence,
        conversationId: conversation.id,
      };
    } catch (error) {
      console.error('Error handling WhatsApp message:', error);
      
      // Send error message
      const errorMessage = "I'm experiencing some technical difficulties. Let me connect you with one of our team members who can assist you right away.";
      await this.sendWhatsAppMessage(phoneNumber, errorMessage);
      
      return { 
        escalated: true, 
        message: errorMessage, 
        error: error.message,
        reason: 'system_error',
      };
    }
  }

  private async shouldEscalateConversation(conversationId: string, message: string): Promise<boolean> {
    // Check message count in conversation
    const messageCount = await this.prisma.chatMessage.count({
      where: { conversationId },
    });

    // Escalate after 5 messages or if certain keywords are detected
    const escalationKeywords = [
      'speak to human', 'talk to agent', 'representative', 'manager',
      'complaint', 'problem', 'issue', 'cancel', 'refund', 'angry',
      'frustrated', 'disappointed', 'not satisfied'
    ];

    const hasEscalationKeyword = escalationKeywords.some(keyword =>
      message.toLowerCase().includes(keyword)
    );

    return messageCount >= 5 || hasEscalationKeyword;
  }

  private shouldEscalateBasedOnResponse(aiResponse: string, userInput: string): boolean {
    // Check if AI response indicates uncertainty or inability to help
    const uncertaintyKeywords = [
      "I don't know", "I'm not sure", "I can't help", "I'm unable to",
      "I don't understand", "I'm not certain", "I can't provide",
      "beyond my capabilities", "I recommend speaking"
    ];

    // Check if user input indicates frustration or urgency
    const urgencyKeywords = [
      "urgent", "emergency", "immediately", "asap", "right now",
      "frustrated", "angry", "complaint", "problem", "issue"
    ];

    const responseHasUncertainty = uncertaintyKeywords.some(keyword =>
      aiResponse.toLowerCase().includes(keyword)
    );

    const inputHasUrgency = urgencyKeywords.some(keyword =>
      userInput.toLowerCase().includes(keyword)
    );

    return responseHasUncertainty || inputHasUrgency;
  }
}