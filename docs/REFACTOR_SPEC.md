# Local Work Hub - 重构规格说明

## 1. 项目定位

### 1.1 核心定位

**Local Work Hub** 是一个面向手机 OS 软件项目经理的**本地工作事项集散中心**。

它只负责：
- 记录事实
- 管理事项
- 导出上下文

**绝对禁止：不要内置任何 AI 能力。**

### 1.2 禁止清单

| 禁止项 | 说明 |
|---|---|
| `/ai` 路由 | 删除，不保留 |
| `/ai/settings` 路由 | 删除，不保留 |
| `AiAgent` model | 从 Prisma schema 中删除 |
| AI Provider / API Key / Agent 配置 | 全部删除 |
| OpenAI / Claude / Codex API 调用 | 不接、不做 |
| RAG / MCP / 向量数据库 | 不做 |
| 登录 / 多用户 | 不做 |
| 飞书 API 集成 | 不做 |
| Work Hub 调用 AI | 禁止 |
| AI 写回数据库 | 禁止 |

---

## 2. 数据模型

### 2.1 WorkItem（工作事项）

持续跟踪的工作事项，有生命周期（open → following/blocked → closed）。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `id` | String (cuid) | 自动 | - | 主键 |
| `title` | String | ✅ | - | 事项标题 |
| `description` | String? | ❌ | null | 事项描述 |
| `project` | String? | ❌ | null | 所属项目 |
| `module` | String? | ❌ | null | 所属模块 |
| `type` | String | ❌ | `"task"` | 类型，可选值：`task` / `risk` / `issue` / `decision` / `blocker` / `other` |
| `priority` | String | ❌ | `"P2"` | 优先级，可选值：`P0` / `P1` / `P2` / `P3` |
| `status` | String | ❌ | `"open"` | 状态，可选值：`open` / `following` / `blocked` / `closed` |
| `owner` | String? | ❌ | null | 责任人 |
| `dueDate` | String? | ❌ | null | 截止日期，格式 `YYYY-MM-DD` |
| `nextAction` | String? | ❌ | null | 下一步行动 |
| `tags` | String? | ❌ | null | 标签 |
| `createdAt` | DateTime | 自动 | now | 创建时间 |
| `updatedAt` | DateTime | 自动 | - | 更新时间 |
| `closedAt` | DateTime? | ❌ | null | 关闭时间 |
| `logs` | WorkLog[] | 关联 | - | 关联的工作日志 |

### 2.2 WorkLog（工作日志）

每天发生的一条工作记录，可以独立存在，也可以关联到 WorkItem。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `id` | String (cuid) | 自动 | - | 主键 |
| `workDate` | String | ✅ | 本地当天 | 工作日期，格式 `YYYY-MM-DD` |
| `title` | String | ✅ | - | 日志标题 |
| `content` | String | ✅ | - | 日志内容 |
| `type` | String | ❌ | `"note"` | 类型，可选值：`note` / `meeting` / `update` / `risk` / `decision` / `todo` / `feishu` / `issue` / `blocker` / `other` |
| `source` | String | ❌ | `"manual"` | 来源，可选值：`manual` / `meeting` / `feishu` / `phone` / `mail` / `other` |
| `project` | String? | ❌ | null | 所属项目 |
| `module` | String? | ❌ | null | 所属模块 |
| `tags` | String? | ❌ | null | 标签 |
| `itemId` | String? | ❌ | null | 关联 WorkItem ID |
| `item` | WorkItem? | 关联 | - | 关联的 WorkItem |
| `createdAt` | DateTime | 自动 | now | 创建时间 |
| `updatedAt` | DateTime | 自动 | - | 更新时间 |

### 2.3 状态规则

| 规则 | 触发条件 | 行为 |
|---|---|---|
| 自动写入 `closedAt` | `status` 从非 `closed` 改为 `closed` | 将 `closedAt` 设为当前时间 |
| 自动清空 `closedAt` | `status` 从 `closed` 改回 `open` / `following` / `blocked` | 将 `closedAt` 设为 `null` |
| 删除 WorkItem 时保护 WorkLog | 删除 WorkItem | 不删除关联的 WorkLog，只将 `WorkLog.itemId` 置为 `null` |

---

## 3. 页面路由

### 3.1 保留页面

| 路由 | 页面 | 说明 |
|---|---|---|
| `/` | Dashboard | 首页仪表盘 |
| `/items` | WorkItem 列表 | 工作事项列表，支持筛选 |
| `/items/new` | 新增 WorkItem | 创建新事项 |
| `/items/[id]` | WorkItem 详情 | 事项详情 + 关联 WorkLog 时间线 |
| `/items/[id]/edit` | 编辑 WorkItem | 编辑事项 |
| `/logs` | WorkLog 列表 | 工作日志列表，支持筛选 |
| `/logs/new` | 新增 WorkLog | 创建新日志 |
| `/logs/[id]` | WorkLog 详情 | 日志详情 |
| `/logs/[id]/edit` | 编辑 WorkLog | 编辑日志 |
| `/today` | 今日视图 | 今日工作汇总 |
| `/export/today` | 今日导出 | 服务端渲染 Markdown |
| `/export/range` | 范围导出 | 服务端渲染 Markdown |
| `/stats` | 统计页 | 数据统计 |

