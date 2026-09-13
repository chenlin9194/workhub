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

- 当前阶段：**Phase 6.1 已完成（PASS）**
- 下一阶段：**Phase 6.2：Home Cockpit（等待用户确认）**
- Phase 5：**已完成；Phase 5.5.1 与 Phase 6.1 已完成，本轮未进入 Phase 6.2**
- 当前分支：`main`
- 当前 HEAD：`74cb51c docs: add WorkHub V3 Phase 6 design plan`
- 当前 Git dirty：
  - `D docs/hermes-workhub-v1.md`
  - `M docs/workhub-v3-progress.md`
  - `M src/app/globals.css`
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

---

# Phase 3：事项 → 行动项 → 日志主链路

## RESULT

PASS

Phase 3 已完成并验证通过。本轮只实现 `WorkItem → ActionItem → WorkLog` 主链路，未进入 Phase 4；未修改 Prisma schema、旧日志字段、汇报聚合或 Hermes/MCP contract。

## WHAT CHANGED

- 新建 ActionItem 的 API 与事项内 UI 必须提供 `workItemId`；项目关系从父 WorkItem 推导，若请求显式项目与父事项不一致则拒绝。
- 从 WorkLog 创建新 ActionItem 的 UI 已移除，`createWorkLogWithContext` 对新的 `actionItems` 输入拒绝；legacy `workLogId` 字段和历史数据保留。
- 新增 ActionItem progress log API：`POST /api/action-items/[id]/progress`。日志写入 `workDate`、`note`、`actionItemId`、父事项 `itemId`，并填充 legacy title/content/type/source/project/module/tags/reportable/sourceUrl 字段。
- 普通“记录进展”只创建日志，不改变 ActionItem、WorkItem 的状态及其他管理字段。
- 新增逾期调整计划事务 API：`POST /api/action-items/[id]/reschedule`。逾期未完成事项必须提供原因和下一步，事务内同时更新 dueDate 和创建 progress WorkLog。
- 新增完成事务 API：`POST /api/action-items/[id]/complete`。事务内写入 `status=done`、`doneAt`；填写完成结果时同时创建 ActionItem progress WorkLog，并继续兼容写入 `doneNote`。
- ActionItemSection 改为轻量原地交互：记录进展、调整计划、完成、编辑；显示负责人、截止日期、状态和最近进展。逾期且原截止日期之后没有 ActionItem progress log 时动态显示“已逾期 · 缺少延期说明”。
- 事项详情时间线合并事项自身 WorkLog 与所有 ActionItem progress WorkLog，并用“事项记录 / 行动项 · …”区分来源；同一条同时拥有 itemId/actionItemId 的迁移日志只显示一次。

## DATA MIGRATION

本阶段没有 schema/data migration。开始前已执行备份和 restore-check：

```text
D:\个人web\.workhub\backups\workhub-2026-09-12T07-45-56-022Z.db
Backup verified: projects=2, items=9, logs=58
```

真实接口场景验收使用了带 `[Phase3验收]` 标记的临时事项、两个临时 ActionItem 和三条临时 progress logs。验证完成后先删除临时 ActionItem/WorkItem，再按精确日志 ID 删除残留的三条测试日志；未触碰历史业务数据。最终标记日志数量为 0。

## FILES CHANGED

- `src/app/api/action-items/route.ts`
- `src/app/api/action-items/[id]/route.ts`
- `src/app/api/action-items/[id]/progress/route.ts`
- `src/app/api/action-items/[id]/reschedule/route.ts`
- `src/app/api/action-items/[id]/complete/route.ts`
- `src/app/api/items/[id]/route.ts`
- `src/app/logs/[id]/page.tsx`
- `src/components/ActionItemSection.tsx`
- `src/components/Timeline.tsx`
- `src/lib/actionItemWorkflow.ts`
- `src/lib/recordingTransaction.ts`
- `tests/actionItemApi.test.ts`
- `tests/actionItemWorkflow.test.ts`
- `tests/recordingTransaction.test.ts`
- `docs/workhub-v3-progress.md`

未修改 `prisma/schema.prisma`；未处理用户已有 deleted dirty 文件 `docs/hermes-workhub-v1.md`。

## BEHAVIOR BEFORE / AFTER

| 能力 | Phase 3 前 | Phase 3 后 |
| --- | --- | --- |
| 新建 ActionItem | 可仅关联 WorkLog | 必须关联 WorkItem，项目从 WorkItem 推导 |
| WorkLog → ActionItem | 旧复合入口仍可创建 | 新 UI/API 使用路径失效，legacy schema 保留 |
| ActionItem 进展 | 无清晰主链 API | 独立 progress API，双归属字段可追溯 |
| 记录普通进展 | 交互不清晰 | 只创建日志，状态不自动变化 |
| 逾期改期 | 仅改日期 | 原因/下一步必填，并与日志同事务提交 |
| 完成 ActionItem | 依赖 doneNote 更新 | done/doneAt 与可选完成日志同事务提交 |
| 事项时间线 | 只显示事项自身日志 | 合并事项日志和行动项日志，来源可区分且去重 |
| legacy 字段 | 保留 | `doneNote`、`workLogId`、`reportable`、WorkLog legacy 字段继续保留 |

## VERIFICATION

测试与构建：

```text
npm.cmd run typecheck  PASS
npm.cmd run test       PASS — 19 test files passed, 1 skipped; 75 tests passed, 9 skipped
npm.cmd run lint       PASS
npm.cmd run build      PASS
```

新增/调整测试覆盖：

- 无 `workItemId` 创建 ActionItem 失败；WorkLog-only 新建路径失败。
- ActionItem 项目关系从父 WorkItem 正确推导。
- progress log 的 `actionItemId`、`itemId`、note 和 legacy 字段正确写入。
- 普通进展不调用 ActionItem 更新。
- 逾期改期原因/下一步缺失时拒绝；成功时日期和日志在同一事务回调中提交，日志失败会向外抛出以触发回滚。
- 完成时写入 done、doneAt 和可选完成日志。
- Phase 1 历史 progress logs 仍能通过事项详情/ActionItem 查询读取。
- WBS fake WorkItem 仍为 0。

