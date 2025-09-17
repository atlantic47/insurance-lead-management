import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/services/prisma.service';
import OpenAI from 'openai';

@Injectable()
export class AIService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async generateAutoResponse(leadId: string, input: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Placeholder AI integration - replace with actual AI service
    const mockResponse = this.generateMockResponse(input, lead);

    const aiConversation = await this.prisma.aIConversation.create({
      data: {
        type: 'AUTO_RESPONSE',
        input,
        output: mockResponse,
        confidence: 0.85,
        leadId,
        metadata: {
          timestamp: new Date(),
          model: 'mock-ai-v1',
        },
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return aiConversation;
  }

  async analyzeSentiment(leadId: string, text: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Mock sentiment analysis - replace with actual AI service
    const sentiment = this.mockSentimentAnalysis(text);

    const aiConversation = await this.prisma.aIConversation.create({
      data: {
        type: 'SENTIMENT_ANALYSIS',
        input: text,
        output: JSON.stringify(sentiment),
        confidence: sentiment.confidence,
        leadId,
        metadata: {
          timestamp: new Date(),
          analysis: sentiment,
        },
      },
    });

    return {
      sentiment,
      conversation: aiConversation,
    };
  }

  async chatbotResponse(input: string, leadId?: string) {
    // Mock chatbot response - replace with actual AI service
    const response = this.generateChatbotResponse(input);

    const aiConversation = await this.prisma.aIConversation.create({
      data: {
        type: 'CHATBOT',
        input,
        output: response,
        confidence: 0.9,
        leadId,
        metadata: {
          timestamp: new Date(),
          channel: 'web-chat',
        },
      },
    });

    return {
      response,
      conversation: aiConversation,
    };
  }

  async getAIConversations(leadId?: string) {
    const where = leadId ? { leadId } : {};

    return this.prisma.aIConversation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async escalateToHuman(conversationId: string, reason: string) {
    // This would typically create a task or notification for human intervention
    const conversation = await this.prisma.aIConversation.findUnique({
      where: { id: conversationId },
      include: { lead: true },
    });

    if (!conversation) {
      throw new NotFoundException('AI conversation not found');
    }

    // Create a task for human follow-up
    if (conversation.leadId) {
      await this.prisma.task.create({
        data: {
          title: 'AI Escalation: Human Review Required',
          description: `Reason: ${reason}\nOriginal Input: ${conversation.input}`,
          type: 'FOLLOW_UP',
          priority: 4,
          leadId: conversation.leadId,
          assignedUserId: conversation.lead?.assignedUserId || '',
        },
      });
    }

    return {
      message: 'Escalated to human agent successfully',
      taskCreated: true,
    };
  }

  private generateMockResponse(input: string, lead: any): string {
    const responses = [
      `Hi ${lead.firstName}, thank you for your interest in ${lead.insuranceType.toLowerCase()} insurance. I'd be happy to help you with your inquiry.`,
      `Hello ${lead.firstName}, I understand you're looking for ${lead.insuranceType.toLowerCase()} coverage. Let me provide you with some information.`,
      `Thank you for reaching out! Based on your inquiry about ${lead.insuranceType.toLowerCase()} insurance, I can help you find the right coverage.`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private mockSentimentAnalysis(text: string) {
    const positive = ['great', 'excellent', 'good', 'happy', 'satisfied', 'love'];
    const negative = ['bad', 'terrible', 'awful', 'hate', 'disappointed', 'frustrated'];
    
    let score = 0.5; // neutral
    const words = text.toLowerCase().split(' ');
    
    words.forEach(word => {
      if (positive.some(p => word.includes(p))) score += 0.1;
      if (negative.some(n => word.includes(n))) score -= 0.1;
    });
    
    score = Math.max(0, Math.min(1, score));
    
    let sentiment = 'neutral';
    if (score > 0.6) sentiment = 'positive';
    if (score < 0.4) sentiment = 'negative';
    
    return {
      sentiment,
      score,
      confidence: 0.85,
    };
  }

  private generateChatbotResponse(input: string): string {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('price') || lowerInput.includes('cost') || lowerInput.includes('premium')) {
      return 'Insurance pricing depends on various factors. I can connect you with an agent who can provide a personalized quote based on your specific needs.';
    }
    
    if (lowerInput.includes('coverage') || lowerInput.includes('policy')) {
      return 'We offer comprehensive coverage options. What type of insurance are you interested in? Our agents can explain the different coverage levels available.';
    }
    
    if (lowerInput.includes('claim') || lowerInput.includes('file')) {
      return 'To file a claim, you can use our online portal or speak with one of our claims specialists. Would you like me to connect you with someone who can assist?';
    }
    
    return 'Thank you for your inquiry! I\'d be happy to help you learn more about our insurance products. Would you like to speak with one of our licensed agents?';
  }
}