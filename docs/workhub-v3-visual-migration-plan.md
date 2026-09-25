# WorkHub V3 Quiet Execution · Visual Migration Plan

状态：**设计与实施计划，尚未执行 Phase 8**。本轮仅新增本文与 [Visual Design Spec](workhub-v3-visual-design-spec.md)。Quiet Execution 是已选定的视觉方向；[FINAL 原型](../artifacts/visual-direction-20260923/FINAL-quiet-execution.html) 是项目详情的可视参考，冻结数据与静态 HTML 不构成生产数据契约。[V3 部署执行基线](workhub-v3-deployment-plan.md) 管产品、数据与既有集成；[Phase 6 设计计划](workhub-v3-phase6-design-plan.md) 和 [进度账本](workhub-v3-progress.md) 记录此前阶段。Phase 8 是新的**后续视觉迁移顺序**，不重写历史阶段或替代业务约束。

当前工作区基线已实际检查：`main`，HEAD `09a6e2d fix: align WorkHub V3 auxiliary surfaces and semantics`；开始前已有 `D docs/hermes-workhub-v1.md` 与 `?? artifacts/`。进度账本开头保留历史时点的 HEAD/dirty 记录，不能当成本轮实时 Git 状态。当前正式服务本轮未在 `127.0.0.1:3000` 运行；现状依据 2026/09/23 已完成的 [十页面真实浏览器审计](../artifacts/browser-audit-20260923/AUDIT.md)、[Current 项目详情 1440 整页](../artifacts/visual-direction-20260923/FINAL-Current-1440-full.png) 和 [1920 整页](../artifacts/visual-direction-20260923/FINAL-Current-1920-full.png)。FINAL 与五方案对比已在本轮浏览器重新打开，并查看原生双宽度截图。

## 迁移原则和阶段门

一个阶段只迁移指定页面，独立查看 before/after、运行工程回归并记录结果，然后决定下一阶段。先将项目详情 pilot 做到能在真实动态数据下长期使用，再把同一视觉语言延伸到其他页面。设计 tokens 可以复用，但初次改样式应限制在目标页面的作用域内，避免 `globals.css` 多层旧规则级联影响整个产品。没有用户确认设计规范与本计划前，不开始 Phase 8.1；后续阶段分别验收，不自动一次全站重写。

所有阶段保持现有业务模型、API 写入行为、ActionItem workflow、Report Aggregator、STR 归属与 WBS readiness 语义。视觉层可以调整布局、层级、展示密度、折叠和展示组件；不以原型快照替换实时数据，不顺手做 schema、数据库、Hermes/MCP 或 legacy cleanup。一级导航保持现有产品路径与标签，不复制原型侧栏中的日志入口来扩大导航。

## 阶段顺序

| 阶段 | 目标与最小交付 | 预计未来修改范围 | 验证与非目标 |
|---|---|---|---|
| **8.1 Project Detail Pilot** | 仅 `/projects/[id]` 迁移 Quiet Execution 阅读顺序；真实风险与行动前移，计划/WBS 降级，事实可展开。 | 项目页 JSX、项目页限定 CSS、少量展示组件；详见下文。 | 原生 1440/1920、动态/空/密集状态、所有管理入口和操作、工程回归；不动业务算法、API contract、schema 或数据库。 |
| **8.2 WorkItem Detail** | `/items/[id]` 中 Action → Timeline 连续，重复 metadata 与 Card 减少。 | 事项详情页、ActionItemSection 的展示样式及页面限定 CSS；API/workflow 不动。 | 未完成/逾期/已完成行动、进展与统一时间线、完整编辑/完成/改期/删除路径；不改 Action 状态机。 |
| **8.3 Home + Today** | `/` 与 `/today` 使用同一执行优先层级。 | 两页布局和局部展示组件/样式。 | 今日队列、项目当前态势、最近进展、空数据；不增加风险算法或 KPI。 |
| **8.4 Lists** | `/projects`、`/items` 统一行/卡密度，大屏宽度随真实条目数合理分配。 | 两页列表展示及局部样式。 | 筛选、搜索、排序、分页/完整入口、长标题、1440/1920；不改列表查询语义。 |
| **8.5 Reports + Secondary Surfaces** | 最后迁移 `/reports`、`/stats`、`/export/*`、`/settings/tools` 的可读层级。 | 各页局部展示与样式。 | 保留现有聚合、图表、复制/导出、工具表单行为；不重写 Report Aggregator 或业务数据。 |

