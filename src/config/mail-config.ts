import { registerAs } from '@nestjs/config';

export interface IMailConfig {
  resendApiKey: string;
  fromEmail: string;
  fromName: string;
  frontendUrl: string;
  logoUrl: string;
}

export const mailConfig = registerAs('mail', (): IMailConfig => {
  const frontendUrl = process.env.FRONTEND_URL || '#';
  const config: IMailConfig = {
    resendApiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.MAIL_FROM_EMAIL || 'noreply@appdevops.in',
    fromName: process.env.MAIL_FROM_NAME || 'CodeMerit',
    frontendUrl,
    logoUrl:
      process.env.MAIL_LOGO_URL ||
      `${frontendUrl}/assets/images/logo.png`,
  };
  return config;
});
