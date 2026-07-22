import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { UserPermission } from 'src/common/typeorm/entities/user-permission.entity';
import { GrantPermissionDto } from '../dto/grant-permission.dto';
import { RequestPermissionDto } from '../dto/request-permission.dto';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { Permission } from 'src/common/typeorm/entities/permission.entity';
import { PermissionRequest } from 'src/common/typeorm/entities/permission-request.entity';
import { PermissionRequestStatusEnum } from 'src/common/enum/permission-request-status.enum';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { Badge } from 'src/common/typeorm/entities/badge.entity';

@Injectable()
export class UserPermissionService {
  constructor(
    @InjectRepository(UserPermission)
    private userPermissionRepo: Repository<UserPermission>,
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
    @InjectRepository(PermissionRequest)
    private permissionRequestRepo: Repository<PermissionRequest>,
    @InjectRepository(Subject)
    private subjectRepo: Repository<Subject>,
    @InjectRepository(Topic)
    private topicRepo: Repository<Topic>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(JobRole)
    private jobRoleRepo: Repository<JobRole>,
    @InjectRepository(Badge)
    private badgeRepo: Repository<Badge>,
  ) {}

  async grantPermission(dto: GrantPermissionDto) {
    const { userId } = dto;
    // '' / 0 / undefined all mean "not scoped to a resource" — store as NULL so a global
    // grant actually matches the IsNull() lookup scoped-permission checks use, instead of
    // silently comparing against '' / 0 forever (see PermissionsService.findOneByUser).
    const resourceType = dto.resourceType ? dto.resourceType : null;
    const resourceId = dto.resourceId ? dto.resourceId : null;
    const permissionIds: number[] = dto.permissionIds;
    const existingPermission = await this.permissionRepo.find({
      where: {
        id: In([permissionIds]),
      },
    });

    if (
      !existingPermission ||
      existingPermission.length !== permissionIds.length
    ) {
      throw new AppCustomException(
        HttpStatus.NOT_FOUND,
        `Could not find the Permission.`,
      );
    }

    const existing = await this.userPermissionRepo.findOne({
      where: {
        userId,
        permissionId: In([permissionIds]),
        resourceType,
        resourceId,
      },
    });

    if (existing) {
      throw new AppCustomException(
        HttpStatus.CONFLICT,
        `Permission already granted to this user .`,
      );
    }
    let permission: any[] = [];
    for (const permissionId of permissionIds) {
      const newEntry = this.userPermissionRepo.create({
        userId,
        permissionId,
        resourceType,
        resourceId,
      });
      permission.push(newEntry);
    }

    const savedPermissions = await this.userPermissionRepo.save(permission);
    const permissionIdsToLoad = savedPermissions.map((item) => item.id);
    const permissionRows = await this.userPermissionRepo.find({
      where: { id: In(permissionIdsToLoad) },
      relations: ['user', 'permission'],
    });

    return this.buildPermissionResponse(permissionRows);
  }

  async revokePermission(id: number) {
    const perm = await this.userPermissionRepo.findOne({ where: { id } });
    if (!perm) {
      throw new AppCustomException(
        HttpStatus.NOT_FOUND,
        `Permission with ID ${id} not found. Cannot revoke non-existent permission.`,
      );
    }

    const deleted = await this.userPermissionRepo.delete({ id });
    if (deleted.affected && deleted.affected > 0) {
      return 'Successfully Deleted';
    }
    return null;
  }

