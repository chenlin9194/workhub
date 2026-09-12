# WorkHub V3 执行进度账本

> 项目：`D:\个人web`
>
> 用途：记录每个 Phase 的真实执行结果、数据库基线、已知风险和下一步。任何新的 Codex 会话在执行 WorkHub V3 前，必须同时阅读：
>
> 1. `AGENTS.md`
> 2. `docs/workhub-v3-deployment-plan.md`
> 3. `docs/workhub-v3-progress.md`
>
> 本文件记录事实状态；部署计划记录目标与规则。若两者冲突，停止执行并报告，不得自行猜测。

---

## 当前状态

- 当前阶段：**Phase 1 已完成（PASS）**
- 下一阶段：**Phase 2：WBS fake WorkItem 清理（等待用户确认）**
- Phase 2：**尚未开始；本轮未自动进入**
- 当前分支：`main`
- 当前 HEAD：`e037137 feat: improve project cockpit and WBS execution`
- 当前 Git dirty：
  - `D docs/hermes-workhub-v1.md`
  - `M package.json`
  - `M prisma/schema.prisma`
  - `M src/lib/types.ts`
  - `M tests/workItemChangeLog.test.ts`
  - `?? docs/workhub-v3-deployment-plan.md`
  - `?? docs/workhub-v3-progress.md`
  - `?? scripts/migrate-v3-phase1.mjs`
- 用户已有 dirty 改动不得覆盖或恢复。

---

# Phase 0：基线审计与备份

## RESULT

PASS_WITH_BLOCKER

Phase 0 本身完成且数据库备份可恢复，但发现真实数据库与 Prisma schema 存在历史漂移。该漂移必须通过 Phase 0.5 独立解决后，才能进入 V3 schema 迁移。

## BASELINE

- 项目：`D:\个人web`
- 分支：`main`
- HEAD：`e037137 feat: improve project cockpit and WBS execution`
- Phase 0 未修改 Prisma schema、业务代码或业务数据
- 未删除/迁移数据
- 未执行 commit、push、reset、restore、stash、rebase
- Phase 0 仅新增数据库备份文件

## DATABASE BACKUP

执行：

```text
npm.cmd run db:backup
```

备份文件：

```text
D:\个人web\.workhub\backups\workhub-2026-09-11T15-38-04-401Z.db
```

- 大小：475,136 bytes
- SHA-256：`C31DF555C2990D076CBEEEB635B3AF7C62BCEA20B586DFCB30B244B7A49884BD`
- 项目备份脚本内部完整性校验通过

## RESTORE CHECK

执行：

```text
npm.cmd run db:restore-check -- D:\个人web\.workhub\backups\workhub-2026-09-11T15-38-04-401Z.db
```

结果：

```text
Backup verified: projects=2, items=15, logs=29
```

额外只读校验：

- 实时库与备份的 13 个现有表计数完全一致
- 实时库、备份库 `integrity_check=ok`
- 实时库、备份库 `foreign_key_check` 均无违规

## SCHEMA–DATABASE DRIFT

Phase 0 发现：

- schema 声明 `IdempotencyOperation`，真实数据库无该表
- schema 声明 `ProjectWbsNode.removedAt`、`removalReason`，真实数据库缺少这两列
- 实测 WBS 查询 `removedAt` 直接失败

Phase 0 未修复这些问题。

## DATA INVENTORY

| 数据项 | 数量 |
| --- | ---: |
| Project | 2 |
| ProjectMilestone | 12 |
| WorkItem | 15 |
| WBS fake gate WorkItem | 6 |
| ActionItem | 38 |
| `ActionItem.workLogId` 非空 | 0 |
| `ActionItem.doneNote` 非空 | 29 |
| WorkLog | 29 |
| `WorkLog.reportable=true` | 21 |
| 孤立 WorkLog（`itemId` 与 `projectId` 均为空） | 0 |
| ProjectLink | 3 |
| ProjectMember | 18 |
| WbsTemplate | 1 |
| WbsTemplateNode | 199 |
| ProjectWbsPlan | 1 |
| ProjectWbsNode | 157 |
| ProjectWbsDeliverable | 146 |
| ToolLink | 4 |

## REAL DATA SHAPE

- 项目为 `tOS17.1`、`tOS16.3`
- 12 个里程碑中有 6 个 STR：STR1、STR2、STR3、STR4、STR4A、STR5
- 6 个明确 fake WorkItem：
  - `[STR1] 节点准备与评审`
  - `[STR2] 节点准备与评审`
  - `[STR3] 节点准备与评审`
  - `[STR4] 节点准备与评审`
  - `[STR4A] 节点准备与评审`
  - `[STR5] 节点准备与评审`
