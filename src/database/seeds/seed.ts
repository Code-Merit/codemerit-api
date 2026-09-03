import { AppDataSource } from '../data-source';
import { seedPermissions } from './seeders/00-permission.seeder';
import { seedCore } from './seeders/01-core.seeder';
import { seedCurriculum } from './seeders/02-curriculum.seeder';
import { seedPrograms } from './seeders/03-programs.seeder';
import { seedQuestions } from './seeders/04-question.seeder';
import { seedLessons } from './seeders/05-lesson.seeder';
import { seedBadges } from './seeders/06-badges.seeder';
import { seedQualityMetrics } from './seeders/07-quality-metrics.seeder';

// Idempotent — every seeder matches by slug (or unique natural key) and skips
// records that already exist, so this is safe to re-run against a seeded DB.

async function main() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected.\n');

    console.log('Syncing permissions...');
    await seedPermissions(AppDataSource);

    console.log('\nSeeding core (job roles, subjects)...');
    const { jobRoles, subjects } = await seedCore(AppDataSource);

    console.log('\nSeeding curriculum (topics, subject tracks)...');
    const { topics, subjectTracks } = await seedCurriculum(AppDataSource, subjects);

    console.log('\nSeeding programs (job-role subjects, certification tracks)...');
    await seedPrograms(AppDataSource, jobRoles, subjects, subjectTracks);

    console.log('\nSeeding questions...');
    await seedQuestions(AppDataSource, subjects, topics);

    console.log('\nSeeding lessons...');
    await seedLessons(AppDataSource, subjects, topics);

    console.log('\nSeeding badges...');
    await seedBadges(AppDataSource);

    console.log('\nSeeding quality metrics...');
    await seedQualityMetrics(AppDataSource);

    console.log('\nDone.');
  } catch (err) {
    console.error('\nSeeding failed:', err);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

main();
