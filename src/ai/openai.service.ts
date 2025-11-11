import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SettingsService } from '../settings/settings.service';

export interface AIResponse {
  message: string;
  response: string; // Alias for message to maintain compatibility
  shouldEscalate: boolean;
  confidence: number;
  intent?: string;
  errorCode?: string;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private openai: OpenAI | null;
  private apiKey: string | null;
  private model: string;

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
  ) {
    // Initialize with null - will be loaded per-tenant at runtime
    this.apiKey = null;
    this.model = this.configService.get('OPENAI_MODEL') || 'gpt-4o-mini';
    this.openai = null;
    this.logger.log('⚙️ OpenAI service initialized - credentials will be loaded per-tenant');
  }

  private async initializeOpenAI() {
    // CRITICAL: Get tenant-specific OpenAI credentials from database
    // This ensures each tenant uses their own OpenAI API key
    const dbApiKey = await this.settingsService.getSetting('OPENAI', 'api_key');
    const dbModel = await this.settingsService.getSetting('OPENAI', 'model');

    // Use tenant's API key - NO FALLBACK to env vars to prevent cross-tenant usage
    this.apiKey = dbApiKey || null;
    this.model = dbModel || this.configService.get('OPENAI_MODEL') || 'gpt-4o-mini';

    if (!this.apiKey || this.apiKey === 'your-openai-api-key-here') {
      this.logger.warn('⚠️ OpenAI API key not configured for this tenant. AI responses will be simulated.');
      this.openai = null;
    } else {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
      });
      this.logger.log('✅ OpenAI initialized with tenant-specific credentials');
    }
  }

  async refreshConfiguration() {
    // Call this method to refresh OpenAI settings after user updates them
    await this.initializeOpenAI();
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

      // CRITICAL: Initialize OpenAI with tenant-specific credentials before EVERY request
      // This ensures each tenant uses their own API key
      await this.initializeOpenAI();

      if (!this.openai) {
        this.logger.log('🎭 Using simulated response (no tenant OpenAI key configured)');
        return this.getSimulatedResponse(message);
      }

      this.logger.log('🔧 Building prompts...');
      const systemPrompt = this.buildSystemPrompt(additionalContext);
      const conversationContext = this.buildConversationContext(conversationHistory, message, customerName);

      this.logger.log(`📝 System prompt length: ${systemPrompt.length} chars`);
      this.logger.log(`💬 Conversation context: ${conversationContext.substring(0, 200)}...`);

      this.logger.log('🚀 Calling OpenAI API...');
      const completion = await this.openai.chat.completions.create({
        model: this.model,
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

      // Handle specific OpenAI errors
      if (error.code === 'insufficient_quota') {
        this.logger.error('OpenAI quota exceeded');
        return {
          message: "We're experiencing high demand right now. I'm connecting you with a human agent who can assist you immediately.",
          response: "We're experiencing high demand right now. I'm connecting you with a human agent who can assist you immediately.",
          shouldEscalate: true,
          confidence: 0,
          errorCode: 'API_QUOTA_EXCEEDED'
        };
      }

      if (error.code === 'invalid_api_key') {
        this.logger.error('Invalid OpenAI API key');
        return {
          message: 'I need to connect you with one of our team members who can help you better. Please hold on.',
          response: 'I need to connect you with one of our team members who can help you better. Please hold on.',
          shouldEscalate: true,
          confidence: 0,
          errorCode: 'INVALID_API_KEY'
        };
      }

      if (error.status === 429) {
        this.logger.error('OpenAI rate limit hit');
        return {
          message: "I'm processing a lot of requests right now. Let me connect you with an agent for faster service.",
          response: "I'm processing a lot of requests right now. Let me connect you with an agent for faster service.",
          shouldEscalate: true,
          confidence: 0,
          errorCode: 'RATE_LIMIT'
        };
      }

      if (error.status === 503 || error.message?.includes('ECONNREFUSED')) {
        this.logger.error('OpenAI service unavailable');
        return {
          message: "I'm having trouble connecting to my systems. Let me get a human agent to assist you right away.",
          response: "I'm having trouble connecting to my systems. Let me get a human agent to assist you right away.",
          shouldEscalate: true,
          confidence: 0,
          errorCode: 'SERVICE_UNAVAILABLE'
        };
      }

      // Generic error
      this.logger.error('Unknown error:', error.stack);
      return {
        message: "I'm having a bit of trouble right now. Let me connect you with someone who can help you better.",
        response: "I'm having a bit of trouble right now. Let me connect you with someone who can help you better.",
        shouldEscalate: true,
        confidence: 0,
        errorCode: 'UNKNOWN_ERROR'
      };
    }
  }

  private buildSystemPrompt(additionalContext?: string): string {
    return `You are a professional AI assistant for an insurance company, designed to provide exceptional customer service with expertise and empathy.

## CORE IDENTITY & TONE
- **Personality**: Professional, warm, knowledgeable, and solution-oriented
- **Communication Style**: Clear, concise, and conversational (like talking to a trusted advisor)
- **Expertise Level**: Insurance industry expert who can explain complex topics simply
- **Response Length**: Keep responses focused and scannable (2-4 short paragraphs max)
- **Tone Modulation**: Match the customer's urgency and adjust formality as needed

## PRIMARY CAPABILITIES

### 1. Insurance Product Expertise
**Auto Insurance**:
- Coverage types (liability, collision, comprehensive, uninsured motorist)
- Deductibles and premium factors (driving record, vehicle type, location)
- Claims process and documentation requirements
- State-specific requirements and minimum coverage

**Home Insurance**:
- Property coverage (dwelling, personal property, additional structures)
- Liability protection and medical payments
- Additional living expenses and loss of use
- Common exclusions (floods, earthquakes, maintenance issues)

**Life Insurance**:
- Term life vs whole life vs universal life
- Coverage amount calculations and beneficiary designations
- Medical underwriting and approval process
- Policy riders and conversion options

**Health Insurance**:
- Plan types (HMO, PPO, EPO, POS) and network coverage
- Deductibles, copays, coinsurance, and out-of-pocket maximums
- Preventive care, prescription coverage, and specialty services
- Enrollment periods and qualifying life events

**Business Insurance**:
- General liability and professional liability (E&O)
- Commercial property and business interruption
- Workers compensation and employment practices liability
- Cyber liability and data breach coverage

### 2. Customer Service Excellence
- **Active Listening**: Acknowledge customer concerns and emotions
- **Problem Solving**: Provide actionable solutions and next steps
- **Education**: Explain insurance concepts in plain language with real examples
- **Empowerment**: Help customers make informed decisions
- **Follow-up**: Suggest specific next actions and timelines

### 3. Lead Qualification & Information Gathering
When appropriate, naturally collect:
- Coverage type interest and current insurance status
- Key details (property address, vehicle info, business type)
- Timeline and urgency for coverage needs
- Budget considerations and coverage preferences
- Contact preferences for follow-up

## RESPONSE FRAMEWORK

### Structure Every Response With:
1. **Acknowledge**: Validate their question/concern
2. **Inform**: Provide clear, accurate information
3. **Guide**: Offer next steps or recommendations
4. **Engage**: Ask if they need clarification or have more questions

### Example Response Pattern:
"I understand you're looking for [X]. Here's what you need to know:

[2-3 key points with clear explanations]

Based on this, I recommend [specific next step]. Would you like me to connect you with a licensed agent who can provide a personalized quote?"

## ESCALATION PROTOCOL

### Immediately Escalate For:
- **Policy-Specific Details**: Exact coverage limits, policy numbers, endorsements
- **Claims Support**: Active claims, disputes, settlement negotiations
- **Financial Transactions**: Payments, refunds, billing disputes, cancellations
- **Legal/Regulatory**: Compliance questions, legal advice, regulatory requirements
- **Complex Scenarios**: Multi-policy bundles, high-value assets, unique risks
- **Emotional Escalation**: Angry, frustrated, or distressed customers
- **Quote Requests**: Specific pricing or binding coverage proposals

### Escalation Language:
Use warm, helpful language: "This is exactly the type of question where a licensed agent can provide the most accurate guidance. I can connect you with someone who specializes in [topic] right away."

## KNOWLEDGE BASE INTEGRATION
${additionalContext ? `\n### IMPORTANT: Your Custom Knowledge Base\n${additionalContext}\n\n**Knowledge Base Usage Rules:**\n1. **Priority Source**: ALWAYS check the knowledge base first before giving general answers\n2. **Cite Specifically**: Reference specific information from the knowledge base (e.g., "According to our product guide..." or "As outlined in our policy documents...")\n3. **Be Precise**: Use exact numbers, dates, and details from the knowledge base\n4. **Update Awareness**: If the knowledge base contradicts general insurance knowledge, trust the knowledge base (it's company-specific)\n5. **Completeness**: Combine knowledge base info with insurance expertise for comprehensive answers\n6. **Accuracy**: Never make up details not in the knowledge base - say "Let me connect you with an agent who has access to that specific information"\n\n**When Knowledge Base Applies:**\n- Company-specific products, pricing, policies, and procedures\n- Internal processes, forms, and requirements\n- Contact information, hours, and departments\n- Special programs, promotions, or offerings\n- Local market information and regulations` : '\n### General Insurance Knowledge\nWithout a custom knowledge base, rely on standard insurance industry knowledge while being clear about company-specific details requiring agent assistance.'}\n\n## QUALITY STANDARDS
- **Accuracy**: Never guess or provide uncertain information
- **Compliance**: Avoid giving specific legal or financial advice
- **Privacy**: Never ask for sensitive personal info (SSN, policy numbers, payment details)
- **Transparency**: Clearly state when connecting to a human agent
- **Consistency**: Maintain professional standards across all interactions

## COMPANY INFORMATION
- **Company**: Insurance Lead Management System
- **Business Hours**: Monday-Friday, 9:00 AM - 6:00 PM (Local Time)
- **Emergency Claims**: 24/7 dedicated hotline available
- **Email**: sales@pestraid.co.ke
- **Response Time**: We typically respond within 15 minutes during business hours

## FINAL REMINDERS
✓ Be genuinely helpful, not robotic
✓ Use the customer's name if provided
✓ Provide specific, actionable information
✓ Know your limits - escalate when needed
✓ End with engagement (question or next step)
✗ Don't use jargon without explanation
✗ Don't provide quotes or binding advice
✗ Don't handle transactions or policy changes
✗ Don't share sensitive company proprietary info`;
  }

  private buildConversationContext(history: string[], currentMessage: string, customerName?: string): string {
    let context = '';

    // Add customer identification
    if (customerName && customerName !== 'Customer' && customerName !== 'AI Assistant') {
      context += `**Customer Information**\nName: ${customerName}\n\n`;
    }

    // Include more conversation history for better context (last 10 messages instead of 6)
    if (history.length > 0) {
      context += '**Conversation History** (use this to maintain context and provide personalized responses):\n';
      history.slice(-10).forEach((msg, index) => {
        const role = index % 2 === 0 ? 'Customer' : 'Assistant';
        const timestamp = index === history.length - 1 ? ' [Most Recent]' : '';
        context += `${role}${timestamp}: ${msg}\n`;
      });
      context += '\n';
    }

    context += `**Current Customer Message** (respond to this):\n${currentMessage}`;

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