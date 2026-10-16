import { registerAs } from '@nestjs/config';

export interface IMailConfig {
  resendApiKey: string;
  fromEmail: string;
  fromName: string;
  frontendUrl: string;
  logoUrl: string;
}

export const mailConfig = registerAs('mail', (): IMailConfig => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const config: IMailConfig = {
    resendApiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.MAIL_FROM_EMAIL || 'noreply@appdevops.in',
    fromName: process.env.MAIL_FROM_NAME || 'CodeMerit',
    frontendUrl,
    // Must be an absolute, publicly reachable PNG — mail clients can't load localhost URLs or
    // SVG. Defaults to the copy the Angular app ships in src/assets/images/email/; set
    // MAIL_LOGO_URL in dev (where FRONTEND_URL is localhost) to see the logo in a real inbox.
    logoUrl:
      process.env.MAIL_LOGO_URL ||
      `${frontendUrl}/assets/images/email/codemerit-logo-email.png`,
  };
  return config;
});
