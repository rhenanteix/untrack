-- Consolidate legacy paid tiers into the single commercial Premium plan.
ALTER TABLE "Workspace" ALTER COLUMN "plan" DROP DEFAULT;

CREATE TYPE "Plan_new" AS ENUM ('free', 'premium');

ALTER TABLE "Workspace"
  ALTER COLUMN "plan" TYPE "Plan_new"
  USING (
    CASE
      WHEN "plan"::text = 'free' THEN 'free'
      ELSE 'premium'
    END
  )::"Plan_new";

DROP TYPE "Plan";
ALTER TYPE "Plan_new" RENAME TO "Plan";

ALTER TABLE "Workspace" ALTER COLUMN "plan" SET DEFAULT 'free';

INSERT INTO "WorkspaceUsage" ("workspaceId", "resource", "count")
SELECT "workspaceId", 'smartCards', COUNT(*)::INTEGER
FROM "SmartCard"
GROUP BY "workspaceId"
ON CONFLICT ("workspaceId", "resource") DO UPDATE
SET "count" = EXCLUDED."count";

INSERT INTO "WorkspaceUsage" ("workspaceId", "resource", "count")
SELECT "workspaceId", 'audienceContacts', COUNT(*)::INTEGER
FROM "AudienceContact"
GROUP BY "workspaceId"
ON CONFLICT ("workspaceId", "resource") DO UPDATE
SET "count" = EXCLUDED."count";