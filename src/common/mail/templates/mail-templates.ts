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
      preheader: 'Use this code to verify your CodeMerit account.',
      heading: `Welcome, ${safeName}!`,
      bodyHtml: `
        <p>Thanks for signing up for CodeMerit. Use the code below to verify your account and get started.</p>
        ${otpBlock(otp)}
        <p>This code expires shortly, so verify soon. If you didn't create this account, you can ignore this e-mail.</p>
      `,
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
          <p>Hi ${safeName}, use the code below to reset your CodeMerit password.</p>
          ${otpBlock(otp)}
          <p>If you didn't request a password reset, you can safely ignore this e-mail — your password won't change.</p>
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
        <p>Hi ${safeName}, use the code below to verify your CodeMerit account.</p>
        ${otpBlock(otp)}
        <p>If you didn't request this, you can safely ignore this e-mail.</p>
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
      heading: `You're all set, ${safeName}!`,
      bodyHtml: `
        <p>Your CodeMerit account is now verified. You can sign in and start taking quizzes, tracking your progress, and earning certificates.</p>
      `,
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
        <p>Hi ${safeName}, this confirms your CodeMerit password was just changed.</p>
        <p>If you didn't make this change, please reset your password immediately and contact support.</p>
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
    subject: `You're enrolled in ${jobRoleTitle}`,
    html: renderEmailLayout({
      preheader: `You're now on the ${jobRoleTitle} career track.`,
      heading: `Welcome to ${safeRole}`,
      bodyHtml: `
        <p>Hi ${safeName}, you're now enrolled in the <strong>${safeRole}</strong> career track. Your progress across its subjects and subject tracks will now count toward this role's certifications.</p>
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
        <p>Hi ${safeName}, you've earned the <strong>${safeTrack}</strong> certificate.</p>
        <p>Certificate number: <strong>${safeCertNumber}</strong></p>
      `,
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
        <p>Hi ${safeName}, you just earned the <strong>${safeBadge}</strong> badge.</p>
      `,
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
      preheader: `You're on a ${days}-day streak.`,
      heading: `You're on a ${days}-day streak!`,
      bodyHtml: `
        <p>Hi ${safeName}, you've been active on CodeMerit for ${days} days in a row. Keep the streak alive by practicing today.</p>
      `,
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
