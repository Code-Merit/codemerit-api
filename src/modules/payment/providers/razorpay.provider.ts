import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
// razorpay's typings use `export =` — this is the unambiguous CJS-import form for that,
// working regardless of esModuleInterop (which this project doesn't enable).
import Razorpay = require('razorpay');
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { IPaymentConfig } from 'src/config/payment-config';

@Injectable()
export class RazorpayProvider {
  constructor(private readonly configService: ConfigService) {}

  private getConfig(): IPaymentConfig['razorpay'] {
    return this.configService.get<IPaymentConfig>('payment').razorpay;
  }

  private getClient(): Razorpay {
    const config = this.getConfig();
    if (!config.keyId || !config.keySecret) {
      throw new AppCustomException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'Razorpay is not configured yet — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
      );
    }
    return new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
  }

  /** publicKeyId is safe to hand to the frontend — it's what Razorpay Checkout.js needs
   * client-side; keySecret never leaves the server. */
  getPublicKeyId(): string {
    return this.getConfig().keyId;
  }

  /** Verifies Checkout.js's post-payment callback params against RAZORPAY_KEY_SECRET —
   * per Razorpay's documented client-side verification scheme:
   * HMAC-SHA256(`${razorpayOrderId}|${razorpayPaymentId}`, key_secret) must equal
   * razorpaySignature. This is what lets a checkout get fulfilled immediately after the
   * Checkout.js `handler` fires, without depending on the webhook actually being
   * reachable (e.g. localhost during development) — the webhook path stays as a second,
   * independent confirmation for whenever it *is* reachable. */
  verifyPaymentSignature(razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string): boolean {
    const config = this.getConfig();
    if (!config.keySecret) {
      throw new AppCustomException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'Razorpay is not configured yet — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
      );
    }
    if (!razorpaySignature) return false;
    const expected = crypto
      .createHmac('sha256', config.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(razorpaySignature);
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  }

  async createOrder(params: {
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ id: string; amount: number; currency: string }> {
    const client = this.getClient();
    // Razorpay amounts are in the smallest currency unit (paise for INR).
    const order = await client.orders.create({
      amount: Math.round(params.amount * 100),
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes,
    });
    return { id: order.id, amount: Number(order.amount), currency: order.currency };
  }

  /** HMAC-SHA256 of the raw webhook body against RAZORPAY_WEBHOOK_SECRET, per Razorpay's
   * documented verification scheme. Must be called with the *raw* request body — a
   * re-serialized/parsed body will not reproduce the same signature. */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const config = this.getConfig();
    if (!config.webhookSecret) {
      throw new AppCustomException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'Razorpay webhook secret is not configured yet — set RAZORPAY_WEBHOOK_SECRET.',
      );
    }
    if (!signature) return false;
    const expected = crypto
      .createHmac('sha256', config.webhookSecret)
      .update(rawBody)
      .digest('hex');
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signature);
    // timingSafeEqual throws on mismatched lengths rather than returning false — a
    // malformed/forged signature of the wrong length must not crash the webhook.
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  }
}
