import { MigrationInterface, QueryRunner } from "typeorm";

// Per-user daily request counts behind the admin profile's "API usage: this week / today".
// Starts empty — rolling counts accrue from deploy onward (the all-time total in api_usage is
// unaffected).
export class CreateApiUsageDaily1792300000000 implements MigrationInterface {
    name = 'CreateApiUsageDaily1792300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`api_usage_daily\` (\`id\` int NOT NULL AUTO_INCREMENT, \`userId\` int NOT NULL, \`day\` date NOT NULL, \`count\` int NOT NULL DEFAULT 0, UNIQUE INDEX \`UQ_api_usage_daily_userId_day\` (\`userId\`, \`day\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`api_usage_daily\``);
    }
}