每阶段最小交付都包括：目标页面的真实浏览器截图、关键状态/操作回归结果、既有行为与数据边界核验、涉及文件与剩余风险。未来需要执行 `npm.cmd run typecheck`、`npm.cmd run test`、`npm.cmd run lint`、`npm.cmd run build`；只有实际修改产品代码的阶段才运行这些检查。本轮文档工作不运行无关的产品构建，也不做写入式数据库验证。

## Phase 8.1 · 当前实现事实

当前 `/projects/[id]` 由 `src/app/projects/[id]/page.tsx` 的客户端页面与内联 JSX 渲染。加载顺序是先 `GET /api/projects/[id]`，然后并行读取现有 milestones、links、members；WBS 摘要组件另行读取 `GET /api/projects/[id]/wbs`。管理分支 `?manage=milestones|links|members` 挂载已有 `ProjectMilestoneSection`、`ProjectLinkSection`、`ProjectMemberSection`，不是默认 cockpit 内嵌编辑器。默认 cockpit 当前顺序是项目头、计划节点、风险、当前/下一 STR、链接/成员、事项及行动摘要、WBS、最近事实；CSS 后段还有显式 `order` 覆盖，使真实浏览器中风险落到约 y2464。阶段曾经完成过逻辑和基础视觉验收；本次迁移解决新的阅读优先级问题，并不否定此前业务验收。

页面中已有 `selectCurrentAndNextMilestones(milestones, today)` 计算当前/下一 STR；WBS `ProjectWbsSummarySection` 使用现有 WBS API/readiness，当前门禁是第一个未闭环 gate。真实 tOS17.1 中“暂无明确当前 STR”与“WBS 当前门禁：STR1”同时成立。风险四项来自当前开放事项的既有优先级、状态、截止日期、健康度计数；不能改成模型推断的新风险。

项目 GET 的事项最多返回 50 条，每条嵌套 Action 只带 `status`、`dueDate` 和最近一条 `progressLogs`，没有行动 `id/title/owner`。因此现有项目页只能展示行动计数/逾期/最近到期，不能仅靠 CSS 显示 FINAL 中的行动标题和负责人。这是 8.1 的**实施前决策门**：

1. **推荐的只读展示路径**：页面额外调用**已经存在**的 `GET /api/action-items?projectId=...`，按 `workItemId` 关联当前可见事项，只用其现有返回字段绘制行动列表。保留原项目 GET 和既有查询语义，不新增/修改服务端 API、数据库或 Action workflow；对加载延迟或该读取失败，显示已有的行动摘要与事项详情入口，不留假空白或伪造姓名。须检查与项目 GET 的计数一致、关闭事项行动不会混入开放区、跨项目记录不混入、长列表分页/入口可达。
2. **若“保留业务查询”被解释为连额外只读读取也不允许**：8.1 仅将现有摘要前移并标记关联事项，详情由 `/items/[id]` 承载；不承诺在项目页显示不存在于当前响应中的 Action 标题/负责人。Action y guardrail 评估行动摘要容器，报告这与 FINAL 的信息完整度差距。两种路径不可混写成已实现事实。

视觉实施不得借“补齐 Action”改写 `src/app/api/projects/[id]/route.ts` select、`src/app/api/action-items/route.ts` 过滤规则或任何写入 endpoint。需要改变 API contract 时，应作为独立业务范围重新评估，不能塞进本视觉 pilot。

## Phase 8.1 · 页面结构与组件边界

