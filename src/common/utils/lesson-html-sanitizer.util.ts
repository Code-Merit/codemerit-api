import * as sanitizeHtml from 'sanitize-html';

/** Lesson content allowlist — see src/database/README.md "Lessons" section for the full
 * policy this implements. `style` is never in an allowedAttributes list for any tag, so
 * sanitize-html strips it unconditionally regardless of what the caller sends. Includes a
 * dialogue convention (`p.lesson-comic-line`, `blockquote.lesson-comic-scene`) for
 * narrative/comic-style lessons, authored as plain rich text rather than a separate format.
 *
 * Used by both LessonService (live API create/update) and the 05-lesson.seeder.ts seed
 * script, so no lesson content reaches the database unsanitized regardless of which path
 * authored it. */
const ALLOWED_LESSON_TAGS = [
  'p', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li',
  'h3', 'h4', 'blockquote', 'pre', 'code', 'br', 'hr',
];

const ALLOWED_LESSON_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href'],
  p: ['class'],
  blockquote: ['class'],
  code: ['class'],
};

const ALLOWED_LESSON_CLASSES: sanitizeHtml.IOptions['allowedClasses'] = {
  p: ['lesson-comic-line'],
  blockquote: ['lesson-note', 'lesson-tip', 'lesson-warn', 'lesson-danger', 'lesson-comic-scene'],
  code: [/^language-[a-z]+$/],
};

export function sanitizeLessonHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_LESSON_TAGS,
    allowedAttributes: ALLOWED_LESSON_ATTRIBUTES,
    allowedClasses: ALLOWED_LESSON_CLASSES,
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}
