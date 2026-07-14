# WorkHub Agent Instructions

This file is the long-term working agreement for AI agents operating on this repository.

## Project identity

WorkHub is a personal project management control tower for a senior software project manager.
It is not a Jira, ALM, Feishu, or enterprise collaboration replacement.

WorkHub should only collect and organize key objects that the user needs to track, explain, report, or quickly retrieve.

## Product boundary

Good fit for WorkHub:

- Key projects
- Key milestones
- Key work items
- Key issues, risks, and blockers
- Key decisions
- Key changes
- Coordination items
- Reportable work logs and process records
- Stable project background information that helps explain status, risk, plan, and ownership

Bad fit for WorkHub:

- Full requirement mirrors
- Full Jira or ALM issue mirrors
- Fine-grained execution task trees
- All meeting transcripts
- Full document repositories
- Complex permission systems
- Multi-user enterprise workflows
- AI API integration unless explicitly requested

## Navigation rule

Keep the top-level navigation simple.

Current intended top-level entries:

- 工作台
- 项目
- 事项
- 日志
- 汇报

Do not add many top-level entries such as members, plans, milestones, documents, links, risks, releases, or tests.
Those should live inside project detail sections where appropriate.

## Current technical context

The project is a Next.js application using TypeScript, Prisma, and SQLite.

Important areas:

- `prisma/schema.prisma`: data model
- `src/app/projects`: project pages
- `src/app/items`: work item pages
- `src/app/logs`: work log pages
- `src/app/api`: API routes
- `src/components`: reusable UI sections and cards
- `src/lib/constants.ts`: option lists and labels
- `src/lib/types.ts`: shared TypeScript types

## Hermes + Feishu MCP integration

