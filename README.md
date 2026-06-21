# Local Work Hub

## 项目定位

Local Work Hub 是一个面向手机 OS 软件项目经理的本地工作事项集散中心。
它只负责记录事实、管理事项、导出上下文，不内置任何 AI 能力。

## WorkItem vs WorkLog

- **WorkItem**：持续跟踪的工作事项，有生命周期（open → following/blocked → closed）
- **WorkLog**：每天发生的一条工作记录，可以独立存在，也可以关联到 WorkItem

## 安装方式

```bash
npm install
```

## 环境配置

创建 `.env` 文件：

```bash
DATABASE_URL="file:./dev.db"
```

## 数据库初始化

```bash
npm run db:push
```

### 重置数据库

```bash
rm prisma/dev.db
npm run db:push
```

## 本地启动

```bash
npm run dev
```

默认绑定 `127.0.0.1:3000`，仅本地访问。

## 页面说明

| 路由 | 说明 |
|---|---|
| `/` | Dashboard 仪表盘 |
| `/items` | WorkItem 列表 |
| `/items/new` | 新增 WorkItem |
| `/items/[id]` | WorkItem 详情 |
| `/items/[id]/edit` | 编辑 WorkItem |
| `/logs` | WorkLog 列表 |
| `/logs/new` | 新增 WorkLog |
| `/logs/[id]` | WorkLog 详情 |
| `/logs/[id]/edit` | 编辑 WorkLog |
| `/today` | 今日工作视图 |
| `/stats` | 统计页面 |
| `/export/today` | 今日 Markdown 导出 |
| `/export/range` | 日期范围 Markdown 导出 |

## WorkItem 操作

### 创建 WorkItem

访问 `/items/new`，填写表单：
- **标题**（必填）
- **描述**（可选）
- **项目/模块**（可选）
- **类型**：task / risk / issue / decision / blocker / other
- **优先级**：P0 / P1 / P2 / P3
- **状态**：open / following / blocked / closed
- **责任人**（可选）
- **截止日期**（可选）
- **下一步行动**（可选）
- **标签**（可选，逗号分隔）

### 查看 WorkItem 列表

访问 `/items`，支持筛选：
- 项目、模块、类型、优先级、状态、责任人
- 关键词搜索
- 逾期事项筛选

### WorkItem 详情

访问 `/items/[id]`，可以：
- 查看完整信息
- 查看关联的 WorkLog 时间线
- 修改状态
- 标记为 closed（自动记录关闭时间）
- 添加关联 WorkLog

## WorkLog 操作

### 创建 WorkLog

访问 `/logs/new`，填写表单：
- **工作日期**（必填，默认今天）
- **标题**（必填）
- **内容**（必填）
- **类型**：note / meeting / update / risk / decision / todo / feishu / issue / blocker / other
- **来源**：manual / meeting / feishu / phone / mail / other
- **项目/模块**（可选）
- **标签**（可选）
- **关联事项**（可选）

### 查看 WorkLog 列表

访问 `/logs`，支持筛选：
- 日期范围、项目、模块、类型、来源
- 是否关联事项
- 关键词搜索

### WorkLog 详情

访问 `/logs/[id]`，可以：
- 查看完整信息
- 查看关联的 WorkItem
- 复制 Markdown

## 如何使用 /export/today

1. 访问 `http://localhost:3000/export/today`
2. 页面会显示今日工作内容的 Markdown
3. 点击复制按钮，复制到剪贴板
4. 粘贴到外部 AI 工具中生成日报

导出内容包含：
- AI 日报提示词（顶部）
- 概览统计
- 一、今日新增日志
- 二、今日关闭事项
- 三、今日更新事项
- 四、当前 P0/P1 未关闭事项
- 五、今日到期事项
- 六、逾期未关闭事项
- 七、今日风险/阻塞
- 八、今日决策

## 如何使用 /export/range

1. 访问 `http://localhost:3000/export/range?start=2025-01-01&end=2025-01-07`
2. 页面会显示指定日期范围的工作内容的 Markdown
3. 点击复制按钮，复制到剪贴板
4. 粘贴到外部 AI 工具中生成周报

## 导出 API

### /api/export/today

```
GET /api/export/today?format=markdown
GET /api/export/today?format=json
```

JSON 字段：
- `workLogs`：今日日志
- `closedItems`：今日关闭事项
- `updatedItems`：今日更新事项
- `openHighPriorityItems`：P0/P1 未关闭事项
- `dueTodayItems`：今日到期事项
- `overdueItems`：逾期未关闭事项
- `riskAndBlockerLogs`：今日风险/阻塞日志
- `decisionLogs`：今日决策日志

### /api/export/range

```
GET /api/export/range?start=YYYY-MM-DD&end=YYYY-MM-DD&format=markdown
GET /api/export/range?start=YYYY-MM-DD&end=YYYY-MM-DD&format=json
```

JSON 字段：
- `workLogs`：日期范围内日志
- `closedItems`：日期范围内关闭事项
- `updatedItems`：日期范围内更新事项

## 如何用 Claude Code / Codex CLI 生成日报周报

### 生成日报

```bash
npm run report:today:claude
# 或
npm run report:today:codex
```

脚本会：
1. 导出今日数据到 `.local-ai/exports/today-YYYY-MM-DD.md`
2. 调用 Claude/Codex 生成日报
3. 输出到 `.local-ai/reports/daily-YYYY-MM-DD.md`

### 生成周报

```bash
npm run report:week:claude
# 或
npm run report:week:codex
```

脚本会：
1. 导出本周数据到 `.local-ai/exports/week-YYYY-MM-DD.md`
2. 调用 Claude/Codex 生成周报
3. 输出到 `.local-ai/reports/weekly-YYYY-MM-DD.md`

### 手动导出

```bash
npm run export:today
npm run export:week
```

## 安全说明

- **默认仅本地访问**：dev server 绑定 `127.0.0.1:3000`
- **不建议暴露到局域网**：如需局域网访问，请自行配置反向代理和认证
- **无认证机制**：本项目不做登录/多用户，适合个人本地使用
- **数据存储**：SQLite 数据库文件 `prisma/dev.db`，请妥善备份

## 非目标说明

本项目：
- ❌ 不内置 AI
- ❌ 不接 OpenAI / Claude / Codex API
- ❌ 不做 RAG / MCP / 向量数据库
- ❌ 不做登录 / 多用户
- ❌ 不做飞书集成
- ✅ 只负责记录事实、管理事项、导出上下文

## 开发命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npm run typecheck    # TypeScript 类型检查
npm run lint         # ESLint 代码检查
npm run db:push      # 推送数据库 schema
npm run db:studio    # 打开 Prisma Studio
```
