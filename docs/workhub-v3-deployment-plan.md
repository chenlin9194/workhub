# WorkHub V3 部署执行基线

> 适用环境：家里个人电脑 `D:\个人web`
>
> 执行代理：Codex / CodexPro
>
> 本文件是 WorkHub V3 重构的唯一实施北极星。每次执行前必须先阅读 `AGENTS.md` 和本文件；不得根据局部代码便利性擅自改变产品模型、阶段顺序或缩小/扩大范围。

---

## 0. 为什么要做 V3

WorkHub 当前已经具备 Project / WorkItem / ActionItem / WorkLog / WBS / Report 等能力，但经过真实使用后，存在三个根本问题：

1. **对象关系不符合真实 SPM 工作路径**：WBS 会自动生成 `[STRx] 节点准备与评审` 事项，导致 WBS 门禁对象与真实管理事项混在一起。
2. **日志被设计成独立业务对象**：包含标题、内容、类型、来源、标签、可汇报等大量字段，使用成本高，且不能自然记录行动项的延期原因、推进过程和下一步。
3. **汇报按状态桶拼接**：日报/周报主要按“新增日志、关闭事项、更新事项、P0/P1、逾期”等分桶，无法形成“项目 → STR → 事项 → 行动项 → 进展”的完整管理上下文。

V3 的目标不是继续增加功能，而是通过减法重构，把 WorkHub 调整为真正围绕个人软件项目经理日常工作节奏运转的工作台。

---

# 1. V3 产品北极星

WorkHub V3 的唯一主链路：

```text
Project 项目
  ↓
STR / ProjectMilestone
  ↓
WorkItem 管理事项
  ↓
ActionItem 具体行动
  ↓
WorkLog 过程记录
```

WBS 与这条链路并行存在，其职责仅为：

```text
Project
  ↓
STR
  ↓
WBS Node / Deliverable
  ↓
Readiness / Gate 状态
```

**WBS 不再自动创造“STR 节点准备与评审”这种 WorkItem。**

最终日报、周报、月报、区间汇报，全部是上述真实工作链路在某个时间范围内的自然投影。

---

# 2. 不可偏离的产品原则

以下原则优先级高于局部实现便利性。

## 2.1 WorkHub 不是企业 ALM

继续遵守 `AGENTS.md`：

- 不做 Jira / ALM 镜像
- 不做复杂权限
- 不做多人企业协作平台
- 不做完整需求树
- 不做全文档仓库
- 不把 WorkHub 变成另一套 WBS 系统

## 2.2 一切围绕个人 SPM 管理路径

首页只需要回答：

1. 今天我要做什么？
2. 哪个项目当前处于哪个 STR？
3. 当前 / 下一个 STR 有哪些需要我盯的事项？
4. 最近发生了什么？

项目详情只需要回答：

1. 当前 STR 是什么？下一个 STR 是什么？
2. 当前 STR 的 WBS readiness 如何？
3. 当前 STR 有哪些管理事项？
4. 每个事项有哪些行动项和最近进展？

事项详情只需要回答：

1. 这是什么问题/任务？
2. 谁在负责？什么时候要完成？
3. 当前有哪些行动项？
4. 最近发生了什么？为什么延期？下一步是什么？

## 2.3 日志是附属记录，不是独立管理对象

日志只回答：

> 什么时候，哪件事，发生了什么。

不得重新把 WorkLog 设计成第二套事项系统。

## 2.4 所有事实都记录，不做“是否可汇报”判断

删除 `reportable` 产品概念。

WorkHub 负责保存事实和上下文；最终哪些内容适合对上汇报，由用户人工判断。

## 2.5 汇报必须整合上下文，不得输出流水账

汇报聚合主键必须是：

```text
Project → STR → WorkItem → ActionItem → WorkLog
```

不得继续以“新增日志 / 状态变化 / 今日关闭 / 今日更新”为主体结构。

---

# 3. V3 目标数据模型

## 3.1 Project

