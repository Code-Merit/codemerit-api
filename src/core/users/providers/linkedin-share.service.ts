import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';

import { Profile } from 'src/common/typeorm/entities/profile.entity';
import { LinkedinShareDto } from '../dtos/linkedin-share.dto';
import { ActivityService } from 'src/modules/activity/providers/activity/activity.service';
import { LinkedinShare } from 'src/common/typeorm/entities/linkedin-share.entity';
import { LinkedInOAuthService, LinkedInTokenGrant } from 'src/core/auth/providers/linkedin-oauth.service';
import { UserProfileService } from './user-profile.service';

// The frontend share button matches on "not connected" to switch to its Connect action.
const LINKEDIN_NOT_CONNECTED = 'LinkedIn is not connected for this user.';
const LINKEDIN_RECONNECT_REQUIRED =
  'LinkedIn is not connected for this user with posting permission. Please connect again.';
const LINKEDIN_POST_SCOPE = 'w_member_social';

// "Share on LinkedIn" product (w_member_social): v2/ugcPosts + v2/assets, per
// learn.microsoft.com/linkedin/consumer/integrations/self-serve/share-on-linkedin.
// NOT the versioned /rest/posts + /rest/images APIs — those belong to partner products
// (Community Management), and this app is refused them ("partnerApiImagesExternal…").
const LINKEDIN_V2 = 'https://api.linkedin.com/v2';

