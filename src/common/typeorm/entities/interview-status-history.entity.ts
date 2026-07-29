import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AbstractEntity } from "./abstract.entity";
import { User } from "./user.entity";
import { Interview } from "./interview.entity";
import { AssessmentSession } from "./assessment-session.entity";

@Entity()
export class InterviewStatusHistory extends AbstractEntity {

  @Column()
  interviewId: number;

  // Set when this row logs a round-level event (assign/start/submit/cancel on
  // a specific AssessmentSession) rather than an interview-level one
  // (schedule/reschedule/cancel-whole-interview/finalize). oldStatus/newStatus
  // hold InterviewStatusEnum values for interview-level rows and
  // AssessmentSessionStatusEnum values (same literal set: ASSIGNED, STARTED,
  // COMPLETED, DECLINED, CANCELLED) for round-level rows — hence typed as
  // plain strings rather than one specific enum.
  @Column({
    type: 'int',
    nullable: true,
  })
  assessmentSessionId?: number;

  @Column({
    type: 'varchar',
    length: 20,
  })
  oldStatus: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  newStatus: string;

  @Column()
  changedBy: number;

  // Populated when this transition is an SME assignment/reassignment
  // (newStatus === ASSIGNED) — the user id of the SME assigned at that point.
  @Column({
    type: 'int',
    nullable: true,
  })
  assignedToUserId?: number;

  @Column({
    nullable: true,
  })
  remarks?: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(
    () => Interview,
    (interview) => interview.statusHistory,
  )
  @JoinColumn({
    name: 'interviewId',
  })
  interview: Interview;

  @ManyToOne(() => User)
  @JoinColumn({
    name: 'changedBy',
  })
  changedByUser: User;

  @ManyToOne(() => User)
  @JoinColumn({
    name: 'assignedToUserId',
  })
  assignedTo?: User;

  @ManyToOne(() => AssessmentSession)
  @JoinColumn({
    name: 'assessmentSessionId',
  })
  assessmentSession?: AssessmentSession;
}