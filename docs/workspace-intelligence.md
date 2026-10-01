# Workspace Intelligence

## Architectural report

The authenticated product is already multi-tenant. `Workspace` is the tenant,
`WorkspaceMember` supplies the `owner`, `admin`, `editor` and `viewer` roles,
and the selected workspace is revalidated from the session for every request.
Links, campaigns, Smart Pages, UTMs and QR assets already belong to that tenant.

The feature therefore extends the existing workspace rather than introducing an
organization or authorization model in parallel. Existing campaign links remain
the canonical relations for their own workflows. Projects add an optional layer
of operational context above those resources.

## Foundation delivered

- `Project` stores the workspace, name, generated workspace-unique slug,
  optional description, icon, color, active/archive status and timestamps.
- `ProjectResource` stores future typed links to resources. Its compound foreign
  key to `(Project.id, Project.workspaceId)` prevents a relation from using a
  workspace different from its project. Resources are never copied.
- `/api/projects` and `/api/projects/[id]` apply the existing session,
  same-origin, rate-limit, workspace transaction, quota and audit conventions.
- Projects are archived and restored; they are not deleted. Archiving preserves
  any future resource relations.
- The authenticated shell exposes Projects, with a responsive list, create
  dialog, archive/restore actions and an empty state that explains the benefit.

The migration `20261001040000_workspace_projects` is additive. Existing assets
remain without a project and keep all existing behavior. Apply it with
`npm run prisma:deploy` before deploying the application.

## Data model

```text
Workspace
  └─ Project
       └─ ProjectResource (typed, optional links)

Workspace resources
  ├─ ShortLink
  ├─ SmartPage
  ├─ Campaign
  ├─ UtmLink
  └─ QrAsset
```

`ProjectResource` is intentionally polymorphic because one resource can appear
in more than one project. The service layer must validate the resource type,
resource existence and workspace before it creates a relation. The database
guarantees that the Project and relation have the same workspace.

## Implementation sequence

1. Foundation: Projects, navigation, authorization, migration and archive flow.
2. Organization: Project-resource association, global tags, favorites and recent
   resources.
3. Workspace overview: health totals from existing monitoring, analytics from
   existing click and Smart Page event stores, and audit-derived activity.
4. Discovery: global search and command palette over the existing resource APIs.
5. Guided setup: templates, optional onboarding and contextual create actions.
6. Intelligence: explainable opportunities and discreet suggestions.
7. Advanced: manual collections, smart collection rules, sharing, import/export
   and bulk actions.

No separate health engine or analytics store is planned. Project Membership is
deferred until project-specific sharing is introduced; until then, workspace
membership remains the sole authorization boundary.

## Security and testing

All project lookups include the actor's `workspaceId`. Mutations run inside
`workspaceTransaction`, which locks the workspace and rechecks membership and
permission. The lifecycle E2E covers project creation, archive/restore and
cross-workspace `404` behavior. Unit tests cover the strict input contract and
slug normalization.