数据库最终校验：

```text
Project                         2
ProjectMilestone               12
WorkItem                        9
ActionItem                     38
WorkLog                        58
ProjectWbsNode                157
ProjectWbsDeliverable         146
Phase 1 progress logs          29
Phase 2 WBS fake WorkItem       0
PRAGMA integrity_check          ok
PRAGMA foreign_key_check        无违规
schema diff                     空迁移
测试标记临时日志               0
```

人工验收（真实本地 API + 事项详情页面读取）PASS：创建临时事项和 ActionItem；普通进展后状态保持 pending；逾期调整同时生成包含原因/下一步的日志；完成后写入 done、doneAt 和完成日志；事项接口返回统一日志；刷新事项详情后时间线显示行动项来源且不重复；临时数据已安全清理。

最终数据库备份及 restore-check：

```text
D:\个人web\.workhub\backups\workhub-2026-09-12T08-02-04-435Z.db
Backup verified: projects=2, items=9, logs=58
```

## KNOWN RISKS

- `ActionItem.workItemId` 在 Prisma schema 中仍为 nullable，以兼容历史记录；V3 新入口已强制要求，旧数据仍需后续清理评估。
- `doneNote`、`workLogId`、`reportable` 及 WorkLog legacy 字段仍保留；字段退休属于后续 legacy cleanup，不在本阶段处理。
- 事项时间线仍复用旧日志详情链接和 type 展示，只新增来源标识；完整日志页面/汇报聚合重构属于 Phase 4 及以后。
- 删除临时父事项时，现有删除语义会解除日志关联而保留日志；本轮已识别该行为并通过精确测试日志 ID 完成清理，后续如需改变保留策略应单独设计。

## NEXT PHASE READINESS

PASS_WITH_USER_CONFIRMATION。

Phase 3 验收通过。下一阶段为 Phase 4：Report Aggregator V3；本轮未执行，需用户明确确认后再开始。

## GIT STATUS

```text
 D docs/hermes-workhub-v1.md
 M docs/workhub-v3-progress.md
 M src/app/api/action-items/route.ts
 M src/app/api/action-items/[id]/route.ts
?? src/app/api/action-items/[id]/complete/route.ts
?? src/app/api/action-items/[id]/progress/route.ts
?? src/app/api/action-items/[id]/reschedule/route.ts
 M src/app/api/items/[id]/route.ts
 M src/app/api/projects/[id]/wbs/nodes/[nodeId]/route.ts
 M src/app/logs/[id]/page.tsx
 M src/app/items/[id]/page.tsx
 M src/components/ActionItemSection.tsx
 M src/components/Timeline.tsx
?? src/lib/actionItemWorkflow.ts
 M src/lib/recordingTransaction.ts
 M src/components/WbsGateClient.tsx
 M src/components/WbsOverviewClient.tsx
 M src/lib/wbs/service.ts
?? tests/actionItemApi.test.ts
?? tests/actionItemWorkflow.test.ts
 M tests/recordingTransaction.test.ts
 M tests/wbsInitializationRetention.test.ts
 M tests/wbsTransaction.test.ts
```

未执行 commit、push、reset、restore、stash、rebase；未处理 `docs/hermes-workhub-v1.md`。

---

# Phase 2：WBS fake WorkItem 清理

## RESULT

PASS

Phase 2 已完成。WBS gate 不再自动创建或同步 `[STRx] 节点准备与评审` WorkItem；本轮未进入 Phase 3。

## PRE-DELETE BACKUP

删除前执行了实时数据库备份与 restore-check：

```text
D:\个人web\.workhub\backups\workhub-2026-09-12T05-52-08-304Z.db
Backup verified: projects=2, items=15, logs=58
```

## DELETION CANDIDATES

删除前重新读取实时数据库。候选集合数量为 6，且全部满足：`managedBy="wbs"`、`executionMilestoneId IS NOT NULL`、来源 WBS 节点 `kind="gate"`、ActionItem=0、WorkLog=0，标题/描述/sourceSystem/sourceId 与 gate execution item 证据一致。

| id | title | projectId | executionMilestoneId | originWbsNodeId | origin kind | ActionItem | WorkLog |
| --- | --- | --- | --- | --- | --- | ---: | ---: |
| `cmrvr1ket00gxs1ukccypg21w` | `[STR1] 节点准备与评审` | `cmqz4m9gg0000s1douq1oyfby` | `cmr8otmd90007s1vk34lykeks` | `cmrvr1k5w000ls1uksklg6uw1` | `gate` | 0 | 0 |
| `cmrvr1kew00gzs1uk37qkfxyp` | `[STR2] 节点准备与评审` | `cmqz4m9gg0000s1douq1oyfby` | `cmr8otzrw0009s1vkp00gvtzf` | `cmrvr1k6b0015s1ukitq42dj8` | `gate` | 0 | 0 |
| `cmrvr1kez00h1s1ukvefychds` | `[STR3] 节点准备与评审` | `cmqz4m9gg0000s1douq1oyfby` | `cmr8oubct000bs1vk1x1tnyiu` | `cmrvr1k6g001fs1uk6oqjdzcg` | `gate` | 0 | 0 |
| `cmrvr1kf200h3s1ukap52naqd` | `[STR4] 节点准备与评审` | `cmqz4m9gg0000s1douq1oyfby` | `cmr8ove7g000fs1vk0b14d56y` | `cmrvr1k6q001ts1uktr2jlo8l` | `gate` | 0 | 0 |
| `cmrvr1kf500h5s1uk6bcc5qup` | `[STR4A] 节点准备与评审` | `cmqz4m9gg0000s1douq1oyfby` | `cmr8ovve5000hs1vk63ehopjr` | `cmrvr1k6z0025s1uk32j0g314` | `gate` | 0 | 0 |
| `cmrvr1kf800h7s1ukscz5gkpm` | `[STR5] 节点准备与评审` | `cmqz4m9gg0000s1douq1oyfby` | `cmr8ow9ug000js1vkkdk2klpe` | `cmrvr1k73002bs1uk80yquup7` | `gate` | 0 | 0 |