### 3.2 删除页面

| 路由 | 原页面 | 原因 |
|---|---|---|
| `/ai` | AI Prompt 生成 | 不内置 AI |
| `/ai/settings` | AI Agent 管理 | 不内置 AI |

---

## 4. Dashboard 展示内容

首页 `/` 需要展示以下信息：

| 数据项 | 说明 |
|---|---|
| Open 事项数量 | `status = "open"` 的 WorkItem |
| Following 事项数量 | `status = "following"` 的 WorkItem |
| Blocked 事项数量 | `status = "blocked"` 的 WorkItem |
| P0 未关闭事项数 | `priority = "P0" AND status != "closed"` |
| P1 未关闭事项数 | `priority = "P1" AND status != "closed"` |
| 今日新增日志数 | `WorkLog.workDate = today` |
| 今日关闭事项数 | `WorkItem.closedAt` 在今天 |
| 今日到期事项 | `WorkItem.dueDate = today AND status != "closed"` |
| 逾期未关闭事项 | `WorkItem.dueDate < today AND status != "closed"` |
| 最近 10 条 WorkLog | 按 `createdAt` 降序 |
| 最近更新 10 个 WorkItem | 按 `updatedAt` 降序 |

---

## 5. WorkItem 功能要求

### 5.1 CRUD 操作

- 新增 WorkItem
- 编辑 WorkItem
- 删除 WorkItem（不删除关联 WorkLog，只清空 `itemId`）
- 查看 WorkItem 详情

### 5.2 状态操作

- 修改状态（open / following / blocked / closed）
- 标记为 closed 时自动写入 `closedAt`
- 从 closed 改回其他状态时自动清空 `closedAt`

### 5.3 列表筛选条件

| 筛选项 | 说明 |
|---|---|
| 项目 (project) | 按项目筛选 |
| 模块 (module) | 按模块筛选 |
| 类型 (type) | task / risk / issue / decision / blocker / other |
| 优先级 (priority) | P0 / P1 / P2 / P3 |
| 状态 (status) | open / following / blocked / closed |
| 责任人 (owner) | 按责任人筛选 |
| 关键词 | 搜索 title / description |
| 是否逾期 | `dueDate < today AND status != "closed"` |

### 5.4 详情页功能

- 展示 WorkItem 完整信息
- 展示关联 WorkLog 时间线（按 `workDate` 降序）
- 支持添加关联 WorkLog（从详情页跳转到新增日志页，自动带入 `itemId`）
- 支持复制为 Markdown 格式

---

## 6. WorkLog 功能要求

### 6.1 CRUD 操作

- 新增 WorkLog
- 编辑 WorkLog
- 删除 WorkLog
- 查看 WorkLog 详情

### 6.2 关联 WorkItem

- 可以不关联 WorkItem（`itemId = null`）
- 可以关联已有 WorkItem（选择已有事项）
- 新增时可以选择创建新 WorkItem 并自动关联

### 6.3 列表筛选条件

| 筛选项 | 说明 |
|---|---|
| 日期范围 | `workDate` 在 start ~ end 之间 |
| 项目 (project) | 按项目筛选 |
| 模块 (module) | 按模块筛选 |
| 类型 (type) | note / meeting / update / risk / decision / todo / feishu / issue / blocker / other |
| 来源 (source) | manual / meeting / feishu / phone / mail / other |
| 是否关联事项 | `itemId` 是否为 null |
| 关键词 | 搜索 title / content |

### 6.4 详情页功能

- 展示 WorkLog 完整信息
- 展示关联的 WorkItem 信息（如有）
- 支持复制为 Markdown 格式

---

## 7. Today 页面展示内容

`/today` 页面需要展示以下信息：

| 序号 | 内容 | 查询条件 |
|---|---|---|
| 1 | 今日新增日志 | `WorkLog.workDate = today` |
| 2 | 今日关闭事项 | `WorkItem.closedAt` 在今天 |
| 3 | 今日更新事项 | `WorkItem.updatedAt` 在今天 |
| 4 | 当前 P0/P1 未关闭事项 | `priority IN ("P0", "P1") AND status != "closed"` |
| 5 | 今日到期事项 | `WorkItem.dueDate = today AND status != "closed"` |
| 6 | 逾期未关闭事项 | `WorkItem.dueDate < today AND status != "closed"` |
| 7 | 今日风险/阻塞日志 | `workDate = today AND type IN ("risk", "blocker")` |
| 8 | 今日决策日志 | `workDate = today AND type = "decision"` |

---

## 8. 导出功能

### 8.1 导出页面

