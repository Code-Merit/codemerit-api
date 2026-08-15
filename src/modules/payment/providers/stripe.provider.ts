import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { IPaymentConfig } from 'src/config/payment-config';

@Injectable()
export class StripeProvider {
  constructor(private readonly configService: ConfigService) {}

  private getConfig(): IPaymentConfig['stripe'] {
    return this.configService.get<IPaymentConfig>('payment').stripe;
  }

  private getClient(): Stripe {
    const config = this.getConfig();
    if (!config.secretKey) {
      throw new AppCustomException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'Stripe is not configured yet — set STRIPE_SECRET_KEY.',
      );
    }
    return new Stripe(config.secretKey);
  }

  async createCheckoutSession(params: {
    amount: number;
    currency: string;
    productName: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
  }): Promise<{ id: string; url: string | null }> {
    const client = this.getClient();
    const session = await client.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: { name: params.productName },
            // Stripe amounts are in the smallest currency unit (cents for USD).
            unit_amount: Math.round(params.amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    });
    return { id: session.id, url: session.url };
  }

  /** Requires the *raw* request body — Stripe's signature check re-hashes the exact
   * bytes received, so a JSON.parse()'d-and-re-stringified body will fail verification.
   * See main.ts's `rawBody: true` app option and the controller's use of req.rawBody. */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const config = this.getConfig();
    if (!config.webhookSecret) {
      throw new AppCustomException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'Stripe webhook secret is not configured yet — set STRIPE_WEBHOOK_SECRET.',
      );
    }
    const client = this.getClient();
    return client.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
  }
}
