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

## 数据库初始化

```bash
npm run db:push
```

## 本地启动

```bash
npm run dev
```

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

```bash
npm run report:today:claude
# 或
npm run report:today:codex
```

### 生成周报

```bash
npm run export:week
# 然后手动调用 Claude/Codex 处理导出的 Markdown
```

## 明确说明

本项目：
- ❌ 不内置 AI
- ❌ 不接 OpenAI / Claude / Codex API
- ❌ 不做 RAG / MCP / 向量数据库
- ❌ 不做登录 / 多用户
- ❌ 不做飞书集成
- ✅ 只负责记录事实、管理事项、导出上下文
