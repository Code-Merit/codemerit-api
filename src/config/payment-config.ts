import { registerAs } from '@nestjs/config';

// Required env vars to go live — all optional at boot (empty string default) so the
// app starts fine before these are configured; each provider throws a clear
// "not configured yet" error only when an endpoint that actually needs it is called.
//
//   RAZORPAY_KEY_ID            — Razorpay dashboard > API Keys
//   RAZORPAY_KEY_SECRET
//   RAZORPAY_WEBHOOK_SECRET    — set when creating the webhook in the Razorpay dashboard
//   STRIPE_SECRET_KEY          — Stripe dashboard > Developers > API keys
//   STRIPE_WEBHOOK_SECRET      — set when creating the webhook endpoint in the Stripe dashboard
//   FOUNDER_PRICING_ENABLED    — "true"/"false", defaults to true (see pricing-catalog.constants.ts)
export interface IPaymentConfig {
  razorpay: {
    keyId: string;
    keySecret: string;
    webhookSecret: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
  };
  founderPricingEnabled: boolean;
}

export const paymentConfig = registerAs('payment', (): IPaymentConfig => ({
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  founderPricingEnabled: (process.env.FOUNDER_PRICING_ENABLED ?? 'true') !== 'false',
}));