  async masterPermissions() {
    const permissions = await this.permissionRepo.find({ order: { group: 'ASC', id: 'ASC' } });

    const groupMap = new Map<string, { group: string; permissions: any[] }>();
    for (const p of permissions) {
      const groupKey = p.group ?? 'Ungrouped';
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, { group: groupKey, permissions: [] });
      }
      groupMap.get(groupKey).permissions.push({
        id: p.id,
        permission: p.permission,
        description: p.description,
        isVisible: p.isVisible,
        isRequestable: p.isRequestable,
      });
    }

    return Array.from(groupMap.values());
  }

  async setRequestable(permissionId: number, isRequestable: boolean) {
    const permission = await this.permissionRepo.findOne({ where: { id: permissionId } });
    if (!permission) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `Could not find the Permission.`);
    }
    await this.permissionRepo.save({ ...permission, isRequestable });
    return this.permissionRepo.findOne({ where: { id: permissionId } });
  }

  /** Permissions an admin has marked requestable, grouped the same way as masterPermissions(),
   * with each entry flagged for whether this user already holds or has a pending request for it
   * so the self-service UI can grey those out instead of allowing a duplicate request. */
  async getRequestablePermissions(userId: number) {
    const permissions = await this.permissionRepo.find({
      where: { isRequestable: true, isVisible: true },
      order: { group: 'ASC', id: 'ASC' },
    });
    if (!permissions.length) return [];

    const permissionIds = permissions.map((p) => p.id);
    const [granted, pending] = await Promise.all([
      this.userPermissionRepo.find({ where: { userId, permissionId: In(permissionIds) } }),
      this.permissionRequestRepo.find({
        where: { userId, permissionId: In(permissionIds), status: PermissionRequestStatusEnum.PENDING },
      }),
    ]);
    const grantedIds = new Set(granted.map((g) => g.permissionId));
    const pendingIds = new Set(pending.map((p) => p.permissionId));

    const groupMap = new Map<string, { group: string; permissions: any[] }>();
    for (const p of permissions) {
      const groupKey = p.group ?? 'Ungrouped';
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, { group: groupKey, permissions: [] });
      }
      groupMap.get(groupKey).permissions.push({
        id: p.id,
        permission: p.permission,
        description: p.description,
        alreadyGranted: grantedIds.has(p.id),
        requestPending: pendingIds.has(p.id),
      });
    }
    return Array.from(groupMap.values());
  }

  async requestPermission(userId: number, dto: RequestPermissionDto) {
    const permission = await this.permissionRepo.findOne({ where: { id: dto.permissionId } });
    if (!permission) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `Could not find the Permission.`);
    }
    if (!permission.isRequestable) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        `"${permission.permission}" is not available for self-service request. Ask an admin to grant it directly.`,
      );
    }

    const resourceType = dto.resourceType ? dto.resourceType : null;
    const resourceId = dto.resourceId ? dto.resourceId : null;

    const alreadyGranted = await this.userPermissionRepo.findOne({
      where: { userId, permissionId: dto.permissionId, resourceType, resourceId },
    });
    if (alreadyGranted) {
      throw new AppCustomException(HttpStatus.CONFLICT, `You already have this permission.`);
    }

    const pending = await this.permissionRequestRepo.findOne({
      where: {
        userId,
        permissionId: dto.permissionId,
        resourceType,
        resourceId,
        status: PermissionRequestStatusEnum.PENDING,
      },
    });
    if (pending) {
      throw new AppCustomException(HttpStatus.CONFLICT, `You already have a pending request for this permission.`);
    }

    const request = this.permissionRequestRepo.create({
      userId,
      permissionId: dto.permissionId,
      resourceType,
      resourceId,
      comment: dto.comment,
      status: PermissionRequestStatusEnum.PENDING,
    });
    const saved = await this.permissionRequestRepo.save(request);
    return this.permissionRequestRepo.findOne({
      where: { id: saved.id },
      relations: ['user', 'permission'],
    });
  }

  async listPermissionRequests(status?: PermissionRequestStatusEnum) {
    return this.permissionRequestRepo.find({
      where: status ? { status } : {},
      relations: ['user', 'permission', 'reviewer'],
      order: { id: 'DESC' },
    });
  }

  /** Status tracking for the requester themselves — separate from listPermissionRequests()
   * (the admin/LearningAdmin review queue across all users) so a requester can only ever see
   * their own history, never anyone else's. A PENDING/REJECTED row here is never a grant —
   * that only exists once approveRequest() copies it into user_permission. */
  async listMyPermissionRequests(userId: number, status?: PermissionRequestStatusEnum) {
    return this.permissionRequestRepo.find({
      where: status ? { userId, status } : { userId },
      relations: ['permission', 'reviewer'],
      order: { id: 'DESC' },
    });
  }

  async approveRequest(requestId: number, reviewerId: number, reviewComment?: string) {
    const request = await this.permissionRequestRepo.findOne({ where: { id: requestId } });
    if (!request) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `Permission request ${requestId} not found.`);
    }
    if (request.status !== PermissionRequestStatusEnum.PENDING) {
      throw new AppCustomException(
        HttpStatus.CONFLICT,
        `This request has already been ${request.status.toLowerCase()}.`,
      );
    }

    const alreadyGranted = await this.userPermissionRepo.findOne({
      where: {
        userId: request.userId,
        permissionId: request.permissionId,
        resourceType: request.resourceType ?? null,
        resourceId: request.resourceId ?? null,
      },
    });
    if (!alreadyGranted) {
      await this.userPermissionRepo.save(
        this.userPermissionRepo.create({
          userId: request.userId,
          permissionId: request.permissionId,
          resourceType: request.resourceType ?? null,
          resourceId: request.resourceId ?? null,
        }),
      );
    }

    await this.permissionRequestRepo.save({
      ...request,
      status: PermissionRequestStatusEnum.APPROVED,
      reviewedBy: reviewerId,
      reviewComment: reviewComment ?? null,
      reviewedAt: new Date(),
    });

    return this.permissionRequestRepo.findOne({
      where: { id: requestId },
      relations: ['user', 'permission', 'reviewer'],
    });
  }

  async rejectRequest(requestId: number, reviewerId: number, reviewComment?: string) {
    const request = await this.permissionRequestRepo.findOne({ where: { id: requestId } });
    if (!request) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `Permission request ${requestId} not found.`);
    }
    if (request.status !== PermissionRequestStatusEnum.PENDING) {
      throw new AppCustomException(
        HttpStatus.CONFLICT,
        `This request has already been ${request.status.toLowerCase()}.`,
      );
    }

    await this.permissionRequestRepo.save({
      ...request,
      status: PermissionRequestStatusEnum.REJECTED,
      reviewedBy: reviewerId,
      reviewComment: reviewComment ?? null,
      reviewedAt: new Date(),
    });

    return this.permissionRequestRepo.findOne({
      where: { id: requestId },
      relations: ['user', 'permission', 'reviewer'],
    });
  }

  /** Whether userId holds ANY grant of the given permission name, regardless of scope — the right
   * check for broad "Role:"-prefixed capability grants (e.g. TalentPartner), which aren't scoped to
   * a specific resource the way Badge:Grant/QuestionAuthor:Create are (see PermissionsService's
   * resourceType/resourceId-scoped findOneByUser for that case instead). */
  async hasPermission(userId: number, permissionName: string): Promise<boolean> {
    const count = await this.userPermissionRepo
      .createQueryBuilder('up')
      .innerJoin('up.permission', 'p')
      .where('up.userId = :userId', { userId })
      .andWhere('p.permission = :permissionName', { permissionName })
      .getCount();
    return count > 0;
  }

  async findUserPermissionList(userId: number) {
    return this.userPermissionRepo
      .createQueryBuilder('userPermission')
      .leftJoin('userPermission.permission', 'permission')
      .where('userPermission.userId = :userId', { userId })
      .select([
        'userPermission.id as id',
        'userPermission.userId as userId',
        'userPermission.permissionId as permissionId',
        'userPermission.resourceType as resourceType',
        'userPermission.resourceId as resourceId',
        'permission.permission AS permissionName',
        'permission.isVisible AS isVisible',
      ])
      .getRawMany();
  }

  async findUsersByPermissionId(id: number) {
    const result = await this.userPermissionRepo
      .createQueryBuilder('userPermission')
      .leftJoin('userPermission.user', 'user')
      .leftJoin('userPermission.permission', 'permission')
      .where('userPermission.id = :id', { id })
      .select([
        'userPermission.id AS id',
        'user.id AS userId',
        'user.firstName AS firstName',
        'user.lastName AS lastName',
        'permission.permission AS permission',
        'userPermission.resourceType AS resourceType',
        'userPermission.resourceId AS resourceId',
      ])
      .getRawOne();

    return result;
  }

  async getAllUserPermissions() {
    const userPermissions = await this.userPermissionRepo.find({
      relations: ['user', 'permission'],
      order: { id: 'DESC' },
    });
    return this.buildPermissionResponse(userPermissions);
  }

  async getPermissionsForProfile(userId: number) {
    const rows = await this.userPermissionRepo
      .createQueryBuilder('up')
      .leftJoin('up.permission', 'p')
      .where('up.userId = :userId', { userId })
      .select([
        'up.id AS id',
        'up.permissionId AS permissionId',
        'up.resourceType AS resourceType',
        'up.resourceId AS resourceId',
        'up.createdAt AS grantedAt',
        'p.permission AS permissionName',
        'p.isVisible AS isVisible',
      ])
      .getRawMany();

    if (!rows.length) return [];

    const idsFor = (type: string) =>
      rows
        .filter((r) => String(r.resourceType || '').toLowerCase() === type && r.resourceId)
        .map((r) => Number(r.resourceId));
    const subjectIds = idsFor('subject');
    const topicIds = idsFor('topic');
    const jobRoleIds = idsFor('job-role');
    const badgeIds = idsFor('badge');

    const [subjects, topics, jobRoles, badges] = await Promise.all([
      subjectIds.length
        ? this.subjectRepo.find({ where: { id: In(subjectIds) }, select: ['id', 'title'] })
        : Promise.resolve([]),
      topicIds.length
        ? this.topicRepo.find({ where: { id: In(topicIds) }, select: ['id', 'title'] })
        : Promise.resolve([]),
      jobRoleIds.length
        ? this.jobRoleRepo.find({ where: { id: In(jobRoleIds) }, select: ['id', 'title'] })
        : Promise.resolve([]),
      badgeIds.length
        ? this.badgeRepo.find({ where: { id: In(badgeIds) }, select: ['id', 'name'] })
        : Promise.resolve([]),
    ]);

    const subjectMap = new Map(subjects.map((s) => [s.id, s.title]));
    const topicMap = new Map(topics.map((t) => [t.id, t.title]));
    const jobRoleMap = new Map(jobRoles.map((j) => [j.id, j.title]));
    const badgeMap = new Map(badges.map((b) => [b.id, b.name]));

    return rows.map((r) => {
      const type = String(r.resourceType || '').toLowerCase();
      let resourceName = '';
      if (type === 'subject' && r.resourceId) resourceName = subjectMap.get(Number(r.resourceId)) || '';
      else if (type === 'topic' && r.resourceId) resourceName = topicMap.get(Number(r.resourceId)) || '';
      else if (type === 'job-role' && r.resourceId) resourceName = jobRoleMap.get(Number(r.resourceId)) || '';
      else if (type === 'badge' && r.resourceId) resourceName = badgeMap.get(Number(r.resourceId)) || '';

      return {
        id: r.id,
        permissionName: r.permissionName,
        resourceType: r.resourceType,
        resourceName,
        grantedAt: r.grantedAt,
        isVisible: r.isVisible === 1 || r.isVisible === true || r.isVisible === '1',
      };
    });
  }

  private async buildPermissionResponse(userPermissions: UserPermission[]) {
    const [subjects, topics, jobRoles, badges] = await Promise.all([
      this.subjectRepo.find(),
      this.topicRepo.find(),
      this.jobRoleRepo.find(),
      this.badgeRepo.find(),
    ]);

    return userPermissions.map((up) => {
      let resourceName = '';
      const normalizedResourceType = String(
        up.resourceType || '',
      ).toLowerCase();

      if (normalizedResourceType === 'subject' && up.resourceId) {
        const subject = subjects.find((s) => s.id === up.resourceId);
        resourceName = subject?.title || '';
      } else if (normalizedResourceType === 'topic' && up.resourceId) {
        const topic = topics.find((t) => t.id === up.resourceId);
        resourceName = topic?.title || '';
      } else if (normalizedResourceType === 'job-role' && up.resourceId) {
        const jobRole = jobRoles.find((j) => j.id === up.resourceId);
        resourceName = jobRole?.title || '';
      } else if (normalizedResourceType === 'badge' && up.resourceId) {
        const badge = badges.find((b) => b.id === up.resourceId);
        resourceName = badge?.name || '';
      }

      return {
        id: up.id,
        permissionId: up.permissionId,
        permissionName: up.permission?.permission || null,
        resourceType: up.resourceType,
        resourceId: up.resourceId,
        resourceName,
        user: up.user
          ? {
              id: up.user.id,
              firstName: up.user.firstName,
              lastName: up.user.lastName,
              email: up.user.email,
              role: up.user.role,
              designation: up.user.designation,
              createdAt: up.user.createdAt,
            }
          : null,
      };
    });
  }
}