保持现有 Project 模型为主，不在本轮扩成企业项目模型。

## 3.2 ProjectMilestone

继续承担项目里程碑 / STR 节点。

对于 WBS gate，继续使用现有 `gateKey`：

- STR1
- STR2
- STR3
- STR4
- STR4A
- STR5

项目页面需要突出“当前 STR / 下一个 STR”。

## 3.3 WorkItem

V3 中 WorkItem 是 **STR 下的管理事项**。

典型类别：

- 计划
- 风险
- 变更
- 资源
- 决策
- 问题
- 其他

关键要求：

- WorkItem 必须可关联 `ProjectMilestone`，用于表示所属 STR。
- 允许少量项目级事项不属于 STR，但创建时默认优先归属当前 STR。
- 不再由 WBS gate 自动创建 WorkItem。

建议新增关系字段：

```prisma
milestoneId String?
milestone   ProjectMilestone? @relation(...)
```

字段命名可根据 Prisma relation 冲突做技术调整，但业务语义不可改变。

### WorkItem 旧字段处理方向

以下字段不得在 V3 UI 继续作为核心手工维护对象：

- `currentSummary`
- `nextAction`
- `reportLevel`

目标状态：

- 当前进展：从日志得出
- 下一行动：从未关闭 ActionItem 得出
- 汇报层级：删除产品概念

为保证迁移安全，可先保留数据库兼容字段，但 V3 主流程不得继续依赖用户重复维护它们。

`trackingReason`、`nextCheckpoint` 是否最终移除，放在最后清理阶段决定，不得在前期大范围破坏兼容性。

## 3.4 ActionItem

ActionItem 是 **WorkItem 下的具体动作**。

V3 目标：

```text
ActionItem
- title
- status
- owner
- dueDate
- workItemId
- projectId（可保留冗余便于查询，但必须与 WorkItem 一致）
- doneAt
- sortOrder
```

### 强制规则

- 新建 ActionItem 必须归属于 WorkItem。
- 不再允许“ActionItem 属于 WorkLog”。
- `workLogId` 进入废弃流程。
- `doneNote` 进入废弃流程。

### 完成动作

完成行动项时，如果用户填写处理结果：

```text
ActionItem.status = done
ActionItem.doneAt = now
+ 创建一条关联该 ActionItem 的 WorkLog
```

完成结果不得继续长期保存在独立 `doneNote` 体系中。

### 延期 / 改期规则

若已逾期 ActionItem 修改 dueDate：

- UI 必须要求用户记录“原因 + 下一步”
- 保存新的 dueDate
- 同时创建 ActionItem WorkLog

若 ActionItem 已逾期且到期后没有新的日志，UI 应显示：

```text
已逾期 · 缺少延期说明
```

不得另造 `delayReason`、`delayNote`、`nextStep` 等持久字段。

## 3.5 WorkLog

V3 最终语义：**事项或行动项的过程记录。**

目标模型尽量收敛为：

