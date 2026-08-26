import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { UserJobRole } from 'src/common/typeorm/entities/user-job-role.entity';
import { ActivityModule } from 'src/modules/activity/activity.module';
import { MasterModule } from 'src/modules/master/master.module';
import { SkillEnrollmentModule } from 'src/modules/skill-enrollment/skill-enrollment.module';
import { UserPermissionModule } from 'src/modules/user-permission/user-permission.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './guards/local.strategy';
import { JwtStrategy } from './jwt/jwt.strategy';
import { LinkedInOAuthModule } from './linkedin-oauth.module';
import { LoginValidationMiddleware } from './middleware/login-validation.middleware';
import { AuthService } from './providers/auth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserJobRole, JobRole]),
    UsersModule,
    PassportModule,
    JwtModule.register({
      global: true,
      secret: 'secret@1234#',
      signOptions: { expiresIn: '1d' },
    }),
    UserPermissionModule,
    MasterModule,
    SkillEnrollmentModule,
    ActivityModule,
    LinkedInOAuthModule,
  ],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  controllers: [AuthController],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoginValidationMiddleware).forRoutes('auth/login');
  }
}