- 6 个 fake WorkItem 均满足：
  - `managedBy="wbs"`
  - `executionMilestoneId` 非空
  - 来源 WBS 节点 `kind="gate"`
  - 当前均无 ActionItem、无 WorkLog
- 当前数据库未发现普通 WBS task split 生成的 WorkItem
- ActionItem：37 条已完成、1 条 pending；全部已有 WorkItem、项目和 dueDate
- 29 条非空 `doneNote` 包含会议结论、决策结果、文档链接等人工事实，不能直接丢弃
- WorkLog：29 条全部关联 WorkItem
- 25 条 WorkLog 没有直接 `projectId`
  - 其中 19 条可通过 WorkItem 的项目关系推导
  - 另有 6 条所属事项本身没有项目
- 21 条日志标题为系统生成的“事项变化：…”格式
- 日志来源主要为 manual
- 日志类型主要为 update
- 未发现空标题或空内容日志

## LEGACY RELATION RISKS

### 1. WBS fake WorkItem

后续不能通过 `originWbsNodeId` 单独判断删除，因为普通 WBS task split 也会使用该字段。

清理必须至少满足：

```text
managedBy="wbs" AND executionMilestoneId IS NOT NULL
```

并再次验证没有人工 ActionItem / WorkLog。

### 2. ActionItem → WorkLog

- 当前 `workLogId` 实际使用数为 0
- 但代码仍允许 WorkLog → ActionItem 创建路径
- 29 条 `doneNote` 是真实人工事实，Phase 1 必须先迁移为 ActionItem WorkLog

### 3. WorkLog 项目归属

- 25 条日志直接 `projectId` 为空
- 19 条可从 WorkItem 推导项目
- 6 条属于项目外 WorkItem
- 不能将项目外日志误归入任意 Project

### 4. reportable

- `reportable=true`：21 条
- `reportable=false`：8 条
- 该字段仍被日志、报表、项目页、Hermes API 多处使用
- 产品概念最终退休，但必须在兼容迁移后进行

### 5. Schema–DB 漂移

WBS 服务代码已经依赖 `removedAt` / `removalReason`，数据库却缺少字段；`IdempotencyOperation` 也缺表。

必须先做 Phase 0.5，不能把漂移修复和 V3 schema 迁移混为一次数据库变更。

## MIGRATION NOTES CONFIRMED BY PHASE 0

- Phase 1 先建立兼容层，不直接删旧字段
- WorkItem 增加 STR / ProjectMilestone 关系
- WorkLog 增加 `note` 和 ActionItem 关系，同时保留 legacy 字段
- 29 条 `doneNote` 后续迁移为 ActionItem WorkLog，保留全部原始人工信息
- `workLogId` 当前无真实数据，但代码路径仍需兼容审查后退休
- WBS fake WorkItem 清理前重新备份并再次验证 ID/title/人工数据
- Hermes / MCP 仍依赖 legacy `reportable` / `workLogId` / `doneNote` 相关语义，需要兼容审查

---

# Phase 0.5：Schema–DB 基线对齐

## RESULT

PASS

仅将真实数据库对齐到当前 HEAD 与当前未修改 Prisma schema 定义的稳定基线。未引入任何 V3 新字段、新 relation 或业务行为。

## PHASE

Phase 0.5：Schema–DB 基线对齐

## PRE-CHANGE BACKUP

Phase 0 备份仍然存在且 restore check 通过。执行 Phase 0.5 前重新创建 pre-0.5 备份：

```text
D:\个人web\.workhub\backups\workhub-2026-09-12T03-25-21-430Z.db
```

执行：

```text
npm.cmd run db:backup
npm.cmd run db:restore-check -- D:\个人web\.workhub\backups\workhub-2026-09-12T03-25-21-430Z.db
```

实际 restore check 结果：

```text
Backup verified: projects=2, items=15, logs=29
```

## DRIFT SCOPE CONFIRMED

执行只读 schema diff，确认差异严格限定为：

- `ProjectWbsNode.removalReason`：新增列
- `ProjectWbsNode.removedAt`：新增列
- `IdempotencyOperation`：新增表
- `IdempotencyOperation_state_idx`：新增索引
- `IdempotencyOperation_scope_operationId_key`：新增唯一索引

未发现删除表、删除列或其他未识别结构差异；未出现 destructive change 预警。

这些对象均属于 Phase 0 已确认的历史能力：WBS 服务已经使用 `removedAt` / `removalReason`，幂等创建路径已经依赖 `IdempotencyOperation`。没有加入 V3 `milestoneId`、`note`、`actionItemId` 等新结构。

## SCHEMA-DB ALIGNMENT

执行：

```text
npm.cmd run db:push
```

结果：

```text
Your database is now in sync with your Prisma schema. Done in 54ms
Prisma Client generated successfully
```

