export const OTP_DAILY_LIMIT = 5; // max OTP sends per user per tag, per calendar day

// A 6-digit code is only 1,000,000 guesses — it must expire, and wrong guesses must be capped
// per e-mail (not per IP, which an attacker can rotate). See OtpThrottlerGuard.
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_VERIFY_LIMIT = 5; // verify attempts per e-mail per OTP_TTL_MS window
