# WorkHub Hermes MCP V1 Contract

WorkHub is the system of record. It exposes an authenticated HTTP tool endpoint for Hermes; it does not run or depend on a large language model.

The deployable Hermes runtime is maintained separately in [WorkHub Hermes Bridge](https://github.com/chenlin9194/workhub-hermes-bridge). Use that repository for the WSL stdio server, installation, diagnostics, the Hermes skill, and Feishu acceptance prompts.

## Boundary

```text
Feishu Bot -> Hermes Agent -> WorkHub Hermes Bridge -> WorkHub HTTP endpoint -> Prisma + SQLite
```

WorkHub owns:

- `src/app/api/integrations/hermes/workhub/route.ts`: tool behavior, authorization, validation, and data access.
- `src/lib/workItemChangeLog.ts`: automatic system logs for tracked work-item changes.
- `.env.example`: `HERMES_WORKHUB_TOKEN` runtime configuration.

The Bridge owns:

- MCP stdio protocol and tool schemas.
- Hermes CLI registration in WSL or Linux.
- Deployment, diagnostics, agent skill, and Feishu acceptance materials.

## Safety Rules

- Calls use `POST /api/integrations/hermes/workhub` with `Authorization: Bearer <HERMES_WORKHUB_TOKEN>` in production.
- Do not add delete tools.
- Dates use `YYYY-MM-DD`.
- A response with `needsConfirmation=true` must be resolved by the user before a read-detail or write action continues.
- Reporting must use stored WorkHub facts; Hermes must not invent conclusions.

## Log Behavior

Keep Hermes consistent with normal web behavior:

- Tracked work-item updates create a system change log.
- A change to `blocked` creates a reportable blocker log; other tracked status changes create reportable update logs.
- Creating or updating projects, milestones, members, links, logs, and action items does not create an additional automatic work log unless the normal web API does so.
- Decisions, risks, blockers, meeting conclusions, and reportable changes need an explicit project log.

## Verification

After deploying WorkHub and the Bridge, run the Bridge `doctor.ps1` script and use the raw `health` prompt from the [Bridge acceptance prompts](https://github.com/chenlin9194/workhub-hermes-bridge/blob/main/docs/acceptance-prompts.md). A successful response identifies `workhub-hermes-v1` and the current advertised tool list.
