import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IUserPermissionDto } from 'src/common/dto/user-permission.dto';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { UserSubject } from 'src/common/typeorm/entities/user-subject.entity';
import { AddUserSubjectsDto } from 'src/core/users/dtos/user-subject.dto';
import { DataSource, In, Repository } from 'typeorm';
import { MeritService } from './merit.service';
import { ProgramService } from './program.service';
import { RouteService } from './route.service';
import { SubjectStatsService } from './subject-stats.service';
import { TopicAnalysisService } from './topic-analysis.service';

@Injectable()
export class MasterService {
  constructor(
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,

    @InjectRepository(Topic)
    private readonly topicRepo: Repository<Topic>,

    @InjectRepository(UserSubject)
    private readonly userSubjectRepo: Repository<UserSubject>,

    private readonly dataSource: DataSource,
    private readonly subjectStats: SubjectStatsService,
    private readonly topicAnalyzer: TopicAnalysisService,
    private readonly meritService: MeritService,
    private readonly programService: ProgramService,
    private readonly routeService: RouteService,
  ) {}

  async getRoutesConfig(userRole?: string, userPermissions: IUserPermissionDto[] = []) {
    return this.routeService.getRoutesConfig(userRole, userPermissions);
  }

  async getMasterData(userId?: number) {
    const [subjects, jobRoles, popularTopics, subjectTracks, certificationTracks, topics] = await Promise.all([
      this.subjectStats.getAllSubjects(userId),
      this.programService.getJobRolesWithSubjects(userId),
      this.meritService.getGlobalPopularTopics(),
      this.getMasterSubjectTracks(),
      this.getMasterCertificationTracks(),
      this.getTopicsForDropdown(),
    ]);

    return { subjects, jobRoles, popularTopics, subjectTracks, certificationTracks, topics };
  }

  private async getTopicsForDropdown() {
    const rows = await this.topicRepo
      .createQueryBuilder('t')
      .select(['t.id AS id', 't.title AS title', 't.slug AS slug', 't.subjectId AS subjectId'])
      .where('t.isPublished = :isPublished', { isPublished: 1 })
      .orderBy('t.subjectId', 'ASC')
      .addOrderBy('t.title', 'ASC')
      .getRawMany();

    return rows.map((r) => ({ id: +r.id, title: r.title, slug: r.slug, subjectId: +r.subjectId }));
  }

  private async getMasterSubjectTracks() {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('st.id', 'id')
      .addSelect('st.subjectId', 'subjectId')
      .addSelect('st.title', 'title')
      .addSelect('st.slug', 'slug')
      .addSelect('st.sortOrder', 'sortOrder')
      .addSelect('st.isPublished', 'isPublished')
      .addSelect('s.title', 'subjectName')
      .addSelect('COUNT(stt.id)', 'topicCount')
      .from('subject_track', 'st')
      .innerJoin('subject', 's', 's.id = st.subjectId')
      .leftJoin('subject_track_topic', 'stt', 'stt.subjectTrackId = st.id')
      .groupBy('st.id')
      .orderBy('st.subjectId', 'ASC')
      .addOrderBy('st.sortOrder', 'ASC')
      .getRawMany();

    return rows.map((r) => ({
      id: +r.id,
      subjectId: +r.subjectId,
      subjectName: r.subjectName,
      title: r.title,
      slug: r.slug,
      sortOrder: +r.sortOrder,
      isPublished: Boolean(r.isPublished),
      topicCount: +r.topicCount,
    }));
  }