未来目标阅读顺序：**项目身份/状态 → 风险 → 开放事项与待办行动 → 当前/下一 STR 和紧凑计划 → WBS readiness → 最近事实 → 项目资料/维护入口**。在桌面，STR 与 WBS 可处于执行主列旁的次级列，但页面与键盘阅读顺序仍应保持可理解。历史默认只呈现 2–3 条；其余可明确展开或跳转访问。计划默认显示当前与关键后续节点，完整节点及管理入口始终可用。

| 当前代码/区域 | Phase 8.1 处理 | 不能丢的能力 |
|---|---|---|
| `page.tsx` 内联项目 hero | 拆出纯展示 header；只留一处阶段/状态，核心元信息紧凑；编辑/删除移为清楚的次级/危险操作。 | `/projects` 返回、`/projects/[id]/edit`、DELETE 确认、重复点击保护、删除中/失败反馈、删除成功后跳转。 |
| 内联 `project-cockpit-signals` | 抽为低高度 Risk strip，移动到 header 后；保留四个现有计数口径，零值文字降级。 | P0/P1、阻塞、逾期、红黄风险的现有计算和清晰标签。 |
| 内联 `project-cockpit-items` | 从多层面板改为连续 WorkItem 主列；按现有优先级/阻塞/更新时间展示开放事项，待办/逾期 Action 优先，已完成摘要降级；标题、截止、真实 STR/项目级归属与最新进展保留。 | `/items?projectId=...` 和每个 `/items/[id]`，完整 Action 处理继续在事项详情；最多 50 条的现有项目响应限制须标示“查看全部”。 |
| 计划时间轴 + 当前/下一 STR 内联 JSX | 合并为紧凑计划上下文，不重复“下一 STR”大面；保留真实状态、日期、范围节点与完整节点入口。 | `selectCurrentAndNextMilestones` 原样；`?manage=milestones` 和 timeline/list 可达能力，不把 WBS gate 当当前 STR。 |
| `ProjectWbsSummarySection` | 保留其组件、GET、readiness 算法与 currentGate 选择；仅增加可选紧凑展示样式/prop。移除项目页外层与组件内层的双重 panel 视觉嵌套。 | 六个 gate 的真实完成数、待交付、WBS 总览与每个 gate 详情链接；没有 WBS 时有明确空状态。 |
| 最近事实内联 JSX | 抽出展示部分，保持现有项目+事项日志按 ID 去重、按创建时间排序；默认 2–3 条，展开剩余或链接完整日志。 | 日期/来源/内容、每条 `/logs/[id]`，0 条事实空状态；不能在收起时丢数据。 |
| links / members / 项目资料 | 合并重复展示，首屏只保留紧凑入口和数量，放到次级区或后段。 | `?manage=links`、`?manage=members`、项目来源与稳定背景仍可访问。 |

仓库虽有 `ProjectHeaderSection.tsx`、`ProjectOverviewSection.tsx`、`ProjectSignalSection.tsx`，当前项目页**未导入**它们；不能宣称“原样保留即完成”。优先从现用内联 JSX 抽取少量纯展示组件，不让它们重新发请求或复制业务算法。`ProjectMilestoneSection`、`ProjectLinkSection`、`ProjectMemberSection` 作为管理页原组件保留；`ActionItemSection` 留在事项详情继续承载完整新增、进展、改期、完成、编辑和删除，不把一套完整编辑器塞进项目概览。

重复信息删除的是**重复展示**：项目阶段在 kicker/pill/meta 的三次出现收为一处；描述/`currentSummary`/`nextAction` 保持现有数据和 fallback，但在页面各选合适的一处展示；风险计数不在 header 与 risk strip 双份强调；“WBS 当前门禁”只在 readiness 主要位置出现；事项列表后的项目级事项副列表若与主列重复，改为单一归属说明和完整入口。不得删除字段、日志、事项或任何记录。

## Phase 8.1 · 预计文件范围（未来修改，不在本轮执行）

