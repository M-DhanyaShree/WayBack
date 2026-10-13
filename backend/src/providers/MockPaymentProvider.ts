import { PaymentProvider, PaymentResponse } from './PaymentProvider';
import crypto from 'crypto';

export class MockPaymentProvider implements PaymentProvider {
  private payments = new Map<string, PaymentResponse>();

  async createPayment(amountMinorUnits: number, currencyCode: string, receiptId: string): Promise<PaymentResponse> {
    const id = `mock_pay_${crypto.randomBytes(8).toString('hex')}`;
    const payment: PaymentResponse = {
      id,
      amount: amountMinorUnits,
      currency: currencyCode,
      status: 'created',
    };
    this.payments.set(id, payment);
    return payment;
  }

  async verifyPayment(paymentId: string, signature: string): Promise<boolean> {
    // In a mock, we can just say if the payment exists and the signature matches a dummy check, it's verified.
    // For simplicity, we just check existence.
    const payment = this.payments.get(paymentId);
    if (payment) {
      payment.status = 'paid';
      return true;
    }
    return false;
  }

  async refundPayment(paymentId: string): Promise<PaymentResponse> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }
    if (payment.status !== 'paid') {
      throw new Error('Payment cannot be refunded');
    }
    payment.status = 'refunded';
    return payment;
  }
}