| 页面 | 说明 |
|---|---|
| `/export/today` | 导出今日工作内容为 Markdown |
| `/export/range?start=YYYY-MM-DD&end=YYYY-MM-DD` | 导出指定日期范围的工作内容为 Markdown |

**重要约束：**
1. `/export/today` 必须**服务端渲染** Markdown，不跳转，不依赖 client state
2. `/export/range` 必须**服务端渲染** Markdown，不跳转，不依赖 client state
3. 导出内容要保留完整事实记录
4. 页面顶部要有给外部 AI 总结日报/周报的提示词
5. Work Hub **只导出内容，不调用 AI**

### 8.2 导出 API

| API | 参数 | 返回格式 |
|---|---|---|
| `GET /api/export/today` | `?format=markdown` | Markdown 文本 |
| `GET /api/export/today` | `?format=json` | JSON 数据 |
| `GET /api/export/range` | `?start=YYYY-MM-DD&end=YYYY-MM-DD&format=markdown` | Markdown 文本 |
| `GET /api/export/range` | `?start=YYYY-MM-DD&end=YYYY-MM-DD&format=json` | JSON 数据 |

---

## 9. 本地脚本

### 9.1 脚本目录

在项目根目录创建 `scripts/` 目录，包含以下脚本：

| 脚本 | 用途 |
|---|---|
| `export-today.mjs` | 从本地 Work Hub 拉取今日 Markdown |
| `export-week.mjs` | 从本地 Work Hub 拉取本周 Markdown |
| `daily-claude.sh` | 调用 Claude Code 生成日报 |
| `daily-codex.sh` | 调用 Codex CLI 生成日报 |
| `weekly-claude.sh` | 调用 Claude Code 生成周报 |
| `weekly-codex.sh` | 调用 Codex CLI 生成周报 |

### 9.2 脚本行为

所有脚本只做以下事情：
1. 从本地 Work Hub 拉取 Markdown（通过 `curl` 调用导出 API）
2. 保存到 `.local-ai/exports/` 目录
3. 调用本地 `claude` 或 `codex` 命令处理 Markdown
4. 输出到 `.local-ai/reports/` 目录
5. **不写回数据库**

---

## 10. package.json scripts

`package.json` 的 `scripts` 字段必须包含以下命令：

| 命令 | 说明 |
|---|---|
| `dev` | 本地开发服务器 |
| `build` | 生产构建 |
| `start` | 生产启动 |
| `typecheck` | TypeScript 类型检查 |
| `lint` | ESLint 代码检查 |
| `db:push` | 推送 Prisma schema 到数据库 |
| `db:studio` | 打开 Prisma Studio |
| `export:today` | 运行今日导出脚本 |
| `export:week` | 运行本周导出脚本 |
| `report:today:claude` | 调用 Claude 生成日报 |
| `report:today:codex` | 调用 Codex 生成日报 |

---

## 11. .gitignore 必须包含

```
.env
.local-ai/
prisma/dev.db
*.db
```

---

## 12. README 必须重写

README.md 必须包含以下章节：

1. **项目定位** - Local Work Hub 是什么
2. **WorkItem vs WorkLog** - 两个核心模型的区别
3. **安装方式** - `npm install`
4. **数据库初始化** - `npm run db:push`
5. **本地启动** - `npm run dev`
6. **页面说明** - 各页面功能简介
7. **如何使用 /export/today** - 导出今日内容
8. **如何使用 /export/range** - 导出日期范围内容
9. **如何用 Claude Code / Codex CLI 生成日报周报** - 脚本使用说明
10. **明确说明** - 本项目不内置 AI、不接 API、不做多用户、不做飞书集成

---

## 13. 执行约束

### 13.1 分阶段执行

重构分 4 个 Phase 执行，每个 Phase 完成后必须通过检查：

```
npm run typecheck
npm run lint
npm run build
```

**如果失败，必须先修复再进入下一阶段。**

### 13.2 严格范围

- 只实现本规格说明中要求的功能
- 不新增未要求的功能
- 不改变项目的核心定位（本地工作事项集散中心）

---

## 附录 A：原 Note 模型到新模型的映射

| 原字段 | 新模型 | 新字段 |
|---|---|---|
| `title` | WorkItem / WorkLog | `title` |
| `content` | WorkLog | `content` |
| `project` | WorkItem / WorkLog | `project` |
| `module` | WorkItem / WorkLog | `module` |
| `type` | WorkItem / WorkLog | `type` |
| `priority` | WorkItem | `priority` |
| `status` | WorkItem | `status` |
| `owner` | WorkItem | `owner` |
| `dueDate` | WorkItem | `dueDate` |
| `source` | WorkLog | `source` |
| `tags` | WorkItem / WorkLog | `tags` |

### 映射规则

- 持续跟踪的事项（有 status 生命周期）→ **WorkItem**
- 每天发生的一次性记录 → **WorkLog**
- 原 `Note` 表数据需要根据业务语义迁移到对应的新表
