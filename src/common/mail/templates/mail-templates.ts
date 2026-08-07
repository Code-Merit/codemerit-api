import { UserOtpTagsEnum } from 'src/core/users/enums/user-otp-Tags.enum';
import { escapeHtml, otpBlock, renderEmailLayout } from './layout';

export interface EmailTemplate {
  subject: string;
  html: string;
}

export function registrationWelcomeTemplate(
  name: string,
  otp: string,
): EmailTemplate {
  const safeName = escapeHtml(name);
  return {
    subject: 'Welcome to CodeMerit — verify your account',
    html: renderEmailLayout({
      preheader: 'Use this code to verify your CodeMerit account and get started.',
      heading: `Welcome, ${safeName}!`,
      bodyHtml: `
        <p>Thanks for joining CodeMerit. We’re excited to help you learn faster, practice smarter, and build momentum toward your goals.</p>
        <p>To get started, please verify your account using the one-time code below.</p>
        ${otpBlock(otp)}
        <p>This code will expire soon, so please verify your account as soon as possible. If you didn’t create this account, you can safely ignore this email.</p>
      `,
      highlightHtml: '<strong>What happens next?</strong><p>Verify your account, explore your dashboard, and start your first learning session.</p>',
      sectionTitle: 'What you can expect',
      sectionHtml: '<p>Personalized recommendations, progress tracking, streaks, badges, certificates, and career-focused learning paths.</p>',
      bulletPoints: [
        'Verify your account in one step',
        'Start quizzes and track your growth',
        'Stay motivated with streaks and achievements',
      ],
      ctaLabel: 'Open CodeMerit',
      ctaUrl: '{{FRONTEND_URL}}',
    }),
  };
}

export function otpTemplate(
  name: string,
  otp: string,
  tag: UserOtpTagsEnum,
): EmailTemplate {
  const safeName = escapeHtml(name);
  if (tag === UserOtpTagsEnum.PWD_RECOVER) {
    return {
      subject: 'Reset your CodeMerit password',
      html: renderEmailLayout({
        preheader: 'Use this code to reset your CodeMerit password.',
        heading: 'Reset your password',
        bodyHtml: `
          <p>Hi ${safeName}, we received a request to reset your CodeMerit password.</p>
          <p>Please use the one-time code below to continue.</p>
          ${otpBlock(otp)}
          <p>If you didn’t make this request, you can safely ignore this email. Your password will remain unchanged.</p>
        `,
      }),
    };
  }
  return {
    subject: 'Verify your CodeMerit account',
    html: renderEmailLayout({
      preheader: 'Use this code to verify your CodeMerit account.',
      heading: 'Verify your account',
      bodyHtml: `
        <p>Hi ${safeName}, please use the one-time code below to verify your CodeMerit account.</p>
        ${otpBlock(otp)}
        <p>If you didn’t request this, you can safely ignore this email.</p>
      `,
    }),
  };
}

export function accountVerifiedTemplate(name: string): EmailTemplate {
  const safeName = escapeHtml(name);
  return {
    subject: 'Your CodeMerit account is verified',
    html: renderEmailLayout({
      preheader: 'Your account is verified and ready to go.',
      heading: `You’re all set, ${safeName}!`,
      bodyHtml: `
        <p>Your CodeMerit account is now verified. You can sign in and start learning, practicing, and building your achievements right away.</p>
      `,
      highlightHtml: '<strong>Your learning journey is ready.</strong><p>Open your dashboard to continue your streak, explore new lessons, and move toward your next milestone.</p>',
      ctaLabel: 'Go to CodeMerit',
      ctaUrl: '{{FRONTEND_URL}}',
    }),
  };
}

export function passwordChangedTemplate(name: string): EmailTemplate {
  const safeName = escapeHtml(name);
  return {
    subject: 'Your CodeMerit password was changed',
    html: renderEmailLayout({
      preheader: 'Your password was just changed.',
      heading: 'Password changed',
      bodyHtml: `
        <p>Hi ${safeName}, this confirms that your CodeMerit password was successfully updated.</p>
        <p>If you did not make this change, please reset your password immediately and contact support so we can help secure your account.</p>
      `,
    }),
  };
}

