import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';

import { Profile } from 'src/common/typeorm/entities/profile.entity';
import { LinkedinShareDto } from '../dtos/linkedin-share.dto';
import { ActivityService } from 'src/modules/activity/providers/activity/activity.service';
import { LinkedinShare } from 'src/common/typeorm/entities/linkedin-share.entity';

@Injectable()
export class LinkedinShareService {
  private readonly logger = new Logger(LinkedinShareService.name);
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(LinkedinShare)
    private readonly linkedinShareRepo: Repository<LinkedinShare>,
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
    let shareRecord: LinkedinShare | undefined;

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

      // If frontend supplied a base64 data URL, decode and upload that image
      if (dto.imageDataUrl) {
        const match = dto.imageDataUrl.match(
          /^data:(image\/[^;]+);base64,(.+)$/,
        );
        if (!match) {
          throw new BadRequestException('Invalid imageDataUrl format.');
        }
        const mime = match[1];
        const base64Data = match[2];
        const ext = mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1];
        const filename = dto.imageFileName
          ? dto.imageFileName
          : `linkedin_${randomUUID()}.${ext}`;

        const tmpPath = path.join(os.tmpdir(), filename);
        try {
          const buffer = Buffer.from(base64Data, 'base64');
          await fs.promises.writeFile(tmpPath, buffer);

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

          // stream file to LinkedIn
          const stream = fs.createReadStream(tmpPath);
          await axios.put(uploadUrl, stream, {
            headers: {
              'Content-Type': mime,
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          });

          media.push({
            status: 'READY',
            media: asset,
          });

          // update audit record with filename
          shareRecord.imageFileName = filename;
          await this.linkedinShareRepo.save(shareRecord);
        } finally {
          // remove temp file if it exists
          try {
            await fs.promises.unlink(tmpPath);
          } catch (e) {
            this.logger.debug(
              `Temp file cleanup failed: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
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
          : dto.imageUrl || dto.imageDataUrl
            ? 'Shared content with an image on LinkedIn.'
            : 'Shared a text post on LinkedIn.',
        postResponse.headers['x-restli-id'] ?? undefined,
        'LINKEDIN_SHARE',
      );

      // update audit row as successful
      try {
        shareRecord.status = 'SENT';
        shareRecord.linkedinUrn = postResponse.headers['x-restli-id'] ?? null;
        await this.linkedinShareRepo.save(shareRecord);
      } catch (e) {
        this.logger.debug(
          'Failed to update linkedin share record: ' +
            (e instanceof Error ? e.message : String(e)),
        );
      }

      return {
        success: true,
        postId: postResponse.headers['x-restli-id'] ?? null,
        shared: {
          text: dto.text,
          url: dto.url ?? null,
          image: dto.imageUrl
            ? dto.imageUrl
            : dto.imageDataUrl
              ? 'uploaded'
              : null,
        },
      };
    } catch (error: any) {
      // try to persist failure state
      try {
        if (typeof shareRecord !== 'undefined' && shareRecord?.id) {
          shareRecord.status = 'FAILED';
          shareRecord.errorMessage = error?.response?.data || error.message;
          await this.linkedinShareRepo.save(shareRecord);
        }
      } catch (e) {
        this.logger.debug(
          'Failed to mark linkedin share as failed: ' +
            (e instanceof Error ? e.message : String(e)),
        );
      }

      throw new BadRequestException(
        error.response?.data?.message ??
          error?.response?.data?.serviceErrorCode ??
          error?.message ??
          'Failed to share on LinkedIn.',
      );
    }
  }
}
