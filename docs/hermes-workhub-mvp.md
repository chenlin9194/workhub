# Hermes + WorkHub MVP 接入说明

这份说明用于在家里先跑通飞书 Hermes 智能体读写 WorkHub，后续迁移到公司环境时可直接复制。

## 目标

让飞书中的 Hermes 智能体成为 WorkHub 的自然语言入口和出口：

- 在飞书里说自然语言。
- Hermes 负责理解、拆解、追问。
- Hermes 调用 WorkHub 的工具 API。
- WorkHub 只保存结构化项目事实，不接入大模型。

## 最小架构

```text
飞书 Bot / Hermes
        |
        | HTTP POST
        v
WorkHub Hermes 工具入口
/api/integrations/hermes/workhub
        |
        v
WorkHub 现有数据模型
Project / WorkItem / WorkLog / ActionItem / ProjectMilestone / ProjectMember
```

## WorkHub 新增入口

统一接口：

```http
POST http://localhost:3000/api/integrations/hermes/workhub
Authorization: Bearer <HERMES_WORKHUB_TOKEN>
Content-Type: application/json
```

请求格式：

```json
{
  "tool": "工具名",
  "input": {
    "字段": "值"
  }
}
```

如果 `.env` 没有设置 `HERMES_WORKHUB_TOKEN`，本地 MVP 会允许调用，但只适合家里实验。公司使用必须设置 token。

## WSL Hermes 接入方式

当前本机 Hermes 在 WSL 中：

```text
/home/linchen/.local/bin/hermes
Hermes Agent v0.13.0
```

Hermes 已支持 MCP，因此推荐把 WorkHub 接成 MCP server，而不是让 Hermes 点网页。

### 1. 启动 WorkHub

在 Windows 项目目录启动 WorkHub：

```bash
npm.cmd run dev
```

默认地址：

```text
http://127.0.0.1:3000
```

如果 WorkHub 不是 3000 端口，后面配置 `WORKHUB_BASE_URL` 时改成实际地址。

### 2. 在 Hermes 中添加 MCP server

在 PowerShell 中执行：

```powershell
wsl.exe -d Ubuntu-22.04 -u linchen sh -lc "hermes mcp add workhub --command node --args '/mnt/d/个人web/scripts/hermes-workhub-mcp.mjs' --env WORKHUB_BASE_URL=http://127.0.0.1:3000"
```

本机已经执行过这一步，并且 Hermes 已保存：

```text
workhub  node /mnt/d/个人web/scripts/hermes-workhub-mcp.mjs  all tools enabled
```

如果你设置了 token：

```powershell
wsl.exe -d Ubuntu-22.04 -u linchen sh -lc "hermes mcp add workhub --command node --args '/mnt/d/个人web/scripts/hermes-workhub-mcp.mjs' --env WORKHUB_BASE_URL=http://127.0.0.1:3000 HERMES_WORKHUB_TOKEN=your-token"
```

### 3. 测试 MCP server

```powershell
wsl.exe -d Ubuntu-22.04 -u linchen sh -lc "hermes mcp test workhub"
```

查看是否已添加：

```powershell
wsl.exe -d Ubuntu-22.04 -u linchen sh -lc "hermes mcp list"
```

本机验证结果：

```text
✓ Connected
✓ Tools discovered: 9
workhub all tools enabled
```

### 4. 日常使用前检查

每次使用 Hermes 操作 WorkHub 前，确认 WorkHub 正在运行：

```bash
npm.cmd run dev
```

如果需要快速检查 WorkHub 接口：

```powershell
Invoke-WebRequest -UseBasicParsing `
  -Uri "http://127.0.0.1:3000/api/integrations/hermes/workhub" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"tool":"health"}'
