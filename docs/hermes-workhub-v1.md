# Hermes + WorkHub MCP V1.0

This document is the copyable operating guide for using a Feishu Hermes agent as the natural-language entrance and exit for WorkHub.

## What V1.0 Does

Hermes interprets a Feishu request, calls a local WorkHub MCP tool, and returns the confirmed result back to Feishu. WorkHub stays the structured record system; it does not need an LLM or any change to its normal web workflow.

```text
Feishu message
  -> Feishu bot / Hermes agent
  -> workhub MCP server (WSL stdio)
  -> WorkHub HTTP tool endpoint
  -> Prisma + SQLite
  -> Hermes response in Feishu
```

V1.0 provides these capability groups:

| Group | Tools |
| --- | --- |
| Project | search/get snapshot/create/update project; list/create/update milestone; list/create/update member; list/create/update key link |
| Work items | list/get/create/update/close work item; create action items together with a work item |
| Logs | list/get/create/update log; create follow-up action items with a log |
| Action items | list/get/update/complete action item |
| Reporting | get today's facts, this week's facts, an explicit date-range fact package, and the portfolio overview |

No delete tool is exposed through Hermes. A closed work item can be reopened with `update_work_item`; it is not destroyed.

## Change Logs

Hermes follows the same automatic log boundary as the WorkHub web UI:

- Updating a work item's tracked fields creates a system `事项变化` log. This includes status, priority, health, summary, next action, checkpoint, report level, owner, due date, and source fields.
- A change to `blocked` becomes a reportable `blocker` log; other tracked status changes are reportable `update` logs.
- Creating or updating projects, milestones, members, links, logs, and action items does not automatically create an extra work log, because the web UI does not create one either.
- Important business conclusions still need an explicit `create_project_log` call, for example a decision, risk, blocker explanation, meeting conclusion, or reportable change record.

## Required Local Setup

1. Start WorkHub on Windows:

```powershell
cd D:\个人web
npm.cmd run dev
```

2. Hermes runs in WSL and calls the MCP script:

```powershell
wsl.exe -d Ubuntu-22.04 -u linchen sh -lc "hermes mcp add workhub --command node --args '/mnt/d/个人web/scripts/hermes-workhub-mcp.mjs' --env WORKHUB_BASE_URL=http://127.0.0.1:3000"
```

3. Verify that Hermes sees the new V1 tool set:

```powershell
wsl.exe -d Ubuntu-22.04 -u linchen sh -lc "hermes mcp test workhub"
wsl.exe -d Ubuntu-22.04 -u linchen sh -lc "hermes mcp list"
```

The Feishu bot must run through this same WSL Hermes profile. A different Hermes user, machine, or cloud agent will not automatically inherit the `workhub` MCP registration.

## Security for Company Use

Set a long random token in the WorkHub production environment:

```text
HERMES_WORKHUB_TOKEN=<a-long-random-secret>
```

Then register or update Hermes with the same value:

```powershell
wsl.exe -d Ubuntu-22.04 -u linchen sh -lc "hermes mcp add workhub --command node --args '/mnt/d/个人web/scripts/hermes-workhub-mcp.mjs' --env WORKHUB_BASE_URL=https://workhub.company.example HERMES_WORKHUB_TOKEN=<the-same-secret>"
```

In production, WorkHub rejects all Hermes calls when `HERMES_WORKHUB_TOKEN` is missing. Local development intentionally permits a missing token so home testing stays simple.

Do not put the token in a Feishu prompt, document, or chat message. Store it only in the WorkHub runtime environment and Hermes MCP configuration.

## Hermes Operating Rules

Copy this into the Hermes agent's WorkHub skill or system instructions:

```text
You are the WorkHub project assistant. Convert Feishu natural-language requests into structured WorkHub records through the workhub MCP tools.

Rules:
1. WorkHub is a personal project control tower, not a full chat archive or enterprise task system. Record only important projects, milestones, work items, key logs, decisions, risks, blockers, members, links, and follow-up action items.
2. Before any write, identify the project. Use search_project first when the project identity is not already exact.
3. If any tool returns needsConfirmation=true, show the candidate names and IDs and ask the user to choose. Do not continue writing.
4. Use YYYY-MM-DD for every date. Do not guess a missing year, owner, deadline, project, or status; ask a short follow-up question.
5. Use create_project_log for decisions, risks, blockers, issues, change records, and important meeting conclusions. Set reportable=true for decisions, risks, blockers, issues, or when the user explicitly asks for reportable content.
6. Use create_work_item_with_actions when the user requests one work item with several to-dos. Use complete_action_item when a to-do is finished. Use close_work_item only when the user explicitly says to close/finish the work item.
7. Never call a delete operation. There are no delete tools in the WorkHub MCP server.
8. For a daily, weekly, or date-range report request, call the matching facts tool and summarize only returned facts. Do not invent management conclusions.
9. Finish every Feishu response with a short confirmation: project, objects created/updated, status or due date, and any unresolved follow-up.
```

## Recommended Feishu Flows

### Milestone change and new member

User message:

```text
XX 项目的 150 版本发布日期改到 2026-08-01，新增张三负责测试协调。
```

Hermes flow:

```text
search_project -> list_project_milestones -> update_project_milestone -> create_project_member
```

### Create a release item and action items

User message:

```text
在 XX 项目建事项：150 版本发布，截止 2026-08-01；待办是准备发布清单、确认测试报告、通知业务方。
```

Hermes flow:

```text
search_project -> create_work_item_with_actions
```

### Forward a change requiring a decision

User message:

```text
这条转发是 XX 项目的需求变更，需要决策，记录并跟踪完成。
```

Hermes flow:

```text
search_project -> create_log_with_followup_action
```

Use `type=decision` or `type=change` according to the actual content. For a decision, set `reportable=true`.

### Record a decision from meeting minutes

User message:

```text
把这份 XX 项目会议纪要中的决策事项理解后，记录成一条可汇报的决策日志。
```

Hermes flow:

```text
search_project -> create_project_log(type=decision, reportable=true)
```

### Ask for progress or a report

```text
XX 项目当前有哪些阻塞和未完成待办？
```

```text
list_work_items -> list_action_items -> list_work_logs
```

```text
给我本周 WorkHub 的事实包。
```

```text
get_weekly_facts
```

## Smoke Tests

First confirm the endpoint is up:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:3000/api/integrations/hermes/workhub" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"tool":"health"}'
```

The response must contain `service: workhub-hermes-v1` and the V1 tools.

Then test read-only behavior in Hermes:

```text
请调用 workhub:get_workhub_overview，告诉我当前 WorkHub 的项目数、阻塞事项和未完成待办数。
```

Finally, use a disposable test project to verify a write and completion loop:

```text
1. create_work_item_with_actions
2. list_action_items
3. complete_action_item
4. get_work_item
```

## Source Files

- `src/app/api/integrations/hermes/workhub/route.ts`: WorkHub HTTP tool endpoint and safety rules.
- `scripts/hermes-workhub-mcp.mjs`: WSL Hermes MCP server registration target.
- `.env.example`: production token variable.
