import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface AIResponse {
  message: string;
  response: string; // Alias for message to maintain compatibility
  shouldEscalate: boolean;
  confidence: number;
  intent?: string;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private openai: OpenAI | null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get('OPENAI_API_KEY');
    if (!apiKey || apiKey === 'your-openai-api-key-here') {
      this.logger.warn('OpenAI API key not configured. AI responses will be simulated.');
      this.openai = null;
    } else {
      this.openai = new OpenAI({
        apiKey: apiKey,
      });
    }
  }

  async generateResponse(
    message: string,
    customerName?: string,
    conversationHistory: string[] = [],
    additionalContext?: string
  ): Promise<AIResponse> {
    try {
      this.logger.log(`🤖 OpenAI generateResponse called with message: "${message}"`);
      this.logger.log(`👤 Customer: ${customerName || 'Unknown'}`);
      this.logger.log(`📚 History length: ${conversationHistory.length}`);
      
      if (!this.openai) {
        this.logger.log('🎭 Using simulated response (no OpenAI key)');
        return this.getSimulatedResponse(message);
      }

      this.logger.log('🔧 Building prompts...');
      const systemPrompt = this.buildSystemPrompt(additionalContext);
      const conversationContext = this.buildConversationContext(conversationHistory, message, customerName);

      this.logger.log(`📝 System prompt length: ${systemPrompt.length} chars`);
      this.logger.log(`💬 Conversation context: ${conversationContext.substring(0, 200)}...`);

      this.logger.log('🚀 Calling OpenAI API...');
      const completion = await this.openai.chat.completions.create({
        model: this.configService.get('OPENAI_MODEL') || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: conversationContext }
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      this.logger.log('✅ OpenAI API response received');
      const response = completion.choices[0]?.message?.content || 'I apologize, but I cannot process your request right now.';
      this.logger.log(`📤 Generated response: ${response.substring(0, 200)}...`);

      // Analyze if escalation is needed
      const shouldEscalate = this.shouldEscalateToHuman(message, response);
      const confidence = this.calculateConfidence(completion);
      const intent = this.detectIntent(message);

      this.logger.log(`📊 Analysis: shouldEscalate=${shouldEscalate}, confidence=${confidence}, intent=${intent}`);

      return {
        message: response,
        response: response, // Alias for compatibility
        shouldEscalate,
        confidence,
        intent
      };

    } catch (error) {
      this.logger.error('❌ Error generating AI response:', error);
      this.logger.error('Error details:', error.message);
      if (error.response) {
        this.logger.error('API response error:', error.response.data);
      }
      
      return {
        message: 'I apologize, but I cannot process your request right now. Let me connect you with a human agent.',
        response: 'I apologize, but I cannot process your request right now. Let me connect you with a human agent.',
        shouldEscalate: true,
        confidence: 0
      };
    }
  }

  private buildSystemPrompt(additionalContext?: string): string {
    return `You are a helpful AI assistant for an insurance company's customer service. Your role is to:

1. **Primary Functions:**
   - Answer general questions about insurance products
   - Help customers understand their policies
   - Assist with basic claims information
   - Collect initial information for new leads
   - Provide company contact information

2. **Insurance Products Knowledge:**
   - Auto Insurance: Coverage types, deductibles, claims process
   - Home Insurance: Property protection, liability coverage
   - Life Insurance: Term vs whole life, beneficiaries
   - Health Insurance: Coverage options, networks, claims
   - Business Insurance: Liability, property, workers compensation

3. **Response Guidelines:**
   - Be friendly, professional, and empathetic
   - Keep responses concise (under 200 words)
   - Use simple, clear language
   - Always ask if they need further assistance
   - If you don't know something, admit it and offer to connect them with an agent

4. **Escalation Triggers:**
   - Complex policy questions requiring specific details
   - Claim disputes or complaints
   - Payment issues or billing problems
   - Requests for specific quotes or pricing
   - Angry or frustrated customers
   - Legal or regulatory questions
   - Requests to cancel policies

5. **Company Information:**
   - Company: Insurance Lead Management System
   - Business Hours: Monday-Friday 9AM-6PM
   - Emergency Claims: 24/7 hotline available
   - Email: sales@pestraid.co.ke

Remember: Your goal is to provide helpful initial support while identifying when human expertise is needed.

${additionalContext ? `\n6. **Custom Knowledge Base:**\n${additionalContext}\n\nIMPORTANT: Use the information from the knowledge base above to provide specific, accurate answers. When the customer asks about topics covered in your knowledge base, reference that information directly. If you find relevant information in the knowledge base, cite it and provide detailed answers based on that content.` : ''}`;
  }

  private buildConversationContext(history: string[], currentMessage: string, customerName?: string): string {
    let context = '';

    if (customerName) {
      context += `Customer Name: ${customerName}\n\n`;
    }

    if (history.length > 0) {
      context += 'Previous conversation:\n';
      history.slice(-6).forEach((msg, index) => {
        const role = index % 2 === 0 ? 'Customer' : 'Assistant';
        context += `${role}: ${msg}\n`;
      });
      context += '\n';
    }

    context += `Current message: ${currentMessage}`;

    return context;
  }

  private shouldEscalateToHuman(message: string, response: string): boolean {
    const escalationKeywords = [
      'complaint', 'angry', 'frustrated', 'cancel', 'refund', 'billing',
      'payment', 'dispute', 'legal', 'lawyer', 'sue', 'claim denied',
      'supervisor', 'manager', 'human', 'agent', 'speak to someone',
      'not satisfied', 'terrible', 'awful', 'scam', 'fraud'
    ];

    const messageText = message.toLowerCase();
    const hasEscalationKeyword = escalationKeywords.some(keyword =>
      messageText.includes(keyword)
    );

    // Also escalate if AI response contains uncertainty indicators
    const uncertaintyIndicators = [
      "i don't know", "i'm not sure", "i cannot", "i'm unable",
      "let me connect you", "speak with an agent"
    ];

    const responseText = response.toLowerCase();
    const hasUncertainty = uncertaintyIndicators.some(indicator =>
      responseText.includes(indicator)
    );

    return hasEscalationKeyword || hasUncertainty;
  }

  private calculateConfidence(completion: any): number {
    // Simple confidence calculation based on response length and finish reason
    const response = completion.choices[0];
    if (response.finish_reason === 'stop' && response.message.content.length > 50) {
      return 0.8;
    } else if (response.finish_reason === 'length') {
      return 0.6;
    }
    return 0.4;
  }

  private detectIntent(message: string): string {
    const messageText = message.toLowerCase();

    if (messageText.includes('quote') || messageText.includes('price') || messageText.includes('cost')) {
      return 'get_quote';
    } else if (messageText.includes('claim') || messageText.includes('accident')) {
      return 'file_claim';
    } else if (messageText.includes('policy') || messageText.includes('coverage')) {
      return 'policy_inquiry';
    } else if (messageText.includes('payment') || messageText.includes('bill')) {
      return 'billing_inquiry';
    } else if (messageText.includes('hello') || messageText.includes('hi') || messageText.includes('help')) {
      return 'greeting';
    }

    return 'general_inquiry';
  }

  private getSimulatedResponse(message: string): AIResponse {
    const messageText = message.toLowerCase();

    // Simulate different responses based on keywords
    if (messageText.includes('hello') || messageText.includes('hi')) {
      const msg = 'Hello! Welcome to our insurance support. How can I help you today?';
      return {
        message: msg,
        response: msg,
        shouldEscalate: false,
        confidence: 0.9,
        intent: 'greeting'
      };
    } else if (messageText.includes('quote') || messageText.includes('price')) {
      const msg = 'I\'d be happy to help you get a quote! For accurate pricing, I\'ll need to connect you with one of our agents who can review your specific needs. Would you like me to arrange that?';
      return {
        message: msg,
        response: msg,
        shouldEscalate: true,
        confidence: 0.8,
        intent: 'get_quote'
      };
    } else if (messageText.includes('claim')) {
      const msg = 'I can help with basic claim information. For specific claim details or to file a new claim, I\'ll connect you with our claims department. Is this regarding an existing claim or would you like to file a new one?';
      return {
        message: msg,
        response: msg,
        shouldEscalate: true,
        confidence: 0.7,
        intent: 'file_claim'
      };
    } else {
      const msg = 'Thank you for contacting us. I\'m here to help with general insurance questions. For specific policy details or personalized assistance, I can connect you with one of our agents. What would you like to know about?';
      return {
        message: msg,
        response: msg,
        shouldEscalate: false,
        confidence: 0.6,
        intent: 'general_inquiry'
      };
    }
  }
}