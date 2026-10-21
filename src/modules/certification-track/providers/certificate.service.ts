import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { CERT_ACHIEVED } from 'src/common/constants/completion-thresholds';
import { minCorrectForCertification } from 'src/common/utils/completion-rules';
import { CertificateSourceEnum } from 'src/common/enum/certificate-source.enum';
import { CertificateStatusEnum } from 'src/common/enum/certificate-status.enum';
import { Certificate } from 'src/common/typeorm/entities/certificate.entity';
import { CertificationTrack } from 'src/common/typeorm/entities/certification-track.entity';
import { CertificationTrackJobRole } from 'src/common/typeorm/entities/certification-track-job-role.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { PermissionsService } from 'src/common/policies/permissions.service';
import { UserPermissionEnum, UserPermissionTitleEnum } from 'src/common/policies/user-permission.enum';
import { generate6DigitNumber } from 'src/common/utils/common-functions';
import { renderCertificateContent } from 'src/common/utils/certificate-content.util';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';
import { ActivityService } from 'src/modules/activity/providers/activity/activity.service';
import { NotificationService } from 'src/modules/notification/providers/notification.service';
import { SkillEnrollmentService } from 'src/modules/skill-enrollment/providers/skill-enrollment.service';
import { SubjectTrackAnalysisService } from 'src/modules/master/providers/subject-track-analysis.service';
import { TopicAnalysisService } from 'src/modules/master/providers/topic-analysis.service';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { GrantCertificateDto } from '../dtos/grant-certificate.dto';
import { RevokeCertificateDto } from '../dtos/revoke-certificate.dto';
import {
  CertExplorerJobRoleDto,
  CertExplorerMyCertificateDto,
  CertExplorerSubjectTrackDto,
  CertificateExplorerGroupDto,
  CertificateExplorerResponseDto,
  CertificateExplorerTrackDto,
} from '../dtos/certificate-explorer-response.dto';

