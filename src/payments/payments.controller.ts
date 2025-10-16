import { Controller, Post, Body, Get, Query, UseGuards, Request, Headers } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  async initiatePayment(
    @Request() req,
    @Body() body: { plan: string; userCount: number },
  ) {
    const tenantId = req.user.tenantId;
    return this.paymentsService.initiatePaymentForTenant(
      tenantId,
      body.plan,
      body.userCount,
    );
  }

  @Get('verify')
  async verifyPayment(@Query('transaction_id') transactionId: string) {
    return this.paymentsService.verifyPayment(transactionId);
  }

  @Post('webhook')
  async handleWebhook(
    @Body() payload: any,
    @Headers('verif-hash') signature: string,
  ) {
    // Verify webhook signature for security
    // const isValid = this.flutterwaveService.verifyWebhookSignature(signature, payload);
    // if (!isValid) {
    //   throw new UnauthorizedException('Invalid webhook signature');
    // }

    return this.paymentsService.handleWebhook(payload);
  }
}
