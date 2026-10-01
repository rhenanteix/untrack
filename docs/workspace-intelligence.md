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

## Delivered

- `Project` stores workspace, workspace-unique slug, description, visual
  identity, optional goal template, active/archive status and timestamps.
- `ProjectResource` links existing links, campaigns, Smart Pages, UTMs and QR
  assets without copying them. Its compound foreign key prevents a relation
  from crossing workspaces.
- Projects support creation, editing, individual or bulk archive/restore,
  resource connections, resource tags, favorites, recent views and CSV or JSON
  export.
- Global `Tag`, user-specific `Favorite` and `RecentResource` records provide
  organization without turning the workspace into a folder tree.
- `Collection` supports ordered manual resources and live smart rules for
  resource type, name and tag. A smart collection scoped to a Project only
  evaluates resources connected to that Project.
- The workspace dashboard aggregates actual link clicks, Smart Page events,
  monitoring checks, incidents, audit activity and explainable opportunities.
  Project insights use the same sources and intentionally avoid a fabricated
  universal health score.
- Global search and the command palette expose navigation and resource lookup.
- Project-member assignments let workspace administrators record project
  responsibility. Workspace membership remains the authorization boundary.

The additive migrations `20261001040000_workspace_projects` and
`20261001050000_workspace_intelligence_organization` preserve existing assets,
which remain without a Project until explicitly connected. Apply both with
`npm run prisma:deploy` before deploying the application.

## Data model

```text
Workspace
  ├─ Project
  │    ├─ ProjectResource (typed, optional links)
  │    ├─ ProjectMember (responsibility roles)
  │    └─ Collection (optional scope)
  ├─ Tag ─ ResourceTag (typed, global labels)
  └─ Collection ─ CollectionResource (ordered manual lists)

Workspace resources
  ├─ Project
  ├─ ShortLink
  ├─ SmartPage
  ├─ Campaign
  ├─ UtmLink
  └─ QrAsset
```

Typed resource relationships are intentionally polymorphic because a resource
can appear in more than one Project or Collection. The service layer validates
the type, existence and workspace before it writes a relation. All concrete
resource lookups include `workspaceId`.

## Delivery Notes

The project goal chooser is the first guided-setup surface. It selects context
but never creates assets automatically. Resource creation remains explicit in
the existing modules and resources can be connected afterwards.

No separate health engine or analytics store is used. Project membership is a
responsibility model, not an access exception: every Project lookup and mutation
still requires workspace membership and uses the existing workspace role checks.

## Security and testing

All resource lookups include the actor's `workspaceId`. Mutations run inside
`workspaceTransaction`, which locks the workspace and rechecks membership and
permission. Schema tests cover project and workspace-intelligence contracts,
including smart-collection rules and the prohibition on adding a Project as its
own resource type. The lifecycle E2E covers project creation, archive/restore
and cross-workspace `404` behavior.