未执行任何数据删除、数据迁移或业务代码绕过。

对齐后只读 schema diff 为空迁移：

```text
-- This is an empty migration.
```

## DATA COUNT BEFORE / AFTER

| 数据项 | 对齐前 | 对齐后 |
| --- | ---: | ---: |
| Project | 2 | 2 |
| ProjectMilestone | 12 | 12 |
| WorkItem | 15 | 15 |
| WBS fake gate WorkItem | 6 | 6 |
| ActionItem | 38 | 38 |
| `ActionItem.workLogId` 非空 | 0 | 0 |
| `ActionItem.doneNote` 非空 | 29 | 29 |
| WorkLog | 29 | 29 |
| `WorkLog.reportable=true` | 21 | 21 |
| 孤立 WorkLog | 0 | 0 |
| ProjectWbsNode | 157 | 157 |
| IdempotencyOperation | 不存在 | 0 |

未修改 fake WorkItem、`doneNote` 或 `reportable`。

## WBS READ CHECK

PASS。

- `ProjectWbsNode.removedAt` 存在
- `ProjectWbsNode.removalReason` 存在
- WBS 查询 `removedAt` 不再报错
- 6 个 `[STRx] 节点准备与评审` 仍完整存在

## DATABASE INTEGRITY

PASS。

- 实时数据库 `PRAGMA integrity_check`：`ok`
- 实时数据库 `PRAGMA foreign_key_check`：无违规
- `IdempotencyOperation` 表结构与当前 schema 一致
- `IdempotencyOperation` 两个业务索引已存在

## VERIFICATION

全部通过：

```text
npm.cmd run typecheck  PASS
npm.cmd run test       PASS — 17 test files passed, 1 skipped; 63 tests passed, 9 skipped
npm.cmd run lint       PASS
npm.cmd run build      PASS
```

## POST-ALIGNMENT BACKUP

执行：

```text
npm.cmd run db:backup
npm.cmd run db:restore-check -- D:\个人web\.workhub\backups\workhub-2026-09-12T03-27-07-652Z.db
```

正式迁移前干净基线备份：

```text
D:\个人web\.workhub\backups\workhub-2026-09-12T03-27-07-652Z.db
```

restore check：

```text
Backup verified: projects=2, items=15, logs=29
```

## KNOWN RISKS

- `IdempotencyOperation` 当前为空表；后续创建事项的幂等路径现在具备所需结构，但未改变业务逻辑。
- 6 个 WBS fake WorkItem 未清理；WBS fake 清理属于 Phase 2，不能在本阶段执行。
- `ActionItem.doneNote`、`ActionItem.workLogId`、`WorkLog.reportable` 均保持原状，相关迁移属于后续阶段。
- Hermes/MCP legacy contract 未修改；后续任何字段退休前仍需完成兼容审查。

## PHASE 1 READINESS

PASS_WITH_USER_CONFIRMATION。

数据库已与当前 schema 对齐，Phase 0.5 验收通过。Phase 1 可以在用户明确确认后开始；本次未自动进入 Phase 1。

## GIT STATUS

```text
D docs/hermes-workhub-v1.md
?? docs/workhub-v3-deployment-plan.md
?? docs/workhub-v3-progress.md
```

未修改、恢复或处理 `docs/hermes-workhub-v1.md`。

---

# Phase 1：数据模型兼容层

## RESULT

PASS

Phase 1 已完成。当前数据库已恢复到“当前 HEAD + 当前 Phase 1 Prisma schema”定义的兼容基线；未进入 Phase 2。

## WHAT CHANGED

- `WorkLog.note` 已增加为 nullable 字段 `String?`，历史日志未被写入空默认值。
- `WorkItem.milestoneId` 已增加为 nullable 字段，并使用独立 relation name `WorkItemMilestone` 指向 `ProjectMilestone`。
- 现有 `executionMilestoneId / WbsExecutionMilestone` 未修改，WBS execution relation 与普通事项 → STR relation 保持区分。
- ActionItem 与 WorkLog 的两套关系已显式命名：
  - `LegacyActionItemSourceLog`：保留旧 `ActionItem.workLogId → WorkLog` 创建来源关系。
  - `ActionItemProgressLogs`：新增 `WorkLog.actionItemId → ActionItem` progress logs 关系。
- 新增幂等迁移命令 `npm.cmd run db:migrate:phase1`。
- 仅为新增 schema 字段补齐了现有测试夹具的 `milestoneId: null`；未修改业务逻辑、WBS fake WorkItem 行为、日志页面、ActionItem UI 或汇报。

## DATA MIGRATION

迁移前先执行了数据库备份和 restore-check：

```text
D:\个人web\.workhub\backups\workhub-2026-09-12T03-31-55-275Z.db
Backup verified: projects=2, items=15, logs=29
```