```

### 5. Hermes 中的使用方式

添加成功后，Hermes 会看到 WorkHub 工具，例如：

```text
workhub:search_project
workhub:create_project_log
workhub:create_work_item_with_actions
workhub:update_project_milestone
workhub:create_project_member
```

你可以在 Hermes CLI 中测试：

```bash
hermes -z "查一下 WorkHub 里有没有 XX项目，并告诉我匹配结果"
```

或：

```bash
hermes -z "在 WorkHub 的 XX项目里创建一条决策日志：150版本范围冻结，后续新增需求进入下一版本。"
```

## 支持的工具

### 1. health

检查接口是否可用。

```json
{
  "tool": "health"
}
```

### 2. search_project

按项目名、编号、描述、标签搜索项目。

```json
{
  "tool": "search_project",
  "input": {
    "keyword": "XX项目"
  }
}
```

### 3. get_project_snapshot

查询项目状态、成员、里程碑、事项、日志等摘要。

```json
{
  "tool": "get_project_snapshot",
  "input": {
    "projectKeyword": "XX项目"
  }
}
```

### 4. list_project_milestones

列出某个项目的里程碑/计划节点。

```json
{
  "tool": "list_project_milestones",
  "input": {
    "projectKeyword": "XX项目"
  }
}
```

### 5. update_project_milestone

更新项目里程碑。

```json
{
  "tool": "update_project_milestone",
  "input": {
    "projectKeyword": "XX项目",
    "milestoneKeyword": "150版本发布",
    "patch": {
      "plannedEndDate": "2026-08-01",
      "status": "in_progress",
      "owner": "张三"
    }
  }
}
```

可更新字段：

```text
title
description
status
stage
planType
dateMode
plannedStartDate
plannedEndDate
actualStartDate
actualEndDate
owner
sourceUrl
sortOrder
```

日期必须是 `YYYY-MM-DD`。

### 6. create_project_member

新增项目成员。

```json
{
  "tool": "create_project_member",
  "input": {
    "projectKeyword": "XX项目",
    "name": "张三",
    "role": "测试负责人",
    "team": "测试组",
    "responsibility": "150版本测试协调",
    "isCore": true
  }
}
```

### 7. create_work_item_with_actions

创建事项，并在事项下创建 action items。

```json
{
  "tool": "create_work_item_with_actions",
  "input": {
    "projectKeyword": "XX项目",
    "title": "150版本发布",
    "type": "milestone",
    "priority": "P2",
    "status": "open",
    "dueDate": "2026-08-01",
    "actionItems": [
      "准备发布清单",
      "确认测试报告",
      "通知业务方"
    ],
    "sourceSystem": "feishu-hermes"
  }
}
```

Action item 也可以写成对象：

```json
{
  "title": "确认测试报告",
  "owner": "李四",
  "dueDate": "2026-07-30"
}
```

### 8. create_project_log

创建项目日志。适合记录决策、风险、变更、阻塞、会议结论等。

```json
{
  "tool": "create_project_log",
  "input": {
    "projectKeyword": "XX项目",
    "title": "决策：150版本发布范围冻结",
    "content": "会议确认150版本本周冻结发布范围，新增需求进入下一版本。",
    "type": "decision",
    "reportable": true,
    "source": "feishu",
    "sourceUrl": "https://..."
  }
}
```

### 9. create_log_with_followup_action

创建日志，同时创建跟踪待办。

```json
{
  "tool": "create_log_with_followup_action",
  "input": {
    "projectKeyword": "XX项目",
    "title": "需求变更待决策",
    "content": "同事转发：XX需求变更需要项目组确认是否进入150版本。",
    "type": "decision",
    "reportable": true,
    "actionItems": [
      {
        "title": "确认需求变更是否进入150版本",
        "owner": "王五",
        "dueDate": "2026-07-15"
      }
    ]
  }
}
```

## Hermes 必须遵守的规则

把下面这段复制到 Hermes 的系统提示词或 WorkHub Skill 说明里：

```text
你是 WorkHub 项目助理。你的任务是把飞书里的自然语言转成 WorkHub 的结构化项目记录。

工作原则：
1. WorkHub 是个人项目管理控制台，不是飞书聊天备份。
2. 只记录关键项目事实：项目、事项、日志、风险、阻塞、决策、里程碑、成员、待办。
3. 写入前必须先识别项目。
4. 项目不唯一、里程碑不唯一、日期不明确、动作类型不明确时，先追问用户。
5. 不要编造项目、成员、日期、状态。
6. 不执行删除。
7. 日期必须转成 YYYY-MM-DD。
8. 对复杂请求先拆解为计划，再调用工具。
9. 如果 WorkHub 返回 needsConfirmation=true，必须把 candidates 列给用户，让用户选择 id 或名称后再继续。
10. 只有用户明确说“记录为可汇报内容”，或内容属于决策、风险、阻塞、问题，才设置 reportable=true。
11. 完成后用飞书返回简短结果和 WorkHub 链接。
```

## 四个场景怎么调用

### 场景 1：里程碑变更 + 新增成员

用户说：

```text
XX项目里程碑节点发生变更，150版本发布时间改到8月1日，新增成员张三，负责测试协调。
```

Hermes 动作：

```text
1. search_project
2. list_project_milestones
3. update_project_milestone
4. create_project_member
```

### 场景 2：创建事项 + 多个待办

用户说：

```text
XX项目需要建一个事项，叫150版本发布，截止日期是8/1，有几个待办：准备发布清单、确认测试报告、通知业务方。
```

Hermes 动作：

```text
1. search_project
2. create_work_item_with_actions
```

### 场景 3：转发需求变更，记录日志和跟踪待办

用户说：

```text
这条转发是XX项目需求变更，需要决策，帮我记录并跟踪完成。
```

Hermes 动作：

```text
1. search_project
2. create_log_with_followup_action
```

### 场景 4：会议纪要提取决策日志

用户说：

```text
将这个XX项目的会议纪要理解为一条决策日志，后续可汇报。
```

Hermes 动作：

```text
1. search_project
2. create_project_log, type=decision, reportable=true
```

## 本地测试命令

启动 WorkHub：

```bash
npm.cmd run dev
```

健康检查：

```bash
curl -X POST http://localhost:3000/api/integrations/hermes/workhub ^
  -H "Content-Type: application/json" ^
  -d "{\"tool\":\"health\"}"
```

如果设置了 token：

```bash
curl -X POST http://localhost:3000/api/integrations/hermes/workhub ^
  -H "Authorization: Bearer your-token" ^
  -H "Content-Type: application/json" ^
  -d "{\"tool\":\"health\"}"
```

## 公司环境上线清单

```text
1. 给 WorkHub 或 Bridge 一个公司内网可访问地址。
2. 设置 HERMES_WORKHUB_TOKEN。
3. Hermes 工具调用时带 Authorization: Bearer <token>。
4. Hermes 系统提示词加入上面的安全规则。
5. 先只开放新增/更新，不开放删除。
6. 先让 Hermes 遇到不确定项目/里程碑时追问，不自动猜。
7. 先跑通 search_project、create_project_log、create_work_item_with_actions。
8. 再开放 update_project_milestone 和 create_project_member。
```