```prisma
model WorkLog {
  id           String   @id @default(cuid())
  workDate     String
  note         String

  itemId       String?
  item         WorkItem?

  actionItemId String?
  actionItem   ActionItem?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### 业务约束

- `itemId` 与 `actionItemId` 至少一个存在。
- 优先实现二选一；若技术迁移阶段暂时允许 ActionItem 日志同时保留 itemId 用于查询，也必须保证主归属明确。
- ActionItem 日志应能通过 ActionItem → WorkItem → STR → Project 自动推导完整上下文。

### 最终需要退休的 WorkLog 字段/概念

- title
- content（迁移到 note）
- type
- source
- project / projectId 独立手工归属
- module
- tags
- reportable
- sourceUrl
- `WorkLog → ActionItem[]` 反向创建行为

### 迁移原则

**禁止直接 drop 字段再修页面。**

必须采用兼容迁移：

1. 增加新字段 / 新关系
2. 将旧数据迁移到新结构
3. 新代码切换到新读写路径
4. 验证现有数据完整
5. 最后才删除旧字段或停止使用

历史日志数据不能因为字段简化而丢失。

旧 `title + content` 迁移到 `note` 时，建议规则：

- 如果 title 为系统生成的“事项变化：xxx”，将有意义的变化内容迁入 note
- 普通人工日志：若 title 和 content 都有信息，可拼成一段可读 note
- 不得静默丢弃任何原有人工信息

---

# 4. WBS 重构规则

## 4.1 必须删除的行为

当前 `src/lib/wbs/service.ts` 中 `generatedExecutionItemData()` 会生成：

```text
[STRx] 节点准备与评审
由 WBS STRx 里程碑初始化生成
```

V3 必须停止此行为。

## 4.2 必须保留的能力

以下能力继续存在：

- WBS Template
- ProjectWbsPlan
- ProjectWbsNode
- ProjectWbsDeliverable
- Gate readiness
- WBS node 状态
- WBS deliverable 状态
- 从真正的 WBS task 拆分为普通 WorkItem 的能力

特别注意：

`originWbsNodeId` 仍然用于“WBS task → 普通事项”的来源追踪，**不能因为删除 gate execution item 而整体删除。**

## 4.3 syncWbsDerivedState

`syncWbsDerivedState()` 继续同步 ProjectMilestone readiness / status。

但必须删除对 gate-generated WorkItem 的依赖和同步。

最终：

```text
WBS readiness → ProjectMilestone
```

而不是：

```text
WBS readiness → ProjectMilestone → fake WorkItem
```

## 4.4 历史 fake WorkItem 清理

只允许清理确认属于 WBS gate 自动生成的 WorkItem，例如满足明确标识：

- `managedBy = "wbs"`
- 且 `executionMilestoneId` 非空
- 且符合 gate execution item 语义

禁止误删从 WBS task 拆出来的普通事项。

清理前必须：

1. 数据库备份
2. 输出将删除记录的数量、ID、title
3. 验证这些记录没有用户人工 ActionItem / 人工日志需要保留
4. 若存在人工数据，先迁移到对应 STR / 合理事项或保留兼容，不得直接删除

---

# 5. 报表聚合器 V3

## 5.1 一个聚合器，多种时间窗口

不得维护日报、周报、月报三套不同业务算法。

统一实现：

```text
ReportAggregator(startDate, endDate, projectFilter?)
```

页面预设：

- 今日
- 本周
- 本月
- 自定义范围

## 5.2 聚合层级

输出数据结构应围绕：

```text
Project
  STR
    WorkItem
      本周期事项日志
      ActionItem
        本周期行动项日志
        当前状态 / owner / dueDate
