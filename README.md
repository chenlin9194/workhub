# WorkHub

## Hermes + Feishu Integration

WorkHub provides the authenticated HTTP endpoint and business rules for Hermes MCP. The Hermes stdio server, WSL installation scripts, deployment runbook, skill, and Feishu acceptance prompts live in the separate [WorkHub Hermes Bridge repository](https://github.com/chenlin9194/workhub-hermes-bridge).

Before changing this integration, read [`AGENTS.md`](AGENTS.md), [`docs/hermes-workhub-v1.md`](docs/hermes-workhub-v1.md), then the [Bridge deployment runbook](https://github.com/chenlin9194/workhub-hermes-bridge/blob/main/docs/company-deployment.md). Do not commit `.env`, database files, Hermes configuration, Feishu credentials, or real tokens.

WorkHub 是一个面向个人的软件项目经理的关键事实管理控制台，也可以理解为“个人项目管理控制台 / 关键事实导航系统”。

它只服务于你真正需要持续跟踪、快速定位、可以汇报的内容，不是完整项目管理系统，也不是 Jira、ALM、飞书或团队协同平台的替代品。

## 项目定位

WorkHub 的目标很明确：

- 个人使用
- 管理关键事实，而不是管理所有细节
- 支撑日报、周报、项目快照
- 快速找到风险、阻塞、决策、变更和关键节点
- 保持轻量，不扩展成全量项目管理系统

## 当前核心能力

WorkHub 第一版已经包含以下能力：

- 工作台 `cockpit`
- 项目管理
- 事项 `WorkItem`
- 日志 `WorkLog`
- 项目详情 `cockpit`
- 项目信号 `signal`
- `signal → filter → list` 导航链路
- 日报、周报、项目快照导出
- 工具链接配置

其中：

- `signalMap` 负责把信号语义映射到列表跳转语义
- `filterLinks` 负责构造列表筛选 URL
- `items` / `logs` 列表页负责读取和同步 URL 筛选条件

## 核心工作流

1. 创建项目
2. 录入关键事项
3. 记录关键日志
4. 通过项目 cockpit 或工作台信号定位风险
5. 进入 `items` / `logs` 列表查看筛选结果
6. 导出日报、周报或项目快照事实包

## 信息收录边界

### 应该收录

- 关键风险
- 关键阻塞
- 关键决策
- 关键变更
- 关键项目节点
- 需要持续跟踪的事项
- 可汇报日志

### 不应该收录

- 全量需求
- 全量 bug
- 所有会议全文
- 细粒度执行任务树
- 完整文档库
- 企业权限和多用户流程

## 当前架构

当前技术栈很简单：

- Next.js
- TypeScript
- Prisma
- SQLite
- URL filter
- `signalMap`
- `filterLinks`

维护时只需要记住两件事：

- 页面层尽量只负责展示、筛选和跳转
- 信号语义和筛选语义分别收口到 `signalMap` 和 `filterLinks`

## 页面入口

主要入口保持简洁：

- `/` 工作台
- `/projects` 项目列表
- `/items` 事项列表
- `/logs` 日志列表
- `/today` 今日视图
- `/reports` 汇报入口
- `/projects/[id]` 项目详情 cockpit

## 启动与验证

Windows 侧使用以下命令：

```bash
npm.cmd install
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev
```

如需同步 Prisma schema，再执行：

```bash
npx prisma db push
```

## 工具链接配置

工具链接在 `/settings/tools` 中维护，用于记录常用外部链接，例如 Jira、Gerrit、Jenkins 等。

原则很简单：

- 只保留本地跳转需要的链接
- 不做账号体系
- 不做权限系统
- 不做多用户协同

## 当前稳定状态

当前 WorkHub 第一版稳定收口到以下状态：

- Phase 11 快速定位完成
- Phase 12 `signal → filter → list` 收敛完成
- Phase 13A freeze 验收通过
- 当前稳定提交：`adc4fe6 feat: unify signal navigation layer with DSL-based routing`

## 维护提醒

后续如果继续扩展，优先遵守这几个约束：

- 不要把它扩成完整项目管理系统
- 不要引入复杂状态管理
- 不要把列表页改成搜索中心或保存视图中心
- 不要把信号映射和筛选构造逻辑分散到各个页面