候选集合通过后，使用上述精确 ID 集合删除，实际删除数量为 **6**。未使用宽泛条件删除普通 WorkItem。

## CODE CHANGES

- `initializeProjectWbs` 保留 WBS plan/node/deliverable 初始化和 ProjectMilestone gateKey 绑定，不再创建或更新 gate execution WorkItem。
- `generatedExecutionItemData()` 已删除。
- `syncWbsDerivedState` 继续计算 readiness 和 ProjectMilestone.status，不再查询或更新 execution WorkItem 的 status、health、nextAction、closedAt。
- `ProjectMilestone.actualDate` 与 `actualEndDate` 在 done 时同步设置，在 reopen 时同步清除；既有里程碑状态行为保持。
- `getProjectWbsSummary` 不再读取 `executionWorkItem`。
- WBS 页面仅做最小文案调整，明确 STR 事项由人工管理。
- `splitWbsNodeIntoWorkItem()` 保留，普通 `kind="task"` 仍可拆分为 WorkItem，并保留 `originWbsNodeId`。
- 未删除 `executionMilestoneId`、`executionMilestone`、`managedBy`、`originWbsNodeId` 等 legacy schema 字段。

## DATA COUNT AFTER DELETE

| 数据项 | 删除前 | 删除后 |
| --- | ---: | ---: |
| Project | 2 | 2 |
| ProjectMilestone | 12 | 12 |
| WorkItem | 15 | 9 |
| WBS fake gate WorkItem | 6 | 0 |
| ActionItem | 38 | 38 |
| WorkLog | 58 | 58 |
| ProjectWbsNode | 157 | 157 |
| ProjectWbsDeliverable | 146 | 146 |

ActionItem、WorkLog、ProjectMilestone、ProjectWbsNode、ProjectWbsDeliverable 的 ID 集合均与删除前备份一致。

## REGRESSION VERIFICATION

新增/调整测试覆盖：

- 初始化 WBS 不创建 `[STRx] 节点准备与评审`，不产生 `managedBy="wbs" + executionMilestoneId` gate WorkItem。
- 重新初始化已有 WBS 不恢复已清理的 fake WorkItem。
- 更新 WBS node 仍正确计算 readiness 和 ProjectMilestone.status。
- done 时 `actualDate / actualEndDate` 正确同步，reopen 时正确清除。
- WBS task split 仍创建普通 WorkItem，保留 `originWbsNodeId`，且不设置 `executionMilestoneId`。

项目原生验证：

```text
npx prisma validate   PASS
schema diff            空迁移
npm.cmd run typecheck  PASS
npm.cmd run test       PASS — 17 test files passed, 1 skipped; 66 tests passed, 9 skipped
npm.cmd run lint       PASS
npm.cmd run build      PASS
```

数据库验证：

```text
fake WorkItem remaining  0
PRAGMA integrity_check   ok
PRAGMA foreign_key_check  无违规
```

## POST-PHASE BACKUP

执行了最终数据库备份及 restore-check：

```text
D:\个人web\.workhub\backups\workhub-2026-09-12T05-59-06-041Z.db
Backup verified: projects=2, items=9, logs=58
```

## FILES CHANGED

- `src/lib/wbs/service.ts`
- `src/app/api/projects/[id]/wbs/nodes/[nodeId]/route.ts`
- `src/components/WbsGateClient.tsx`
- `src/components/WbsOverviewClient.tsx`
- `tests/wbsInitializationRetention.test.ts`
- `tests/wbsTransaction.test.ts`
- `docs/workhub-v3-progress.md`

## KNOWN RISKS

- legacy execution relation字段仍保留，仅停止运行时自动创建和同步；最终 schema cleanup 不属于本阶段。
- WBS task split 仍会创建普通 WorkItem；后续必须继续区分 task split 与 gate fake。
- `ActionItem.doneNote`、`workLogId`、`reportable` 仍处于兼容阶段，未在本阶段处理。
- Hermes/MCP legacy contract 未修改；`docs/hermes-workhub-v1.md` 的既有 dirty 状态保持不变。

## PHASE 3 READINESS

PASS_WITH_USER_CONFIRMATION。

Phase 2 验收通过。下一阶段为 Phase 3：事项 → 行动项 → 日志主链路；本轮未执行，需用户明确确认后再开始。

## GIT STATUS

```text
 D docs/hermes-workhub-v1.md
 M docs/workhub-v3-progress.md
 M src/app/api/projects/[id]/wbs/nodes/[nodeId]/route.ts
 M src/components/WbsGateClient.tsx
 M src/components/WbsOverviewClient.tsx
 M src/lib/wbs/service.ts
 M tests/wbsInitializationRetention.test.ts
 M tests/wbsTransaction.test.ts
```

未执行 commit、push、reset、restore、stash、rebase；未处理 `docs/hermes-workhub-v1.md`。


---

# Phase 4：Report Aggregator V3

## RESULT

PASS

Phase 4 已完成并验证通过。本轮只替换汇报与导出的状态桶式事实包为统一的 `Project → STR/里程碑 → WorkItem → ActionItem → WorkLog` 聚合；未进入 Phase 5，未执行 schema/data migration。

## WHAT CHANGED

