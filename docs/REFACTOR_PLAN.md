# Local Work Hub - 重构执行计划

## 概述

本计划将 `local-work-log` 重构为 `Local Work Hub`，分 4 个阶段执行，每个阶段完成后需通过质量检查。

---

## Phase 1：清理 AI 相关代码

**目标：** 删除所有 AI 相关的代码、路由、模型、导航项。

### 1.1 删除 AI 相关文件

| 文件/目录 | 操作 |
|---|---|
| `src/app/ai/page.tsx` | 删除 |
| `src/app/ai/settings/page.tsx` | 删除 |
| `src/app/ai/` 目录 | 删除 |
| `src/app/api/ai-providers/route.ts` | 删除 |
| `src/app/api/ai-providers/[id]/route.ts` | 删除 |
| `src/app/api/ai-providers/` 目录 | 删除 |

### 1.2 修改 Prisma Schema

- 删除 `AiAgent` model
- 保留 `Note` model（Phase 2 再重构）

### 1.3 修改导航栏

编辑 `src/components/Navbar.tsx`：
- 移除 `/ai` 导航项
- 移除 `/ai/settings` 导航项
- 保留其他导航项（后续 Phase 会重命名）

### 1.4 清理代码引用

搜索并删除所有 AI 相关的引用：
- `grep -r "ai" src/ --include="*.ts" --include="*.tsx"`
- 删除 `AiAgent` 相关的 import、类型定义、API 调用
- 删除 `src/lib/types.ts` 中的 `AiAgent` 类型
- 删除 `src/lib/constants.ts` 中 AI 相关的常量（如果有）

### 1.5 质量检查

```bash
npm run typecheck
npm run lint
npm run build
```

**通过标准：** 无错误、无警告（或仅有预期内的警告）

---

## Phase 2：重构数据模型

**目标：** 重构 Prisma schema 为 `WorkItem` + `WorkLog`，实现数据库和基础工具函数。

### 2.1 更新 Prisma Schema

编辑 `prisma/schema.prisma`：

```prisma
model WorkItem {
  id          String     @id @default(cuid())
  title       String
  description String?
  project     String?
  module      String?
  type        String     @default("task")
  priority    String     @default("P2")
  status      String     @default("open")
  owner       String?
  dueDate     String?
  nextAction  String?
  tags        String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  closedAt    DateTime?
  logs        WorkLog[]
}

model WorkLog {
  id        String    @id @default(cuid())
  workDate  String
  title     String
  content   String
  type      String    @default("note")
  source    String    @default("manual")
  project   String?
  module    String?
  tags      String?
  itemId    String?
  item      WorkItem? @relation(fields: [itemId], references: [id])
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

### 2.2 推送数据库

```bash
npm run db:push
```

### 2.3 更新 TypeScript 类型

编辑 `src/lib/types.ts`：
- 删除 `Note` 和 `AiAgent` 类型
- 添加 `WorkItem` 和 `WorkLog` 类型

```typescript
export interface WorkItem {
  id: string;
  title: string;
  description?: string | null;
  project?: string | null;
  module?: string | null;
  type: 'task' | 'risk' | 'issue' | 'decision' | 'blocker' | 'other';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'open' | 'following' | 'blocked' | 'closed';
  owner?: string | null;
  dueDate?: string | null;
  nextAction?: string | null;
  tags?: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date | null;
  logs?: WorkLog[];
}