首次执行 `npm.cmd run db:migrate:phase1`：

```text
WorkLog.note backfilled: 29
ActionItem progress logs created: 29
doneAt fallback count: 0
```

历史 note 规则是确定性的：title 与 content 均有内容时保存为 `title + "\\n" + content`，否则保存唯一非空字段；未静默丢弃 title 或 content。

29 条非空 `ActionItem.doneNote` 均创建为 progress WorkLog，并同时保存：

```text
actionItemId = ActionItem.id
itemId = ActionItem.workItemId
note = 原始 doneNote
workDate = Asia/Shanghai 下的 doneAt 日期
```

legacy `title`、`content`、`type`、`source`、`project`、`projectId`、`module`、`tags`、`reportable`、`sourceUrl` 均按兼容要求填写；未删除或迁移 `doneNote`、`workLogId`、`reportable`。

第二次执行同一命令：

```text
WorkLog.note backfilled: 0
ActionItem progress logs created: 0
Existing progress logs skipped: 29
Final WorkLog count: 58
```

幂等判断使用 `actionItemId + itemId + note`，没有增加额外长期业务字段。

## FILES CHANGED

- `prisma/schema.prisma`
- `src/lib/types.ts`
- `scripts/migrate-v3-phase1.mjs`
- `package.json`
- `tests/workItemChangeLog.test.ts`
- `docs/workhub-v3-progress.md`

用户已有的 `docs/hermes-workhub-v1.md` dirty 状态未处理。

## BEHAVIOR BEFORE / AFTER

| 能力 | Phase 1 前 | Phase 1 后 |
| --- | --- | --- |
| WorkLog 结构化 note | 不存在 | `note String?`，58/58 条已有 note |
| 普通事项关联 STR | 无兼容关系 | `milestoneId` nullable，独立 `WorkItemMilestone` |
| WBS execution 关联 | `executionMilestoneId / WbsExecutionMilestone` | 保持不变 |
| ActionItem progress logs | 无新关系 | `WorkLog.actionItemId` + `ActionItemProgressLogs` |
| legacy ActionItem source log | `workLogId` | 保留且关系名为 `LegacyActionItemSourceLog` |
| ActionItem.doneNote | 29 条非空人工事实 | 原文保留，并各有一条 progress WorkLog |

## VERIFICATION

数据与结构校验全部通过：

```text
Project                         2
ProjectMilestone               12
原始 WorkItem                   15；全部仍存在
原始 ActionItem                38；全部仍存在
原始 WorkLog                   29；全部仍存在
最终 WorkLog                   58
WorkLog.note 非空               58
ActionItem.doneNote 非空        29
progress logs                   29；对应 29 个 ActionItem
doneNote 可恢复                 29/29
doneAt 日期匹配                 29/29
doneAt fallback                 0
WorkLog.reportable=true         21；未改变
项目外事项错误归属 Project       0
历史 legacy 字段被改写           0
PRAGMA integrity_check          ok
PRAGMA foreign_key_check         无违规
schema diff                     空迁移
```

项目原生验证：

```text
npm.cmd run typecheck  PASS
npm.cmd run test       PASS — 17 test files passed, 1 skipped; 63 tests passed, 9 skipped
npm.cmd run lint       PASS
npm.cmd run build      PASS
```

迁移后最终备份及 restore-check：

```text
D:\个人web\.workhub\backups\workhub-2026-09-12T03-41-16-153Z.db
Backup verified: projects=2, items=15, logs=58
```

## KNOWN RISKS

- legacy `WorkLog.title/content/type/source/reportable`、`ActionItem.doneNote`、`ActionItem.workLogId` 均仍保留；旧模型退出和字段收紧不属于本阶段。
- 6 个 `[STRx] 节点准备与评审` WBS fake WorkItem 仍保留，清理属于 Phase 2。
- 当前未重做日志、ActionItem、汇报 UI/API；本阶段只建立数据模型兼容层和迁移脚本。
- Hermes/MCP legacy contract 未修改；`docs/hermes-workhub-v1.md` 的既有 dirty 状态保持不变。

## NEXT PHASE READINESS

PASS_WITH_USER_CONFIRMATION。

Phase 1 验收通过。下一阶段为 Phase 2：WBS fake WorkItem 清理；本轮未执行，需用户明确确认后再开始。

## GIT STATUS

```text
D docs/hermes-workhub-v1.md
M package.json
M prisma/schema.prisma
M src/lib/types.ts
M tests/workItemChangeLog.test.ts
?? docs/workhub-v3-deployment-plan.md
?? docs/workhub-v3-progress.md
?? scripts/migrate-v3-phase1.mjs
```

未执行 commit、push、reset、restore、stash、rebase；未处理 `docs/hermes-workhub-v1.md`。
