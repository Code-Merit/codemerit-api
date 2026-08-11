import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';

import { Profile } from 'src/common/typeorm/entities/profile.entity';
import { LinkedinShareDto } from '../dtos/linkedin-share.dto';
import { ActivityService } from 'src/modules/activity/providers/activity/activity.service';

@Injectable()
export class LinkedinShareService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    private readonly activityService: ActivityService,
  ) {}

  async getStatus(userId: number) {
    const profile = await this.profileRepository.findOne({
      where: { userId },
      select: ['linkedinId', 'linkedinAccessToken', 'linkedinTokenExpiresAt'],
    });

    const connected =
      !!profile?.linkedinId &&
      !!profile?.linkedinAccessToken &&
      (!profile.linkedinTokenExpiresAt ||
        profile.linkedinTokenExpiresAt > new Date());

    return {
      connected,
      expiresAt: profile?.linkedinTokenExpiresAt ?? null,
    };
  }

  async share(userId: number, dto: LinkedinShareDto) {
    const profile = await this.profileRepository.findOne({
      where: { userId },
    });

    if (!profile?.linkedinAccessToken || !profile.linkedinId) {
      throw new BadRequestException('LinkedIn is not connected for this user.');
    }

    try {
      const author = `urn:li:person:${profile.linkedinId}`;
      let media: any[] = [];

      // 1. Upload image asset to LinkedIn if a URL is provided
      if (dto.imageUrl) {
        const registerResponse = await axios.post(
          'https://api.linkedin.com/v2/assets?action=registerUpload',
          {
            registerUploadRequest: {
              recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
              owner: author,
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
              Authorization: `Bearer ${profile.linkedinAccessToken}`,
              'X-Restli-Protocol-Version': '2.0.0',
            },
          },
        );

        const uploadUrl =
          registerResponse.data.value.uploadMechanism[
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
          ].uploadUrl;
        const asset = registerResponse.data.value.asset;

        // Fetch image as binary array data from the provided image link
        const imageResponse = await axios.get(dto.imageUrl, {
          responseType: 'arraybuffer',
        });

        // Binary transfer directly to LinkedIn's media pipeline storage bucket
        await axios.put(uploadUrl, imageResponse.data, {
          headers: {
            'Content-Type': 'image/jpeg',
          },
        });

        media.push({
          status: 'READY',
          media: asset,
        });
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

      await this.activityService.createActivity(
        userId,
        'Shared on LinkedIn',
        dto.url
          ? 'Shared content with a link on LinkedIn.'
          : dto.imageUrl
            ? 'Shared content with an image on LinkedIn.'
            : 'Shared a text post on LinkedIn.',
        postResponse.headers['x-restli-id'] ?? undefined,
        'LINKEDIN_SHARE',
      );

      return {
        success: true,
        postId: postResponse.headers['x-restli-id'] ?? null,
        shared: {
          text: dto.text,
          url: dto.url ?? null,
          image: dto.imageUrl ?? null,
        },
      };
    } catch (error: any) {
      throw new BadRequestException(
        error.response?.data?.message || 'Failed to share on LinkedIn.',
      );
    }
  }
}