export interface WorkLog {
  id: string;
  workDate: string;
  title: string;
  content: string;
  type: 'note' | 'meeting' | 'update' | 'risk' | 'decision' | 'todo' | 'feishu' | 'issue' | 'blocker' | 'other';
  source: 'manual' | 'meeting' | 'feishu' | 'phone' | 'mail' | 'other';
  project?: string | null;
  module?: string | null;
  tags?: string | null;
  itemId?: string | null;
  item?: WorkItem | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.4 更新常量

编辑 `src/lib/constants.ts`：
- 删除 `Note` 相关的常量
- 添加 `WorkItem` 和 `WorkLog` 的类型、优先级、状态、来源等常量

### 2.5 更新工具函数

编辑 `src/lib/utils.ts`：
- 删除或重构与 `Note` 相关的工具函数
- 添加 `WorkItem` 和 `WorkLog` 相关的工具函数：
  - 日期格式化
  - 记录分组
  - Markdown 生成
  - 筛选条件构建

### 2.6 质量检查

```bash
npm run typecheck
npm run lint
npm run build
```

**通过标准：** 无错误（允许有页面相关的警告，因为页面还未更新）

---

## Phase 3：实现页面功能

**目标：** 实现 WorkItem / WorkLog 的页面、CRUD、筛选、详情、时间线、Today、Stats。

### 3.1 创建 API 路由

#### WorkItem API

| 路由 | 方法 | 功能 |
|---|---|---|
| `src/app/api/items/route.ts` | GET | 获取列表（支持筛选） |
| `src/app/api/items/route.ts` | POST | 创建新事项 |
| `src/app/api/items/[id]/route.ts` | GET | 获取单个事项详情 |
| `src/app/api/items/[id]/route.ts` | PUT | 更新事项 |
| `src/app/api/items/[id]/route.ts` | DELETE | 删除事项（不清空 WorkLog.itemId） |

#### WorkLog API

| 路由 | 方法 | 功能 |
|---|---|---|
| `src/app/api/logs/route.ts` | GET | 获取列表（支持筛选） |
| `src/app/api/logs/route.ts` | POST | 创建新日志 |
| `src/app/api/logs/[id]/route.ts` | GET | 获取单条日志详情 |
| `src/app/api/logs/[id]/route.ts` | PUT | 更新日志 |
| `src/app/api/logs/[id]/route.ts` | DELETE | 删除日志 |

#### Stats API

| 路由 | 方法 | 功能 |
|---|---|---|
| `src/app/api/stats/route.ts` | GET | 获取统计数据 |

### 3.2 更新组件

#### Navbar 组件

编辑 `src/components/Navbar.tsx`：
- 更新导航项：Dashboard、Work Items、Work Logs、Today、Stats、Export
- 移除 AI 相关导航

#### 新增组件

| 组件 | 文件 | 功能 |
|---|---|---|
| `WorkItemCard` | `src/components/WorkItemCard.tsx` | WorkItem 卡片展示 |
| `WorkLogCard` | `src/components/WorkLogCard.tsx` | WorkLog 卡片展示 |
| `FilterBar` | `src/components/FilterBar.tsx` | 通用筛选栏 |
| `Timeline` | `src/components/Timeline.tsx` | 时间线组件（用于详情页） |
| `StatsCard` | `src/components/StatsCard.tsx` | 统计卡片 |

### 3.3 实现页面

#### Dashboard (`/`)

- 展示 open/following/blocked 事项数量
- 展示 P0/P1 未关闭事项数量
- 展示今日新增日志数量
- 展示今日关闭事项数量
- 展示今日到期事项
- 展示逾期未关闭事项
- 展示最近 10 条 WorkLog
- 展示最近更新 10 个 WorkItem

#### WorkItem 列表 (`/items`)

- 展示 WorkItem 列表
- 支持筛选：项目、模块、类型、优先级、状态、owner、关键词、是否逾期
- 支持分页
- 支持复制 Markdown

#### 新增 WorkItem (`/items/new`)

- 表单：title、description、project、module、type、priority、status、owner、dueDate、nextAction、tags
- 提交后跳转到详情页

#### WorkItem 详情 (`/items/[id]`)

- 展示 WorkItem 完整信息
- 展示关联 WorkLog 时间线（按 workDate 降序）
- 支持添加关联 WorkLog（跳转到新增日志页，带 itemId 参数）
- 支持修改状态
- 支持标记为 closed
- 支持复制 Markdown

#### 编辑 WorkItem (`/items/[id]/edit`)

- 表单：同新增，预填充现有数据
- 提交后跳转到详情页

#### WorkLog 列表 (`/logs`)

- 展示 WorkLog 列表
- 支持筛选：日期范围、项目、模块、类型、来源、是否关联事项、关键词
- 支持分页
- 支持复制 Markdown

#### 新增 WorkLog (`/logs/new`)

- 表单：workDate、title、content、type、source、project、module、tags、itemId
- 支持选择已有 WorkItem 关联
- 支持创建新 WorkItem 并关联
- 如果 URL 带 `?itemId=xxx`，自动关联该事项

#### WorkLog 详情 (`/logs/[id]`)

- 展示 WorkLog 完整信息
- 展示关联的 WorkItem 信息（如有）
- 支持复制 Markdown

#### 编辑 WorkLog (`/logs/[id]/edit`)

- 表单：同新增，预填充现有数据
- 提交后跳转到详情页

#### Today 页面 (`/today`)

- 展示今日新增日志
- 展示今日关闭事项
- 展示今日更新事项
- 展示当前 P0/P1 未关闭事项
- 展示今日到期事项
- 展示逾期未关闭事项
- 展示今日风险/阻塞日志
- 展示今日决策日志

#### Stats 页面 (`/stats`)

- 展示各种统计数据（图表或数字）
- 可选项：按项目、按类型、按优先级、按时间趋势

### 3.4 质量检查

```bash
npm run typecheck
npm run lint
npm run build
```

**通过标准：** 无错误、无警告

---

## Phase 4：实现导出、脚本、文档

**目标：** 实现 Markdown 导出页、导出 API、本地脚本、README、.gitignore。

### 4.1 实现导出 API

#### `/api/export/today`

| 参数 | 说明 |
|---|---|
| `format=markdown` | 返回 Markdown 文本 |
| `format=json` | 返回 JSON 数据 |

**实现逻辑：**
1. 查询今日 WorkLog（`workDate = today`）
2. 查询今日关闭 WorkItem（`closedAt` 在今天）
3. 查询今日更新 WorkItem（`updatedAt` 在今天）
4. 查询当前 P0/P1 未关闭事项
5. 查询今日到期事项
6. 查询逾期未关闭事项
7. 根据 format 参数返回 Markdown 或 JSON

#### `/api/export/range`

| 参数 | 说明 |
|---|---|
| `start=YYYY-MM-DD` | 开始日期 |
| `end=YYYY-MM-DD` | 结束日期 |
| `format=markdown` | 返回 Markdown 文本 |
| `format=json` | 返回 JSON 数据 |

**实现逻辑：**
1. 查询日期范围内的 WorkLog
2. 查询日期范围内关闭的 WorkItem
3. 查询日期范围内更新的 WorkItem
4. 根据 format 参数返回 Markdown 或 JSON

### 4.2 实现导出页面

#### `/export/today`

- **服务端渲染**，不依赖 client state
- 调用 `/api/export/today?format=markdown` 获取 Markdown
- 展示 Markdown 内容
- 页面顶部提供复制按钮
- 页面顶部提供给外部 AI 总结日报的提示词

#### `/export/range`

- **服务端渲染**，不依赖 client state
- 接收 `start` 和 `end` 查询参数
- 调用 `/api/export/range?start=...&end=...&format=markdown` 获取 Markdown
- 展示 Markdown 内容
- 页面顶部提供复制按钮
- 页面顶部提供给外部 AI 总结周报的提示词

### 4.3 创建本地脚本

#### `scripts/export-today.mjs`

```javascript
// 功能：从本地 Work Hub 拉取今日 Markdown
// 保存到：.local-ai/exports/today-YYYY-MM-DD.md
// 使用：curl http://localhost:3000/api/export/today?format=markdown
```

#### `scripts/export-week.mjs`

```javascript
// 功能：从本地 Work Hub 拉取本周 Markdown
// 保存到：.local-ai/exports/week-YYYY-MM-DD.md
// 计算本周一到今天的日期范围
// 使用：curl http://localhost:3000/api/export/range?start=...&end=...&format=markdown
```

#### `scripts/daily-claude.sh`

```bash
#!/bin/bash
# 功能：调用 Claude Code 生成日报
# 步骤：
# 1. 运行 export-today.mjs 导出今日数据
# 2. 调用 claude 命令处理导出的 Markdown
# 3. 输出到 .local-ai/reports/daily-YYYY-MM-DD.md
# 不写回数据库
```

#### `scripts/daily-codex.sh`

```bash
#!/bin/bash
# 功能：调用 Codex CLI 生成日报
# 步骤：
# 1. 运行 export-today.mjs 导出今日数据
# 2. 调用 codex 命令处理导出的 Markdown
# 3. 输出到 .local-ai/reports/daily-YYYY-MM-DD.md
# 不写回数据库
```

#### `scripts/weekly-claude.sh`

```bash
#!/bin/bash
# 功能：调用 Claude Code 生成周报
# 步骤：
# 1. 运行 export-week.mjs 导出本周数据
# 2. 调用 claude 命令处理导出的 Markdown
# 3. 输出到 .local-ai/reports/weekly-YYYY-MM-DD.md
# 不写回数据库
```

#### `scripts/weekly-codex.sh`

```bash
#!/bin/bash
# 功能：调用 Codex CLI 生成周报
# 步骤：
# 1. 运行 export-week.mjs 导出本周数据
# 2. 调用 codex 命令处理导出的 Markdown
# 3. 输出到 .local-ai/reports/weekly-YYYY-MM-DD.md
# 不写回数据库
```

### 4.4 更新 package.json scripts

在 `package.json` 的 `scripts` 中添加：

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "export:today": "node scripts/export-today.mjs",
    "export:week": "node scripts/export-week.mjs",
    "report:today:claude": "bash scripts/daily-claude.sh",
    "report:today:codex": "bash scripts/daily-codex.sh"
  }
}
```

### 4.5 更新 .gitignore

在 `.gitignore` 中添加：

```
.env
.local-ai/
prisma/dev.db
*.db
```

### 4.6 重写 README.md

完全重写 `README.md`，包含以下章节：

```markdown
# Local Work Hub

