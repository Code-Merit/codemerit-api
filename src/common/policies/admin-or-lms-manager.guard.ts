import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';
import { UserPermissionEnum } from './user-permission.enum';
import { PermissionsService } from './permissions.service';

/**
 * Gate for curriculum/content analytics shared by Admins and LMS Managers: Admin role, or
 * anyone holding the global LmsManager permission. Unlike LmsManagerGuard (no Admin bypass),
 * this lets either in.
 */
@Injectable()
export class AdminOrLmsManagerGuard implements CanActivate {
  constructor(private readonly permissionService: PermissionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;
    if (user.role === UserRoleEnum.ADMIN) return true;

    return this.permissionService.hasGlobalPermission(
      user.id,
      UserPermissionEnum.LmsManager,
    );
  }
}
