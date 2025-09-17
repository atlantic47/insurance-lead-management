import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Get all chat conversations' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getConversations(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.chatService.getAllConversations(+page, +limit);
  }

  @Get('conversations/:leadId')
  @ApiOperation({ summary: 'Get conversation for a specific lead' })
  async getConversation(@Param('leadId') leadId: string) {
    return this.chatService.getConversation(leadId);
  }

  @Post('conversations/:conversationId/escalate')
  @ApiOperation({ summary: 'Manually escalate conversation to human agent' })
  async escalateConversation(
    @Param('conversationId') conversationId: string,
    @Body() data: { reason?: string },
    @CurrentUser() user: any,
  ) {
    const result = await this.chatService.escalateConversation(conversationId, user.id);
    
    // Notify the customer about the escalation
    const conversation = await this.chatService.getConversation(conversationId);
    if (conversation?.lead?.phone) {
      const escalationMessage = `Hello! I'm ${user.firstName}, one of our insurance specialists. I'll be taking over this conversation to provide you with personalized assistance. How can I help you today?`;
      
      await this.chatService.createChatMessage({
        content: escalationMessage,
        sender: 'HUMAN_AGENT',
        platform: 'WHATSAPP',
        leadId: conversation.lead.id,
        conversationId,
        metadata: { 
          agentId: user.id, 
          agentName: `${user.firstName} ${user.lastName}`,
          escalationReason: data.reason || 'manual_takeover',
        },
      });

      await this.chatService.sendWhatsAppMessage(conversation.lead.phone, escalationMessage);
    }
    
    return { ...result, escalatedBy: user.id, escalationReason: data.reason || 'manual_takeover' };
  }

  @Post('send-message')
  @ApiOperation({ summary: 'Send message to WhatsApp conversation' })
  async sendMessage(
    @Body() data: {
      leadId: string;
      message: string;
      conversationId?: string;
    },
    @CurrentUser() user: any,
  ) {
    // Get lead to find phone number
    const lead = await this.chatService.getLeadById(data.leadId);
    if (!lead) {
      throw new Error('Lead not found');
    }
    
    if (!lead.phone) {
      throw new Error('Lead does not have a phone number');
    }
    
    // Save human agent message
    await this.chatService.createChatMessage({
      content: data.message,
      sender: 'HUMAN_AGENT',
      platform: 'WHATSAPP',
      leadId: data.leadId,
      conversationId: data.conversationId,
      metadata: { agentId: user.id, agentName: `${user.firstName} ${user.lastName}` },
    });

    // Send WhatsApp message using the lead's phone number
    await this.chatService.sendWhatsAppMessage(lead.phone, data.message);
    
    return {
      success: true,
      message: 'Message sent successfully',
      leadPhone: lead.phone
    };
  }

  @Public()
  @Get('webhook/whatsapp')
  @ApiOperation({ summary: 'WhatsApp webhook verification endpoint' })
  async verifyWhatsappWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') verifyToken: string,
  ) {
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'insurance_lead_webhook_token';
    
    if (mode === 'subscribe' && verifyToken === expectedToken) {
      console.log('WhatsApp webhook verified successfully');
      return parseInt(challenge);
    } else {
      console.log('WhatsApp webhook verification failed');
      throw new Error('Verification failed');
    }
  }

  @Public()
  @Post('webhook/whatsapp')
  @ApiOperation({ summary: 'WhatsApp webhook endpoint' })
  async whatsappWebhook(
    @Body() data: any,
  ) {
    // Handle Meta WhatsApp webhook format
    if (data.entry && data.entry[0] && data.entry[0].changes) {
      const changes = data.entry[0].changes[0];
      if (changes.field === 'messages' && changes.value.messages) {
        const message = changes.value.messages[0];
        const contact = changes.value.contacts[0];
        
        return this.chatService.handleIncomingWhatsAppMessage(
          contact.wa_id,
          message.text?.body || 'Media message received',
          contact.profile?.name,
        );
      }
    }
    
    // Handle custom format for testing
    if (data.phoneNumber && data.message) {
      return this.chatService.handleIncomingWhatsAppMessage(
        data.phoneNumber,
        data.message,
        data.senderName,
      );
    }
    
    return { status: 'OK' };
  }
}