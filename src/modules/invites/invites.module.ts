import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invite } from 'src/common/typeorm/entities/invite.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { Profile } from 'src/common/typeorm/entities/profile.entity';
import { Badge } from 'src/common/typeorm/entities/badge.entity';
import { Permission } from 'src/common/typeorm/entities/permission.entity';
import { SkillEnrollmentModule } from '../skill-enrollment/skill-enrollment.module';
import { UserPermissionModule } from '../user-permission/user-permission.module';
import { ActivityModule } from '../activity/activity.module';
import { InvitesController } from './invites.controller';
import { InvitesService } from './providers/invites.service';
import {
  BadgeInviteHandler,
  CertificationInviteHandler,
  GenericInviteHandler,
  InviteActionHandler,
  JourneyInviteHandler,
  MockInterviewInviteHandler,
  QuestionReviewInviteHandler,
} from './providers/invite-action.handler';
import { InviteTypeEnum } from 'src/common/enum/invite-type.enum';
import { INVITE_ACTION_HANDLERS } from './constants/invites.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invite, User, Profile, Badge, Permission]),
    SkillEnrollmentModule,
    UserPermissionModule,
    ActivityModule,
  ],
  controllers: [InvitesController],
  providers: [
    InvitesService,
    GenericInviteHandler,
    JourneyInviteHandler,
    CertificationInviteHandler,
    BadgeInviteHandler,
    MockInterviewInviteHandler,
    QuestionReviewInviteHandler,
    {
      // InviteTypeEnum -> InviteActionHandler map — the one place a new invite type gets
      // wired in. InvitesService.redeem() dispatches through this map and never branches
      // on type itself, so adding a 7th scenario later is one handler class + one line
      // here, nothing else in InvitesService changes.
      provide: INVITE_ACTION_HANDLERS,
      useFactory: (
        generic: GenericInviteHandler,
        journey: JourneyInviteHandler,
        certification: CertificationInviteHandler,
        badge: BadgeInviteHandler,
        mockInterview: MockInterviewInviteHandler,
        questionReview: QuestionReviewInviteHandler,
      ): Map<InviteTypeEnum, InviteActionHandler> =>
        new Map<InviteTypeEnum, InviteActionHandler>([
          [InviteTypeEnum.GENERIC, generic],
          [InviteTypeEnum.JOURNEY, journey],
          [InviteTypeEnum.CERTIFICATION, certification],
          [InviteTypeEnum.BADGE, badge],
          [InviteTypeEnum.MOCK_INTERVIEW, mockInterview],
          [InviteTypeEnum.QUESTION_REVIEW, questionReview],
        ]),
      inject: [
        GenericInviteHandler,
        JourneyInviteHandler,
        CertificationInviteHandler,
        BadgeInviteHandler,
        MockInterviewInviteHandler,
        QuestionReviewInviteHandler,
      ],
    },
  ],
  exports: [InvitesService],
})
export class InvitesModule {}
