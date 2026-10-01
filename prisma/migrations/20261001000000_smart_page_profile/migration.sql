-- Older installations applied Smart Pages before profile customization was added.
-- Keep this additive and rerunnable on installations whose initial migration
-- already contained these columns. Do not rewrite published migration history.
ALTER TABLE "SmartPage"
  ADD COLUMN IF NOT EXISTS "theme" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "socialLinks" JSONB NOT NULL DEFAULT '[]';
