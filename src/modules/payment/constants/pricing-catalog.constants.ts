import { HttpStatus } from '@nestjs/common';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';
import { PaymentProviderEnum } from 'src/common/enum/payment-provider.enum';

// Server-side source of truth for what to charge — never trust a client-submitted
// amount. Pricing is per-tier by default (founder pricing while
// FOUNDER_PRICING_ENABLED, mainstream after); a specific subject/job-role can
// override either currency's amount via SkillTierOffering.priceInr/priceUsd, in
// which case that flat override wins outright (no founder/mainstream split on a
// deliberately-set custom price).
export type SupportedCurrency = 'INR' | 'USD';
export type PaidTier = Exclude<EnrollmentTierEnum, EnrollmentTierEnum.Basic>;

const PAID_TIERS: PaidTier[] = [
  EnrollmentTierEnum.Curious,
  EnrollmentTierEnum.Pro,
  EnrollmentTierEnum.Intern,
  EnrollmentTierEnum.Serious,
];

// Placeholder numbers, ascending with tier value — adjust once there's real
// conversion data. Serious is billed monthly (see DEFAULT_TIER_DURATION_MONTHS in
// skill-enrollment.constants.ts), so its per-cycle price is deliberately lower than a
// 6-month Pro window despite recurring more often.
const TIER_PRICING: Record<
  PaidTier,
  Record<SupportedCurrency, { founder: number; mainstream: number }>
> = {
  [EnrollmentTierEnum.Curious]: {
    INR: { founder: 299, mainstream: 499 },
    USD: { founder: 8, mainstream: 14 },
  },
  [EnrollmentTierEnum.Pro]: {
    INR: { founder: 699, mainstream: 999 },
    USD: { founder: 19, mainstream: 29 },
  },
  [EnrollmentTierEnum.Intern]: {
    INR: { founder: 1499, mainstream: 1999 },
    USD: { founder: 39, mainstream: 59 },
  },
  [EnrollmentTierEnum.Serious]: {
    INR: { founder: 999, mainstream: 1499 },
    USD: { founder: 25, mainstream: 39 },
  },
};

// Regional routing locked in the monetization plan: INR -> Razorpay, USD -> Stripe.
const CURRENCY_PROVIDER: Record<SupportedCurrency, PaymentProviderEnum> = {
  INR: PaymentProviderEnum.Razorpay,
  USD: PaymentProviderEnum.Stripe,
};

export function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return currency === 'INR' || currency === 'USD';
}

export function isPaidTier(tier: EnrollmentTierEnum): tier is PaidTier {
  return tier !== EnrollmentTierEnum.Basic;
}

export function resolveProviderForCurrency(currency: SupportedCurrency): PaymentProviderEnum {
  return CURRENCY_PROVIDER[currency];
}

/** `override` comes from a scope's SkillTierOffering row, if it has one — a non-null
 * value for the requested currency wins outright over the tier's default catalog
 * price (founder/mainstream doesn't apply to a deliberately-set custom price). */
export function getTierPrice(
  tier: PaidTier,
  currency: SupportedCurrency,
  founderPricingEnabled: boolean,
  override?: { priceInr?: number | null; priceUsd?: number | null },
): { amount: number; currency: SupportedCurrency } {
  const overrideAmount = currency === 'INR' ? override?.priceInr : override?.priceUsd;
  if (overrideAmount != null) {
    return { amount: Number(overrideAmount), currency };
  }

  const table = TIER_PRICING[tier]?.[currency];
  if (!table) {
    throw new AppCustomException(
      HttpStatus.BAD_REQUEST,
      `No price configured for the ${tier} tier in ${currency}.`,
    );
  }
  return {
    amount: founderPricingEnabled ? table.founder : table.mainstream,
    currency,
  };
}

/** Full default catalog (no per-scope overrides) for a general pricing page — every
 * paid tier x currency, plus which provider each currency routes to. A specific
 * subject/job-role's actual price may differ if it has a SkillTierOffering override;
 * callers that need the real per-scope price should use getTierPrice() with that
 * scope's offering row instead. */
export function getFullPricingCatalog(founderPricingEnabled: boolean): {
  founderPricingEnabled: boolean;
  pricing: Record<
    PaidTier,
    Record<SupportedCurrency, { amount: number; currency: SupportedCurrency; provider: PaymentProviderEnum }>
  >;
} {
  const currencies: SupportedCurrency[] = ['INR', 'USD'];

  const pricing = {} as Record<
    PaidTier,
    Record<SupportedCurrency, { amount: number; currency: SupportedCurrency; provider: PaymentProviderEnum }>
  >;
  for (const tier of PAID_TIERS) {
    pricing[tier] = {} as Record<
      SupportedCurrency,
      { amount: number; currency: SupportedCurrency; provider: PaymentProviderEnum }
    >;
    for (const currency of currencies) {
      const { amount } = getTierPrice(tier, currency, founderPricingEnabled);
      pricing[tier][currency] = { amount, currency, provider: resolveProviderForCurrency(currency) };
    }
  }

  return { founderPricingEnabled, pricing };
}
