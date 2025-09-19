import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: {
    body: string;
  };
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
}

export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly baseUrl = 'https://graph.facebook.com/v18.0';
  
  constructor(private configService: ConfigService) {}

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.configService.get('WHATSAPP_ACCESS_TOKEN')}`,
      'Content-Type': 'application/json',
    };
  }

  async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      const phoneNumberId = this.configService.get('WHATSAPP_PHONE_NUMBER_ID');
      const url = `${this.baseUrl}/${phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
          body: message
        }
      };

      this.logger.log(`Sending WhatsApp message to ${to}: ${message.substring(0, 100)}...`);
      
      const response = await axios.post(url, payload, {
        headers: this.getHeaders()
      });

      if (response.status === 200) {
        this.logger.log(`WhatsApp message sent successfully to ${to}`);
        return true;
      } else {
        this.logger.error(`Failed to send WhatsApp message: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (error) {
      this.logger.error('Error sending WhatsApp message:', error.response?.data || error.message);
      return false;
    }
  }

  async sendTypingIndicator(to: string): Promise<void> {
    try {
      const phoneNumberId = this.configService.get('WHATSAPP_PHONE_NUMBER_ID');
      const url = `${this.baseUrl}/${phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: {
          body: '...' // Minimal message to show typing
        }
      };

      await axios.post(url, payload, {
        headers: this.getHeaders()
      });
    } catch (error) {
      this.logger.warn('Failed to send typing indicator:', error.message);
    }
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    try {
      const phoneNumberId = this.configService.get('WHATSAPP_PHONE_NUMBER_ID');
      const url = `${this.baseUrl}/${phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      };

      await axios.post(url, payload, {
        headers: this.getHeaders()
      });
    } catch (error) {
      this.logger.warn('Failed to mark message as read:', error.message);
    }
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = this.configService.get('WHATSAPP_VERIFY_TOKEN');
    
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verified successfully');
      return challenge;
    } else {
      this.logger.warn('Webhook verification failed');
      return null;
    }
  }

  validateWebhookSignature(signature: string, body: string): boolean {
    try {
      const crypto = require('crypto');
      const appSecret = this.configService.get('WHATSAPP_APP_SECRET');
      
      if (!signature || !signature.startsWith('sha256=')) {
        return false;
      }

      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', appSecret)
        .update(body)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      this.logger.error('Error validating webhook signature:', error);
      return false;
    }
  }

  parseWebhookPayload(body: any): { messages: WhatsAppMessage[], contacts: WhatsAppContact[] } | null {
    try {
      if (!body.entry || !body.entry[0] || !body.entry[0].changes || !body.entry[0].changes[0]) {
        return null;
      }

      const change = body.entry[0].changes[0];
      if (change.field !== 'messages' || !change.value) {
        return null;
      }

      const messages = change.value.messages || [];
      const contacts = change.value.contacts || [];

      return { messages, contacts };
    } catch (error) {
      this.logger.error('Error parsing webhook payload:', error);
      return null;
    }
  }
}