- 新增 `src/lib/reportAggregator.ts`，提供可测试的 `buildReportAggregate` 纯构建层和数据库 `aggregateReport` 查询层，输入为 `startDate`、`endDate`、可选 `projectId`。
- 聚合严格按 WorkItem 的 `milestoneId` 归属 STR/里程碑；`milestoneId` 为空的事项进入“未归属 STR / 项目级事项”，不根据标题推断。
- 时间范围基于 `WorkLog.workDate`，同时纳入事项记录、ActionItem progress logs、区间内完成的 ActionItem、当前开放 ActionItem 上下文和延期/计划调整日志；不再以 `updatedAt` 作为主体。
- 事项日志与 ActionItem 日志按真实 WorkLog ID 去重；Phase 1 的 29 条 `actionItemId` 日志继续可读，且不因 `reportable=false` 被过滤。
- 历史系统日志按标题规则确定性识别，保留在聚合数据和数据库中但不展开为正文；ActionItem progress logs 不按该规则降级。
- `/reports` 支持今天、本周、本月、自定义范围和项目筛选，按层级展示当前状态、ActionItem 状态/负责人/截止日期及最近进展。
- `/export/today`、`/export/range` 及对应 API 和 Markdown generator 统一使用同一聚合结果；`scripts/export-today.mjs`、`scripts/export-week.mjs` 均实际运行成功。旧 reportable/legacy 字段未删除，Hermes/MCP contract 未修改。
- 移除旧的今日/区间独立状态桶 Markdown 生成算法；项目快照 Markdown 保持兼容。

## DATA MIGRATION

无。Phase 4 未修改 `prisma/schema.prisma`，未写入、删除或迁移业务数据。

开始前备份及恢复校验：

```text
D:\个人web\.workhub\backups\workhub-2026-09-12T08-12-47-904Z.db
Backup verified: projects=2, items=9, logs=58
```

最终备份及恢复校验：

```text
D:\个人web\.workhub\backups\workhub-2026-09-12T08-32-11-888Z.db
Backup verified: projects=2, items=9, logs=58
```

## FILES CHANGED

- `docs/workhub-v3-progress.md`
- `src/app/api/export/range/route.ts`
- `src/app/api/export/today/route.ts`
- `src/app/export/range/page.tsx`
- `src/app/export/today/page.tsx`
- `src/app/reports/page.tsx`
- `src/lib/export.ts`
- `src/lib/reportAggregator.ts`
- `tests/exportQuality.test.ts`
- `tests/reportAggregator.test.ts`

未修改 Prisma schema、WorkItem/ActionItem/WorkLog 业务写入 API、WBS service、`docs/hermes-workhub-v1.md`。后者继续保持用户原有 deleted dirty 状态。

## BEHAVIOR BEFORE / AFTER

| 项目 | Before | After |
| --- | --- | --- |
| 汇报组织 | 今日新增/关闭/更新/风险等状态桶 | Project → STR/里程碑 → WorkItem → ActionItem → logs |
| 时间口径 | 混用当日日志、`closedAt`、`updatedAt` | 统一按 `workDate`，另显式纳入 ActionItem 完成和开放上下文 |
| STR 归属 | 旧桶不稳定聚合 | 只使用 `milestoneId`；空值明确为项目级事项 |
| 日志来源 | 事项日志和行动项日志可能重复 | 按 WorkLog ID 去重，并显示“事项记录/行动项进展” |
| 系统日志 | 可能混入正文 | 保留且统计，确定性降级，不展开正文 |
| reportable | 汇报入口使用 reportable 过滤 | Phase 4 聚合不读取、不筛选 `reportable` |

真实项目范围验收（`2026-06-22` 至 `2026-07-27`，项目 `tOS17.1`）：项目 1、事项 3、ActionItem 18、日志 25，其中系统变化日志 10 条；报告日志 ID 25/25 唯一。事项 `17.1 规划KO` 在同一事项上下文聚合 12 条事项记录；当前开放 ActionItem“沟通17.1的首发项目”保留状态 `pending`、负责人“孙仁海”和截止日期 `2026-07-24`。该真实范围内 12 条 `reportable=false` 项目日志全部存在于聚合结果。

## VERIFICATION

- `npm.cmd run typecheck`：PASS
- `npm.cmd run test`：PASS，20 个测试文件通过、1 个跳过；80 个测试通过、9 个跳过
- `npm.cmd run lint`：PASS，无 warning/error
- `npm.cmd run build`：PASS
- `npx prisma migrate diff --from-url file:./prisma/dev.db --to-schema-datamodel prisma/schema.prisma`：`No difference detected.`
- `PRAGMA integrity_check`：`ok`
- `PRAGMA foreign_key_check`：`[]`
- 数据库数量：Project 2、ProjectMilestone 12、WorkItem 9、ActionItem 38、WorkLog 58、ProjectWbsNode 157、ProjectWbsDeliverable 146；WBS gate fake WorkItem 0
- Phase 1 历史 progress logs：29 条；历史 `doneNote` 非空记录：29 条
- 旧导出脚本：`npm.cmd run export:today`、`npm.cmd run export:week` 均成功生成 Markdown
- API 实测：项目范围 JSON 与 Markdown 均由同一聚合器生成；系统日志不出现在 Markdown 正文

## REAL DATA ACCEPTANCE

- 已使用真实项目完成至少 3 天范围验收：多条同事项日志归入同一事项，ActionItem 状态/负责人/截止日期可见，日志无重复。
- 当前开放 ActionItem 可在事项上下文中读取。
- `reportable=false` 日志未丢失。
- 系统变化日志仅统计、不压过人工事实；ActionItem progress logs 保持正常正文路径。
- 当前真实数据库没有现成的“计划调整：旧日期 → 新日期”日志，因此未为验收污染真实数据；延期原因/下一步的展示和同一聚合路径由纯构建测试覆盖。

## KNOWN RISKS

- 当前真实库的 9 个 WorkItem 中有 4 个没有 `projectId`；为避免错误归属，Phase 4 的 Project 树不把它们伪装归入任一项目，后续如需汇报项目外事项需另行定义产品口径。
- 当前 12 个 ProjectMilestone 没有被现有真实 WorkItem 通过 `milestoneId` 使用，因此真实项目范围显示“未归属 STR / 项目级事项”；系统没有根据标题猜测 STR。
- `reportable`、`doneNote`、`workLogId` 和其他 legacy 字段仍存在于旧页面/API/Hermes 兼容边界；Phase 4 只让新聚合路径退出 `reportable`，没有提前退休字段。
- 真实数据未包含延期事务样本，延期原因/下一步的端到端页面验收留待实际用户操作时确认；本轮未新增测试数据。