## 项目定位

Local Work Hub 是一个面向手机 OS 软件项目经理的本地工作事项集散中心。
它只负责记录事实、管理事项、导出上下文，不内置任何 AI 能力。

## WorkItem vs WorkLog

- **WorkItem**：持续跟踪的工作事项，有生命周期（open → following/blocked → closed）
- **WorkLog**：每天发生的一条工作记录，可以独立存在，也可以关联到 WorkItem

## 安装方式

npm install

## 数据库初始化

npm run db:push

## 本地启动

npm run dev

## 页面说明

| 路由 | 说明 |
|---|---|
| `/` | Dashboard 仪表盘 |
| `/items` | WorkItem 列表 |
| `/items/new` | 新增 WorkItem |
| `/items/[id]` | WorkItem 详情 |
| `/logs` | WorkLog 列表 |
| `/logs/new` | 新增 WorkLog |
| `/logs/[id]` | WorkLog 详情 |
| `/today` | 今日工作视图 |
| `/stats` | 统计页面 |
| `/export/today` | 今日 Markdown 导出 |
| `/export/range` | 日期范围 Markdown 导出 |

## 如何使用 /export/today

1. 访问 `http://localhost:3000/export/today`
2. 页面会显示今日工作内容的 Markdown
3. 点击复制按钮，复制到剪贴板
4. 粘贴到外部 AI 工具中生成日报

