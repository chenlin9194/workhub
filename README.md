# WorkHub

WorkHub 是面向个人软件项目经理的关键事实管理控制台。它用于跟踪项目、事项、日志、风险、阻塞、决策、变更和关键节点，支持快速定位、项目快照和日报/周报事实整理。

WorkHub 保持轻量，不是 Jira、ALM、飞书或团队协同平台的替代品，也不追求完整的企业级项目管理、权限和任务协作能力。

## 当前能力

- 工作台：查看今日态势、待处理行动、事项信号和 WBS 待处理队列。
- 项目驾驶舱：维护项目基本信息、阶段、健康度、成员、关键链接、里程碑/计划节点、事项和事实日志。
- 事项与事实：管理关键 WorkItem、WorkLog、行动项，以及项目和事项之间的上下文关系。
- 项目快照与汇报：查看项目状态、信号、交付节点、成员、链接、风险和最近日志，并导出日报或区间/周报事实包。
- 统计概览：查看交付健康、优先级、阻塞和日志活动等指标。
- 工具入口：维护右上角常用外部链接，例如 Jira、Gerrit、Jenkins；只做跳转，不保存凭据或做外部系统同步。
- Hermes + Feishu：WorkHub 提供鉴权 HTTP 接口和业务规则，Hermes Bridge 单独维护 MCP stdio 服务、部署脚本和 Feishu 验收材料。

## WBS 规划与执行

WBS 是项目级执行模块，但任务定义是全局统一的：所有项目共用同一套 WBS 模板，项目只保存自己的初始化结果、节点状态、交付物、检查日期和执行进度，不按项目类型筛选任务。

使用流程：

1. 打开 `/settings/tools` 的“全局 WBS 模板”区域。
2. 上传 `.xlsx` 模板，填写版本，点击“导入并设为当前模板”。系统会校验模板结构，并保存历史模板版本。
3. 打开项目驾驶舱中的 WBS 区块，进入 `/projects/[id]/wbs`。
4. 预览并初始化当前项目的 WBS 执行计划。
5. 在 WBS 总览或 `/projects/[id]/wbs/[gateKey]` 中维护 STR1、STR2、STR3、STR4、STR4A、STR5 各阶段节点。

也可以使用命令行预览或导入模板：

```powershell
npm.cmd run wbs:template:preview -- --dry-run "D:\path\template.xlsx" V2.0
npm.cmd run wbs:template:import -- --apply "D:\path\template.xlsx" V2.0
```

WBS 生成的系统事项由 WBS 执行节点管理，不能通过普通事项接口直接修改状态或删除；需要在 WBS 页面维护。

## 页面入口

- `/`：工作台
- `/projects`：项目列表、新建项目和项目驾驶舱入口
- `/projects/[id]`：项目驾驶舱
- `/projects/[id]/snapshot`：项目快照
- `/projects/[id]/wbs`：项目 WBS 总览
- `/projects/[id]/wbs/[gateKey]`：单个 STR 阶段执行页
- `/items`：事项列表
- `/logs`：事实日志列表
- `/today`：今日行动项和待处理队列
- `/reports`：汇报入口
- `/stats`：统计概览
- `/export/today`：今日日报事实包
- `/export/range`：区间/周报事实包
- `/settings/tools`：工具链接和全局 WBS 模板管理

侧边栏保持分组导航：工作台、项目、事项、汇报；未归档事实和今日行动项位于 Inbox；统计、导出和工具入口位于 Tools。WBS 不作为新的顶层导航，而是从项目和工具入口进入。

## 技术栈

- Next.js 15
- React 19
- TypeScript
- Prisma 6
- SQLite
- ExcelJS：读取 WBS `.xlsx` 模板
- Vitest：自动化测试

主要代码目录：

- `src/app`：页面和 API 路由
- `src/components`：可复用界面组件
- `src/lib`：业务逻辑、类型、筛选和 WBS 服务
- `prisma/schema.prisma`：数据模型
- `scripts`：数据库备份、恢复校验、导出和 WBS 模板命令
- `tests`：自动化测试

## 本地启动

Windows PowerShell：

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run db:push
npm.cmd run dev
```

默认使用本地 SQLite 数据库 `prisma/dev.db`，不需要单独安装数据库服务。`.env`、数据库文件、备份文件和真实凭据均不纳入 Git。

常用验证命令：

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

如果只修改了前端或业务代码，通常执行 `typecheck`、`test` 和 `build` 即可；修改 Prisma schema 后还要执行：

```powershell
npm.cmd run db:push
```

## 数据库备份与恢复

本地数据库位于 `prisma/dev.db`。备份会写入 `.workhub/backups/`，并自动做 SQLite 完整性校验：

```powershell
npm.cmd run db:backup
npm.cmd run db:restore-check -- "D:\path\workhub-backup.db"
```

恢复前建议先运行 `db:backup`，再停止开发服务器，将备份文件复制为 `prisma/dev.db`，最后重新启动应用并用 `db:restore-check` 校验。数据库是本机运行数据，不会通过 Git commit 或 push 同步到 GitHub。

## Hermes + Feishu Integration

WorkHub owns the authenticated HTTP endpoint and its business rules. The Hermes stdio server, WSL installation scripts, deployment runbook, skill, and Feishu acceptance prompts live in the separate [WorkHub Hermes Bridge repository](https://github.com/chenlin9194/workhub-hermes-bridge).

修改这条链路前，请先阅读 [`AGENTS.md`](AGENTS.md) 和 [`docs/hermes-workhub-v1.md`](docs/hermes-workhub-v1.md)，再阅读 [Bridge deployment runbook](https://github.com/chenlin9194/workhub-hermes-bridge/blob/main/docs/company-deployment.md)。

配置项位于 `.env`：

```dotenv
DATABASE_URL="file:./dev.db"
HERMES_WORKHUB_TOKEN=""
```

生产环境调用 `POST /api/integrations/hermes/workhub` 时使用 `Authorization: Bearer <HERMES_WORKHUB_TOKEN>`。不要把 token、`.env`、数据库或 Hermes 配置提交到 Git。WorkHub 不提供删除 MCP 工具；被跟踪事项的状态变更会产生系统变更日志，其他操作遵循现有 Web API 的日志边界。

## 设计边界

适合收录：

- 关键风险、阻塞、决策和变更
- 关键里程碑和项目节点
- 需要持续跟踪的事项
- 可用于日报、周报和项目快照的事实日志

不适合收录：

- 全量需求、全量 bug 或完整会议全文
- 细粒度执行任务树的全面镜像
- 完整文档库
- 企业权限、多用户协同和复杂审批流程

后续扩展应优先保持项目驾驶舱和事实导航清晰，避免增加大量顶层导航、复杂权限系统、Jira/ALM 全量同步或不必要的外部 AI 集成。
