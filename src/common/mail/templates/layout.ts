const BRAND_COLOR = '#4F46E5';
const TEXT_COLOR = '#1f2937';
const MUTED_COLOR = '#6b7280';
const LIGHT_BG = '#f9fafb';

export function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface EmailLayoutOptions {
  preheader?: string;
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  highlightHtml?: string;
  sectionTitle?: string;
  sectionHtml?: string;
  bulletPoints?: string[];
  footerNote?: string;
}

export function renderEmailLayout(options: EmailLayoutOptions): string {
  const {
    preheader = '',
    heading,
    bodyHtml,
    ctaLabel,
    ctaUrl,
    secondaryCtaLabel,
    secondaryCtaUrl,
    highlightHtml,
    sectionTitle,
    sectionHtml,
    bulletPoints = [],
    footerNote,
  } = options;

  const ctaHtml = buildCtaGroup({ ctaLabel, ctaUrl, secondaryCtaLabel, secondaryCtaUrl });
  const highlightBlock = highlightHtml ? highlightBox(highlightHtml) : '';
  const sectionBlockHtml = sectionTitle && sectionHtml ? sectionBox(sectionTitle, sectionHtml) : '';
  const bulletListHtml = bulletPoints.length ? bulletList(bulletPoints) : '';
  const footerText = footerNote ?? 'This is an automated message from CodeMerit. If you weren\'t expecting this e-mail, you can safely ignore it.';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:linear-gradient(90deg,#4f46e5 0%,#6366f1 100%);padding:24px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;">CodeMerit</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:22px;color:${TEXT_COLOR};">${escapeHtml(heading)}</h1>
                <div style="font-size:15px;line-height:1.7;color:${TEXT_COLOR};">
                  ${bodyHtml}
                </div>
                ${highlightBlock}
                ${bulletListHtml}
                ${sectionBlockHtml}
                ${ctaHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:${LIGHT_BG};border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED_COLOR};">
                  ${escapeHtml(footerText)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildCtaGroup(options: {
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
}): string {
  const { ctaLabel, ctaUrl, secondaryCtaLabel, secondaryCtaUrl } = options;
  const primary = ctaLabel && ctaUrl ? ctaButton(ctaLabel, ctaUrl, true) : '';
  const secondary = secondaryCtaLabel && secondaryCtaUrl ? ctaButton(secondaryCtaLabel, secondaryCtaUrl, false) : '';

  if (!primary && !secondary) return '';

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr>${primary}${secondary}</tr></table>`;
}

function ctaButton(label: string, url: string, primary: boolean): string {
  const color = primary ? BRAND_COLOR : '#ffffff';
  const textColor = primary ? '#ffffff' : BRAND_COLOR;
  const borderColor = primary ? BRAND_COLOR : '#d1d5db';
  const background = primary ? BRAND_COLOR : '#ffffff';

  return `<td style="padding-right:12px;padding-bottom:8px;">
    <a href="${url}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:${textColor};text-decoration:none;border-radius:999px;border:1px solid ${borderColor};background-color:${background};">${escapeHtml(label)}</a>
  </td>`;
}

function highlightBox(content: string): string {
  return `<div style="margin:24px 0;padding:16px 18px;background-color:${LIGHT_BG};border-left:4px solid ${BRAND_COLOR};border-radius:10px;">${content}</div>`;
}

function sectionBox(title: string, content: string): string {
  return `<div style="margin-top:24px;padding:16px 18px;background-color:${LIGHT_BG};border:1px solid #e5e7eb;border-radius:10px;">
    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${TEXT_COLOR};">${escapeHtml(title)}</p>
    <div style="font-size:14px;line-height:1.6;color:${TEXT_COLOR};">${content}</div>
  </div>`;
}

function bulletList(items: string[]): string {
  const listItems = items.map((item) => `<li style="margin:0 0 8px;color:${TEXT_COLOR};">${escapeHtml(item)}</li>`).join('');
  return `<ul style="margin:20px 0 0 20px;padding:0;">${listItems}</ul>`;
}

export function otpBlock(otp: string): string {
  return `<div style="margin:20px 0;padding:16px;background-color:#f3f4f6;border-radius:10px;text-align:center;">
    <span style="font-size:28px;font-weight:700;letter-spacing:6px;color:${TEXT_COLOR};">${escapeHtml(otp)}</span>
  </div>`;
}
