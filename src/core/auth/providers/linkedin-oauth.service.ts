import { Injectable } from '@nestjs/common';
import axios from 'axios';

export interface LinkedInProfile {
  sub: string;
  email: string;
  given_name: string;
  picture: string;
}

export interface LinkedInTokenGrant {
  accessToken: string;
  expiresInSeconds: number | null;
  /** null when LinkedIn omitted the field — treat as unknown, not as "nothing granted". */
  scopes: string[] | null;
}

/**
 * The OAuth code<->token mechanics shared by two call sites that must never diverge: the existing
 * "Sign in with LinkedIn" login flow (AuthService.handleLinkedinCallback) and the newer "connect
 * LinkedIn for sharing while already signed in" flow (LinkedinShareService.connectAccount). Split
 * out specifically so neither AuthModule nor UsersModule has to import the other just to reach
 * this — AuthModule already imports UsersModule, so the reverse import would cycle. Both modules
 * import this one instead.
 */
@Injectable()
export class LinkedInOAuthService {
  private readonly clientId = process.env.LINKEDIN_CLIENT_ID;
  private readonly clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  private readonly redirectUri = process.env.LINKEDIN_REDIRECT_URI;

  async exchangeCodeForToken(code: string): Promise<string> {
    return (await this.exchangeCodeForTokenGrant(code)).accessToken;
  }

  /** Full token grant — `scopes` is what the member actually granted (LinkedIn's `scope`
   * response field), which can be narrower than what the popup requested. */
  async exchangeCodeForTokenGrant(code: string): Promise<LinkedInTokenGrant> {
    const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
    });

    const response = await axios.post(tokenUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, expires_in, scope } = response.data;
    return {
      accessToken: access_token,
      expiresInSeconds: typeof expires_in === 'number' ? expires_in : null,
      scopes: typeof scope === 'string' ? scope.split(/[\s,]+/).filter(Boolean) : null,
    };
  }

  async fetchLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
    const response = await axios.get<LinkedInProfile>(
      'https://api.linkedin.com/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    return response.data;
  }
}
