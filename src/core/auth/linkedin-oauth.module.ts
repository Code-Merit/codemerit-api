import { Module } from '@nestjs/common';
import { LinkedInOAuthService } from './providers/linkedin-oauth.service';

// Deliberately its own tiny module (no other imports) — a leaf both AuthModule and UsersModule
// can depend on without either depending on the other. See linkedin-oauth.service.ts's own doc
// comment for why that matters (AuthModule already imports UsersModule).
@Module({
  providers: [LinkedInOAuthService],
  exports: [LinkedInOAuthService],
})
export class LinkedInOAuthModule {}