```

## 5.3 汇报内容

每个事项至少应该能够给出：

- 事项名称 / 类型
- 所属项目 / STR
- 时间窗口内的真实进展记录
- 当前未完成 ActionItem
- 已完成 ActionItem（仅当本周期完成或相关）
- 逾期及延期原因
- 下一步

“下一步”优先来自当前未完成 ActionItem 以及最近 ActionItem 日志，而不是 WorkItem `nextAction` 文本字段。

## 5.4 禁止的主体结构

V3 汇报不得继续以以下结构作为主干：

- 今日新增日志
- 今日关闭事项
- 今日更新事项
- 状态变化
- P0/P1 状态桶
- 可汇报事实

这些可以作为辅助统计，但不能成为报告正文主结构。

## 5.5 不做 AI 幻觉式总结

WorkHub 可以：

- 合并同一事项的多条时间线
- 按时间排序
- 生成结构化 Markdown
- 使用存储的事实组织成连贯表达

WorkHub 不得：

- 补写未记录的原因
- 猜测风险判断
- 猜测老板关心什么
- 自动隐藏某些事实因为“不可汇报”
- 生成数据库里没有依据的结论

---

# 6. V3 页面信息架构

## 6.1 一级导航

目标一级导航：

```text
今日
项目
事项
汇报
```

日志不再作为主要一级业务对象。

当前“未归档事实”入口进入废弃流程。

工具类入口可保留，但需要弱化，不得抢主导航注意力。

## 6.2 首页 / 今日工作台

首页不是 KPI 大屏。

必须优先展示：

### A. 今日行动

- 今日到期 ActionItem
- 已逾期 ActionItem
- 近期 ActionItem
- 关联事项 / Project / STR

### B. 项目当前态势

每个活跃项目至少显示：

```text
当前 STR
下一个 STR
当前 STR 风险/计划/变更/资源事项数量
未完成 ActionItem 数
逾期 ActionItem 数
```

### C. 最近进展

以最新 WorkLog 时间线呈现：

```text
时间 + 事项 / 行动项 + note
```

### 首页禁止

- 不放 8 个 KPI 大卡片
- 不以 P0/P1 / OPEN / FOLLOW / FACTS 等指标占据首屏
- 不使用大量全大写英文 eyebrow
- 不营造监控中心 / NOC 大屏感

## 6.3 项目详情

信息层级：

1. 项目基本信息
2. STR 时间轴
3. 当前 STR readiness / WBS 摘要
4. 当前 STR 管理事项
5. 下一个 STR 管理事项（可折叠或次级展示）
6. 最近进展
7. 其他项目信息

事项支持类别筛选：

- 全部
- 计划
- 风险
- 变更
- 资源
- 决策/问题/其他

WBS 是当前 STR 的门禁入口，不要生成对应的假事项卡。

## 6.4 事项详情

核心顺序：

1. 标题 / 类型 / 状态 / 项目 / STR
2. 简要描述
3. ActionItem 列表
4. 事项级日志时间线
5. 次级元信息

不要继续让大量 metadata 抢占首屏。

### ActionItem 卡片必须提供

- 标题
- owner
- dueDate
- status
- 最近一条日志
- 记录进展
- 完成
- 调整计划

逾期且缺日志时突出：

```text
已逾期 · 缺少延期说明
```

## 6.5 汇报页

布局：

```text
[今日] [本周] [本月] [自定义]
项目筛选

Project A
  STR1
    事项 A
      本周期进展
      当前行动项
    事项 B
  STR2
    ...

Project B
  ...
```

提供：

- 页面阅读
- 复制 Markdown

不得重新出现“可汇报/不可汇报”筛选。

---

# 7. V3 视觉规范

V3 视觉关键词：

```text
安静
轻盈
个人工作台
低视觉噪音
舒适阅读
清晰层级
```

不是：

```text
监控驾驶舱
BI 大屏
企业后台
高密度数据墙
```

## 7.1 借鉴方向

吸收而非照搬：

- Linear：清晰层级、克制导航、信息密度控制
- Notion Projects：Project / Task 关系清楚、阅读感强
- Sunsama：围绕“今天该做什么”的个人工作台感

## 7.2 字体

Windows 本地优先：

```css
font-family:
  "Segoe UI Variable",
  "Microsoft YaHei UI",
  "PingFang SC",
  system-ui,
  sans-serif;