@Injectable()
export class LinkedinShareService {
  private readonly logger = new Logger(LinkedinShareService.name);
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(LinkedinShare)
    private readonly linkedinShareRepo: Repository<LinkedinShare>,
    private readonly activityService: ActivityService,
    private readonly linkedInOAuth: LinkedInOAuthService,
    private readonly userProfileService: UserProfileService,
  ) {}

  /**
   * "Connect LinkedIn for sharing" — a narrower sibling of AuthService.handleLinkedinCallback()
   * for a user who's already signed in and just wants posting access, not a login/account-match/
   * JWT-issue. Same OAuth code exchange (LinkedInOAuthService, shared to avoid a second copy),
   * but deliberately omits `auth_provider` so this never overwrites how the caller's account
   * actually signs in.
   */
  async connectAccount(userId: number, code: string) {
    let grant: LinkedInTokenGrant;
    let profile: { sub: string };
    try {
      grant = await this.linkedInOAuth.exchangeCodeForTokenGrant(code);
      profile = await this.linkedInOAuth.fetchLinkedInProfile(grant.accessToken);
    } catch (error: any) {
      // Most often an expired/reused code or a LINKEDIN_REDIRECT_URI that doesn't match the
      // origin the popup ran on — LinkedIn's reason is logged, the user gets a retryable 400.
      this.logger.error(`LinkedIn connect failed: ${JSON.stringify(error?.response?.data ?? error?.message)}`);
      throw new BadRequestException('Could not connect LinkedIn. Please try again.');
    }

    const granted = grant.scopes?.join(', ') ?? 'unknown';
    const appId = process.env.LINKEDIN_CLIENT_ID ?? 'unset';
    this.logger.log(`LinkedIn connect for userId=${userId}: app=${appId}, granted scopes=${granted}`);
    // A token without the posting scope "connects" fine but every share then 403s
    // (ugcPosts.CREATE.NO_VERSION) — refuse it here, where the cause is still visible. The app id
    // and granted scopes go in the message: the usual cause is the Share on LinkedIn product being
    // on a different LinkedIn app than the one this environment's client id points at.
    if (grant.scopes && !grant.scopes.includes(LINKEDIN_POST_SCOPE)) {
      throw new BadRequestException(
        `LinkedIn didn't grant posting permission (${LINKEDIN_POST_SCOPE}) for app ${appId}. Granted: ${granted}.`,
      );
    }

    const accessToken = grant.accessToken;
    // LinkedIn's own expires_in when given (normally 60 days), same window the login flow assumes.
    const linkedinTokenExpiresAt = new Date(Date.now() + (grant.expiresInSeconds ?? 60 * 24 * 60 * 60) * 1000);

    await this.userProfileService.updateSocialProfile(userId, {
      linkedinId: profile.sub,
      linkedinAccessToken: accessToken,
      linkedinTokenExpiresAt,
    });

    try {
      await this.activityService.createActivity(
        userId,
        'LinkedIn Connected',
        'connected their LinkedIn account for sharing.',
        { dataId: String(userId), dataType: 'LINKEDIN_CONNECT' },
      );
    } catch (err) {
      this.logger.error(
        `Failed to log LinkedIn connect activity: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return { connected: true, expiresAt: linkedinTokenExpiresAt };
  }

  /** Drops the stored posting token. linkedinId stays — it's harmless on its own (login matches
   * by email), and keeps a LinkedIn-signed-in account's identity intact. */
  async disconnectAccount(userId: number) {
    await this.profileRepository.update(
      { userId },
      { linkedinAccessToken: null, linkedinTokenExpiresAt: null },
    );
    return { connected: false, expiresAt: null };
  }

  async getStatus(userId: number) {
    const profile = await this.findLinkedInCredentials(userId);
    return {
      connected: this.hasValidToken(profile),
      expiresAt: profile?.linkedinTokenExpiresAt ?? null,
    };
  }

  async share(userId: number, dto: LinkedinShareDto) {
    const profile = await this.findLinkedInCredentials(userId);
    if (!this.hasValidToken(profile)) {
      throw new BadRequestException(LINKEDIN_NOT_CONNECTED);
    }

    let shareRecord: LinkedinShare | undefined;
    let postUrn: string | null;
    let imageAsset: string | null = null;
    let publishing = false;

    try {
      // create an audit row with pending status
      shareRecord = await this.linkedinShareRepo.save({
        userId,
        text: dto.text,
        url: dto.url ?? null,
        imageFileName: dto.imageFileName ?? null,
        status: 'PENDING',
      });

      const author = `urn:li:person:${profile.linkedinId}`;
      const headers = {
        Authorization: `Bearer ${profile.linkedinAccessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      };

      // 1. Best-effort image (client-captured base64 data URL), uploaded straight from memory.
      // If LinkedIn refuses the upload (403 — the app's product access doesn't cover it), the
      // post still goes out as text + link card instead of failing the whole share.
      if (dto.imageDataUrl) {
        const match = dto.imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if (!match) {
          throw new BadRequestException('Invalid imageDataUrl format.');
        }
        try {
          imageAsset = await this.uploadImage(headers, author, Buffer.from(match[2], 'base64'), match[1]);
        } catch (error: any) {
          if (error?.response?.status !== 403) throw error;
          this.logger.warn(`LinkedIn image upload refused, posting without it: ${JSON.stringify(error.response.data)}`);
        }
      }

      // 2. Publish — an image post, a link-card post, or plain text.
      publishing = true;
      const postResponse = await axios.post(
        `${LINKEDIN_V2}/ugcPosts`,
        {
          author,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: dto.text },
              ...(imageAsset
                ? { shareMediaCategory: 'IMAGE', media: [{ status: 'READY', media: imageAsset }] }
                : dto.url
                  ? { shareMediaCategory: 'ARTICLE', media: [{ status: 'READY', originalUrl: dto.url }] }
                  : { shareMediaCategory: 'NONE' }),
            },
          },
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        },
        { headers },
      );
      postUrn = postResponse.headers['x-restli-id'] ?? null;
    } catch (error: any) {
      const detail = error?.response?.data ?? error?.message;
      await this.updateShareRecord(shareRecord, {
        status: 'FAILED',
        errorMessage: typeof detail === 'string' ? detail : JSON.stringify(detail),
      });

      // 401 = LinkedIn revoked or expired the token early — same reconnect path as no token.
      if (error?.response?.status === 401) {
        throw new BadRequestException(LINKEDIN_NOT_CONNECTED);
      }
      // 403 on ugcPosts = the stored token can't post (ACCESS_DENIED "ugcPosts.CREATE.NO_VERSION"):
      // typically issued without w_member_social, e.g. before the scope was requested or by a
      // different LinkedIn app. Retrying with it can never work, so drop it — status flips to
      // disconnected and the button offers Connect, which mints a fresh, scope-checked token.
      if (publishing && error?.response?.status === 403) {
        this.logger.warn(`LinkedIn post refused (403) for userId=${userId}, clearing token: ${JSON.stringify(detail)}`);
        await this.disconnectAccount(userId).catch((e) =>
          this.logger.error(`Failed to clear refused LinkedIn token: ${e instanceof Error ? e.message : String(e)}`),
        );
        throw new BadRequestException(LINKEDIN_RECONNECT_REQUIRED);
      }
      throw new BadRequestException(
        error.response?.data?.message ??
          error?.response?.data?.serviceErrorCode ??
          error?.message ??
          'Failed to share on LinkedIn.',
      );
    }

    // The post is live from here on — bookkeeping must never fail the request, or the user
    // sees an error, retries, and posts twice.
    await this.updateShareRecord(shareRecord, { status: 'SENT', linkedinUrn: postUrn });
    try {
      await this.activityService.createActivity(
        userId,
        'Shared on LinkedIn',
        dto.url
          ? 'shared content with a link on LinkedIn.'
          : imageAsset
            ? 'shared content with an image on LinkedIn.'
            : 'shared a text post on LinkedIn.',
        { dataId: postUrn ?? undefined, dataType: 'LINKEDIN_SHARE' },
      );
    } catch (e) {
      this.logger.error(`Failed to log LinkedIn share activity: ${e instanceof Error ? e.message : String(e)}`);
    }

    return {
      success: true,
      postId: postUrn,
      postUrl: postUrn ? `https://www.linkedin.com/feed/update/${postUrn}` : null,
      // false when an image was sent but LinkedIn refused the upload (posted without it).
      imageAttached: !!imageAsset,
      shared: {
        text: dto.text,
        url: dto.url ?? null,
        image: imageAsset ? 'uploaded' : null,
      },
    };
  }

  private findLinkedInCredentials(userId: number) {
    return this.profileRepository.findOne({
      where: { userId },
      select: ['linkedinId', 'linkedinAccessToken', 'linkedinTokenExpiresAt'],
    });
  }

  private hasValidToken(profile: Profile | null): boolean {
    return (
      !!profile?.linkedinId &&
      !!profile?.linkedinAccessToken &&
      (!profile.linkedinTokenExpiresAt || profile.linkedinTokenExpiresAt > new Date())
    );
  }

  /** Best-effort audit-row update — a failure here is logged, never surfaced to the caller. */
  private async updateShareRecord(record: LinkedinShare | undefined, changes: Partial<LinkedinShare>) {
    if (!record?.id) return;
    try {
      await this.linkedinShareRepo.save({ ...record, ...changes });
    } catch (e) {
      this.logger.error(`Failed to update LinkedIn share record: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** Assets API: registers a feed image, uploads its bytes, and returns the asset URN. */
  private async uploadImage(headers: Record<string, string>, owner: string, data: Buffer, mime: string): Promise<string> {
    const register = await axios.post(
      `${LINKEDIN_V2}/assets?action=registerUpload`,
      {
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner,
          serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
        },
      },
      { headers },
    );
    const { asset, uploadMechanism } = register.data.value;
    const uploadUrl = uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;

    // Per the Share on LinkedIn doc's upload example, the bearer token goes with the bytes too.
    await axios.put(uploadUrl, data, {
      headers: { Authorization: headers.Authorization, 'Content-Type': mime },
      maxBodyLength: Infinity,
    });

    return asset;
  }
}
