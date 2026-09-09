import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { UserPermissionEnum } from 'src/common/policies/user-permission.enum';
import { UserPermissionService } from 'src/modules/user-permission/providers/user-permission.service';

/**
 * Gate for LMS Manager-only endpoints (SME quality review queue, quality-pipeline
 * and subjects/trends dashboards): requires the Role:LmsManager permission —
 * no Admin bypass, same rule every LmsController route previously re-checked
 * inline via its own `ensureLmsAccess`.
 */
@Injectable()
export class LmsManagerGuard implements CanActivate {
  constructor(private readonly userPermissionService: UserPermissionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const isLmsManager =
      !!userId &&
      (await this.userPermissionService.hasPermission(
        userId,
        UserPermissionEnum.LmsManager,
      ));

    if (!isLmsManager) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        'You are not authorized to make this request.',
      );
    }
    return true;
  }
}