## NEXT PHASE READINESS

PASS_WITH_USER_CONFIRMATION。

Phase 4 验收通过。下一阶段为 Phase 5：核心页面 V3 信息架构；本轮未执行，需用户明确确认后再开始。

## GIT STATUS

```text
 D docs/hermes-workhub-v1.md
 M docs/workhub-v3-progress.md
 M src/app/api/export/range/route.ts
 M src/app/api/export/today/route.ts
 M src/app/export/range/page.tsx
 M src/app/export/today/page.tsx
 M src/app/reports/page.tsx
 M src/lib/export.ts
?? src/lib/reportAggregator.ts
 M tests/exportQuality.test.ts
?? tests/reportAggregator.test.ts
```

未执行 commit、push、reset、restore、stash、rebase；未处理 `docs/hermes-workhub-v1.md`。未进入 Phase 5。

---

# Phase 5：核心页面 V3 信息架构

## RESULT

PASS

Phase 5 已完成并验证通过。本轮只调整核心页面的信息架构和 WorkItem 的真实 STR 归属入口，未进入 Phase 6；未修改 Prisma schema、未迁移或删除数据、未改动 Hermes/MCP contract。

## WHAT CHANGED

- 首页 `/` 收敛为 WorkHub V3 工作台：今日行动、项目当前/下一 STR、最近进展；移除旧 KPI 墙和旧事实桶作为首页主路径。
- 顶部主导航调整为“今日 / 项目 / 事项 / 汇报”；“未归档事实”退出主导航，日志页面和 API 保留兼容。
- 项目详情增加当前/下一 STR 的确定性展示、STR/项目级事项归属提示和 WBS readiness 主路径；STR 归属只读取真实 `WorkItem.milestoneId`，不按标题、日期或类型推断。
- 事项详情显示真实 STR 或“项目级事项（未归属 STR）”，继续保留 ActionItemSection 和事项 + ActionItem progress 的统一时间线。
- 今日页收敛为 ActionItem 处理队列，按已逾期、今日到期、即将到期/未设置日期分组；保留完成交互和事项上下文。
- 事项列表增加项目/STR 及行动进展摘要；新建/编辑事项增加当前项目 STR 选择器，切换项目会清空旧 STR。
- `/api/items`、`/api/items/[id]`、复合新建路径均校验 `milestone.projectId === workItem.projectId`；项目级事项使用 nullable `milestoneId`。
- 新增纯函数测试覆盖合法/跨项目/null STR、项目切换清空以及当前/下一 STR 确定性选择；Phase 3 ActionItem 主链与 Phase 4 汇报测试保持通过。

## DATA MIGRATION

本阶段没有 schema/data migration，没有创建、删除或重归属真实业务数据。

开始前备份及 restore-check：

```text
D:\个人web\.workhub\backups\workhub-2026-09-12T14-47-27-063Z.db
Backup verified: projects=2, items=9, logs=58
```

Phase 5 数据核对：

```text
Project             2
ProjectMilestone   12
WorkItem            9
ActionItem         38
WorkLog            58
ProjectWbsNode    157
Deliverable       146
WBS fake WorkItem   0
integrity_check     ok
foreign_key_check   []
```

## FILES CHANGED

- `docs/workhub-v3-progress.md`
- `src/app/api/items/[id]/route.ts`
- `src/app/api/items/route.ts`
- `src/app/api/projects/[id]/route.ts`
- `src/app/items/[id]/edit/page.tsx`
- `src/app/items/[id]/page.tsx`
- `src/app/items/new/page.tsx`
- `src/app/items/page.tsx`
- `src/app/page.tsx`
- `src/app/projects/[id]/page.tsx`
- `src/app/today/page.tsx`
- `src/components/SidebarNavigation.tsx`
- `src/components/TodayActionQueue.tsx`
- `src/components/redesign/ItemsTable.tsx`
- `src/lib/actionItemQueue.ts`
- `src/lib/projectMilestoneView.ts`
- `src/lib/recordingTransaction.ts`
- `src/lib/workItemMilestone.ts`
- `tests/recordingTransaction.test.ts`
- `tests/workItemMilestone.test.ts`

## BEHAVIOR BEFORE / AFTER

| 场景 | Before | After |
| --- | --- | --- |
| 首页 | KPI、事项关注和事实桶混合 | 今日行动 → 项目 STR → 最近进展 |
| 主导航 | 工作台 + 未归档事实 + 今日行动项 | 今日 / 项目 / 事项 / 汇报 |
| WorkItem STR | 只能看到项目，真实事项基本无法管理 STR 归属 | 新建/编辑按当前项目选择真实 STR；空值明确为项目级事项 |
| 项目详情 | 事项未按 STR 主链呈现 | 当前/下一 STR、WBS readiness、STR/项目级事项上下文可见 |
| 今日 | 日志、事项、风险、决策等多种桶 | ActionItem 队列，按处理时限分组 |
| 事项时间线 | Phase 3 已有统一时间线 | 继续保留事项记录与行动项进展来源区分，无重复展示 |
| WBS | gate 不生成 fake WorkItem | 仍保持 fake WorkItem 为 0，task split 未改动 |

## VERIFICATION

- `npm.cmd run typecheck`：PASS
- `npm.cmd run test`：PASS，21 个测试文件通过、1 个跳过；85 个测试通过、9 个跳过
- `npm.cmd run lint`：PASS
- `npm.cmd run build`：PASS
- `npm.cmd run db:push`：PASS，数据库已与 Prisma schema 同步；停止开发服务器后重新生成 Prisma Client 成功
- `PRAGMA integrity_check`：`ok`
- `PRAGMA foreign_key_check`：`[]`
- `WBS fake WorkItem`：0
- 页面 HTTP smoke：`/`、`/today`、`/projects/cmqz4m9gg0000s1douq1oyfby`、`/items/cmwfake`、`/reports` 均返回 HTTP 200；未为验收创建或修改数据
- 最终备份：

