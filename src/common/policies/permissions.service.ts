import {
    Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Equal, In, IsNull, Or, Repository } from 'typeorm';
import { Permission } from '../typeorm/entities/permission.entity';
import { UserPermission } from '../typeorm/entities/user-permission.entity';
import { User } from '../typeorm/entities/user.entity';
import { UserPermissionTitleEnum } from './user-permission.enum';

@Injectable()
export class PermissionsService {
    constructor(
        @InjectRepository(Permission)
        private permissionRepo: Repository<Permission>,
        @InjectRepository(UserPermission)
        private userPermissionRepo: Repository<UserPermission>,
    ) { }

    /** For unscoped "Role:" permissions (LmsManager, SME, LearningAdmin, ...) — checked by
     * permission name alone, same as the manual `.some()` checks in lms/question/lesson
     * controllers, since these grants carry no resourceType/resourceId. */
    async hasGlobalPermission(userId: number, permission: string): Promise<boolean> {
        const result = await this.userPermissionRepo.findOne({
            where: { userId, permission: { permission } },
            relations: ['permission'],
        });
        return Boolean(result);
    }

    async findOneByUser(userId: number, permission: string, resourceType: UserPermissionTitleEnum, resourceId: number) {
        // Match exact resourceId OR a global grant (resourceId IS NULL) for the same permission+type
        const result = await this.userPermissionRepo.findOne({
            where: {
                userId,
                permission: { permission },
                resourceType,
                resourceId: resourceId !== null ? Or(Equal(resourceId), IsNull()) : IsNull(),
            },
            relations: ['permission'],
        });
        return Boolean(result);
    }

    /** Distinct users holding any of the given global ("Role:"-style) permissions —
     * e.g. sourcing an SME picker for an assign-round UI. Unscoped (resourceType/
     * resourceId ignored), matching how hasGlobalPermission checks these grants. */
    async findUsersByPermissions(permissions: string[]): Promise<User[]> {
        const grants = await this.userPermissionRepo.find({
            where: { permission: { permission: In(permissions) } },
            relations: ['user', 'permission'],
        });

        const usersById = new Map<number, User>();
        for (const grant of grants) {
            if (grant.user) {
                usersById.set(grant.user.id, grant.user);
            }
        }
        return Array.from(usersById.values());
    }

    //add utility
    //private async ensureLmsAccess(userId: number, permissionId) {

    async findByUserTopics(userId: number, permission: string, resourceType: UserPermissionTitleEnum,
        resourceId: number | number[]) {
        const whereCondition: any = {
            userId: userId,
            permission: {
                permission: permission,
            },
            resourceType,
            resourceId: Array.isArray(resourceId) ? In(resourceId) : resourceId,
        };
        let flag: boolean = false;

        const query = await this.userPermissionRepo.find({
            where: whereCondition,
            relations: ['permission'],
        });
        //console.log(`length ${query.length} == ${resourceId.toString()}`);

        if (Array.isArray(resourceId) && resourceId.length > 0 && query.length == resourceId.length) {
            flag = true;
        } else if (!Array.isArray(resourceId) && query.length > 0) {
            return flag = true;
        }
        return flag;
    }
}
