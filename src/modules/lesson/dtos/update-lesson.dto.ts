import { PartialType } from '@nestjs/mapped-types';
import { CreateLessonDto } from './create-lesson.dto';

/** All fields optional. When `sections` is provided, it replaces the lesson's full
 * section set (delete-and-reinsert) rather than patching individual sections —
 * editors always resend the complete section list. */
export class UpdateLessonDto extends PartialType(CreateLessonDto) {}
