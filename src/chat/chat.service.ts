import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { LeadSource, LeadStatus, InsuranceType } from '@prisma/client';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatService {
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
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
      lead = await this.prisma.lead.create({
        data: {
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' ') || 'Contact',
          phone: phoneNumber,
          source: LeadSource.WHATSAPP,
          status: LeadStatus.NEW,
          insuranceType: InsuranceType.OTHER, // Default until we know more
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
    return this.prisma.chatMessage.create({
      data,
    });
  }

  async getConversation(leadId: string) {
    return this.prisma.aIConversation.findFirst({
      where: { leadId },
      include: {
        chatMessages: {
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
    
    const [conversations, total] = await Promise.all([
      this.prisma.aIConversation.findMany({
        skip,
        take: limit,
        include: {
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
          chatMessages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.aIConversation.count(),
    ]);

    return {
      conversations,
      total,
      page,
      totalPages: Math.ceil(total / limit),
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
      await this.prisma.aIConversation.create({
        data: {
          type: 'CHATBOT',
          input,
          output: aiResponse,
          confidence,
          leadId,
          metadata: {
            timestamp: new Date(),
            platform: 'WHATSAPP',
            model: 'gpt-3.5-turbo',
            tokens: completion.usage?.total_tokens || 0,
          },
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
      
      await this.prisma.aIConversation.create({
        data: {
          type: 'CHATBOT',
          input,
          output: fallbackResponse,
          confidence: 0.3,
          leadId,
          metadata: {
            timestamp: new Date(),
            platform: 'WHATSAPP',
            error: error.message,
          },
        },
      });

      return {
        response: fallbackResponse,
        confidence: 0.3,
        shouldEscalate: true,
      };
    }
  }

  async sendWhatsAppMessage(phoneNumber: string, message: string) {
    try {
      const accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
      const phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
      
      if (!accessToken || !phoneNumberId) {
        console.log(`[DEV MODE] Sending WhatsApp message to ${phoneNumber}: ${message}`);
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

      // Get or create conversation - look for any existing conversation for this lead
      let conversation = await this.prisma.aIConversation.findFirst({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'desc' }, // Get the most recent conversation
        include: {
          chatMessages: {
            orderBy: { createdAt: 'asc' },
            take: 10, // Last 10 messages for context
          },
        },
      });

      if (!conversation) {
        conversation = await this.prisma.aIConversation.create({
          data: {
            type: 'CHATBOT',
            input: message,
            output: '',
            leadId: lead.id,
          },
          include: {
            chatMessages: true,
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