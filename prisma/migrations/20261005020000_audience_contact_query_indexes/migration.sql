-- Audience lists filter acquisition periods and sort last interaction per workspace.
CREATE INDEX "AudienceContact_workspaceId_firstSeenAt_idx"
  ON "AudienceContact"("workspaceId", "firstSeenAt");

CREATE INDEX "AudienceContact_workspaceId_lastSeenAt_idx"
  ON "AudienceContact"("workspaceId", "lastSeenAt");