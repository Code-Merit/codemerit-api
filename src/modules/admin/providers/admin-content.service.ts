import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { CertificationTrack } from 'src/common/typeorm/entities/certification-track.entity';
import { SubjectTrack } from 'src/common/typeorm/entities/subject-track.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { Lesson } from 'src/common/typeorm/entities/lesson.entity';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { DifficultyLevelEnum } from 'src/common/enum/difficulty-lavel.enum';

export interface PublishedStats {
  total: number;
  published: number;
  draft: number;
}

@Injectable()
export class AdminContentService {
  constructor(
    @InjectRepository(JobRole)
    private readonly jobRoleRepo: Repository<JobRole>,

    @InjectRepository(CertificationTrack)
    private readonly certificationTrackRepo: Repository<CertificationTrack>,

    @InjectRepository(SubjectTrack)
    private readonly subjectTrackRepo: Repository<SubjectTrack>,

    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,

    @InjectRepository(Topic)
    private readonly topicRepo: Repository<Topic>,

    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,

    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
  ) {}

  async getContentStats() {
    const [programs, certificationTracks, subjectTracks, subjects, topics, questions, lessonTotal] =
      await Promise.all([
        this.publishedStats(this.jobRoleRepo, 'jr'),
        this.getCertificationTrackStats(),
        this.publishedStats(this.subjectTrackRepo, 'st'),
        this.publishedStats(this.subjectRepo, 's'),
        this.publishedStats(this.topicRepo, 't'),
        this.getQuestionStats(),
        this.lessonRepo.count(),
      ]);

    const lessons = { total: lessonTotal };

    const moderationQueue = {
      pendingQuestions: questions.byType.trivia.pending + questions.byType.general.pending,
      unpublishedSubjects: subjects.draft,
      unpublishedTopics: topics.draft,
      unpublishedSubjectTracks: subjectTracks.draft,
      unpublishedCertificationTracks: certificationTracks.draft,
    };

    return {
      programs,
      certificationTracks,
      subjectTracks,
      subjects,
      topics,
      questions,
      lessons,
      moderationQueue,
    };
  }

  // CertificationTrack itself carries no isPublished/jobRoleId column — a track is offered
  // through one or more job roles via CertificationTrackJobRole, each link with its own publish
  // flag (see certification-track-job-role.entity.ts). "Published" here means the track is
  // currently offered via at least one published job-role link; a track with zero links, or only
  // unpublished ones, counts as draft — same definition ProgramService uses when assembling a
  // job role's cert tracks (ctjr.isPublished = 1).
  private async getCertificationTrackStats(): Promise<PublishedStats> {
    const result = await this.certificationTrackRepo
      .createQueryBuilder('ct')
      .leftJoin('ct.certificationTrackJobRoles', 'ctjr')
      .select([
        'COUNT(DISTINCT ct.id) as total',
        'COUNT(DISTINCT CASE WHEN ctjr.isPublished = true THEN ct.id END) as published',
      ])
      .getRawOne();

    const total = +result.total || 0;
    const published = +result.published || 0;

    return { total, published, draft: total - published };
  }

  private async publishedStats(repo: Repository<any>, alias: string): Promise<PublishedStats> {
    const result = await repo
      .createQueryBuilder(alias)
      .select([
        `COUNT(${alias}.id) as total`,
        `SUM(CASE WHEN ${alias}.isPublished = true THEN 1 ELSE 0 END) as published`,
        `SUM(CASE WHEN ${alias}.isPublished = false THEN 1 ELSE 0 END) as draft`,
      ])
      .getRawOne();

    return {
      total: +result.total || 0,
      published: +result.published || 0,
      draft: +result.draft || 0,
    };
  }

  private async getQuestionStats() {
    const result = await this.questionRepo
      .createQueryBuilder('q')
      .select([
        'COUNT(q.id) as total',
        `SUM(CASE WHEN q.questionType = :trivia THEN 1 ELSE 0 END) as triviaTotal`,
        `SUM(CASE WHEN q.questionType = :trivia AND q.status = :active THEN 1 ELSE 0 END) as triviaActive`,
        `SUM(CASE WHEN q.questionType = :trivia AND q.status = :pending THEN 1 ELSE 0 END) as triviaPending`,
        `SUM(CASE WHEN q.questionType = :general THEN 1 ELSE 0 END) as generalTotal`,
        `SUM(CASE WHEN q.questionType = :general AND q.status = :active THEN 1 ELSE 0 END) as generalActive`,
        `SUM(CASE WHEN q.questionType = :general AND q.status = :pending THEN 1 ELSE 0 END) as generalPending`,
        `SUM(CASE WHEN q.level = :easy THEN 1 ELSE 0 END) as easy`,
        `SUM(CASE WHEN q.level = :intermediate THEN 1 ELSE 0 END) as intermediate`,
        `SUM(CASE WHEN q.level = :advanced THEN 1 ELSE 0 END) as advanced`,
      ])
      .setParameters({
        trivia: QuestionTypeEnum.Trivia,
        general: QuestionTypeEnum.General,
        active: QuestionStatusEnum.Active,
        pending: QuestionStatusEnum.Pending,
        easy: DifficultyLevelEnum.Easy,
        intermediate: DifficultyLevelEnum.Intermediate,
        advanced: DifficultyLevelEnum.Advanced,
      })
      .getRawOne();

    return {
      total: +result.total || 0,
      byType: {
        trivia: {
          total: +result.triviaTotal || 0,
          active: +result.triviaActive || 0,
          pending: +result.triviaPending || 0,
        },
        general: {
          total: +result.generalTotal || 0,
          active: +result.generalActive || 0,
          pending: +result.generalPending || 0,
        },
      },
      byLevel: {
        easy: +result.easy || 0,
        intermediate: +result.intermediate || 0,
        advanced: +result.advanced || 0,
      },
    };
  }
}
