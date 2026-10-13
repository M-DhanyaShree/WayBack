export interface PaymentResponse {
  id: string;
  amount: number;
  currency: string;
  status: 'created' | 'paid' | 'failed' | 'refunded';
}

export interface PaymentProvider {
  createPayment(amountMinorUnits: number, currencyCode: string, receiptId: string): Promise<PaymentResponse>;
  verifyPayment(paymentId: string, signature: string): Promise<boolean>;
  refundPayment(paymentId: string): Promise<PaymentResponse>;
}
