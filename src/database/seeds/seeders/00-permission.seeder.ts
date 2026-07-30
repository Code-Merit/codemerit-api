import { DataSource } from 'typeorm';
import { Permission } from 'src/common/typeorm/entities/permission.entity';
import { UserPermissionEnum } from 'src/common/policies/user-permission.enum';

const PERMISSION_GROUP = 'LMS Manager';
const SUBJECT_TRACK_GROUP = 'Subject Track Manager';
const CERTIFICATION_TRACK_GROUP = 'Certification Manager';
const QUESTION_AUTHOR_GROUP = 'Question Author';
const TOPIC_ACCESS_GROUP = 'Topic Access';
const BADGE_GROUP = 'Badge Manager';
const SME_GROUP = 'SME Access';
const TALENT_GROUP = 'Talent Partner';
const INTERVIEW_GROUP = 'Interview Manager';
const ORGANIZATION_GROUP = 'Organization';
const LEARNER_GROUP = 'Learner Tier';

type PermissionMeta = { description: string; group: string };

const PERMISSION_META: Record<UserPermissionEnum, PermissionMeta> = {
  [UserPermissionEnum.TopicGet]:                  { description: 'View topics',                                              group: TOPIC_ACCESS_GROUP },
  [UserPermissionEnum.TopicCreate]:               { description: 'Create topics',                                            group: TOPIC_ACCESS_GROUP },
  [UserPermissionEnum.TopicUpdate]:               { description: 'Update topics',                                            group: TOPIC_ACCESS_GROUP },
  [UserPermissionEnum.TopicDelete]:               { description: 'Delete topics',                                            group: TOPIC_ACCESS_GROUP },
  [UserPermissionEnum.QuestionAuthorCreate]:      { description: 'Create questions as an author',                            group: QUESTION_AUTHOR_GROUP },
  [UserPermissionEnum.QuestionAuthorUpdate]:      { description: 'Update own questions',                                     group: QUESTION_AUTHOR_GROUP },
  [UserPermissionEnum.QuestionAuthorDelete]:      { description: 'Delete own questions',                                     group: QUESTION_AUTHOR_GROUP },
  [UserPermissionEnum.LmsManager]:               { description: 'Full LMS management access',                               group: PERMISSION_GROUP },
  [UserPermissionEnum.SubjectTrackGet]:          { description: 'View all subject tracks',                                  group: SUBJECT_TRACK_GROUP },
  [UserPermissionEnum.SubjectTrackCreate]:       { description: 'Create subject tracks',                                    group: SUBJECT_TRACK_GROUP },
  [UserPermissionEnum.SubjectTrackUpdate]:       { description: 'Update subject tracks and manage topic links',             group: SUBJECT_TRACK_GROUP },
  [UserPermissionEnum.SubjectTrackDelete]:       { description: 'Delete subject tracks',                                    group: SUBJECT_TRACK_GROUP },
  [UserPermissionEnum.CertificationTrackGet]:    { description: 'View all certification tracks',                            group: CERTIFICATION_TRACK_GROUP },
  [UserPermissionEnum.CertificationTrackCreate]: { description: 'Create certification tracks',                              group: CERTIFICATION_TRACK_GROUP },
  [UserPermissionEnum.CertificationTrackUpdate]: { description: 'Update certification tracks and manage subject track links', group: CERTIFICATION_TRACK_GROUP },
  [UserPermissionEnum.CertificationTrackDelete]: { description: 'Delete certification tracks',                              group: CERTIFICATION_TRACK_GROUP },
  [UserPermissionEnum.BadgeGrant]:               { description: 'Grant badges to learners (e.g. during an interview)',      group: BADGE_GROUP },
  [UserPermissionEnum.Sme]:                      { description: 'Subject Matter Expert access, e.g. taking candidate interviews', group: SME_GROUP },

  // Ladder: LmsManager (above) < LearningManager < LearningAdmin — same group so the
  // Grant Permission form lists the whole tier together instead of scattering it.
  [UserPermissionEnum.LearningManager]:          { description: 'Oversee learning content and learner progress across subjects and tracks (above LmsManager)', group: PERMISSION_GROUP },
  [UserPermissionEnum.LearningAdmin]:            { description: 'Full learning administration, including approving requested permissions', group: PERMISSION_GROUP },

  // Ladder: AssociateSme < Sme (above) < SmeLead — same group as Sme for the same reason.
  [UserPermissionEnum.AssociateSme]:             { description: 'Supervised/junior subject matter expert access to interviews', group: SME_GROUP },
  [UserPermissionEnum.SmeLead]:                  { description: 'Senior SME who can oversee other SMEs\' interview activity', group: SME_GROUP },

  [UserPermissionEnum.TalentPartner]:            { description: 'Manage job roles and candidate pipeline for hiring', group: TALENT_GROUP },
  [UserPermissionEnum.InterviewManager]:         { description: 'Schedule, reschedule, assign SMEs to, and cancel candidate interviews', group: INTERVIEW_GROUP },
  [UserPermissionEnum.OrganizationOwner]:        { description: 'Full ownership access across the organization\'s account and settings', group: ORGANIZATION_GROUP },
  [UserPermissionEnum.ProLearner]:               { description: 'Access to premium/pro learner features and content', group: LEARNER_GROUP },
};

export async function seedPermissions(dataSource: DataSource): Promise<Permission[]> {
  const repo = dataSource.getRepository(Permission);

  for (const [, value] of Object.entries(UserPermissionEnum)) {
    const meta = PERMISSION_META[value as UserPermissionEnum];
    const exists = await repo.findOne({ where: { permission: value } });

    if (!exists) {
      await repo.save(repo.create({ permission: value, description: meta.description, group: meta.group }));
    } else if (exists.group !== meta.group || exists.description !== meta.description) {
      await repo.save({ ...exists, description: meta.description, group: meta.group });
    }
  }

  const all = await repo.find({ order: { id: 'ASC' } });
  console.log(`  ✔ Permissions: ${all.length} records`);
  return all;
}
