import { Column, CreateDateColumn, Entity, OneToMany } from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { JobRole } from './job-role.entity';

// Pure display categorization for the job-role catalog/picker (e.g. "Web Foundations",
// "Frontend Engineering", "Backend Engineering") — a plain lookup table rather than a
// hardcoded enum so new groups can be curated without a migration. Distinct from
// JobRoleRelation, which is about scope inheritance, not display grouping.
@Entity()
export class JobRoleGroup extends AbstractEntity {
  @Column({ type: 'varchar', length: 100, nullable: false, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true, unique: true, default: null })
  slug: string;

  @Column({ type: 'int', nullable: false, default: 1 })
  sortOrder: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @OneToMany(() => JobRole, (jr) => jr.group)
  jobRoles: JobRole[];
}
