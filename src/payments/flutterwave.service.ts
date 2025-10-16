import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class FlutterwaveService {
  private readonly logger = new Logger(FlutterwaveService.name);
  private readonly baseUrl = 'https://api.flutterwave.com/v3';
  private readonly secretKey: string;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('FLUTTERWAVE_SECRET_KEY') || '';
  }

  async initiatePayment(data: {
    amount: number;
    email: string;
    name: string;
    tenantId: string;
    plan: string;
    redirectUrl: string;
  }) {
    try {
      const payload = {
        tx_ref: `TXN-${data.tenantId}-${Date.now()}`,
        amount: data.amount,
        currency: 'NGN',
        redirect_url: data.redirectUrl,
        customer: {
          email: data.email,
          name: data.name,
        },
        customizations: {
          title: 'Insurance CRM Subscription',
          description: `${data.plan} Plan - Monthly Subscription`,
          logo: 'https://your-domain.com/logo.png',
        },
        meta: {
          tenantId: data.tenantId,
          plan: data.plan,
        },
      };

      const response = await axios.post(
        `${this.baseUrl}/payments`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      this.logger.log(`Payment initiated for tenant ${data.tenantId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Flutterwave payment initiation failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async verifyPayment(transactionId: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transactions/${transactionId}/verify`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        }
      );

      this.logger.log(`Payment verified: ${transactionId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Payment verification failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async createSubscription(data: {
    amount: number;
    email: string;
    name: string;
    plan: string;
    tenantId: string;
  }) {
    try {
      const payload = {
        amount: data.amount,
        name: `${data.plan} Plan`,
        interval: 'monthly',
        duration: 12, // 12 months
      };

      const response = await axios.post(
        `${this.baseUrl}/payment-plans`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      this.logger.log(`Subscription plan created for ${data.plan}`);
      return response.data;
    } catch (error) {
      this.logger.error('Subscription creation failed:', error.response?.data || error.message);
      throw error;
    }
  }

  verifyWebhookSignature(signature: string, payload: any): boolean {
    const crypto = require('crypto');
    const secretHash = this.configService.get<string>('FLUTTERWAVE_SECRET_HASH') || '';

    const hash = crypto
      .createHmac('sha256', secretHash)
      .update(JSON.stringify(payload))
      .digest('hex');

    return hash === signature;
  }
}
