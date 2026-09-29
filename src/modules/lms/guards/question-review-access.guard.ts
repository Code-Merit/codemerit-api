import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { UserPermissionEnum, UserPermissionTitleEnum } from 'src/common/policies/user-permission.enum';
import { PermissionsService } from 'src/common/policies/permissions.service';
import { UserPermissionService } from 'src/modules/user-permission/providers/user-permission.service';

export interface QuestionReviewAccess {
  isGlobal: boolean;
  // Only meaningful when isGlobal is false — the Subject ids this caller holds a
  // Question:Review grant for. Guaranteed non-empty whenever isGlobal is false, since the
  // guard already rejects a caller with neither global LmsManager nor any scoped grant.
  subjectIds: number[];
}

/**
 * Gate for the SME quality-review queue/detail/submit/stats routes: allows either a global
 * LmsManager grant (unrestricted, same as today) OR one-or-more subject-scoped
 * Question:Review grants (restricted to those subjects). Unlike LmsManagerGuard this isn't a
 * plain pass/fail check — it also resolves *what* the caller can see and stashes it on
 * `request.reviewAccess` for the handler/service to scope queries by, since a scoped
 * reviewer's queue is a strict subset of the LmsManager-only universe every other LMS route
 * still uses.
 */
@Injectable()
export class QuestionReviewAccessGuard implements CanActivate {
  constructor(
    private readonly userPermissionService: UserPermissionService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    if (!userId) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        'You are not authorized to review questions.',
      );
    }

    const isGlobal = await this.userPermissionService.hasPermission(
      userId,
      UserPermissionEnum.LmsManager,
    );
    if (isGlobal) {
      const access: QuestionReviewAccess = { isGlobal: true, subjectIds: [] };
      request.reviewAccess = access;
      return true;
    }

    const subjectIds = await this.permissionsService.getGrantedResourceIds(
      userId,
      UserPermissionEnum.QuestionReview,
      UserPermissionTitleEnum.Subject,
    );
    if (!subjectIds.length) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        'You are not authorized to review questions.',
      );
    }

    const access: QuestionReviewAccess = { isGlobal: false, subjectIds };
    request.reviewAccess = access;
    return true;
  }
}