| 文件 | 预计变化 |
|---|---|
| `src/app/projects/[id]/page.tsx` | 保留状态、现有读取、STR/风险/事实计算、管理分支和操作；重排默认 JSX，接入少量展示组件；若通过上文决策门，可新增对现有只读 Action GET 的页面读取。 |
| `src/app/globals.css` | 优先清理/替换 `.project-cockpit-v2` 限定的旧三列、`order`、卡片密度、字号及 13933–14355 附近的后续覆盖；改为受控主/次级列与自然高度，保留全站其他页面样式。 |
| `src/components/ProjectWbsSummarySection.tsx` | 可选 `compact` 展示变体，仅改布局/类名/展开方式；不复制或修改 WBS gate/readiness 计算。 |
| 新建 `src/components/projects/ProjectExecutionHeader.tsx`、`ProjectRiskStrip.tsx`、`ProjectExecutionItems.tsx`、`ProjectPlanContext.tsx`、`ProjectRecentFacts.tsx`（名称待实现时按现有目录约定调整） | 从现用 JSX 提取纯展示责任；主页面仍持有数据和操作回调。仅为确有复用/可读性收益的边界拆分，不强制创建空壳组件。 |

预计**不修改**：`prisma/**`、`tests/**` 中的现有业务断言（视觉回归可另建适当测试）、`src/app/api/**`、`src/lib/projectMilestoneView.ts`、`src/lib/wbs/**`、`src/lib/actionItemWorkflow.ts`、`src/components/ActionItemSection.tsx`、上述三个管理组件、`src/app/items/[id]/page.tsx` 及 Hermes/Bridge 相关文件。此表是可评审范围，实施时若发现必须触及 API、业务逻辑或数据库，应停在 8.1 边界并单独说明影响。

## Phase 8.1 · 验收与回归

以下数值仅是 **tOS17.1 类似稀疏数据的视觉 guardrail**，不是为了达标而隐藏真实内容的机械 KPI。[FINAL 原生实测](../artifacts/visual-direction-20260923/FINAL-REPORT.md)：默认高 1466px、Risk y228、Action y530、1920 有效宽 1440px、主要视觉 Card 1、无嵌套/横向溢出；Current 对照高 3101px、Risk y2464。

| 验收维度 | 目标 |
|---|---|
| 原生浏览器 | 1440×1000 与 1920×1000，页面加载完成后保存首屏/整页截图及元素位置；不能用缩放对比框代替。 |
| 首屏优先级 | Risk y≤300px；首个可执行 Action（或无 Action 的明确摘要）y≤550px，用户无需滚过历史才能看风险。 |
| 稀疏页高度 | 与 pilot 同类数据参考约 1250–1550px；多事项、展开历史按内容自然增长，不截断。 |
| 宽度与密度 | 1920 有效宽受控约 1360–1480px；1440 主列可读；主要视觉 Card≤2、嵌套 0、横向溢出 0；Body 不低于 15px 参考，元信息不大量落到 11/12px。 |
| 真实语义 | 当前 STR 与 WBS gate 分开；项目级事项仍未归属 STR；风险/逾期沿用既有计算，日期不由固定快照决定。 |
| 操作与可访问性 | 编辑、删除、管理 milestones/links/members、事项/WBS/日志跳转及加载/错误/空状态均可用；展开控件可键盘操作并有清楚状态。 |

动态场景在**不写入正式业务数据库**的前提下使用可控只读夹具、现有不同密度项目或隔离浏览器数据模拟验证；不能只测 tOS17.1 单事项：