export function roleEnrolledTemplate(
  name: string,
  jobRoleTitle: string,
): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeRole = escapeHtml(jobRoleTitle);
  return {
    subject: `You’re enrolled in ${jobRoleTitle}`,
    html: renderEmailLayout({
      preheader: `You’re now on the ${jobRoleTitle} career track.`,
      heading: `Welcome to ${safeRole}`,
      bodyHtml: `
        <p>Hi ${safeName}, you’re now enrolled in the <strong>${safeRole}</strong> career track.</p>
        <p>Your progress across the related subjects and learning paths will now contribute to your journey toward this role’s certifications and milestones.</p>
      `,
      ctaLabel: 'View your career dashboard',
      ctaUrl: '{{FRONTEND_URL}}',
    }),
  };
}

export function certificateIssuedTemplate(
  name: string,
  trackTitle: string,
  certificateNumber: string,
): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeTrack = escapeHtml(trackTitle);
  const safeCertNumber = escapeHtml(certificateNumber);
  return {
    subject: `You earned the ${trackTitle} certificate!`,
    html: renderEmailLayout({
      preheader: `Congratulations on earning the ${trackTitle} certificate.`,
      heading: 'Congratulations! 🎉',
      bodyHtml: `
        <p>Hi ${safeName}, you’ve earned the <strong>${safeTrack}</strong> certificate.</p>
        <p>Your certificate reference number is <strong>${safeCertNumber}</strong>.</p>
      `,
      sectionTitle: 'Certificate details',
      sectionHtml: '<p>Share your achievement with your network and keep the momentum going by taking on your next challenge.</p>',
      ctaLabel: 'View your certificate',
      ctaUrl: '{{FRONTEND_URL}}',
    }),
  };
}

export function badgeEarnedTemplate(
  name: string,
  badgeName: string,
): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeBadge = escapeHtml(badgeName);
  return {
    subject: `New badge earned: ${badgeName}`,
    html: renderEmailLayout({
      preheader: `You earned the ${badgeName} badge.`,
      heading: 'New badge earned!',
      bodyHtml: `
        <p>Hi ${safeName}, you’ve just earned the <strong>${safeBadge}</strong> badge.</p>
        <p>This recognition reflects your consistency and progress, and it’s a great sign that your effort is paying off.</p>
      `,
      highlightHtml: '<strong>Keep the momentum going.</strong><p>Your next lesson or quiz is waiting—keep building on this success.</p>',
      ctaLabel: 'View your badges',
      ctaUrl: '{{FRONTEND_URL}}',
    }),
  };
}

export function streakMilestoneTemplate(
  name: string,
  days: number,
): EmailTemplate {
  const safeName = escapeHtml(name);
  return {
    subject: `${days}-day streak! Keep it up`,
    html: renderEmailLayout({
      preheader: `You’re on a ${days}-day streak.`,
      heading: `You’re on a ${days}-day streak!`,
      bodyHtml: `
        <p>Hi ${safeName}, you’ve been active on CodeMerit for ${days} days in a row.</p>
        <p>That consistency is building real momentum, and one small session today can keep it going.</p>
      `,
      highlightHtml: '<strong>Small daily effort adds up.</strong><p>A short session today can help you build toward your next milestone and keep the streak alive.</p>',
      ctaLabel: 'Keep the streak going',
      ctaUrl: '{{FRONTEND_URL}}',
    }),
  };
}

export function interviewRescheduledTemplate(
  name: string,
  title: string,
  scheduledAt: string,
): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(title);
  const safeWhen = escapeHtml(scheduledAt);
  return {
    subject: `Your interview "${title}" has been rescheduled`,
    html: renderEmailLayout({
      preheader: `Your interview is now scheduled for ${scheduledAt}.`,
      heading: 'Interview rescheduled',
      bodyHtml: `
        <p>Hi ${safeName}, your interview <strong>${safeTitle}</strong> has been rescheduled.</p>
        <p>New date &amp; time: <strong>${safeWhen}</strong></p>
      `,
      ctaLabel: 'View interview details',
      ctaUrl: '{{FRONTEND_URL}}',
    }),
  };
}

