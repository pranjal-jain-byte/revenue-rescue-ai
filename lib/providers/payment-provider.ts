/**
 * Payment Provider Abstraction
 *
 * Clean interface that separates payment execution from the agent logic.
 * Supports:
 * - MockPaymentProvider (default, deterministic, no external calls)
 * - RazorpayTestProvider (Razorpay TEST MODE only — zero real money)
 *
 * NEVER use live payment credentials.
 */

export interface PaymentAttemptParams {
  orderId: string;
  amount: number;
  currency: string;
  customerId: string;
  paymentMethod: string;
  caseId: string;
}

export interface PaymentAttemptResult {
  success: boolean;
  paymentId?: string;
  errorCode?: string;
  errorDescription?: string;
  provider: string;
  simulatedOutcome?: string;
}

export interface PaymentProvider {
  name: string;
  retryPayment(params: PaymentAttemptParams): Promise<PaymentAttemptResult>;
  sendPaymentLink(params: { customerId: string; amount: number; currency: string; caseId: string }): Promise<{ success: boolean; linkId?: string }>;
  isTestMode: boolean;
}

// ── Mock Payment Provider ─────────────────────────────────────────────────────

/**
 * Deterministic mock provider for demo and testing.
 * Outcomes are seeded by caseId hash for reproducibility.
 */
export class MockPaymentProvider implements PaymentProvider {
  name = 'MOCK';
  isTestMode = true;

  private hashCode(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  async retryPayment(params: PaymentAttemptParams): Promise<PaymentAttemptResult> {
    // Add realistic latency
    await new Promise(r => setTimeout(r, 200 + Math.random() * 300));

    // Deterministic outcome based on case ID for reproducibility
    const hash = this.hashCode(params.caseId);

    // Simulate realistic outcomes: 60% success on retry
    const outcomes = [
      { success: true, paymentId: `pay_mock_${params.caseId.slice(-8)}`, simulatedOutcome: 'SUCCESS' },
      { success: true, paymentId: `pay_mock_${params.caseId.slice(-8)}`, simulatedOutcome: 'SUCCESS' },
      { success: true, paymentId: `pay_mock_${params.caseId.slice(-8)}`, simulatedOutcome: 'SUCCESS' },
      { success: false, errorCode: 'INSUFFICIENT_BALANCE', errorDescription: 'Insufficient balance in account', simulatedOutcome: 'INSUFFICIENT_FUNDS' },
      { success: false, errorCode: 'BANK_DECLINED', errorDescription: 'Transaction declined by bank', simulatedOutcome: 'BANK_DECLINED' },
    ];

    const outcome = outcomes[hash % outcomes.length];

    return {
      ...outcome,
      provider: 'MOCK',
    };
  }

  async sendPaymentLink(params: { customerId: string; amount: number; currency: string; caseId: string }): Promise<{ success: boolean; linkId?: string }> {
    await new Promise(r => setTimeout(r, 100));
    return {
      success: true,
      linkId: `lnk_mock_${params.caseId.slice(-8)}`,
    };
  }
}

// ── Razorpay Test Provider ────────────────────────────────────────────────────

/**
 * Razorpay Test Mode provider.
 * Only activates when RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set.
 * Uses Razorpay TEST MODE exclusively — no real money is moved.
 */
export class RazorpayTestProvider implements PaymentProvider {
  name = 'RAZORPAY_TEST';
  isTestMode = true;

  private keyId: string;
  private keySecret: string;

  constructor(keyId: string, keySecret: string) {
    if (!keyId.startsWith('rzp_test_')) {
      throw new Error('SAFETY: Only Razorpay TEST MODE keys (rzp_test_...) are accepted.');
    }
    this.keyId = keyId;
    this.keySecret = keySecret;
  }

  async retryPayment(params: PaymentAttemptParams): Promise<PaymentAttemptResult> {
    try {
      // Create a Razorpay order in test mode
      const credentials = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

      const orderResp = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify({
          amount: Math.round(params.amount * 100), // Razorpay uses paise
          currency: params.currency,
          receipt: params.orderId,
          notes: {
            case_id: params.caseId,
            customer_id: params.customerId,
            mode: 'TEST',
          },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!orderResp.ok) {
        const err = await orderResp.json() as { error?: { description?: string } };
        return {
          success: false,
          errorCode: 'RAZORPAY_ORDER_FAILED',
          errorDescription: err.error?.description ?? 'Order creation failed',
          provider: 'RAZORPAY_TEST',
        };
      }

      const order = await orderResp.json() as { id?: string };

      // In test mode, we create the order and record it
      // Actual payment completion requires frontend SDK — mark as pending
      return {
        success: true,
        paymentId: order.id ?? `rzp_test_order_${Date.now()}`,
        simulatedOutcome: 'ORDER_CREATED_TEST_MODE',
        provider: 'RAZORPAY_TEST',
      };
    } catch (err) {
      return {
        success: false,
        errorCode: 'PROVIDER_ERROR',
        errorDescription: err instanceof Error ? err.message : 'Unknown error',
        provider: 'RAZORPAY_TEST',
      };
    }
  }

  async sendPaymentLink(params: { customerId: string; amount: number; currency: string; caseId: string }): Promise<{ success: boolean; linkId?: string }> {
    try {
      const credentials = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

      const resp = await fetch('https://api.razorpay.com/v1/payment_links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify({
          amount: Math.round(params.amount * 100),
          currency: params.currency,
          description: `Payment recovery - Case ${params.caseId}`,
          notes: { case_id: params.caseId, mode: 'TEST' },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!resp.ok) return { success: false };

      const link = await resp.json() as { id?: string };
      return { success: true, linkId: link.id };
    } catch {
      return { success: false };
    }
  }
}

// ── Provider Factory ──────────────────────────────────────────────────────────

export function getPaymentProvider(): PaymentProvider {
  const providerType = process.env.PAYMENT_PROVIDER ?? 'mock';
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (providerType === 'razorpay' && keyId && keySecret) {
    try {
      return new RazorpayTestProvider(keyId, keySecret);
    } catch {
      console.warn('Razorpay provider init failed, falling back to mock');
    }
  }

  return new MockPaymentProvider();
}
