# WorkHub V3 Phase 6 Design Plan

## 1. Phase Goal

Phase 6 目标：将 WorkHub 从“功能完整的个人项目管理工具”升级为“OS 软件项目经理执行驾驶舱”。

核心目标不是增加更多数据，而是提升 PM 每日决策和执行效率。

WorkHub 打开后需要帮助 PM 快速回答：

1. 今天需要推动什么？
2. 哪些项目存在风险？
3. 哪些事项阻塞？
4. 下一步行动是什么？
5. 如何形成管理汇报？

---

## 2. 产品定位约束

WorkHub 仍然定位为：

个人 OS 软件项目经理执行工作台 / PM cockpit。

不是：

- Jira / ALM 替代系统
- 企业协作平台
- BI 数据大屏
- AI Inbox
- 完整 WBS 管理系统

核心管理链保持：

```
Project
  ↓
STR / ProjectMilestone
  ↓
WorkItem
  ↓
ActionItem
  ↓
WorkLog
```

WBS 继续只负责阶段 readiness，不生成假 WorkItem。

---

## 3. Phase 6 Scope

## Phase 6.1 Design System Foundation

目标：统一视觉基础。

范围：

- typography
- spacing
- card
- badge
- button
- status display
- empty state

原则：

优先统一基础视觉，不改变业务模型。

限制：

- 不修改 Prisma schema
- 不做数据迁移
- 不改变业务流程

---

## Phase 6.2 Home Cockpit

目标：让首页成为每日打开的 PM 驾驶台。

首页需要回答：

“今天我要关注什么？”

优化方向：

- 今日重点
- 项目状态
- 最近变化
- 快速进入行动

不增加无关 BI 指标。

---

## Phase 6.3 Project Cockpit

目标：项目详情成为 WorkHub 最核心页面。

推荐结构：

```
Project Header

↓

STR Timeline

↓

Readiness

↓

Management Items

↓

Action Items

↓

Facts / Logs

↓

Secondary Information
```

WBS readiness 作为阶段健康信号，不成为第二套 dashboard。

---

## Phase 6.4 WorkItem Execution Experience

目标：事项详情成为推动闭环中心。

核心链路：

```
问题
 ↓
行动
 ↓
负责人
 ↓
截止时间
 ↓
结果
 ↓
事实记录
```

ActionItem 继续作为页面核心。

---

## Phase 6.5 Report Experience

目标：从“报告展示页面”升级为“PM 汇报输出页面”。

默认展示：

- 管理判断
- 当前进展
- 风险
- 下一步行动

Markdown 保留作为导出/复制格式，不作为默认阅读入口。

---

## 4. Legacy Strategy

保留数据库字段，不删除历史能力。

以下字段逐步降低 UI 优先级：

- currentSummary
- nextAction
- nextCheckpoint
- trackingReason
- health
- source
- reportLevel

原则：

数据库保留事实，UI 突出执行链路。

---

## 5. Technical Constraints

Phase 6 禁止：

- 引入 Jira 模型
- 引入复杂权限
- 引入团队协作模型
- 引入 BI 大屏
- 自动推断业务事实
- 自动给 WorkItem 分配 STR
- 恢复 WBS fake WorkItem
- 修改 ActionItem workflow
- 修改 Report Aggregator 核心逻辑

---

## 6. Acceptance Criteria

每个 Phase 6 子阶段完成后必须验证：

- typecheck PASS
- test PASS
- lint PASS
- build PASS
- schema 无变化
- 数据基线无变化

当前基线：

- Project：2
- ProjectMilestone：12
- WorkItem：9
- ActionItem：38
- WorkLog：58
- ProjectWbsNode：157
- ProjectWbsDeliverable：146
- WBS fake WorkItem：0

---

## 7. Execution Rule

Phase 6 必须分阶段执行，每个阶段独立验收、独立 checkpoint。

不要一次性重构所有页面。

推荐顺序：

1. Phase 6.1 Design System Foundation
2. Phase 6.2 Home Cockpit
3. Phase 6.3 Project Cockpit
4. Phase 6.4 WorkItem Experience
5. Phase 6.5 Report Experience

当前：

Phase 6 未开始。