export function interviewAssignedTemplate(
  name: string,
  title: string,
  scheduledAt: string,
): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(title);
  const safeWhen = escapeHtml(scheduledAt);
  return {
    subject: `You've been assigned to conduct "${title}"`,
    html: renderEmailLayout({
      preheader: `You're assigned to conduct an interview on ${scheduledAt}.`,
      heading: 'New interview assigned',
      bodyHtml: `
        <p>Hi ${safeName}, you've been assigned to conduct the interview <strong>${safeTitle}</strong>.</p>
        <p>Scheduled for: <strong>${safeWhen}</strong></p>
      `,
      ctaLabel: 'View interview details',
      ctaUrl: '{{FRONTEND_URL}}',
    }),
  };
}

export function interviewScheduledTemplate(
  name: string,
  title: string,
  scheduledAt: string,
): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(title);
  const safeWhen = escapeHtml(scheduledAt);
  return {
    subject: `Your interview "${title}" is scheduled`,
    html: renderEmailLayout({
      preheader: `You're booked in for ${scheduledAt}.`,
      heading: "You're booked in!",
      bodyHtml: `
        <p>Hi ${safeName}, thanks for scheduling your interview <strong>${safeTitle}</strong>.</p>
        <p>Target date &amp; time: <strong>${safeWhen}</strong></p>
        <p>We'll email you again as soon as an interviewer is assigned and confirmed. If your plans
        change before then, you can reschedule or cancel from your dashboard.</p>
      `,
      ctaLabel: 'View interview details',
      ctaUrl: '{{FRONTEND_URL}}',
    }),
  };
}

export function interviewCancelledTemplate(
  name: string,
  title: string,
  reason: string,
): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(title);
  const safeReason = escapeHtml(reason);
  return {
    subject: `Your interview "${title}" has been cancelled`,
    html: renderEmailLayout({
      preheader: `Your interview "${title}" has been cancelled.`,
      heading: 'Interview cancelled',
      bodyHtml: `
        <p>Hi ${safeName}, your interview <strong>${safeTitle}</strong> has been cancelled.</p>
        <p>Reason: <strong>${safeReason}</strong></p>
        <p>No further action is needed on your end. If you have questions about this or would like to
        schedule a new interview, please get in touch.</p>
      `,
    }),
  };
}

export function interviewCompletedTemplate(
  name: string,
  title: string,
  feedback?: string,
): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(title);
  const feedbackHtml = feedback
    ? `<p>Summary from the panel: <strong>${escapeHtml(feedback)}</strong></p>`
    : '';
  return {
    subject: `Your interview "${title}" has been completed`,
    html: renderEmailLayout({
      preheader: `Your interview "${title}" is complete — your report is ready.`,
      heading: 'Interview complete',
      bodyHtml: `
        <p>Hi ${safeName}, your interview <strong>${safeTitle}</strong> has now been completed and
        reviewed across all its rounds.</p>
        ${feedbackHtml}
        <p>You can view the full report — including feedback from every round — any time.</p>
      `,
      ctaLabel: 'View your full report',
      ctaUrl: '{{FRONTEND_URL}}',
    }),
  };
}

export function interviewRoundScheduledTemplate(
  name: string,
  title: string,
  roundNumber: number,
  scheduledAt: string,
  interviewerName: string,
): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(title);
  const safeWhen = escapeHtml(scheduledAt);
  const safeInterviewer = escapeHtml(interviewerName);
  return {
    subject: `Round ${roundNumber} of "${title}" is scheduled`,
    html: renderEmailLayout({
      preheader: `Round ${roundNumber} is scheduled for ${scheduledAt}.`,
      heading: 'Your next interview round is set',
      bodyHtml: `
        <p>Hi ${safeName}, round ${roundNumber} of your interview <strong>${safeTitle}</strong> has
        been scheduled.</p>
        <p>Date &amp; time: <strong>${safeWhen}</strong></p>
        <p>You'll be meeting with: <strong>${safeInterviewer}</strong></p>
      `,
      ctaLabel: 'View interview details',
      ctaUrl: '{{FRONTEND_URL}}',
    }),
  };
}

