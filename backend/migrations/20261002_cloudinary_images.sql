-- Apply before deploying if TypeORM synchronize is disabled.
-- Existing image references are preserved; re-upload local images to Cloudinary.
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "avatarPublicId" text;
ALTER TABLE buses ADD COLUMN IF NOT EXISTS "photoPublicIds" jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMIT;
