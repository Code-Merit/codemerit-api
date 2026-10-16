import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Throttles OTP verification per target e-mail instead of per IP. The global ThrottlerGuard keys
 * on IP, which a brute-forcer rotates freely; keying on the account being attacked caps total
 * guesses per OTP no matter how many IPs are used. Pair with @Throttle on the route for the limit.
 */
@Injectable()
export class OtpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return email ? `otp:${email}` : req.ip;
  }
}
