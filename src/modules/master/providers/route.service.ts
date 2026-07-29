import { Injectable } from '@nestjs/common';
import { IUserPermissionDto } from 'src/common/dto/user-permission.dto';
import { UserPermissionEnum } from 'src/common/policies/user-permission.enum';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';
import { lmsRoutes } from '../routes/lms.routes';
import { welcomeRoutes } from '../routes/welcome.routes';
import { quizRoutes } from '../routes/quiz.routes';
import { adminRoutes, manageUsersRoutes } from '../routes/admin.routes';
import { uiRoutes } from '../routes/ui.routes';
import { userRoutes } from '../routes/user.routes';
import { smeRoutes, smeInterviewRoutes } from '../routes/sme.routes';
import { footerRoutes } from '../routes/footer.routes';
import { interviewRoutes, interviewManagerRoutes } from '../routes/interview.routes';

@Injectable()
export class RouteService {
  private normalizeRole(role?: string): string {
    return (role || '').trim();
  }

  private isRouteAllowed(routeRoles: string[] | undefined, userRole?: string): boolean {
    const normalizedUserRole = this.normalizeRole(userRole);
    const normalizedRoles = (routeRoles || []).map((role) => this.normalizeRole(role));
    if (normalizedRoles.includes('All')) return true;
    if (!normalizedUserRole) return false;
    return normalizedRoles.includes(normalizedUserRole);
  }

  private filterRoutesByRole(routes: any[], userRole?: string): any[] {
    return (routes || [])
      .map((route) => {
        const filteredSubmenu = this.filterRoutesByRole(route?.submenu || [], userRole);
        const isCurrentRouteAllowed = this.isRouteAllowed(route?.role, userRole);
        if (!isCurrentRouteAllowed && filteredSubmenu.length === 0) return null;
        return { ...route, submenu: filteredSubmenu };
      })
      .filter(Boolean);
  }

  /**
   * Get all routes for a user, filtered by role and permissions.
   */
  /**
   * userPermissions: strictly IUserPermissionDto[]
   */
  getRoutesConfig(userRole?: string, userPermissions: IUserPermissionDto[] = []): any[] {
    // let routes: any[] = [
    //   ...welcomeRoutes,
    //   ...quizRoutes,
    //   ...adminRoutes,
    //   ...uiRoutes,
    //   ...userRoutes,
    // ];

    let routes: any[] = [
      ...welcomeRoutes,
      ...interviewRoutes
    ];

    const permissionNames = userPermissions.map((p) => p.permissionName);
    if (permissionNames.includes(UserPermissionEnum.Sme)) {
      routes = [...routes, ...smeInterviewRoutes];
    }
    if (permissionNames.includes(UserPermissionEnum.LmsManager)) {
      routes = [...routes, ...lmsRoutes, ...quizRoutes, ...smeRoutes];
    }
    // Mirrors InterviewManagerGuard's own access check (Admin role OR Role:InterviewManager
    // permission) so the nav item only shows up for users who can actually use the page.
    if (
      this.normalizeRole(userRole) === UserRoleEnum.ADMIN ||
      permissionNames.includes(UserPermissionEnum.InterviewManager)
    ) {
      routes = [...routes, ...interviewManagerRoutes];
    }

    if (permissionNames.includes(UserPermissionEnum.TalentPartner)
    ) {
      routes = [...routes, ...manageUsersRoutes];
    }
    if (
      this.normalizeRole(userRole) === UserRoleEnum.ADMIN
    ) {
      routes = [...routes, ...adminRoutes];
    }
    routes = [...routes,
      ...uiRoutes,
      ...userRoutes,
      ...footerRoutes
    ];
    // Add more modular route groups here as needed, based on permissions
    return this.filterRoutesByRole(routes, userRole);
    //return routes;
  }
}