```

正文建议约 14.5–15px，主要阅读区域行高 1.55–1.7。

## 7.3 色彩

- 主体使用暖白 / 极浅灰背景
- 主文字使用接近黑但非纯黑
- 蓝色作为交互强调
- 红 / 橙只用于风险、逾期、异常
- 绿色用于完成 / 正常
- 禁止每个信息块都使用强状态色

## 7.4 容器

- 减少 card 套 card
- 减少重边框
- 更多使用留白、分隔线、层级排版
- 阴影非常轻
- 圆角克制统一

## 7.5 中英文

UI 以中文为主。

减少：

- WORKSPACE PULSE
- EXECUTION SUMMARY
- FACT PACKAGE HUB
- QUALITY CHECK
- WORK ITEMS

此类持续占视觉空间的英文标签。

## 7.6 新版视觉参考

本次 V3 已经确定的视觉方向：

- 左侧轻量导航
- 白色/浅灰主背景
- 顶部全局搜索 + 快速记录
- 首页重点是“今日 + 项目 + 最近进展”
- 项目页顶部显示 STR 横向阶段轴
- 事项卡内直接看到 ActionItem 与最近日志
- 汇报页按 Project / STR / WorkItem 组织

实现时以本节的产品语言为准，不要求像素级复刻任何生成图片。

---

# 8. 实施阶段与停止点

**Codex 每次只执行一个 Phase。**

禁止一次对话直接把 Phase 0–6 全部做完。

每个 Phase 完成后必须停止，输出结果和风险，由用户决定是否进入下一阶段。

---

## Phase 0：基线审计与备份

### 目标

在修改任何 schema / 数据之前建立安全基线。

### 必做

1. 阅读 `AGENTS.md`
2. 阅读本文件
3. 检查当前 Git 状态
4. 识别相关 schema / API / UI / export / WBS 文件
5. 执行 `npm.cmd run db:backup` 备份 `prisma/dev.db`
6. 执行 `npm.cmd run db:restore-check` 验证备份可恢复
7. 统计：
   - Project 数量
   - ProjectMilestone 数量
   - WorkItem 数量
   - `managedBy=wbs` 的 fake gate WorkItem 数量
   - ActionItem 数量
   - ActionItem.workLogId 非空数量
   - ActionItem.doneNote 非空数量
   - WorkLog 数量
   - WorkLog.reportable=true 数量
   - 孤立 WorkLog 数量
8. 抽样验证历史数据形态

### 禁止

- 不修改 schema
- 不修改业务代码
- 不删除数据

### Phase 0 验收

输出：

```text
RESULT
BASELINE
DATABASE BACKUP
RESTORE CHECK
DATA INVENTORY
LEGACY RELATION RISKS
PROPOSED MIGRATION NOTES
FILES LIKELY AFFECTED
```

然后停止。

---

## Phase 0.5：Schema–DB 基线对齐（Phase 0 发现后的强制前置阶段）

### 触发原因

Phase 0 已确认真实数据库与 `prisma/schema.prisma` 存在历史漂移：

- schema 声明 `IdempotencyOperation`，真实数据库缺少该表
- schema 声明 `ProjectWbsNode.removedAt`、`removalReason`，真实数据库缺少这两列
- 当前 WBS 代码已经读取 `removedAt`，真实数据库会直接报错

因此 **禁止直接进入 Phase 1**。否则一次 `db:push` 会同时包含“历史漂移修复”和“V3 新 schema 变更”，导致变更不可归因、回滚边界不清晰。

### 目标

只把真实数据库恢复到“当前 HEAD + 当前 schema 应有的稳定基线”，不引入任何 V3 新字段、新关系或新业务行为。

### 必做

1. 重新阅读 `AGENTS.md`、本文件和 Phase 0 输出。
2. 检查当前 Git dirty 状态，保护用户已有修改。
3. 确认 Phase 0 备份文件存在且 `db:restore-check` 仍然 PASS；必要时再创建一份新的 pre-0.5 备份。
4. 只读确认漂移范围，确保除以下对象外没有其他未识别差异：
   - `IdempotencyOperation`
   - `ProjectWbsNode.removedAt`
   - `ProjectWbsNode.removalReason`
5. 分析这些 schema 对象是否属于当前代码已经依赖的历史能力，确认不是 V3 新需求。
6. 使用项目原生 `npm.cmd run db:push` 将真实数据库对齐到**当前未修改的 schema**。
7. 对齐后验证：
   - `IdempotencyOperation` 表存在且结构与 schema 一致
   - `ProjectWbsNode.removedAt` 存在
   - `ProjectWbsNode.removalReason` 存在
   - 原有业务表记录数不应异常减少
   - WBS 读取 `removedAt` 不再报错
   - `integrity_check=ok`
   - `foreign_key_check` 无违规
8. 执行：
   - `npm.cmd run typecheck`
   - `npm.cmd run test`
   - `npm.cmd run lint`
   - `npm.cmd run build`
9. 再执行一次 `npm.cmd run db:backup` 和 `npm.cmd run db:restore-check`，形成 **V3 正式迁移前的干净数据库基线**。

### 严格禁止

- 不修改 `prisma/schema.prisma`
- 不增加 V3 `milestoneId` / `note` / `actionItemId` 等新字段
- 不修改业务代码来绕过漂移
- 不删除 WBS fake WorkItem
- 不迁移 `doneNote`
- 不修改 `reportable`
- 不进入 Phase 1
- 不 commit / push / reset / restore / stash / rebase

### 异常处理

若 `db:push` 预览或执行显示将：

- 删除现有列或表
- 重建表且可能丢数据
- 修改除已识别漂移之外的结构
- 产生无法解释的 destructive change

则立即停止，不确认 destructive operation，不继续执行。输出真实差异、影响和建议，由用户决定。

### Phase 0.5 验收

固定输出：

```text
RESULT
PHASE
PRE-CHANGE BACKUP
DRIFT SCOPE CONFIRMED
SCHEMA-DB ALIGNMENT
DATA COUNT BEFORE / AFTER
WBS READ CHECK
DATABASE INTEGRITY
VERIFICATION
POST-ALIGNMENT BACKUP
KNOWN RISKS
PHASE 1 READINESS
GIT STATUS
```

只有当结果为 PASS，且数据库与当前 schema 已一致，才允许进入 Phase 1。

然后停止。

---

## Phase 1：数据模型兼容层

### 目标

建立 V3 新关系，但暂不删除旧字段。

### 建议实现

- WorkItem 增加 ProjectMilestone / STR 关联
- WorkLog 增加 `note`
- WorkLog 增加 `actionItemId` relation
- ActionItem 增加 WorkLog[] 关系
- 保持旧字段暂时存在

### 数据迁移

写可重复、安全、有验证输出的迁移脚本。

要求：

- 旧人工日志信息完整迁移到 note
- 旧 ActionItem.doneNote 若有值，迁成 ActionItem WorkLog
- 旧 ActionItem.workLogId 必须先分析语义，再迁移，禁止直接置空
- 迁移完成后可追溯数量必须一致

### Phase 1 验收

- `npm.cmd run db:push` PASS
- Prisma Client generate 正常（若 `db:push` 未自动完成，则显式执行项目适用的 generate）
- migration verification PASS
- `npm.cmd run typecheck` PASS
- `npm.cmd run test` PASS
- `npm.cmd run lint` PASS
- `npm.cmd run build` PASS（如项目基线支持）
- 历史数据无丢失

完成后停止。

---

## Phase 2：WBS fake WorkItem 清理

### 目标

停止自动创建 `[STRx] 节点准备与评审`。

### 必做

- 删除 `generatedExecutionItemData()` 主流程依赖
- initializeProjectWbs 不再创建 / update gate execution WorkItem
- syncWbsDerivedState 不再同步 fake WorkItem
- ProjectMilestone readiness/status 保持正确
- WBS task → 普通 WorkItem 的 split 能力保持
- 清理历史 fake WorkItem 前先输出清单并保护人工数据

### 必须补测试

至少覆盖：

- 初始化 WBS 不再创建 STR fake WorkItem
- WBS readiness 仍能驱动 milestone status
- WBS task split WorkItem 不受影响
- reinitialize 不恢复 fake WorkItem

完成后停止。

---

## Phase 3：事项 → 行动项 → 日志主链路

### 目标

完成 V3 最核心业务链。

### ActionItem

- 必须归属 WorkItem
- 移除 UI 中 WorkLog → ActionItem 创建逻辑
- 完成 ActionItem 时写 WorkLog
- 调整逾期日期时要求原因和下一步，并写 WorkLog

### WorkLog

新 UI 只需要：

```text
日期
记录内容 note
关联事项 或 行动项
```

日志创建入口优先内嵌在事项 / ActionItem 上。

### UI

优先重做：

- ActionItemSection
- WorkItem detail timeline
- 记录进展交互
- 完成交互
- 调整计划交互

### Phase 3 验收

至少人工验证：

1. 新建事项
2. 新建 ActionItem
3. 给 ActionItem 添加日志
4. 修改逾期日期并记录原因/下一步
5. 完成 ActionItem 并写结果日志
6. 事项页能看到完整时间线
7. 原有数据仍可读

完成后停止。

---

## Phase 4：Report Aggregator V3

### 目标

替换状态桶式事实包。

### 必做

实现统一时间范围聚合器：

```text
startDate
endDate
projectId?
```

返回：

```text
Project[]
  STR[]
    WorkItem[]
      logs[]
      actionItems[]
        logs[]
