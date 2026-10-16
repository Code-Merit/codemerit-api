import { join, resolve } from 'path';

// User-uploaded files live in <api project root>/uploads (git-ignored) and are served publicly at
// /uploads/... by main.ts. Must persist across deploys — don't place it inside dist/. UPLOADS_DIR
// overrides the location (e.g. a mounted Docker volume; the container's own filesystem is wiped
// on every redeploy). A function, not a constant: main.ts loads .env only after its imports run.
export function uploadsRoot(): string {
  const configured = process.env.UPLOADS_DIR?.trim();
  return configured ? resolve(configured) : join(process.cwd(), 'uploads');
}

export const UPLOADS_URL_PREFIX = '/uploads';

// Profile pictures: uploads/users/images/<userId>-<timestamp>.<ext>
export const USER_IMAGES_SUBDIR = 'users/images';