## 如何使用 /export/range

1. 访问 `http://localhost:3000/export/range?start=2025-01-01&end=2025-01-07`
2. 页面会显示指定日期范围的工作内容的 Markdown
3. 点击复制按钮，复制到剪贴板
4. 粘贴到外部 AI 工具中生成周报

## 如何用 Claude Code / Codex CLI 生成日报周报

### 生成日报

npm run report:today:claude
# 或
npm run report:today:codex

### 生成周报

npm run export:week
# 然后手动调用 Claude/Codex 处理导出的 Markdown

## 明确说明

本项目：
- ❌ 不内置 AI
- ❌ 不接 OpenAI / Claude / Codex API
- ❌ 不做 RAG / MCP / 向量数据库
- ❌ 不做登录 / 多用户
- ❌ 不做飞书集成
- ✅ 只负责记录事实、管理事项、导出上下文
```

### 4.7 质量检查

```bash
npm run typecheck
npm run lint
npm run build
```

**通过标准：** 无错误、无警告

---

## 最终检查清单

完成所有 4 个 Phase 后，输出以下内容：

### 完成了哪些内容

- [ ] Phase 1：删除 AI 相关代码
- [ ] Phase 2：重构数据模型
- [ ] Phase 3：实现页面功能
- [ ] Phase 4：实现导出、脚本、文档

### 删除了哪些 AI 功能

- `/ai` 路由
- `/ai/settings` 路由
- `AiAgent` model
- AI Provider / API Key / Agent 配置
- 所有 AI 相关的 API 调用

### 新数据模型说明

- WorkItem：持续跟踪的工作事项
- WorkLog：每天发生的一条工作记录

### 页面说明

列出所有新页面及其功能

### API 说明

列出所有新 API 及其参数

### 脚本说明

列出所有新脚本及其用途

### 如何启动

```bash
npm install
npm run db:push
npm run dev
```

### 如何重置数据库

```bash
rm prisma/dev.db
npm run db:push
```

### 如何用 Claude/Codex 生成日报周报

```bash
npm run report:today:claude
# 或
npm run report:today:codex
```

### typecheck/lint/build 结果

```bash
npm run typecheck
npm run lint
npm run build
```

### 后续建议

可选的改进方向：
- 添加更多统计图表
- 支持数据导入
- 支持更多导出格式（JSON、CSV）
- 优化移动端体验
- 添加数据备份功能
