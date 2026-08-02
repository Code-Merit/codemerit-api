import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse as ApiResponseDoc,
} from '@nestjs/swagger';
import { BadgeAwardMethodEnum } from 'src/common/enum/badge-award-method.enum';
import { BadgeScopeEnum } from 'src/common/enum/badge-scope.enum';
import { GrantBadgeDto } from './dtos/grant-badge.dto';
import { AchievementService } from './providers/achievement.service';

@ApiTags('Achievements')
@ApiBearerAuth('access-token')
@Controller('apis/achievements')
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  /** ?scopeType=Subject&scopeId=12 narrows to one subject/job-role/topic's badges, e.g. for a
   * contextual badge widget on that subject's dashboard — omit both for the full collection.
   * ?userId=<id> fetches that user's badges instead of the caller's own — e.g. so the Admin
   * "Grant Badge" picker can preview a learner's current badges before granting one. Gated:
   * Admins can pass any userId in any scope; everyone else must also pass a scopeType (+scopeId
   * unless Global) they hold a matching Badge:Grant permission for — see
   * AchievementService.ensureCanViewUserBadges for why an unscoped request isn't allowed. */
  @ApiOperation({
    summary: "Get a user's badge collection (defaults to the caller's own)",
    description:
      "Returns earned badges (with earnedAt) plus the still-locked catalog entries, optionally " +
      "narrowed to one scope via `scopeType`/`scopeId`. Pass `userId` to view someone else's " +
      "badges instead of the caller's own — Admins may do this for any user in any scope; anyone " +
      "else must also supply a `scopeType` (and `scopeId` unless Global) matching a Badge:Grant " +
      "permission they hold, otherwise 403. An unscoped request for another user's badges is " +
      "always rejected, since it would otherwise leak that user's entire badge collection.",
  })
  @ApiQuery({
    name: 'scopeType',
    required: false,
    enum: BadgeScopeEnum,
    description: 'Narrows results to one scope — e.g. Subject, JobRole, Topic, or Global.',
  })
  @ApiQuery({
    name: 'scopeId',
    required: false,
    type: String,
    description:
      'The Subject/JobRole/Topic id the scope refers to. Meaningless without scopeType.',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: String,
    description:
      "View this user's badges instead of the caller's own. Requires Admin, or a scoped " +
      'Badge:Grant permission matching scopeType/scopeId — 403 otherwise.',
  })
  @ApiResponseDoc({
    status: 403,
    description:
      "Caller requested another user's badges without Admin access and without a scopeType " +
      '(+scopeId unless Global) matching a Badge:Grant permission they hold.',
  })
  @UseGuards(AuthGuard('jwt'))
  @Get('my-badges')
  async getMyBadges(
    @Request() req: any,
    @Query('scopeType') scopeType?: BadgeScopeEnum,
    @Query('scopeId') scopeId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.achievementService.getUserBadgesForViewer(
      { id: req.user.id, role: req.user.role },
      userId ? +userId : req.user.id,
      scopeType,
      scopeId ? +scopeId : undefined,
    );
  }

  /** Catalog of badge definitions, e.g. for an interviewer picking which badge to grant.
   * ?scopeType=Subject&scopeId=12 narrows to badges defined for that subject; scopeId requires
   * scopeType alongside it (scopeId alone is ambiguous — it's a Subject/JobRole/Topic id depending
   * on scopeType). ?isManuallyGrantable=true narrows to badges the grant endpoint will accept —
   * the authoritative filter for a grant picker (awardMethod is a display hint only). */
  @ApiOperation({
    summary: 'List the published badge catalog',
    description:
      'Returns published Badge definitions, optionally narrowed by scope, award method, or ' +
      'manual-grantability. `scopeId` requires `scopeType` alongside it (400 otherwise) since ' +
      "it's a polymorphic reference into Subject/JobRole/Topic depending on scopeType. " +
      '`isManuallyGrantable` is the authoritative filter for a grant picker — `awardMethod` is ' +
      'only a display hint and is not guaranteed to correlate with it for every badge.',
  })
  @ApiQuery({
    name: 'scopeType',
    required: false,
    enum: BadgeScopeEnum,
    description: 'Narrows to badges defined for this scope.',
  })
  @ApiQuery({
    name: 'scopeId',
    required: false,
    type: String,
    description: 'The Subject/JobRole/Topic id. Requires scopeType — 400 if scopeType is omitted.',
  })
  @ApiQuery({
    name: 'awardMethod',
    required: false,
    enum: BadgeAwardMethodEnum,
    description: 'Narrows by System vs Manual award method. Display hint only — see isManuallyGrantable.',
  })
  @ApiQuery({
    name: 'isManuallyGrantable',
    required: false,
    type: String,
    description:
      '"true"/"false" — narrows to badges the manual grant endpoint will actually accept.',
  })
  @ApiResponseDoc({
    status: 400,
    description: '`scopeId` was supplied without `scopeType`.',
  })
  @UseGuards(AuthGuard('jwt'))
  @Get('badges')
  async getBadgeCatalog(
    @Query('scopeType') scopeType?: BadgeScopeEnum,
    @Query('scopeId') scopeId?: string,
    @Query('awardMethod') awardMethod?: BadgeAwardMethodEnum,
    @Query('isManuallyGrantable') isManuallyGrantable?: string,
  ) {
    return this.achievementService.getBadgeCatalog(
      scopeType,
      scopeId ? +scopeId : undefined,
      awardMethod,
      isManuallyGrantable !== undefined ? isManuallyGrantable === 'true' : undefined,
    );
  }

  /** Manually award a MANUAL-method badge to a user, e.g. an interviewer granting
   * "JavaScript Expert" after an interview. Gated by the Badge:Grant permission (or Admin role). */
  @ApiOperation({
    summary: 'Manually grant a badge to a user',
    description:
      'Awards a `isManuallyGrantable` badge to `userId` — 400 if the badge is not manually ' +
      'grantable or is unpublished, 404 if the badge or user does not exist. Admins may grant any ' +
      'badge; everyone else needs a Badge:Grant permission scoped to match the badge (exact ' +
      'Subject/JobRole, or a Badge-scoped grant for Global badges) — 403 otherwise. Re-granting an ' +
      "already-earned badge updates who granted it and the note rather than erroring or " +
      'duplicating. On a genuinely new grant, notifies the recipient (in-app + email) and logs an ' +
      'activity entry.',
  })
  @ApiResponseDoc({
    status: 400,
    description: 'Badge is not manually grantable, or is not currently published.',
  })
  @ApiResponseDoc({
    status: 403,
    description: "Granter lacks Admin role and lacks a Badge:Grant permission matching the badge's scope.",
  })
  @ApiResponseDoc({
    status: 404,
    description: 'badgeId or userId does not exist.',
  })
  @UseGuards(AuthGuard('jwt'))
  @Post('badges/grant')
  async grantBadge(@Body() dto: GrantBadgeDto, @Request() req: any) {
    return this.achievementService.grantBadge(
      { id: req.user.id, role: req.user.role },
      dto,
    );
  }
}