WorkHub owns the authenticated HTTP tool endpoint and its business rules. The Hermes stdio server, WSL installation scripts, deployment runbook, skill, and Feishu acceptance prompts live in the separate [WorkHub Hermes Bridge repository](https://github.com/chenlin9194/workhub-hermes-bridge).

Before modifying or diagnosing the Feishu/Hermes path, read:

- `docs/hermes-workhub-v1.md`
- Bridge repository: `docs/company-deployment.md` and `docs/hermes-skill.md`

The authoritative WorkHub MCP files are:

- `src/app/api/integrations/hermes/workhub/route.ts`
- `src/lib/workItemChangeLog.ts`

Keep `HERMES_WORKHUB_TOKEN` out of Git. The token must match between WorkHub and the Bridge configuration. Do not add delete MCP tools. Preserve the current log boundary: tracked work-item updates create system change logs; other CRUD actions do not create automatic logs unless the web API already does.

Use Windows-compatible npm commands when giving user-side commands:

```bash
npm.cmd run typecheck
npm.cmd run build
```

If Prisma schema changes are made, also run the project database push command if available, or otherwise use:

```bash
npx prisma db push
```

## Current stable baseline

Current stable baseline at Phase 3 start:

```text
e485bc7 fix: improve action feedback and long text wrapping
```

Expected branch:

```text
main
```

Before starting any implementation, check:

```bash
git status --short
git log -1 --oneline
git branch --show-current
```

## Completed phases

### Phase 1

- Introduced `Project` entity
- Added `projectId` relation support to `WorkItem` and `WorkLog`
- Added project list, create, detail, and edit pages
- Project detail aggregates related items and logs

### Phase 2

- Split project detail sections
- Commit: `703e477 refactor: split project detail sections`

### Phase 2.10 bugfix

- Commit: `e485bc7 fix: improve action feedback and long text wrapping`
- Fixed long text and URL wrapping on project, item, and log detail pages
- Improved create and delete feedback for items and logs
- Added `useRef` plus DOM-level button disabling to prevent repeated fast clicks causing duplicate create/delete actions
- Used `window.location.assign` after successful create/delete for clear navigation feedback
- Verified with typecheck and build

## Phase 3 direction

Phase 3 evolves project-level stable information and project cockpit structure.

Focus areas:

- Project basic information
- Project members and roles
- Project stages and lifecycle
- Project cycle dates
- Project key links
- Project description, background, and scope
- Milestones and plan nodes
- Release, test, and development plan nodes
- Project snapshot and management reporting view

Important: Do not turn Phase 3 into a large enterprise project management system.

## Current Project model capabilities

At Phase 3 start, `Project` already has:

- Basic identity: `name`, `code`, `description`
- Classification and state: `type`, `status`, `stage`, `health`
- Ownership: `owner`, `pm`
- Dates: `startDate`, `targetDate`, `releaseDate`
- Reporting fields: `currentSummary`, `nextMilestone`, `nextAction`
- Source fields: `sourceSystem`, `sourceId`, `sourceUrl`, `tags`
- Relations: `items`, `logs`, `links`, `milestones`

Project child models already exist:

- `ProjectLink`: key links with category, primary flag, description, and sort order
- `ProjectMilestone`: milestones with status, target date, actual date, owner, source URL, and sort order

Do not duplicate these existing capabilities without a strong reason.

## Recommended Phase 3 breakdown

### Phase 3.1: Project detail cockpit refactor, no database change

Goal: reorganize the project detail page into clearer cockpit sections without changing schema or API.

Recommended files:

- `src/app/projects/[id]/page.tsx`
- `src/components/ProjectHeaderSection.tsx`
- `src/components/ProjectOverviewSection.tsx`
- `src/components/ProjectSignalSection.tsx`

Keep existing components:

- `src/components/ProjectMilestoneSection.tsx`
- `src/components/ProjectLinkSection.tsx`

Suggested project detail order:

1. Project header
2. Project overview
3. Project signals
4. Quick actions
5. Project milestones
6. Key links
7. Project info
8. Related items
9. Recent logs

Verification:

```bash
npm.cmd run typecheck
npm.cmd run build
```

### Phase 3.2: Project snapshot enhancement, no database change

Goal: make `/api/projects/[id]/snapshot` include project-level status, summary, milestones, key links, risk signals, and recent logs.

Recommended file:

- `src/app/api/projects/[id]/snapshot/route.ts`

Verification:

```bash
npm.cmd run typecheck
npm.cmd run build
```

### Phase 3.3: Add plan type to project milestones

Goal: allow milestone entries to represent release plan, test plan, development plan, requirement plan, management nodes, or generic milestones.

Prefer adding a lightweight field to `ProjectMilestone` instead of creating a separate `ProjectPlan` model at this stage.

Candidate Prisma field:

```prisma
planType String @default("milestone")
```

Recommended files:

- `prisma/schema.prisma`
- `src/lib/constants.ts`
- `src/lib/types.ts`
- `src/components/ProjectMilestoneSection.tsx`
- `src/app/api/projects/[id]/milestones/route.ts`
- `src/app/api/projects/[id]/milestones/[milestoneId]/route.ts`
- `src/app/api/projects/[id]/snapshot/route.ts`

Verification:

```bash
npx prisma db push
npm.cmd run typecheck
npm.cmd run build
```

### Phase 3.4: Lightweight project members

Goal: support stable project member information without building an organization or permission system.

Possible model:

```prisma
model ProjectMember {
  id             String   @id @default(cuid())
  projectId      String
  project        Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name           String
  role           String
  team           String?
  responsibility String?
  contact        String?
  isCore         Boolean  @default(false)
  sortOrder      Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

Recommended files:

- `prisma/schema.prisma`
- `src/lib/constants.ts`
- `src/lib/types.ts`
- `src/components/ProjectMemberSection.tsx`
- `src/app/projects/[id]/page.tsx`
- `src/app/api/projects/[id]/members/route.ts`
- `src/app/api/projects/[id]/members/[memberId]/route.ts`
- `src/app/api/projects/[id]/snapshot/route.ts`

Verification:

```bash
npx prisma db push
npm.cmd run typecheck
npm.cmd run build
```

## Implementation rules

Before modifying files:

1. Inspect current state.
2. Explain the intended change scope.
3. Keep the change small and phase-aligned.
4. Do not enter future phases without confirmation.

Always avoid:

- Unrequested commits
- Unrequested pushes
- Large rewrites
- Top-level navigation expansion
- AI API integration
- Jira or ALM synchronization
- Complex permission systems
- Full project planning suites
- Gantt chart implementation unless explicitly approved

## Git rules

Do not commit unless the user explicitly asks.
Do not push unless the user explicitly asks.
Do not reset, rebase, force-push, or discard changes unless explicitly approved.

After changes, report:

- Files changed
- What changed
- Verification commands and results
- Remaining risks or follow-up suggestions

## Code style and UX rules

Prefer small reusable components over very long page files.
Keep Chinese UI labels consistent with the existing app.
Preserve existing visual language and button classes unless a focused UI cleanup is requested.
Ensure long text and URLs wrap safely.
Prevent duplicate submit/delete actions where forms can be clicked repeatedly.
Use clear loading, saving, deleting, and error feedback.

## Reporting style for agents

When reporting back to the user, be factual and concise.
Separate verified facts from suggestions.
Do not invent code state. Base conclusions on files actually inspected or commands actually run.

For long-term planning, prefer phased recommendations with:

1. Goal
2. Files to change
3. Verification commands
4. What not to do
5. Minimal deliverable
