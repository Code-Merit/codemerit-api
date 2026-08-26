import { Injectable } from '@nestjs/common';
import axios from 'axios';

export interface LinkedInProfile {
  sub: string;
  email: string;
  given_name: string;
  picture: string;
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

    return response.data.access_token;
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
