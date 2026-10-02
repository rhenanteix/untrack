ALTER TABLE "Workspace"
  ADD COLUMN "slug" VARCHAR(80),
  ADD COLUMN "logoUrl" VARCHAR(4096),
  ADD COLUMN "timezone" VARCHAR(80) NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN "locale" VARCHAR(12) NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN "notifications" JSONB NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");