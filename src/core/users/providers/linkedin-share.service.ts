import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';

import { Profile } from 'src/common/typeorm/entities/profile.entity';
import { LinkedinShareDto } from '../dtos/linkedin-share.dto';
import { ActivityService } from 'src/modules/activity/providers/activity/activity.service';
import { LinkedinShare } from 'src/common/typeorm/entities/linkedin-share.entity';
import { LinkedInOAuthService } from 'src/core/auth/providers/linkedin-oauth.service';
import { UserProfileService } from './user-profile.service';

// The frontend share button matches on "not connected" to switch to its Connect action.
const LINKEDIN_NOT_CONNECTED = 'LinkedIn is not connected for this user.';

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
    let accessToken: string;
    let profile: { sub: string };
    try {
      accessToken = await this.linkedInOAuth.exchangeCodeForToken(code);
      profile = await this.linkedInOAuth.fetchLinkedInProfile(accessToken);
    } catch (error: any) {
      // Most often an expired/reused code or a LINKEDIN_REDIRECT_URI that doesn't match the
      // origin the popup ran on — LinkedIn's reason is logged, the user gets a retryable 400.
      this.logger.error(`LinkedIn connect failed: ${JSON.stringify(error?.response?.data ?? error?.message)}`);
      throw new BadRequestException('Could not connect LinkedIn. Please try again.');
    }
    const linkedinTokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days, matches the login flow's own grant window

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
      const media: any[] = [];

      // 1. Upload the client-captured image (base64 data URL), if any. Uploaded straight from
      // memory — never via a temp file, and never fetched from a client-supplied URL.
      if (dto.imageDataUrl) {
        const match = dto.imageDataUrl.match(
          /^data:(image\/[^;]+);base64,(.+)$/,
        );
        if (!match) {
          throw new BadRequestException('Invalid imageDataUrl format.');
        }
        const asset = await this.uploadImage(
          profile.linkedinAccessToken,
          author,
          Buffer.from(match[2], 'base64'),
          match[1],
        );
        media.push({ status: 'READY', media: asset });
      }

      // 2. Structuring user generated feed content payload schema
      const postPayload: any = {
        author,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: dto.text,
            },
            shareMediaCategory: media.length ? 'IMAGE' : 'ARTICLE',
            media: media.length
              ? media
              : dto.url
                ? [
                    {
                      status: 'READY',
                      originalUrl: dto.url,
                    },
                  ]
                : [],
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      // 3. Make the final post deployment call on LinkedIn feed network
      const postResponse = await axios.post(
        'https://api.linkedin.com/v2/ugcPosts',
        postPayload,
        {
          headers: {
            Authorization: `Bearer ${profile.linkedinAccessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'Content-Type': 'application/json',
          },
        },
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
          : dto.imageDataUrl
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
      shared: {
        text: dto.text,
        url: dto.url ?? null,
        image: dto.imageDataUrl ? 'uploaded' : null,
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

  /** Registers an image asset with LinkedIn, uploads its bytes, and returns the asset URN. */
  private async uploadImage(
    accessToken: string,
    owner: string,
    data: Buffer,
    mime: string,
  ): Promise<string> {
    const registerResponse = await axios.post(
      'https://api.linkedin.com/v2/assets?action=registerUpload',
      {
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      },
    );

    const { asset, uploadMechanism } = registerResponse.data.value;
    const uploadUrl =
      uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;

    await axios.put(uploadUrl, data, {
      headers: { 'Content-Type': mime },
      maxBodyLength: Infinity,
    });

    return asset;
  }
}
