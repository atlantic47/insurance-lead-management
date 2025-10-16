import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { FlutterwaveService } from './flutterwave.service';
import { TenantsService } from '../tenants/tenants.service';

export const SUBSCRIPTION_PLANS = {
  free: { name: 'Free', price: 0, maxUsers: 1, maxLeads: 100 },
  basic: { name: 'Basic', price: 5000, maxUsers: 5, maxLeads: 1000 }, // NGN per user/month
  pro: { name: 'Pro', price: 8000, maxUsers: 20, maxLeads: 10000 },
  enterprise: { name: 'Enterprise', price: 15000, maxUsers: 100, maxLeads: 100000 },
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private flutterwaveService: FlutterwaveService,
    private tenantsService: TenantsService,
  ) {}

  async initiatePaymentForTenant(tenantId: string, plan: string, userCount: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          where: { role: 'ADMIN' },
          take: 1,
        },
      },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const planDetails = SUBSCRIPTION_PLANS[plan];
    if (!planDetails) {
      throw new Error('Invalid plan');
    }

    const amount = planDetails.price * userCount;
    const admin = tenant.users[0];

    const payment = await this.flutterwaveService.initiatePayment({
      amount,
      email: admin.email,
      name: `${admin.firstName} ${admin.lastName}`,
      tenantId: tenant.id,
      plan,
      redirectUrl: `${process.env.FRONTEND_URL}/payment/callback`,
    });

    return {
      paymentLink: payment.data.link,
      amount,
      plan,
      userCount,
    };
  }

  async handleWebhook(payload: any) {
    this.logger.log('Processing Flutterwave webhook');

    const { event, data } = payload;

    if (event === 'charge.completed' && data.status === 'successful') {
      const tenantId = data.meta.tenantId;
      const plan = data.meta.plan;

      // Update tenant subscription
      await this.tenantsService.updateSubscriptionStatus(
        tenantId,
        'active',
        data.tx_ref,
      );

      // Update plan and limits
      const planDetails = SUBSCRIPTION_PLANS[plan];
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          plan,
          maxUsers: planDetails.maxUsers,
          maxLeads: planDetails.maxLeads,
          status: 'active',
        },
      });

      this.logger.log(`Subscription activated for tenant ${tenantId}`);
      return { success: true };
    }

    if (event === 'subscription.cancelled') {
      const tenantId = data.meta.tenantId;

      await this.tenantsService.updateSubscriptionStatus(tenantId, 'cancelled');
      this.logger.log(`Subscription cancelled for tenant ${tenantId}`);
    }

    return { success: true };
  }

  async verifyPayment(transactionId: string) {
    return this.flutterwaveService.verifyPayment(transactionId);
  }
}