export function interviewRoundRescheduledTemplate(
  name: string,
  title: string,
  roundNumber: number,
  scheduledAt: string,
): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(title);
  const safeWhen = escapeHtml(scheduledAt);
  return {
    subject: `Round ${roundNumber} of "${title}" has a new time`,
    html: renderEmailLayout({
      preheader: `Round ${roundNumber} you're assigned to has moved to ${scheduledAt}.`,
      heading: 'Interview round rescheduled',
      bodyHtml: `
        <p>Hi ${safeName}, round ${roundNumber} of <strong>${safeTitle}</strong>, which you're
        assigned to conduct, has been rescheduled.</p>
        <p>New date &amp; time: <strong>${safeWhen}</strong></p>
      `,
      ctaLabel: 'View interview details',
      ctaUrl: '{{FRONTEND_URL}}',
    }),
  };
}

export function interviewRoundCancelledTemplate(
  name: string,
  title: string,
  roundNumber: number,
  reason: string,
): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(title);
  const safeReason = escapeHtml(reason);
  return {
    subject: `Round ${roundNumber} of "${title}" has been cancelled`,
    html: renderEmailLayout({
      preheader: `Round ${roundNumber} you were assigned has been cancelled.`,
      heading: 'Interview round cancelled',
      bodyHtml: `
        <p>Hi ${safeName}, round ${roundNumber} of <strong>${safeTitle}</strong>, which you were
        assigned to conduct, has been cancelled.</p>
        <p>Reason: <strong>${safeReason}</strong></p>
        <p>No action is needed from you — nothing further is scheduled for this round.</p>
      `,
    }),
  };
}

export function interviewRoundCompletedTemplate(
  name: string,
  title: string,
  roundNumber: number,
  feedback?: string,
): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(title);
  const feedbackHtml = feedback
    ? `<p>Interviewer feedback: <strong>${escapeHtml(feedback)}</strong></p>`
    : '';
  return {
    subject: `Round ${roundNumber} of "${title}" is complete`,
    html: renderEmailLayout({
      preheader: `Round ${roundNumber} of "${title}" has been completed and reviewed.`,
      heading: 'Round complete',
      bodyHtml: `
        <p>Hi ${safeName}, round ${roundNumber} of your interview <strong>${safeTitle}</strong> has
        been completed and reviewed.</p>
        ${feedbackHtml}
        <p>If another round is needed, we'll be in touch to schedule it. Otherwise, you'll hear from
        us once the overall interview has been finalized.</p>
      `,
      ctaLabel: 'View interview details',
      ctaUrl: '{{FRONTEND_URL}}',
    }),
  };
}

export function interviewRoundDeclinedTemplate(
  name: string,
  title: string,
  roundNumber: number,
  reason: string,
): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(title);
  const safeReason = escapeHtml(reason);
  return {
    subject: `Update on round ${roundNumber} of "${title}"`,
    html: renderEmailLayout({
      preheader: `There's an update on round ${roundNumber} of "${title}".`,
      heading: 'Round update',
      bodyHtml: `
        <p>Hi ${safeName}, round ${roundNumber} of your interview <strong>${safeTitle}</strong> was
        marked as declined by the interviewer.</p>
        <p>Reason given: <strong>${safeReason}</strong></p>
        <p>If you believe this was recorded in error, please get in touch so we can look into it.</p>
      `,
    }),
  };
}

export function interviewCancelledSmeNoticeTemplate(
  name: string,
  title: string,
  reason: string,
): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(title);
  const safeReason = escapeHtml(reason);
  return {
    subject: `Interview "${title}" has been cancelled`,
    html: renderEmailLayout({
      preheader: `The interview "${title}" you were assigned to has been cancelled.`,
      heading: 'Interview cancelled',
      bodyHtml: `
        <p>Hi ${safeName}, the interview <strong>${safeTitle}</strong> you were assigned to has been
        cancelled.</p>
        <p>Reason: <strong>${safeReason}</strong></p>
        <p>No action is needed from you — nothing further is scheduled for this interview.</p>
      `,
    }),
  };
}

export function levelUpTemplate(
  name: string,
  level: number,
  levelTitle: string,
): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(levelTitle);
  return {
    subject: `You leveled up to Level ${level}: ${levelTitle}`,
    html: renderEmailLayout({
      preheader: `You reached Level ${level}: ${levelTitle}.`,
      heading: 'Level up!',
      bodyHtml: `
        <p>Hi ${safeName}, you've leveled up to <strong>Level ${level}: ${safeTitle}</strong>. Keep earning XP to reach the next level.</p>
      `,
      ctaLabel: 'View your progress',
      ctaUrl: '{{FRONTEND_URL}}',
    }),
  };
}