```text
D:\个人web\.workhub\backups\workhub-2026-09-12T15-00-57-414Z.db
Backup verified: projects=2, items=9, logs=58
```

- 最终备份 restore-check：PASS

## REAL DATA ACCEPTANCE

- 真实数据读取确认 2 个项目、12 个 STR、9 个事项、38 个 ActionItem、58 个 WorkLog；当前 9 个事项的 `milestoneId` 为空，因此页面显示为项目级事项/未归属 STR，没有进行推断归属。
- 首页、今日、项目详情、事项详情和汇报入口均完成真实本地服务访问检查；页面检查未写入数据库。
- 事项新建/编辑的合法、跨项目、null STR 规则由 API 复用的纯函数和复合事务测试覆盖；ActionItem/WorkLog Phase 3 行为及 Phase 4 aggregator 测试均未回归。
- 未生成截图文件：本机浏览器自动化状态读取失败，因此未保留截图路径；已用本地服务 HTTP smoke 完成无数据写入的页面可达性检查。

## KNOWN RISKS

- 当前真实 9 个 WorkItem 全部没有 `milestoneId`；Phase 5 不擅自把它们归属到任何 STR，项目详情会诚实显示项目级事项，后续需由用户按真实业务事实维护。
- 项目详情仍保留部分旧信号/元数据组件，Phase 5 只完成主信息架构收口，视觉 token 和 legacy cleanup 留到 Phase 6。
- 旧日志独立页面、legacy WorkLog 字段、`reportable`、`ActionItem.doneNote/workLogId` 仍保留兼容；本轮没有删除或改变这些边界。
- 本轮未完成真实浏览器点击式交互验收，仅完成本地服务页面可达性和不写库的数据核对；需要进入 Phase 6 前，可由用户在浏览器补做一次手工点击确认。

## NEXT PHASE READINESS

PASS_WITH_USER_CONFIRMATION。

Phase 5 验收通过。下一阶段为 Phase 6：视觉系统统一与旧逻辑清理；本轮未执行，需用户明确确认后再开始。

## GIT STATUS

```text
 D docs/hermes-workhub-v1.md
 M docs/workhub-v3-progress.md
 M src/app/api/items/[id]/route.ts
 M src/app/api/items/route.ts
 M src/app/api/projects/[id]/route.ts
 M src/app/items/[id]/edit/page.tsx
 M src/app/items/[id]/page.tsx
 M src/app/items/new/page.tsx
 M src/app/items/page.tsx
 M src/app/page.tsx
 M src/app/projects/[id]/page.tsx
 M src/app/today/page.tsx
 M src/components/SidebarNavigation.tsx
 M src/components/TodayActionQueue.tsx
 M src/components/redesign/ItemsTable.tsx
 M src/lib/actionItemQueue.ts
?? src/lib/projectMilestoneView.ts
 M src/lib/recordingTransaction.ts
?? src/lib/workItemMilestone.ts
 M tests/recordingTransaction.test.ts
?? tests/workItemMilestone.test.ts
```

未执行 commit、push、reset、restore、stash、rebase；未修改或处理 `docs/hermes-workhub-v1.md`；未进入 Phase 6。

---

# Phase 6.1：Design System Foundation

## RESULT

PASS

Phase 6.1 已完成。本轮只建立统一视觉基础，未进入 Phase 6.2/6.3/6.4/6.5，未改变页面信息结构、模块顺序、数据查询或业务逻辑。

## PHASE

Phase 6.1 Design System Foundation

## FILES CHANGED

- `src/app/globals.css`
- `docs/workhub-v3-progress.md`

## DESIGN CHANGES

- 建立统一的 typography token：Page Title、Section Title、Content、Body、Metadata、Caption。
- 建立 4px 基准 spacing token，并统一页面容器、section、card、列表和空状态的间距基线。
- 统一通用 card 的 border、radius、background 和 shadow 基础表现，同时保留 Phase 5.5 页面专用层级规则。
- 统一 success、warning、danger、neutral 四类 badge/entity pill 的尺寸、圆角、文字和状态色基础表现；不改变状态逻辑。
- 统一 `empty-state` 以及首页、项目、汇报页的常见空状态文字层级和留白。
- 正文基础字号提升到 14px，主要内容和 metadata 分别使用 15px 与 13px；未新增 UI framework 或依赖。

## BUSINESS IMPACT

无业务逻辑变化。未修改 API、Report Aggregator、ActionItem workflow、Prisma schema、数据查询或页面信息架构；未写入数据库，未自动归属 STR，未恢复 WBS fake WorkItem。

## DATA VERIFICATION

```text
Project                 2
ProjectMilestone       12
WorkItem                9
ActionItem             38
WorkLog                58
ProjectWbsNode        157
ProjectWbsDeliverable 146
WBS fake WorkItem       0
integrity_check         ok
foreign_key_check       []
schema                  No difference detected.
```

## VERIFICATION

- `npm.cmd run typecheck`：PASS
- `npm.cmd run test`：PASS，21 个测试文件通过、1 个跳过；85 个测试通过、9 个跳过
- `npm.cmd run lint`：PASS
- `npm.cmd run build`：PASS
- Prisma schema diff：`No difference detected.`

## KNOWN RISKS

- 本阶段只统一基础视觉规则，首页、项目、事项和 Reports 的专门体验优化仍分别留给 Phase 6.2–6.5。
- 历史 CSS 规则较多，个别低频页面可能仍存在局部视觉覆盖差异，需后续阶段按页面验收。

## GIT STATUS

```text
 D docs/hermes-workhub-v1.md
 M docs/workhub-v3-progress.md
 M src/app/globals.css
```

