// Single source of truth for the certificate FACE sentence — mirrored on the frontend by
// shared/utils/certificate-model.util.ts's own copy of this same constant, since preview
// rendering (a track with no issued Certificate yet) happens client-side.
export const DEFAULT_CERTIFICATE_CONTENT_TEMPLATE =
  'This certificate is awarded to {{userName}} for successfully passing the {{skillName}} skill assessment conducted at CodeMerit.';

/** Substitutes {{userName}} / {{skillName}} tokens into a track's content template (or the
 * default template when the track has none), producing the final sentence to snapshot onto a
 * Certificate at issuance. */
export function renderCertificateContent(
  template: string | null | undefined,
  userName: string,
  skillName: string,
): string {
  const tpl = template && template.trim().length ? template : DEFAULT_CERTIFICATE_CONTENT_TEMPLATE;
  return tpl
    .replace(/\{\{\s*userName\s*\}\}/g, userName)
    .replace(/\{\{\s*skillName\s*\}\}/g, skillName);
}