export interface VerifyCertificateResult {
  valid: boolean;
  status?: CertificateStatusEnum;
  certificateNumber?: string;
  skillName?: string | null;
  tierDisplayName?: string | null;
  issuedAt?: Date;
  holderName?: string;
  scorePercentage?: number | null;
  verificationCode?: string | null;
  content?: string | null;
}

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(
    @InjectRepository(Certificate)
    private certificateRepo: Repository<Certificate>,
    @InjectRepository(CertificationTrack)
    private certificationTrackRepo: Repository<CertificationTrack>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(CertificationTrackJobRole)
    private ctJobRoleRepo: Repository<CertificationTrackJobRole>,
    @InjectRepository(Subject)
    private subjectRepo: Repository<Subject>,
    private readonly permissionsService: PermissionsService,
    private readonly notificationService: NotificationService,
    private readonly activityService: ActivityService,
    private readonly subjectTrackAnalyzer: SubjectTrackAnalysisService,
    private readonly topicAnalyzer: TopicAnalysisService,
    private readonly skillEnrollmentService: SkillEnrollmentService,
    private readonly dataSource: DataSource,
  ) {}

  /** Public lookup — no auth, no personalization. Distinguishes "no such code" (404) from
   * "real code, but this certificate is no longer valid" (200, valid:false) so a verifier
   * can tell a typo apart from a genuinely revoked credential. */
  async verify(code: string): Promise<VerifyCertificateResult> {
    const cert = await this.certificateRepo.findOne({
      where: { verificationCode: code },
      relations: ['user'],
    });
    if (!cert) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, 'No certificate found for this verification code.');
    }
    if (cert.status !== CertificateStatusEnum.ISSUED) {
      return { valid: false, status: cert.status };
    }
    return {
      valid: true,
      status: cert.status,
      certificateNumber: cert.certificateNumber,
      skillName: cert.skillName,
      tierDisplayName: cert.tierDisplayName,
      issuedAt: cert.issuedAt,
      holderName: cert.user ? `${cert.user.firstName} ${cert.user.lastName}`.trim() : undefined,
      scorePercentage: cert.scorePercentage,
      verificationCode: cert.verificationCode,
      content: cert.content,
    };
  }

  /** Backs the public "invite someone to earn this certification" page (/certification/:slug
   * on the frontend) — deliberately reuses getExplorer() rather than a second, parallel query
   * path that could drift from it, instead of rebuilding the hierarchy/progress computation a
   * second time just to narrow it to one track. Personalizes (isAchieved/progressPercent/
   * myCertificate) when userId is present, same as the explorer itself does; works fully
   * anonymously otherwise.
   *
   * A slug that isn't in the published catalog isn't necessarily a bad link — the track may be
   * a real row still awaiting approval (isPublished: false), e.g. a link shared early or found
   * before launch. That case gets a minimal, safe fallback DTO (title/description/content only,
   * no progress/subjectTracks/myCertificate — none of that is real yet) with isPublished:false,
   * so the frontend can show an "undergoing approval" notice instead of a flat 404. Only a slug
   * matching no row at all is a genuine 404. */
  async getPublicTrack(slug: string, userId?: number): Promise<CertificateExplorerTrackDto> {
    const explorer = await this.getExplorer(userId);
    const track = explorer.groups
      .flatMap((g) => g.tracks)
      .find((t) => t.slug === slug);
    if (track) return track;

    const raw = await this.certificationTrackRepo.findOne({ where: { slug } });
    if (!raw) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, 'No certification track found for this link.');
    }
    return {
      id: raw.id,
      title: raw.title,
      slug: raw.slug,
      description: raw.description,
      content: raw.content,
      subjectId: raw.subjectId,
      jobRoles: [],
      totalSubjectTracks: 0,
      completedSubjectTracks: 0,
      progressPercent: 0,
      achievementThreshold: raw.passThreshold ?? CERT_ACHIEVED,
      totalQuestions: 0,
      questionsAttempted: 0,
      questionsCorrect: 0,
      estimatedTimeSeconds: 0,
      correctAnswersToEarn: null,
      isAchieved: false,
      subjectTracks: [],
      myCertificate: null,
      note: raw.note,
      popularity: raw.popularity ?? 0,
      isPublished: false,
    };
  }

  /** Manually grant a certificate — mirrors AchievementService.grantBadge: create-or-reissue,
   * same unique-constraint race handling, same notification/activity side effects the
   * system-issued path already fires. Re-granting an already-ISSUED cert just refreshes
   * note/awardedBy; re-granting a REVOKED one clears the revoke fields and re-issues it. */
  async grant(
    granter: { id: number; role: string },
    dto: GrantCertificateDto,
  ): Promise<{ certificateNumber: string; certificationTrackId: number; alreadyIssued: boolean }> {
    const track = await this.certificationTrackRepo.findOne({ where: { id: dto.certificationTrackId } });
    if (!track) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `CertificationTrack ID ${dto.certificationTrackId} not found.`);
    }
    const learner = await this.userRepo.findOne({
      where: { id: dto.userId },
      select: ['id', 'firstName', 'lastName'],
    });
    if (!learner) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `User with ID ${dto.userId} not found.`);
    }
    const learnerName = `${learner.firstName ?? ''} ${learner.lastName ?? ''}`.trim();

    await this.ensureCanManageCertificate(granter, track.id);

    const existing = await this.certificateRepo.findOne({
      where: { userId: dto.userId, certificationTrackId: dto.certificationTrackId },
    });
    if (existing) {
      await this.certificateRepo.update(existing.id, {
        status: CertificateStatusEnum.ISSUED,
        source: CertificateSourceEnum.MANUAL,
        awardedBy: granter.id,
        note: dto.note ?? null,
        revokedAt: null,
        revokedBy: null,
        revokeReason: null,
        // Backfill only — never overwrite a content snapshot an already-issued cert already has.
        content: existing.content ?? renderCertificateContent(track.content, learnerName, track.title),
      });
      return { certificateNumber: existing.certificateNumber, certificationTrackId: track.id, alreadyIssued: true };
    }

    let cert: Certificate;
    try {
      cert = await this.certificateRepo.save(
        this.certificateRepo.create({
          userId: dto.userId,
          certificationTrackId: dto.certificationTrackId,
          certificateNumber: `CM-${track.id}-${generate6DigitNumber()}`,
          verificationCode: `${generate6DigitNumber()}${generate6DigitNumber()}`,
          skillName: track.title,
          content: renderCertificateContent(track.content, learnerName, track.title),
          source: CertificateSourceEnum.MANUAL,
          awardedBy: granter.id,
          note: dto.note ?? null,
        }),
      );
    } catch (error) {
      const raced = await this.certificateRepo.findOne({
        where: { userId: dto.userId, certificationTrackId: dto.certificationTrackId },
      });
      if (!raced) throw error;
      this.logger.warn(`grantCertificate race for userId=${dto.userId}, trackId=${dto.certificationTrackId}: ${error}`);
      await this.certificateRepo.update(raced.id, {
        source: CertificateSourceEnum.MANUAL,
        awardedBy: granter.id,
        note: dto.note ?? null,
      });
      return { certificateNumber: raced.certificateNumber, certificationTrackId: track.id, alreadyIssued: true };
    }

    await this.notificationService.notifyCertificateIssued(dto.userId, track.title, cert.certificateNumber, track.id, {
      verificationCode: cert.verificationCode,
      issuedAt: cert.issuedAt,
    });
    await this.activityService.createActivity(
      dto.userId,
      'Certificate Earned',
      `earned the "${track.title}" certificate.`,
      { dataId: String(track.id), dataType: 'certification_track' },
    );

    return { certificateNumber: cert.certificateNumber, certificationTrackId: track.id, alreadyIssued: false };
  }

  async revoke(
    granter: { id: number; role: string },
    certificateId: number,
    dto: RevokeCertificateDto,
  ): Promise<void> {
    const cert = await this.certificateRepo.findOne({ where: { id: certificateId } });
    if (!cert) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `Certificate ID ${certificateId} not found.`);
    }

    await this.ensureCanManageCertificate(granter, cert.certificationTrackId);

    await this.certificateRepo.update(cert.id, {
      status: CertificateStatusEnum.REVOKED,
      revokedAt: new Date(),
      revokedBy: granter.id,
      revokeReason: dto.reason ?? null,
    });
  }

  /**
   * Public/optional-auth catalog for the Browse Certificates page — mirrors
   * AchievementService.getBadgeExplorer's shape (full catalog + an earned slice + a
   * "relevant" slice gated to real enrollment), but grouped by certification-track rules
   * instead of badge scope: one group per job role (a job-role-bundle track can link to
   * several roles and appears under each), one group per subject for subject-native tracks.
   * Progress is computed with the exact same pipeline
   * AchievementService.evaluateCertifications uses at issuance time, just unscoped to
   * "subjects just quizzed" — every published track is evaluated.
   */
  async getExplorer(userId?: number): Promise<CertificateExplorerResponseDto> {
    const [subjectNativeTracks, jobRoleBundleTracks, myIssuedTrackIds] = await Promise.all([
      this.certificationTrackRepo.find({ where: { subjectId: Not(IsNull()), isPublished: true } }),
      this.findPublishedJobRoleBundleTracks(),
      userId
        ? this.certificateRepo
            .find({ where: { userId, status: CertificateStatusEnum.ISSUED }, select: ['certificationTrackId'] })
            .then((rows) => rows.map((r) => r.certificationTrackId))
        : Promise.resolve([] as number[]),
    ]);
    // A learner keeps what they earned: a track unpublished after they earned it (e.g. pulled for
    // lack of questions) still backs their `earned` list and certificate reveal. These tracks are
    // NOT added to `groups` (the public catalog) or `inProgress`.
    const publishedIds = new Set([...subjectNativeTracks, ...jobRoleBundleTracks].map((t) => t.id));
    const earnedOnlyIds = [...new Set(myIssuedTrackIds)].filter((id) => !publishedIds.has(id));
    const earnedOnlyTracks = earnedOnlyIds.length
      ? await this.certificationTrackRepo.find({ where: { id: In(earnedOnlyIds) } })
      : [];
    const allTracks = [...subjectNativeTracks, ...jobRoleBundleTracks, ...earnedOnlyTracks];
    if (!allTracks.length) {
      const hasAnyEnrollment = userId
        ? (await this.skillEnrollmentService.getSubjectTierMap(userId)).size > 0
        : false;
      return { groups: [], earned: [], inProgress: [], hasAnyEnrollment };
    }

    const allTrackIds = allTracks.map((t) => t.id);

    const [hierarchyRows, jobRoleLinks, subjects, myCertificates] = await Promise.all([
      this.subjectTrackAnalyzer.fetchCertTrackSubjectTrackHierarchy(allTrackIds),
      jobRoleBundleTracks.length
        ? this.ctJobRoleRepo.find({
            where: { certificationTrackId: In(jobRoleBundleTracks.map((t) => t.id)), isPublished: true },
            relations: ['jobRole'],
          })
        : Promise.resolve([]),
      subjectNativeTracks.length
        ? this.subjectRepo.find({ where: { id: In(subjectNativeTracks.map((t) => t.subjectId!)) } })
        : Promise.resolve([]),
      // status: ISSUED — a revoked certificate must not keep reading as earned/valid here (the
      // same rule verify() already applies). Without this filter a revoked cert still counted
      // as isAchieved, still appeared in `earned`, and still rendered the full reveal + share
      // flow — directly contradicting what /verify/:code would say about the same code.
      userId
        ? this.certificateRepo.find({
            where: { userId, certificationTrackId: In(allTrackIds), status: CertificateStatusEnum.ISSUED },
          })
        : Promise.resolve([]),
    ]);

    const subjectTrackIdsByCert = new Map<number, Set<number>>();
    for (const row of hierarchyRows) {
      const ctId = +row.ctId;
      if (!subjectTrackIdsByCert.has(ctId)) subjectTrackIdsByCert.set(ctId, new Set());
      subjectTrackIdsByCert.get(ctId)!.add(+row.stId);
    }
    const allSubjectTrackIds = [...new Set(hierarchyRows.map((r) => +r.stId))];

    const stRows = allSubjectTrackIds.length
      ? await this.subjectTrackAnalyzer.fetchSubjectTracksWithTopicsByIds(allSubjectTrackIds)
      : [];
    // Sourced directly from stRows (which already carries stSubjectTitle/stSubjectSlug per row)
    // rather than a separate Subject query — every subject touched by any subject-track in the
    // whole catalog ends up here, keyed by subjectId.
    const subjectMetaById = new Map<number, { id: number; title: string; slug: string }>();
    for (const r of stRows as any[]) {
      const sid = +r.stSubjectId;
      if (!subjectMetaById.has(sid)) {
        subjectMetaById.set(sid, { id: sid, title: r.stSubjectTitle, slug: r.stSubjectSlug });
      }
    }
    const topicIds = [...new Set(stRows.map((r: any) => +r.topicId))];
    const topicStatsList = topicIds.length ? await this.topicAnalyzer.getTopicStatsByIds(topicIds, userId) : [];
    const topicStatsMap = new Map<number, any>(topicStatsList.map((t: any) => [t.id, t]));
    const subjectTrackMap = this.subjectTrackAnalyzer.buildSubjectTrackMap(
      stRows,
      topicStatsMap,
      { meritLists: new Map(), userRanks: new Map() },
      userId,
    );

    const jobRolesByTrack = new Map<number, CertExplorerJobRoleDto[]>();
    for (const link of jobRoleLinks) {
      const list = jobRolesByTrack.get(link.certificationTrackId) ?? [];
      if (link.jobRole) list.push({ id: link.jobRole.id, title: link.jobRole.title, slug: link.jobRole.slug });
      jobRolesByTrack.set(link.certificationTrackId, list);
    }
    const subjectTitleById = new Map(subjects.map((s) => [s.id, s.title]));
    const myCertByTrack = new Map(myCertificates.map((c) => [c.certificationTrackId, c]));

    const enrolledSubjectIds = userId
      ? new Set((await this.skillEnrollmentService.getSubjectTierMap(userId)).keys())
      : new Set<number>();

    const toDto = (track: CertificationTrack): CertificateExplorerTrackDto => {
      const subjectTrackIds = [...(subjectTrackIdsByCert.get(track.id) ?? [])];
      const subjectTracks: CertExplorerSubjectTrackDto[] = subjectTrackIds
        .map((id) => subjectTrackMap.get(id))
        .filter(Boolean)
        .map((st: any) => ({
          id: st.id,
          title: st.title,
          slug: st.slug,
          sortOrder: st.sortOrder,
          totalTopics: st.totalTopics,
          subject: subjectMetaById.get(st.subjectId) ?? { id: st.subjectId, title: st.subjectName, slug: '' },
          progressPercent: st.progressPercent,
          isCompleted: st.isCompleted,
          totalQuestions: st.numTrivia ?? 0,
          attempted: st.attempted ?? 0,
          correct: st.correct ?? 0,
          estimatedTimeSeconds: st.totalTimeAllowedSeconds ?? 0,
          topicTitles: ((st.topics ?? []) as any[]).map((t) => t.title).filter(Boolean),
        }));
      const total = subjectTracks.length;
      const completed = subjectTracks.filter((st) => st.isCompleted).length;
      const totalQuestions = subjectTracks.reduce((sum, st) => sum + st.totalQuestions, 0);
      const questionsAttempted = subjectTracks.reduce((sum, st) => sum + st.attempted, 0);
      const questionsCorrect = subjectTracks.reduce((sum, st) => sum + st.correct, 0);
      // "How long would it take to answer every Trivia question in this certification" —
      // sum of Question.timeAllowed (seconds) across every subject track, surfaced to the UI
      // as a rounded minute estimate. Based on the per-question time budget, not actual
      // attempt time, so it's available even for a track no one has started yet.
      const estimatedTimeSeconds = subjectTracks.reduce((sum, st) => sum + st.estimatedTimeSeconds, 0);
      const correctAnswersToEarn = minCorrectForCertification(
        subjectTrackIds.filter((id) => subjectTrackMap.has(id)).map((id) => subjectTrackMap.get(id).minCorrectToComplete),
        track.passThreshold ?? CERT_ACHIEVED,
      );
      // Weighted by actual question volume across the whole cert — questionsAttempted /
      // totalQuestions — not an unweighted average of each subject-track's own percentage
      // (the previous pass here) and not completed/total subject tracks (the original bug).
      // Averaging percentages let a 500-question track and a 10-question track pull the
      // overall number equally even though they represent wildly different amounts of real
      // work; this is the same coverage-based convention subject-track/topic progress bars
      // already use (attempted/total, correctness reported separately), just rolled up one
      // level. Floored at 1% so real-but-tiny attempted volume never rounds back to 0.
      const progressPercent = totalQuestions > 0 && questionsAttempted > 0
        ? Math.max(1, Math.round((questionsAttempted / totalQuestions) * 100))
        : 0;

      const cert = myCertByTrack.get(track.id);
      const myCertificate: CertExplorerMyCertificateDto | null = cert
        ? {
            certificateNumber: cert.certificateNumber,
            status: cert.status,
            issuedAt: cert.issuedAt,
            expiresAt: cert.expiresAt,
            pdfUrl: cert.pdfUrl,
            verificationCode: cert.verificationCode,
            scorePercentage: cert.scorePercentage,
            skillName: cert.skillName,
            tierDisplayName: cert.tierDisplayName,
            content: cert.content,
          }
        : null;

      return {
        id: track.id,
        title: track.title,
        slug: track.slug,
        description: track.description,
        content: track.content,
        subjectId: track.subjectId,
        jobRoles: jobRolesByTrack.get(track.id) ?? [],
        totalSubjectTracks: total,
        completedSubjectTracks: completed,
        progressPercent,
        achievementThreshold: track.passThreshold ?? CERT_ACHIEVED,
        totalQuestions,
        questionsAttempted,
        questionsCorrect,
        estimatedTimeSeconds,
        correctAnswersToEarn,
        // Authoritative from an actual issued row — never re-derived from progressPercent vs.
        // achievementThreshold (see certification-tracks.component.ts's own comment on why).
        isAchieved: !!myCertificate,
        subjectTracks,
        myCertificate,
        note: track.note,
        popularity: track.popularity ?? 0,
        // false only for an earned-only track (unpublished after the learner earned it).
        isPublished: track.isPublished,
      };
    };

    const dtoById = new Map(allTracks.map((t) => [t.id, toDto(t)]));

    const groups: CertificateExplorerGroupDto[] = [];

    // One group per job role, not a single lumped bucket — a job-role-bundle track can (and
    // often does) link to several job roles, so it legitimately appears under each of them.
    // 89 real tracks dumped into one "Platform" pill was the actual complaint this replaces:
    // that number was correct, but useless without a way to browse by the role it's actually
    // organized under (see the `jobRoleLinks` fetch above — this reuses the same rows).
    const trackIdsByJobRole = new Map<number, Set<number>>();
    const jobRoleMetaById = new Map<number, CertExplorerJobRoleDto>();
    for (const link of jobRoleLinks) {
      if (!link.jobRole) continue;
      jobRoleMetaById.set(link.jobRole.id, { id: link.jobRole.id, title: link.jobRole.title, slug: link.jobRole.slug });
      const set = trackIdsByJobRole.get(link.jobRole.id) ?? new Set<number>();
      set.add(link.certificationTrackId);
      trackIdsByJobRole.set(link.jobRole.id, set);
    }
    const jobRoleGroups = [...trackIdsByJobRole.entries()]
      .map(([jobRoleId, trackIds]): CertificateExplorerGroupDto => ({
        scopeType: 'JobRole',
        scopeId: jobRoleId,
        scopeTitle: jobRoleMetaById.get(jobRoleId)?.title ?? null,
        tracks: [...trackIds].map((id) => dtoById.get(id)).filter((d): d is CertificateExplorerTrackDto => !!d),
      }))
      .sort((a, b) => (a.scopeTitle ?? '').localeCompare(b.scopeTitle ?? ''));
    groups.push(...jobRoleGroups);

    const bySubject = new Map<number, CertificateExplorerTrackDto[]>();
    for (const t of subjectNativeTracks) {
      const list = bySubject.get(t.subjectId!) ?? [];
      list.push(dtoById.get(t.id)!);
      bySubject.set(t.subjectId!, list);
    }
    const subjectGroups = [...bySubject.entries()]
      .map(([subjectId, tracks]): CertificateExplorerGroupDto => ({
        scopeType: 'Subject',
        scopeId: subjectId,
        scopeTitle: subjectTitleById.get(subjectId) ?? null,
        tracks,
      }))
      .sort((a, b) => (a.scopeTitle ?? '').localeCompare(b.scopeTitle ?? ''));
    groups.push(...subjectGroups);

    const trackDtos = [...dtoById.values()];
    // Kept forever regardless of current enrollment — same rule badges' own `earned` slice
    // follows (see feedback_enrollment_authority_source): you keep what you earned.
    const earned = trackDtos.filter((d) => d.isAchieved);
    // Gated to real enrollment, never UserJobRole. Checked against the SUBJECTS the track's own
    // subject-tracks actually belong to — not derived job-role enrollment
    // (SkillEnrollmentService.getDerivedJobRoleIds only "derives" a job role once enough of its
    // whole mapped subject bundle is enrolled), which under-counted real progress: a learner
    // enrolled directly in one relevant subject, with real attempts in it, showed as 0 in
    // progress because no full job-role bundle had been derived for them. Subject-level
    // enrollment is the true source of truth here (every SkillEnrollment row is subject-scoped),
    // and it's exactly what AchievementService.getCertificationTrackIdsForSubjects already keys
    // candidate-track resolution on at issuance time — this mirrors that, not job-role scope.
    const inProgress = trackDtos.filter((d) => {
      if (d.isAchieved) return false;
      const touchedSubjectIds = new Set(d.subjectTracks.map((st) => st.subject.id));
      if (d.subjectId != null) touchedSubjectIds.add(d.subjectId);
      for (const sid of touchedSubjectIds) {
        if (enrolledSubjectIds.has(sid)) return true;
      }
      return false;
    });

    return { groups, earned, inProgress, hasAnyEnrollment: enrolledSubjectIds.size > 0 };
  }

  private async findPublishedJobRoleBundleTracks(): Promise<CertificationTrack[]> {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('DISTINCT ctjr.certificationTrackId', 'ctId')
      .from('certification_track_job_role', 'ctjr')
      .where('ctjr.isPublished = 1')
      .getRawMany();
    const ids = rows.map((r) => +r.ctId);
    if (!ids.length) return [];
    // subjectId: IsNull() keeps a track that happens to have both a subjectId and an
    // incidental job-role link filed under its subject group only, never double-counted here.
    // isPublished: the track's own flag gates it too. A published job-role link alone used to be
    // enough, so unpublishing a job-role-bundle track didn't hide it from the catalog.
    return this.certificationTrackRepo.find({ where: { id: In(ids), subjectId: IsNull(), isPublished: true } });
  }

  /** Same shape as AchievementService.ensureCanGrantBadge: Admin bypasses, everyone else
   * needs CertificationTrack:Grant scoped to this exact track (or an unscoped/global grant). */
  private async ensureCanManageCertificate(
    granter: { id: number; role: string },
    certificationTrackId: number,
  ): Promise<void> {
    if (granter.role === UserRoleEnum.ADMIN) return;

    const hasPermission = await this.permissionsService.findOneByUser(
      granter.id,
      UserPermissionEnum.CertificationTrackGrant,
      UserPermissionTitleEnum.CertificationTrack,
      certificationTrackId,
    );

    if (!hasPermission) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        'You do not have permission to grant or revoke this certificate.',
      );
    }
  }
}
