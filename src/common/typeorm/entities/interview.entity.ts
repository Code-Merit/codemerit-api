import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, UpdateDateColumn } from "typeorm";
import { AssessmentSession } from "./assessment-session.entity";
import { JobRole } from "./job-role.entity";
import { AbstractEntity } from "./abstract.entity";
import { User } from "./user.entity";
import { InterviewStatusHistory } from "./interview-status-history.entity";
import { InterviewStatusEnum } from "src/common/enum/interview-status.enum";

@Entity()
export class Interview extends AbstractEntity {
  @Column({
    unique: true,
    length: 10,
  })
  interviewCode: string;

  @Column()
  title: string;

  @Column()
  userId: number;

  // Assigned interviewer (SME) user id. DB column is still named `externalId`
  // (kept as-is to avoid a column-rename migration); the TS property was
  // renamed to reflect its actual purpose.
  @Column({
    name: 'externalId',
    type: 'int',
    nullable: true,
  })
  interviewerId?: number;

  @Column()
  jobRoleId: number;

  // datetime, not timestamp — MySQL's TIMESTAMP type auto-attaches
  // DEFAULT/ON UPDATE CURRENT_TIMESTAMP to the first such column in a table
  // when explicit_defaults_for_timestamp is off (true on this server), which
  // silently reset this to "now" on every single interview update
  // (assign/cancel/finalize/anything), regardless of what the application
  // set. DATETIME never gets that behavior. See
  // migrate-interview-scheduledat-timestamp.js.
  @Column({
    type: 'datetime',
  })
  scheduledAt: Date;

  @Column({
    type: 'enum',
    enum: InterviewStatusEnum,
    default: InterviewStatusEnum.SCHEDULED,
  })
  status: InterviewStatusEnum;

  @Column({
    type: 'text',
    nullable: true,
  })
  feedback?: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  declineReason?: string;

  @Column({
    nullable: true,
  })
  startedAt?: Date;

  @Column({
    nullable: true,
  })
  completedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /*
   * Relations
   */

  @ManyToOne(() => User)
  @JoinColumn({
    name: 'userId',
  })
  user: User;

  @ManyToOne(() => JobRole)
  @JoinColumn({
    name: 'jobRoleId',
  })
  jobRole: JobRole;

  @ManyToOne(() => User)
  @JoinColumn({
    name: 'externalId',
  })
  interviewer?: User;

  @OneToMany(
    () => AssessmentSession,
    (assessment) => assessment.interview,
  )
  assessmentSessions: AssessmentSession[];

  @OneToMany(
    () => InterviewStatusHistory,
    (history) => history.interview,
  )
  statusHistory: InterviewStatusHistory[];
}