未执行 commit、push、reset、restore、stash、rebase；未修改或处理 `docs/hermes-workhub-v1.md`；未进入 Phase 6.2。

## NEXT STEP

Phase 6.1 完成。Phase 6.2 未执行，等待用户确认后再开始。

---

# Phase 5.5.1：Final Layout Fix

## RESULT

PASS_WITH_USER_CONFIRMATION

Phase 5.5.1 已完成。本轮仅修复 Phase 5.5 的四类布局问题，等待用户进行最后一次人工截图验收；未进入 Phase 6。

## ROOT CAUSE

1. 项目详情 STR / WBS 被压缩：旧版三栏 cockpit 规则仍让 `.project-cockpit-v2` 继承固定视口高度和 `overflow: hidden`，自然增长的 STR/WBS 内容被根容器截断。
2. 事项详情右侧大空白：事项页仍受旧的 1320px 宽度上限和级联布局规则约束，主内容网格没有充分利用项目详情同级的可用宽度。
3. Reports 空白过多：项目事实树和 WBS 事实被放在整块外层白色 `.card` 中，内容少时仍保留完整外壳宽度和内边距。
4. 首页最近进展拥挤：事实行的最小高度、上下 padding、标题/摘要行高和相邻分隔间距偏小，导致多条记录上下贴近。

## FILES CHANGED

- `D:\个人web\src\app\globals.css`
- `D:\个人web\docs\workhub-v3-progress.md`

本轮未修改其他 TSX、schema、数据或业务逻辑文件。

## WHAT CHANGED

- 项目详情：根容器改为自然高度并允许内容完整展开；STR/WBS 区域不再被固定高度或 overflow 裁切，顺序保持 Project Header → STR timeline → 当前/下一 STR → WBS readiness → 管理事项 → 最近进展 → 次要信息。
- 事项详情：整体有效宽度提升至不超过 1440px，主列/辅助列保持约 70/30，Timeline 使用完整内容宽度，响应式断点继续保留。
- 汇报页：项目事实和 WBS 事实去除低内容量外层白卡空壳，保留内部事实块与 Markdown 折叠；WBS 多项目事实采用内容驱动列宽。
- 首页：最近进展增加行高、上下间距、标题与摘要间距和分隔留白，没有增加模块、查询或数据。

## BEHAVIOR BEFORE / AFTER

| 页面 | Before | After |
| --- | --- | --- |
| 项目详情 | 固定视口高度可能裁切 STR/WBS 内容 | 页面按真实内容自然撑高，STR/WBS 可完整阅读 |
| 事项详情 | 1320px 上限导致可用宽度不足 | 最大 1440px，主列约 70%、辅助列约 30% |
| 汇报 | 大白卡片包住少量事实 | 外层空壳收紧，事实块按内容自然增长 |
| 首页最近进展 | 记录行间距和行高偏紧 | 标题、摘要、分隔线间距更易扫读 |

## DATA MIGRATION

无 schema/data migration。未写入、删除、迁移、修正或自动归属任何业务数据；未给 WorkItem 分配 STR，未恢复 WBS fake WorkItem。

## DATA VERIFICATION

```text
Project                 2
ProjectMilestone       12
WorkItem                9
ActionItem             38
WorkLog                58
ProjectWbsNode        157
ProjectWbsDeliverable 146
WBS fake WorkItem       0
WorkItemWithMilestone   0
integrity_check         ok
foreign_key_check       []
```

## VERIFICATION

- `npm.cmd run typecheck`：PASS
- `npm.cmd run test`：PASS，21 个测试文件通过、1 个跳过；85 个测试通过、9 个跳过
- `npm.cmd run lint`：PASS
- `npm.cmd run build`：PASS
- `npx.cmd prisma migrate diff --from-url file:./prisma/dev.db --to-schema-datamodel prisma/schema.prisma`：`No difference detected.`
- HTTP smoke：`/`、`/projects/cmqz4m9gg0000s1douq1oyfby`、`/items/cmrj9www30001s1984njh1imj`、`/reports` 均返回 HTTP 200。
- 浏览器截图：此前已完成 Phase 5.5 页面视觉检查；本轮重新启动服务后 CUA 浏览器会话失效，未生成新的持久化截图文件，保留人工截图验收为下一步。

## KNOWN RISKS

- 本轮未完成新的截图式人工验收，需用户确认项目 STR/WBS、事项宽度、Reports 空白占比和首页进展间距。
- Phase 6 的统一视觉 token、字体、间距、表面、阴影和 legacy cleanup 尚未执行。
- 真实 9 个 WorkItem 仍保持项目级/未归属 STR，页面没有进行事实推断。

## NEXT PHASE READINESS

PASS_WITH_USER_CONFIRMATION。

Phase 6 未执行。等待用户完成人工截图验收并明确确认后再进入 Phase 6。

## GIT STATUS

```text
 D docs/hermes-workhub-v1.md
 M docs/workhub-v3-deployment-plan.md
 M docs/workhub-v3-progress.md
 M src/app/globals.css
 M src/app/items/[id]/page.tsx
 M src/app/page.tsx
 M src/app/projects/[id]/page.tsx
 M src/app/reports/page.tsx
```

未 commit、未 push、未 reset、未 restore、未 stash、未 rebase；`docs/hermes-workhub-v1.md` 未处理，保持原有 deleted dirty 状态；未进入 Phase 6。

---

# Phase 5.5：核心页面产品层级修正

## RESULT

PASS_WITH_USER_CONFIRMATION

Phase 5.5 已完成并验证通过。本轮只修正首页、项目详情、事项详情和汇报页的产品层级、首屏信息密度与旧式视觉提示；未进入 Phase 6，未修改 Prisma schema，未迁移或删除业务数据。

## WHAT CHANGED

