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
  Param,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppConversationService } from './whatsapp-conversation.service';
import { WhatsAppTokenService } from './whatsapp-token.service';
import { WhatsAppTokenManagerService } from './whatsapp-token-manager.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private whatsappService: WhatsAppService,
    private conversationService: WhatsAppConversationService,
    private tokenService: WhatsAppTokenService,
    private tokenManager: WhatsAppTokenManagerService,
    private configService: ConfigService,
  ) {}

  // Tenant-specific webhook endpoint: /whatsapp/webhook/:tenantId
  @Public()
  @Get('webhook/:tenantId')
  async verifyWebhook(
    @Param('tenantId') tenantId: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): Promise<string> {
    this.logger.log(`Webhook verification for tenant ${tenantId}`);

    const result = await this.whatsappService.verifyWebhookForTenant(
      tenantId,
      mode,
      token,
      challenge,
    );

    if (result) {
      this.logger.log(`Webhook verification successful for tenant ${tenantId}`);
      return result;
    } else {
      this.logger.error(`Webhook verification failed for tenant ${tenantId}`);
      throw new UnauthorizedException('Webhook verification failed');
    }
  }

  // Tenant-specific webhook POST endpoint
  @Public()
  @Post('webhook/:tenantId')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('tenantId') tenantId: string,
    @Body() body: any,
    @Headers('x-hub-signature-256') signature: string,
  ): Promise<{ status: string }> {
    try {
      this.logger.log(`=== WEBHOOK POST for tenant ${tenantId} ===`);
      this.logger.log('Raw webhook payload:', JSON.stringify(body, null, 2));

      // Validate webhook signature with tenant-specific secret
      const bodyString = JSON.stringify(body);
      const isValid = await this.whatsappService.validateWebhookSignatureForTenant(
        tenantId,
        signature,
        bodyString,
      );

      if (!isValid) {
        this.logger.warn(`Invalid webhook signature for tenant ${tenantId}`);
        throw new UnauthorizedException('Invalid signature');
      }

      // Parse webhook payload
      this.logger.log('Attempting to parse webhook payload...');
      const parsed = this.whatsappService.parseWebhookPayload(body);

      if (!parsed) {
        this.logger.warn('❌ PARSE FAILED: No messages found in webhook payload');
        this.logger.warn('Payload structure check - body.entry exists:', !!body.entry);
        if (body.entry) {
          this.logger.warn('Entry[0] exists:', !!body.entry[0]);
          if (body.entry[0]) {
            this.logger.warn('Changes exists:', !!body.entry[0].changes);
            if (body.entry[0].changes) {
              this.logger.warn('Changes[0] exists:', !!body.entry[0].changes[0]);
              if (body.entry[0].changes[0]) {
                this.logger.warn('Field:', body.entry[0].changes[0].field);
                this.logger.warn('Value exists:', !!body.entry[0].changes[0].value);
              }
            }
          }
        }
        return { status: 'ok' };
      }

      const { messages, contacts } = parsed;
      this.logger.log(`✅ PARSE SUCCESS: Found ${messages.length} messages and ${contacts.length} contacts`);

      // Process each message
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const contact = contacts[i];

        this.logger.log(`Processing message ${message.id} from ${message.from}`);

        // Only process text messages for now
        if (message.type === 'text' && message.text?.body) {
          await this.conversationService.processIncomingMessage(message, contact, tenantId);
        } else {
          this.logger.log(`Unsupported message type: ${message.type}`);

          // Send unsupported message response
          await this.whatsappService.sendMessage(
            message.from,
            'Thank you for your message. Currently, I can only process text messages. Please send your message as text, and I\'ll be happy to help!',
            tenantId
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
    @Body() body: { to: string; message: string; agentId?: string },
    @CurrentUser() user: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.log(`Manual message send request to ${body.to}`);

      const success = await this.whatsappService.sendMessage(body.to, body.message, user.tenantId);

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
  @Get('test/:tenantId')
  async testConnection(@Param('tenantId') tenantId: string): Promise<{ status: string; message: string }> {
    try {
      // Test sending a message to the test number
      const testNumber = '+15550935798';
      const testMessage = 'Hello! This is a test message from your insurance WhatsApp integration. If you receive this, the setup is working correctly!';

      const success = await this.whatsappService.sendMessage(testNumber, testMessage, tenantId);

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

  // SECURITY FIX: Removed @Public() - requires authentication
  @Get('conversations')
  async getConversations(): Promise<{ conversations: any[] }> {
    try {
      return await this.conversationService.getConversations();
    } catch (error) {
      this.logger.error('Error fetching conversations:', error);
      return { conversations: [] };
    }
  }

  // SECURITY FIX: Removed @Public() - requires authentication
  @Get('conversation/:id/lead')
  async getConversationLead(@Param('id') conversationId: string): Promise<{ leadId?: string; lead?: any; error?: string }> {
    try {
      const conversation = await this.conversationService.findConversationById(conversationId);
      if (!conversation) {
        return { error: 'Conversation not found' };
      }

      if (!conversation.leadId) {
        // Try to create a lead for this conversation if it doesn't have one
        const lead = await this.conversationService.createOrGetLeadForConversation(conversation.phoneNumber, conversation.customerName);
        
        // Update the conversation metadata to include the lead ID
        await this.conversationService.linkConversationToLead(conversationId, lead.id);
        
        return { leadId: lead.id, lead };
      }

      return { leadId: conversation.leadId, lead: conversation.lead };
    } catch (error) {
      this.logger.error('Error getting conversation lead:', error);
      return { error: error.message };
    }
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

  @Public()
  @Post('simulate-incoming')
  async simulateIncomingMessage(
    @Body() body: { phoneNumber: string; message: string; senderName?: string }
  ): Promise<{ success: boolean; conversationId?: string }> {
    try {
      this.logger.log(`Simulating incoming WhatsApp message from ${body.phoneNumber}: ${body.message}`);
      
      // Create the webhook payload format
      const webhookPayload = {
        entry: [{
          changes: [{
            field: 'messages',
            value: {
              messages: [{
                from: body.phoneNumber,
                id: `sim_${Date.now()}`,
                timestamp: Math.floor(Date.now() / 1000).toString(),
                type: 'text',
                text: {
                  body: body.message
                }
              }],
              contacts: [{
                profile: {
                  name: body.senderName || 'Test User'
                },
                wa_id: body.phoneNumber
              }]
            }
          }]
        }]
      };

      // Process through the conversation service
      await this.conversationService.processIncomingMessage(
        webhookPayload.entry[0].changes[0].value.messages[0] as any,
        webhookPayload.entry[0].changes[0].value.contacts[0] as any
      );

      return { success: true };
    } catch (error) {
      this.logger.error('Error simulating incoming message:', error);
      return { success: false };
    }
  }

  @Public()
  @Get('token/info')
  async getTokenInfo(): Promise<any> {
    try {
      const managerInfo = await this.tokenManager.getTokenInfo();
      const serviceInfo = await this.tokenService.getTokenInfo();
      
      return {
        tokenManager: managerInfo,
        tokenService: serviceInfo,
        recommendation: managerInfo.valid ? 'Token Manager is working' : 'Use POST /whatsapp/token/set to provide a valid user access token'
      };
    } catch (error) {
      this.logger.error('Error getting token info:', error);
      return { 
        valid: false, 
        error: error.message,
        message: 'Failed to get token information'
      };
    }
  }

  @Public()
  @Post('token/refresh')
  async refreshToken(): Promise<{ success: boolean; message: string; tokenInfo?: any }> {
    try {
      // Try token manager first
      await this.tokenManager.refreshToken();
      const managerInfo = await this.tokenManager.getTokenInfo();
      
      if (managerInfo.valid) {
        return {
          success: true,
          message: 'Token refreshed successfully via Token Manager',
          tokenInfo: managerInfo
        };
      }
      
      // Fallback to token service
      const newToken = await this.tokenService.getValidAccessToken();
      const serviceInfo = await this.tokenService.getTokenInfo();
      
      return {
        success: true,
        message: 'Token refreshed successfully via Token Service',
        tokenInfo: serviceInfo
      };
    } catch (error) {
      this.logger.error('Error refreshing token:', error);
      return {
        success: false,
        message: `Failed to refresh token: ${error.message}. Please use POST /whatsapp/token/set to manually set a valid token.`
      };
    }
  }

  @Public()
  @Post('token/set')
  async setNewToken(
    @Body() body: { token: string; expiresInDays?: number }
  ): Promise<{ success: boolean; message: string; tokenInfo?: any }> {
    try {
      // Set token in both services
      await this.tokenManager.setNewToken(body.token, body.expiresInDays || 60);
      await this.tokenService.setNewToken(body.token, body.expiresInDays || 60);
      
      const tokenInfo = await this.tokenManager.getTokenInfo();
      
      return {
        success: true,
        message: 'New token set successfully in both services',
        tokenInfo
      };
    } catch (error) {
      this.logger.error('Error setting new token:', error);
      return {
        success: false,
        message: `Failed to set new token: ${error.message}`
      };
    }
  }

  @Public()
  @Get('token/instructions')
  async getTokenInstructions(): Promise<{ instructions: string[]; currentStatus: any }> {
    const tokenInfo = await this.getTokenInfo();
    
    return {
      instructions: [
        "🔧 HOW TO GET A NEW WHATSAPP ACCESS TOKEN:",
        "1. Go to Facebook Developer Console: https://developers.facebook.com/tools/explorer/",
        "2. Select your app: 'Insurance Lead Management' (App ID: 729588945970730)",
        "3. Click 'Generate Access Token' and login to Facebook",
        "4. In 'Permissions' tab, add: 'whatsapp_business_management', 'whatsapp_business_messaging'",
        "5. Click 'Generate Access Token' again",
        "6. Copy the generated User Access Token",
        "7. Test the token using the endpoint below:",
        "   POST /whatsapp/token/test",
        "   Body: { \"token\": \"your_new_token_here\" }",
        "8. If test passes, set the token:",
        "   POST /whatsapp/token/set", 
        "   Body: { \"token\": \"your_new_token_here\", \"expiresInDays\": 60 }",
        "",
        "🚨 IMPORTANT: You need a USER ACCESS TOKEN, not an APP ACCESS TOKEN!",
        "🚨 The token must have 'whatsapp_business_management' permissions!",
        "🚨 Phone Number ID: 271219419402280 must be accessible with this token!"
      ],
      currentStatus: tokenInfo
    };
  }

  @Public()
  @Post('token/test')
  async testToken(@Body() body: { token: string }): Promise<{ valid: boolean; message: string; details?: any }> {
    try {
      // Test basic token validity
      const response = await axios.get('https://graph.facebook.com/me', {
        params: { access_token: body.token }
      });

      if (!response.data.id) {
        return { valid: false, message: 'Token is invalid - no user ID returned' };
      }

      // Test WhatsApp Business permissions
      const phoneNumberId = this.configService.get('WHATSAPP_PHONE_NUMBER_ID');
      try {
        const phoneResponse = await axios.get(`https://graph.facebook.com/v18.0/${phoneNumberId}`, {
          params: { access_token: body.token }
        });

        return {
          valid: true,
          message: '✅ Token is valid and has WhatsApp Business permissions!',
          details: {
            user: response.data,
            phoneNumber: phoneResponse.data,
            phoneNumberId: phoneNumberId
          }
        };
      } catch (phoneError) {
        return {
          valid: false,
          message: `❌ Token is valid but lacks permissions for Phone Number ID: ${phoneNumberId}`,
          details: {
            user: response.data,
            phoneError: phoneError.response?.data?.error,
            phoneNumberId: phoneNumberId
          }
        };
      }
    } catch (error) {
      return {
        valid: false,
        message: '❌ Token validation failed',
        details: error.response?.data?.error || error.message
      };
    }
  }
}