| 场景 | 必须检查 |
|---|---|
| 多 WorkItem、多 Action | 首个待推进行动优先，其他行动可完整访问；不出现一项一卡堆叠、右栏过长或丢失超过默认展示上限的事项。 |
| 长标题、长 URL、长进展 | 自然换行、不遮挡日期/操作、不产生横向滚动；URL 内容可复制/访问。 |
| 无 Action、无风险 | “暂无待推行动 / 当前无该类信号”的紧凑状态，零值不做大面积庆祝卡。 |
| 无 WBS 或尚未初始化 | 清楚说明无 readiness 数据，保留进入 WBS 的既有入口；不把不存在的 gate 推断为当前 STR。 |
| 多 WBS gate | 当前门禁明确，其余紧凑排列，完整 gate 详情仍可进入；不能生成假 WorkItem。 |
| 历史全部展开 | 事实数量与顺序不变、完整日志可访问；页高自然增长且无横向溢出。 |
| 两个桌面宽度及窄桌面 | 主列与次级列在空间不足时切回单栏，阅读顺序和正文大小保持，导航/编辑/删除入口不丢。 |
| 交互回归 | 原有项目删除确认/禁重/结果反馈、项目编辑、计划/成员/链接维护、事项详情与 Action 完整 workflow 都能按现有路径访问。 |

未来 8.1 实施后执行 `npm.cmd run typecheck`、`npm.cmd run test`、`npm.cmd run lint`、`npm.cmd run build`。对比前后 Git 范围、schema 与数据库哈希/只读数量，确认视觉迁移没有产品数据写入；必要时复核 [真实浏览器审计](../artifacts/browser-audit-20260923/AUDIT.md) 中被本阶段触及的项目页 P1。未改的其他页面不借 8.1 宣称已通过新视觉验收。

## 风险与应对

| 风险 | 应对与停止条件 |
|---|---|
| FINAL 冻结数据，正式页动态变化 | 所有标题、状态、日期、计数来自现有实时 API；默认限制和展开要显示真实总数。发现字段无法从获准读取路径取得时，降级摘要并记录，不硬编码原型文案。 |
| 多事项/行动增高 | 允许页面自然增长；首项执行信息优先，后续平行列表可展开/跳全部。1250–1550px 只对稀疏对照样本适用。 |
| 当前项目 GET 有 50 项上限 | 不把已加载条数冒充项目总数；保持现有“查看所有事项”入口。若视觉需求需要完整项目清单，属于独立查询范围。 |
| 两个只读 Action/Project 请求有时间差 | 以 `projectId`、`workItemId` 关联，保留 loading/失败回退，避免数值与细节在页面同屏矛盾；不得因展示需求改写事务/API。 |
| 长文本与 1440/1920 差异 | 断点按实际可用宽度设计，长标题和 URL 测两宽；不为保住两栏牺牲字号。 |
| 无 Action / Risk / WBS 或多个 gate | 提供各自空状态和完整入口；当前 STR 继续来自 ProjectMilestone，gate 仅表示 readiness。 |
| 历史展开后页面长度 | 默认少量但保留全部，展开状态按内容自然增加；保存展开/收起的原生浏览器证据。 |
| 编辑、删除、跳转被视觉简化吞没 | 使用明确的操作盘点逐项回归；失败反馈、禁重、确认和危险层级继续可见。 |
| 旧 CSS 级联与深色主题 | 新规则限定项目页，移除/整理冲突旧覆盖；双主题、焦点与长文本回归。若全局规则影响其他页，收窄选择器后再交付。 |

## 本轮边界与下一步

本轮**正式产品代码修改 = 0；业务逻辑影响 = 0；数据库、schema、API 与测试文件修改 = 0**。没有修改 `src/**`、`prisma/**`、`tests/**`、`artifacts/**`，没有处理原有 `docs/hermes-workhub-v1.md` 删除状态，没有 commit/push/reset/restore/stash。只交付两份新的 docs。

用户查看并确认 [Visual Design Spec](workhub-v3-visual-design-spec.md) 与本文后，再启动 **Phase 8.1 Project Detail Pilot**。开始实施前先确认上文 Action 标题/负责人采用现有只读 GET 还是摘要降级，并再次核对实时 Git、项目服务与业务操作基线；随后只执行 8.1，独立验收，不自动进入 8.2。