```

### UI / Export

重做：

- `/reports`
- `/export/today`
- `/export/range`
- 对应 API
- Markdown generator

### 删除/退休

- reportable 筛选
- 可汇报事实 UI
- QUALITY CHECK 与 reportable 强耦合部分
- 以 updatedAt 为主体的“今日更新事项”汇报

### 验收

用真实数据库选一个项目，验证一段至少 3 天时间范围：

- 同一事项多条日志被聚合到同一上下文
- ActionItem 状态/owner/dueDate 正确
- 延期原因和下一步出现在对应 ActionItem 下
- 不重复计算
- 不出现 fake WBS WorkItem

完成后停止。

---

## Phase 5：核心页面 V3 信息架构

### 目标

先改骨架，不追求最后像素。

### 页面优先级

1. 首页 `/`
2. 项目详情 `/projects/[id]`
3. 事项详情 `/items/[id]`
4. 今日 `/today`
5. 汇报 `/reports`
6. 项目列表 / 事项列表

### 首页

只保留：

- 今日行动
- 项目当前/下一个 STR
- 最近进展

### 项目详情

突出：

- STR timeline
- current / next STR
- current STR WBS readiness
- STR 下的管理事项
- 事项分类
- 最近进展

### 事项详情

突出：

- 事项
- ActionItem
- 日志

次级 metadata 后置。

完成后停止。

---

## Phase 6：视觉系统统一与旧逻辑清理

### 目标

统一全站视觉并清理兼容债。

### 视觉

重构 `globals.css` tokens：

- typography
- spacing
- surface
- border
- shadow
- status
- interactive state

统一亮色舒适风格。

### 清理候选

完成数据验证后，评估删除：

- WorkLog legacy fields
- WorkLog.reportable
- ActionItem.workLogId
- ActionItem.doneNote
- WorkItem.reportLevel
- WorkItem.currentSummary
- WorkItem.nextAction
- 旧日志独立页面 / 导航
- 旧 reportReadiness 逻辑
- 旧 signalMap reportable 路径
- Hermes API 中 legacy reportable 语义

### 注意

Hermes / Bridge 属于外部集成边界。任何 API contract 调整必须先识别兼容风险，不能因为页面重构直接破坏现有 MCP 调用。

完成后停止并输出最终回归。

---

# 9. 每个 Phase 的强制执行协议

Codex 每次执行必须遵循：

## 开始前

1. 读取 `AGENTS.md`
2. 读取 `docs/workhub-v3-deployment-plan.md`
3. 读取 `docs/workhub-v3-progress.md`，确认真实执行进度、数据库基线和下一阶段
4. 明确当前只执行哪个 Phase
5. 检查 Git dirty 状态
6. 不覆盖用户已有未提交改动

## 执行中

- 先查明当前实现再改
- 采用最小必要改动
- 不顺手做无关重构
- 不因某个测试难过就修改产品目标
- 不为了复用旧代码保留已经明确废弃的产品概念
- 不为了“一次做完”跨 Phase 大规模修改

## 验证

项目当前已有原生脚本，优先使用：

```text
npm.cmd run typecheck
npm.cmd run test
npm.cmd run lint
npm.cmd run build
```

Schema 修改使用：

```text
npm.cmd run db:push
```

数据库改造前/后优先使用：

```text
npm.cmd run db:backup
npm.cmd run db:restore-check
```

不得绕过项目现有脚本直接编造其他数据库命令，除非先证明项目脚本无法满足当前任务，并在结果中说明原因。

数据库危险操作前必须确认备份已经存在且 restore check 通过。

## Git

除非用户明确要求：

- 不 commit
- 不 push
- 不 reset
- 不 restore 用户改动
- 不 stash 用户改动
- 不 rebase

## 完成后固定输出

```text
RESULT
PHASE
WHAT CHANGED
DATA MIGRATION
FILES CHANGED
BEHAVIOR BEFORE / AFTER
VERIFICATION
KNOWN RISKS
NEXT PHASE READINESS
GIT STATUS
```

然后停止，不自动进入下一 Phase。

---

# 10. 防钻牛角尖规则

Codex 遇到下列情况时必须回到本文件，不允许在局部实现无限优化：

1. 一个组件修改超过预期且开始牵出大量无关 UI
2. 为兼容旧 `reportable` 逻辑而准备保留“可汇报”产品概念
3. 为保持旧 WorkLog API 而重新给日志增加类型/来源/标题
4. WBS 改造又准备创建新的 STR 执行 WorkItem 替代旧 fake item
5. 为生成更漂亮日报准备引入 AI 自动推断事实
6. 为解决延期记录准备给 ActionItem 增加大量专用字段
7. 页面开始重新堆大量 KPI 卡片
8. 实现开始跨越当前 Phase 大量修改下一阶段代码

处理方式：

```text
暂停局部优化 → 对照产品北极星 → 选择最短路径满足当前 Phase 验收
```

如果发现本文件目标与真实现有数据存在冲突：

- 不自行改产品定义
- 先输出证据、影响、建议
- 停止在安全状态

---

# 11. Definition of Done

WorkHub V3 只有同时满足以下条件才算完成：

## 产品模型

- [ ] 不再存在自动生成的 `[STRx] 节点准备与评审` WorkItem
- [ ] WorkItem 可以明确归属 STR
- [ ] ActionItem 明确归属 WorkItem
- [ ] WorkLog 可以记录 WorkItem 或 ActionItem 进展
- [ ] 日志主流程不再需要 title/type/source/reportable
- [ ] ActionItem 延期可以沉淀原因与下一步
- [ ] ActionItem 完成结果进入日志时间线

## 汇报

- [ ] 日报 / 周报 / 月报共用同一时间范围聚合逻辑
- [ ] 汇报按 Project / STR / WorkItem / ActionItem 组织
- [ ] 能看到期间真实进展、延期原因和当前下一步
- [ ] 不再要求“可汇报”勾选
- [ ] 不以状态流转流水账作为正文

## UX

- [ ] 首页重点是今日行动、项目 STR、最近进展
- [ ] 项目页突出当前 / 下一个 STR
- [ ] 事项页优先显示行动项与时间线
- [ ] 日志录入足够轻量
- [ ] 全站字体、留白、密度适合长期阅读
- [ ] 视觉不再呈现沉重 BI 驾驶舱感

## 安全

- [ ] 历史数据无丢失
- [ ] DB 有可恢复备份
- [ ] typecheck 通过
- [ ] tests 通过
- [ ] lint 通过
- [ ] build 通过或明确记录已有基线问题
- [ ] Hermes / MCP 兼容风险已处理或明确记录

---

# 12. 当前执行起点

Phase 0 已于 2026-09-12 完成，并发现必须先处理的 schema–database 历史漂移。真实执行状态以 `docs/workhub-v3-progress.md` 为准。

当前应从：

```text
Phase 0.5：Schema–DB 基线对齐
```

开始。

在 Phase 0.5 完成并由用户确认前，不进入 Phase 1，也不引入任何 V3 schema 新字段。