- 首页首屏聚焦今日行动，行动信息横向呈现状态、事项、项目/STR、负责人和截止日期；项目卡展示当前/下一 STR、开放事项、开放行动项、逾期行动项和项目级事项，并将项目状态映射为中文；最近进展改为可读的横向事实列表并显示月日时分。
- 项目详情调整为项目头部 → STR 时间轴 → 当前/下一 STR → 当前 STR WBS readiness → 管理事项 → 最近进展 → 次要事实/信号/链接/成员；当前 STR 无法确定时统一显示“暂无明确当前 STR”。事项卡补充 STR/项目级上下文、行动项数量、逾期数量和最近进展。
- 事项详情改为约 70/30 主辅双栏：主列仅突出事项描述与 ActionItem，时间线位于主内容之后；右侧只保留 Project、STR、类型、状态、负责人、截止日期六项核心信息。`currentSummary`、`nextAction`、`nextCheckpoint`、`trackingReason`、`reportLevel`、`health`、来源等 legacy 信息全部收进默认折叠的“更多信息”。
- 汇报页默认显示可读的项目 → STR/里程碑 → 事项 → 行动项 → 日志事实树；内部状态映射为中文；Markdown 原文改为默认折叠；顶部 5 格 debug 风格统计收敛成一行轻量摘要，标题收敛为“汇报”。WBS 仅保留轻量事实摘要。
- 页面宽度、字号、行高、卡片间距和响应式列布局做了本阶段范围内的局部修正；完整视觉 token、字体、间距和 legacy cleanup 留给 Phase 6。

## DATA MIGRATION

无 schema/data migration。执行前数据库基线备份：

```text
D:\个人web\.workhub\backups\workhub-2026-09-13T04-14-54-636Z.db
Backup verified: projects=2, items=9, logs=58
```

本轮仅读取数据库，没有创建、更新、删除或重新归属任何业务记录。

## FILES CHANGED

- `docs/workhub-v3-deployment-plan.md`
- `docs/workhub-v3-progress.md`
- `src/app/globals.css`
- `src/app/items/[id]/page.tsx`
- `src/app/page.tsx`
- `src/app/projects/[id]/page.tsx`
- `src/app/reports/page.tsx`

## BEHAVIOR BEFORE / AFTER

| 场景 | Before | After |
| --- | --- | --- |
| 首页 | 首屏信息较密，项目与进展层级不够清晰 | 今日行动 → 项目 STR → 最近进展，行动和项目指标可直接阅读 |
| 项目详情 | 事项、WBS、信号和项目资料并列，主次不明显 | Project Header → STR timeline → 当前/下一 STR → WBS readiness → 管理事项 → 最近进展 → 次要信息 |
| 当前 STR | 无当前 STR 时存在多种提示文案 | 统一为“暂无明确当前 STR”，不根据标题推断归属 |
| 事项详情 | ActionItem 与旧进展/关系信息竞争首屏 | ActionItem 主链进入主列，项目/STR上下文明确，legacy 信息降为辅助 |
| 汇报 | Markdown 原文默认占据较大空间，状态存在内部枚举 | 默认先读事实树，Markdown 折叠，状态映射为中文 |

## VERIFICATION

- `npm.cmd run typecheck`：PASS
- `npm.cmd run test`：PASS，21 个测试文件通过、1 个跳过；85 个测试通过、9 个跳过
- `npm.cmd run lint`：PASS
- `npm.cmd run build`：PASS
- `npx.cmd prisma migrate diff --from-url file:./prisma/dev.db --to-schema-datamodel prisma/schema.prisma`：`No difference detected.`
- 本轮最终只读数据核对：Project 2、ProjectMilestone 12、WorkItem 9、ActionItem 38、WorkLog 58、ProjectWbsNode 157、ProjectWbsDeliverable 146、WBS fake WorkItem 0；`milestoneId != null` 的 WorkItem 为 0
- `PRAGMA integrity_check`：`ok`
- `PRAGMA foreign_key_check`：`[]`
- CodexPro 的 WSL `git diff --check` 会把仓库既有 CRLF 文件整体误报为 trailing whitespace，因此本轮不把该命令作为验收依据；未做任何换行符清理或无关文件改写。
- 浏览器真实本地页面可达并完成视觉检查：`/`、`/projects/cmqz4m9gg0000s1douq1oyfby`、`/items/cmrj9www30001s1984njh1imj`、`/reports`；检查未写入数据库。截图通过本机浏览器即时查看，未保存为本地截图文件，因此无持久化截图路径。
- 最终数据库备份：

```text
D:\个人web\.workhub\backups\workhub-2026-09-13T04-43-41-716Z.db
Backup verified: projects=2, items=9, logs=58
```

- 最终备份 restore-check：PASS

## KNOWN RISKS

- 本阶段未做 Phase 6 的统一设计 token、字体、间距、表面、边框和阴影治理，旧页面仍可能存在视觉语言差异。
- 真实 9 个 WorkItem 仍未自动归属任何 STR；页面继续按真实数据显示项目级事项，不做产品事实推断。
- 事项详情和项目详情仍保留 legacy 辅助信息区块；本轮只调整层级和可读性，没有删除 legacy 字段或重做业务模块。
- 本轮完成了浏览器页面级视觉检查，但没有通过页面操作写入测试数据；数据库交互回归仍依赖既有测试和后续阶段的人工验收。

## NEXT PHASE READINESS

PASS_WITH_USER_CONFIRMATION。

Phase 5.5 验收通过。下一阶段为 Phase 6：视觉系统统一与旧逻辑清理；本轮未执行，需用户明确确认后再开始。

## GIT STATUS

```text
 D docs/hermes-workhub-v1.md
 M docs/workhub-v3-deployment-plan.md
 M docs/workhub-v3-progress.md
 M src/app/globals.css
 M src/app/items/[id]/page.tsx
 M src/app/page.tsx
 M src/app/projects/[id]/page.tsx
 M src/app/reports/page.tsx
```

未执行 commit、push、reset、restore、stash、rebase；未修改或处理 `docs/hermes-workhub-v1.md`；未进入 Phase 6。