  private async getMasterCertificationTracks() {
    const [rows, stRows] = await Promise.all([
      this.dataSource
        .createQueryBuilder()
        .select('ct.id', 'id')
        .addSelect('ct.title', 'title')
        .addSelect('ctjr.jobRoleId', 'jobRoleId')
        .addSelect('ctjr.sortOrder', 'sortOrder')
        .addSelect('ctjr.isPublished', 'isPublished')
        .addSelect('jr.title', 'jobRoleTitle')
        .from('certification_track', 'ct')
        .innerJoin('certification_track_job_role', 'ctjr', 'ctjr.certificationTrackId = ct.id')
        .innerJoin('job_role', 'jr', 'jr.id = ctjr.jobRoleId')
        .orderBy('ct.id', 'ASC')
        .addOrderBy('ctjr.sortOrder', 'ASC')
        .getRawMany(),
      this.dataSource
        .createQueryBuilder()
        .select('ctst.certificationTrackId', 'certId')
        .addSelect('st.id', 'id')
        .addSelect('st.title', 'title')
        .addSelect('st.slug', 'slug')
        .addSelect('st.subjectId', 'subjectId')
        .addSelect('s.title', 'subjectName')
        .from('certification_track_subject_track', 'ctst')
        .innerJoin('subject_track', 'st', 'st.id = ctst.subjectTrackId')
        .innerJoin('subject', 's', 's.id = st.subjectId')
        .orderBy('ctst.certificationTrackId', 'ASC')
        .addOrderBy('s.title', 'ASC')
        .addOrderBy('st.title', 'ASC')
        .getRawMany(),
    ]);

    const stMap = new Map<number, { id: number; title: string; slug: string; subjectId: number; subjectName: string }[]>();
    for (const r of stRows) {
      const certId = +r.certId;
      if (!stMap.has(certId)) stMap.set(certId, []);
      stMap.get(certId).push({ id: +r.id, title: r.title, slug: r.slug, subjectId: +r.subjectId, subjectName: r.subjectName });
    }

    const certMap = new Map<number, { id: number; title: string; subjectTrackCount: number; subjectTracks: { id: number; title: string; slug: string; subjectId: number; subjectName: string }[]; jobRoles: { jobRoleId: number; jobRoleTitle: string; sortOrder: number; isPublished: boolean }[] }>();
    for (const row of rows) {
      const id = +row.id;
      if (!certMap.has(id)) {
        const subjectTracks = stMap.get(id) ?? [];
        certMap.set(id, { id, title: row.title, subjectTrackCount: subjectTracks.length, subjectTracks, jobRoles: [] });
      }
      certMap.get(id).jobRoles.push({
        jobRoleId: +row.jobRoleId,
        jobRoleTitle: row.jobRoleTitle,
        sortOrder: +row.sortOrder,
        isPublished: Boolean(row.isPublished),
      });
    }

    return [...certMap.values()];
  }

  async addUserSubjects(userId: number, dto: AddUserSubjectsDto) {
    try {
      const existing = await this.userSubjectRepo.find({
        where: { userId },
        relations: ['subject'],
        select: ['id', 'subjectId', 'subject'],
      });

      const existingIds = new Set(existing.map((us) => us.subjectId));
      const results: { subjectId: number; status: string }[] = [];

      for (const subjectId of dto.subjectIds) {
        if (existingIds.has(subjectId)) {
          results.push({
            subjectId,
            status: `Subject already added: ${existing.find((e) => e.subjectId === subjectId)?.subject.title}`,
          });
          continue;
        }
        const newUserSubject = this.userSubjectRepo.create({ userId, subjectId });
        await this.userSubjectRepo.save(newUserSubject);
        results.push({ subjectId, status: 'Added successfully' });
      }

      if (!results.length) return { message: 'No new subjects added', results };
      return { message: 'Subjects processed successfully', results };
    } catch (err) {
      throw new AppCustomException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Failed to add subjects. Please try again later.',
      );
    }
  }

  async getUserQuizStats(userId: number) {
    const [subjects, topics] = await Promise.all([
      this.subjectStats.getAllSubjects(userId),
      this.topicAnalyzer.getAllTopicStats(userId),
    ]);

    const subjectMap = new Map<number, any>();
    for (const subject of subjects) {
      subjectMap.set(subject.id, { ...subject, topics: [] });
    }
    for (const topic of topics) {
      if (topic.subjectId && subjectMap.has(topic.subjectId)) {
        subjectMap.get(topic.subjectId).topics.push(topic);
      }
    }
    return Array.from(subjectMap.values());
  }

  async getTopicListByIds(topicIdsArray: number[]) {
    return this.topicRepo.findBy({ id: In(topicIdsArray) });
  }

  async getSubjectListByIds(subjectIdsArray: number[]) {
    return this.subjectRepo.findBy({ id: In(subjectIdsArray) });
  }
}
