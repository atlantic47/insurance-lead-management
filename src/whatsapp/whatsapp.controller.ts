import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Headers,
  Logger,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppConversationService } from './whatsapp-conversation.service';

@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private whatsappService: WhatsAppService,
    private conversationService: WhatsAppConversationService,
  ) {}

  @Public()
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    this.logger.log('Webhook verification request received');
    
    const result = this.whatsappService.verifyWebhook(mode, token, challenge);
    
    if (result) {
      this.logger.log('Webhook verification successful');
      return result;
    } else {
      this.logger.error('Webhook verification failed');
      throw new UnauthorizedException('Webhook verification failed');
    }
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: any,
    @Headers('x-hub-signature-256') signature: string,
  ): Promise<{ status: string }> {
    try {
      this.logger.log('Webhook message received');
      this.logger.debug('Webhook payload:', JSON.stringify(body, null, 2));

      // Validate webhook signature
      const bodyString = JSON.stringify(body);
      if (!this.whatsappService.validateWebhookSignature(signature, bodyString)) {
        this.logger.error('Invalid webhook signature');
        throw new UnauthorizedException('Invalid signature');
      }

      // Parse webhook payload
      const parsed = this.whatsappService.parseWebhookPayload(body);
      if (!parsed) {
        this.logger.warn('No messages found in webhook payload');
        return { status: 'ok' };
      }

      const { messages, contacts } = parsed;

      // Process each message
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const contact = contacts[i];

        this.logger.log(`Processing message ${message.id} from ${message.from}`);

        // Only process text messages for now
        if (message.type === 'text' && message.text?.body) {
          await this.conversationService.processIncomingMessage(message, contact);
        } else {
          this.logger.log(`Unsupported message type: ${message.type}`);
          
          // Send unsupported message response
          await this.whatsappService.sendMessage(
            message.from,
            'Thank you for your message. Currently, I can only process text messages. Please send your message as text, and I\'ll be happy to help!'
          );
        }
      }

      return { status: 'ok' };

    } catch (error) {
      this.logger.error('Error handling webhook:', error);
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      // Return OK to prevent Facebook from retrying
      return { status: 'error' };
    }
  }

  @Post('send-message')
  async sendMessage(
    @Body() body: { to: string; message: string; agentId?: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.log(`Manual message send request to ${body.to}`);

      const success = await this.whatsappService.sendMessage(body.to, body.message);
      
      if (success) {
        this.logger.log(`Message sent successfully to ${body.to}`);
        return { success: true };
      } else {
        return { success: false, error: 'Failed to send message' };
      }

    } catch (error) {
      this.logger.error('Error sending manual message:', error);
      return { success: false, error: error.message };
    }
  }

  @Public()
  @Get('test')
  async testConnection(): Promise<{ status: string; message: string }> {
    try {
      // Test sending a message to the test number
      const testNumber = '+15550935798'; // Your test number
      const testMessage = 'Hello! This is a test message from your insurance WhatsApp integration. If you receive this, the setup is working correctly!';

      const success = await this.whatsappService.sendMessage(testNumber, testMessage);

      if (success) {
        return {
          status: 'success',
          message: `Test message sent successfully to ${testNumber}`
        };
      } else {
        return {
          status: 'error',
          message: 'Failed to send test message'
        };
      }

    } catch (error) {
      this.logger.error('Error in test endpoint:', error);
      return {
        status: 'error',
        message: `Test failed: ${error.message}`
      };
    }
  }

  @Get('conversations')
  async getConversations(): Promise<{ conversations: any[] }> {
    // This would return active WhatsApp conversations
    // For now, return empty array
    return { conversations: [] };
  }

  @Post('conversations/:id/escalate')
  async escalateConversation(
    @Body() body: { agentId: string; reason?: string }
  ): Promise<{ success: boolean }> {
    try {
      // This would escalate a conversation to a human agent
      this.logger.log(`Conversation escalation requested by agent ${body.agentId}`);
      return { success: true };
    } catch (error) {
      this.logger.error('Error escalating conversation:', error);
      return { success: false };
    }
  }
}