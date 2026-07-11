#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const WORKHUB_BASE_URL = (process.env.WORKHUB_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const HERMES_WORKHUB_TOKEN = process.env.HERMES_WORKHUB_TOKEN || "";
const WORKHUB_ENDPOINT = `${WORKHUB_BASE_URL}/api/integrations/hermes/workhub`;

const jsonObject = z.record(z.string(), z.unknown()).default({});

async function callWorkHub(tool, input = {}) {
  const headers = {
    "content-type": "application/json",
  };

  if (HERMES_WORKHUB_TOKEN) {
    headers.authorization = `Bearer ${HERMES_WORKHUB_TOKEN}`;
  }

  const response = await fetch(WORKHUB_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ tool, input }),
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok || data.ok === false) {
    const message = data.error || `WorkHub request failed with HTTP ${response.status}`;
    throw new Error(`${message}\n${JSON.stringify(data, null, 2)}`);
  }

  return data;
}

function toolResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
    structuredContent: data,
  };
}

function registerWorkHubTool(server, name, description, inputSchema) {
  server.registerTool(
    name,
    {
      title: name,
      description,
      inputSchema,
    },
    async (input) => toolResult(await callWorkHub(name, input))
  );
}

const projectLookupSchema = {
  projectId: z.string().optional().describe("Exact WorkHub project id. Prefer this after confirmation."),
  projectKeyword: z.string().optional().describe("Project name/code keyword, for example XX项目."),
  projectName: z.string().optional().describe("Alias of projectKeyword."),
};

const actionItemSchema = z.union([
  z.string(),
  z.object({
    title: z.string(),
    owner: z.string().optional(),
    dueDate: z.string().optional().describe("YYYY-MM-DD"),
    status: z.string().optional(),
    sortOrder: z.number().optional(),
  }),
]);

const patchSchema = z.record(z.string(), z.unknown()).optional();

const itemLookupSchema = {
  ...projectLookupSchema,
  itemId: z.string().optional().describe("Exact WorkHub work item id. Prefer this after confirmation."),
  itemKeyword: z.string().optional().describe("Work item title/content keyword."),
  itemTitle: z.string().optional().describe("Alias of itemKeyword."),
};

const logLookupSchema = {
  ...projectLookupSchema,
  logId: z.string().optional().describe("Exact WorkHub work log id. Prefer this after confirmation."),
  logKeyword: z.string().optional().describe("Work log title/content keyword."),
  logTitle: z.string().optional().describe("Alias of logKeyword."),
};

const actionLookupSchema = {
  ...projectLookupSchema,
  actionItemId: z.string().optional().describe("Exact WorkHub action item id. Prefer this after confirmation."),
  actionItemKeyword: z.string().optional().describe("Action item title keyword."),
  actionItemTitle: z.string().optional().describe("Alias of actionItemKeyword."),
};

const projectCreateSchema = {
  name: z.string().describe("Project name. Required."),
  code: z.string().optional(),
  description: z.string().optional(),
  type: z.string().optional().describe("Defaults to project."),
  status: z.string().optional().describe("Defaults to active."),
  stage: z.string().optional(),
  health: z.string().optional().describe("Defaults to unknown."),
  owner: z.string().optional(),
  pm: z.string().optional(),
  startDate: z.string().optional().describe("YYYY-MM-DD"),
  targetDate: z.string().optional().describe("YYYY-MM-DD"),
  releaseDate: z.string().optional().describe("YYYY-MM-DD"),
  currentSummary: z.string().optional(),
  nextMilestone: z.string().optional(),
  nextAction: z.string().optional(),
  sourceSystem: z.string().optional(),
  sourceId: z.string().optional(),
  sourceUrl: z.string().optional(),
  tags: z.string().optional(),
};

const milestoneCreateSchema = {
  ...projectLookupSchema,
  title: z.string().describe("Milestone title. Required."),
  description: z.string().optional(),
  stage: z.string().describe("Required WorkHub milestone stage value."),
  planType: z.string().optional().describe("Defaults to milestone."),
  dateMode: z.string().optional().describe("Usually derived from planType."),
  status: z.string().optional().describe("Defaults to planned."),
  plannedStartDate: z.string().optional().describe("YYYY-MM-DD"),
  plannedEndDate: z.string().optional().describe("YYYY-MM-DD"),
  targetDate: z.string().optional().describe("Alias of plannedEndDate for point milestones."),
  actualStartDate: z.string().optional().describe("YYYY-MM-DD"),
  actualEndDate: z.string().optional().describe("YYYY-MM-DD"),
  actualDate: z.string().optional().describe("Alias of actualEndDate."),
  owner: z.string().optional(),
  sourceUrl: z.string().optional(),
  sortOrder: z.number().optional(),
};

const server = new McpServer({
  name: "workhub",
  version: "1.0.0",
});

registerWorkHubTool(
  server,
  "search_project",
  "Search WorkHub projects by name/code/description/tags before writing any data.",
  {
    keyword: z.string().optional(),
    projectKeyword: z.string().optional(),
    projectName: z.string().optional(),
    pageSize: z.number().optional(),
  }
);

registerWorkHubTool(
  server,
  "get_project_snapshot",
  "Get a WorkHub project snapshot including members, milestones, links, open items, and recent logs.",
  projectLookupSchema
);

registerWorkHubTool(
  server,
  "create_project",
  "Create a WorkHub project. Use search_project first when duplicate risk is unclear.",
  projectCreateSchema
);

registerWorkHubTool(
  server,
  "list_project_milestones",
  "List project milestones and plan nodes before updating a milestone.",
  projectLookupSchema
);

registerWorkHubTool(
  server,
  "create_project_milestone",
  "Create one milestone under an existing WorkHub project.",
  milestoneCreateSchema
);

registerWorkHubTool(
  server,
  "update_project_milestone",
  "Update one project milestone. If the API returns needsConfirmation, ask the user to choose a candidate before retrying.",
  {
    ...projectLookupSchema,
    milestoneId: z.string().optional(),
    milestoneKeyword: z.string().optional(),
    milestoneTitle: z.string().optional(),
    patch: z.object({
      title: z.string().optional(),
      description: z.string().nullable().optional(),
      status: z.string().optional(),
      stage: z.string().optional(),
      planType: z.string().optional(),
      dateMode: z.string().optional(),
      plannedStartDate: z.string().nullable().optional().describe("YYYY-MM-DD"),
      plannedEndDate: z.string().nullable().optional().describe("YYYY-MM-DD"),
      actualStartDate: z.string().nullable().optional().describe("YYYY-MM-DD"),
      actualEndDate: z.string().nullable().optional().describe("YYYY-MM-DD"),
      owner: z.string().nullable().optional(),
      sourceUrl: z.string().nullable().optional(),
      sortOrder: z.number().optional(),
    }).optional(),
  }
);

registerWorkHubTool(
  server,
  "create_project_member",
  "Create a lightweight project member record.",
  {
    ...projectLookupSchema,
    name: z.string().optional(),
    memberName: z.string().optional(),
    role: z.string().optional(),
    team: z.string().optional(),
    responsibility: z.string().optional(),
    contact: z.string().optional(),
    isCore: z.boolean().optional(),
    sortOrder: z.number().optional(),
  }
);

registerWorkHubTool(
  server,
  "create_work_item_with_actions",
  "Create a WorkHub work item and optional action items under it.",
  {
    ...projectLookupSchema,
    title: z.string(),
    description: z.string().optional(),
    module: z.string().optional(),
    type: z.string().optional(),
    priority: z.string().optional(),
    status: z.string().optional(),
    owner: z.string().optional(),
    dueDate: z.string().optional().describe("YYYY-MM-DD"),
    nextAction: z.string().optional(),
    trackingReason: z.string().optional(),
    sourceSystem: z.string().optional(),
    sourceId: z.string().optional(),
    sourceUrl: z.string().optional(),
    health: z.string().optional(),
    currentSummary: z.string().optional(),
    nextCheckpoint: z.string().optional().describe("YYYY-MM-DD"),
    reportLevel: z.string().optional(),
    tags: z.string().optional(),
    actionItems: z.array(actionItemSchema).optional(),
    actions: z.array(actionItemSchema).optional(),
    todos: z.array(actionItemSchema).optional(),
  }
);

registerWorkHubTool(
  server,
  "create_project_log",
  "Create a project log for key facts such as decisions, risks, changes, blockers, and meeting conclusions.",
  {
    ...projectLookupSchema,
    title: z.string(),
    content: z.string(),
    workDate: z.string().optional().describe("YYYY-MM-DD"),
    type: z.string().optional(),
    source: z.string().optional(),
    module: z.string().optional(),
    tags: z.string().optional(),
    itemId: z.string().optional(),
    reportable: z.boolean().optional(),
    sourceUrl: z.string().optional(),
    actionItems: z.array(actionItemSchema).optional(),
    actions: z.array(actionItemSchema).optional(),
    followups: z.array(actionItemSchema).optional(),
  }
);

registerWorkHubTool(
  server,
  "create_log_with_followup_action",
  "Create a project log and one or more follow-up action items.",
  {
    ...projectLookupSchema,
    title: z.string(),
    content: z.string(),
    workDate: z.string().optional().describe("YYYY-MM-DD"),
    type: z.string().optional(),
    source: z.string().optional(),
    module: z.string().optional(),
    tags: z.string().optional(),
    itemId: z.string().optional(),
    reportable: z.boolean().optional(),
    sourceUrl: z.string().optional(),
    actionItems: z.array(actionItemSchema).optional(),
    actions: z.array(actionItemSchema).optional(),
    followups: z.array(actionItemSchema).optional(),
  }
);

registerWorkHubTool(
  server,
  "update_project",
  "Update a WorkHub project, including its summary, owner, health, stage, dates, or status. Never delete a project.",
  { ...projectLookupSchema, patch: patchSchema }
);

registerWorkHubTool(
  server,
  "list_project_members",
  "List the stable member records of one WorkHub project.",
  projectLookupSchema
);

registerWorkHubTool(
  server,
  "update_project_member",
  "Update one project member record. Resolve a member by memberId or memberKeyword before changing it.",
  {
    ...projectLookupSchema,
    memberId: z.string().optional(),
    memberKeyword: z.string().optional(),
    memberName: z.string().optional(),
    patch: patchSchema,
  }
);

registerWorkHubTool(
  server,
  "list_project_links",
  "List a project's key links, such as Feishu docs, specifications, dashboards, and release plans.",
  projectLookupSchema
);

registerWorkHubTool(
  server,
  "create_project_link",
  "Create a key link under an existing WorkHub project.",
  {
    ...projectLookupSchema,
    title: z.string(),
    url: z.string(),
    category: z.string().describe("For example: feishu, spec, dashboard, release-plan, or other."),
    description: z.string().optional(),
    isPrimary: z.boolean().optional(),
    sortOrder: z.number().optional(),
  }
);

registerWorkHubTool(
  server,
  "update_project_link",
  "Update one project key link. Resolve by linkId or linkKeyword before changing it.",
  {
    ...projectLookupSchema,
    linkId: z.string().optional(),
    linkKeyword: z.string().optional(),
    linkTitle: z.string().optional(),
    patch: patchSchema,
  }
);

registerWorkHubTool(
  server,
  "list_work_items",
  "List WorkHub work items, optionally scoped to a project. By default excludes closed items and includes each item's action items.",
  {
    ...projectLookupSchema,
    keyword: z.string().optional(),
    itemKeyword: z.string().optional(),
    type: z.string().optional(),
    priority: z.string().optional(),
    status: z.string().optional(),
    owner: z.string().optional(),
    health: z.string().optional(),
    reportLevel: z.string().optional(),
    overdue: z.boolean().optional(),
    includeClosed: z.boolean().optional(),
    pageSize: z.number().optional(),
  }
);

registerWorkHubTool(
  server,
  "get_work_item",
  "Get one WorkHub work item with its action items, recent logs, and linked project.",
  itemLookupSchema
);

registerWorkHubTool(
  server,
  "update_work_item",
  "Update a WorkHub work item. Use itemId after confirmation when the title is ambiguous. Never delete an item.",
  { ...itemLookupSchema, patch: patchSchema }
);

registerWorkHubTool(
  server,
  "close_work_item",
  "Close one WorkHub work item. This is reversible through update_work_item if the user later reopens it.",
  { ...itemLookupSchema, patch: patchSchema }
);

registerWorkHubTool(
  server,
  "list_work_logs",
  "List WorkHub logs, optionally by project and date range. Includes linked action items.",
  {
    ...projectLookupSchema,
    keyword: z.string().optional(),
    logKeyword: z.string().optional(),
    startDate: z.string().optional().describe("YYYY-MM-DD"),
    endDate: z.string().optional().describe("YYYY-MM-DD"),
    type: z.string().optional(),
    source: z.string().optional(),
    reportable: z.boolean().optional(),
    pageSize: z.number().optional(),
  }
);

registerWorkHubTool(
  server,
  "get_work_log",
  "Get one WorkHub log with its linked project, work item, and follow-up action items.",
  logLookupSchema
);

registerWorkHubTool(
  server,
  "update_work_log",
  "Update a WorkHub log, including the content, type, date, source, and reportable flag. Never delete a log.",
  { ...logLookupSchema, patch: patchSchema }
);

registerWorkHubTool(
  server,
  "list_action_items",
  "List pending or completed action items globally, by project, work item, or work log.",
  {
    ...projectLookupSchema,
    workItemId: z.string().optional(),
    workLogId: z.string().optional(),
    keyword: z.string().optional(),
    actionItemKeyword: z.string().optional(),
    status: z.string().optional(),
    includeDone: z.boolean().optional(),
    pageSize: z.number().optional(),
  }
);

registerWorkHubTool(
  server,
  "get_action_item",
  "Get one WorkHub action item with its linked work item, log, and project.",
  actionLookupSchema
);

registerWorkHubTool(
  server,
  "update_action_item",
  "Update one WorkHub action item, for example its owner, due date, status, or completion note.",
  { ...actionLookupSchema, patch: patchSchema }
);

registerWorkHubTool(
  server,
  "complete_action_item",
  "Mark one WorkHub action item as done and optionally record a completion note.",
  { ...actionLookupSchema, patch: patchSchema }
);

registerWorkHubTool(
  server,
  "get_today_facts",
  "Get today's structured WorkHub fact package: reportable facts, logs, updates, closures, risks, and pending action items. Optionally scope to a project.",
  projectLookupSchema
);

registerWorkHubTool(
  server,
  "get_weekly_facts",
  "Get this Monday-to-Sunday structured WorkHub fact package. Optionally scope to a project.",
  projectLookupSchema
);

registerWorkHubTool(
  server,
  "get_range_facts",
  "Get a structured WorkHub fact package for an explicit inclusive YYYY-MM-DD date range. Optionally scope to a project.",
  {
    ...projectLookupSchema,
    startDate: z.string().optional().describe("YYYY-MM-DD. Required."),
    endDate: z.string().optional().describe("YYYY-MM-DD. Required."),
  }
);

registerWorkHubTool(
  server,
  "get_workhub_overview",
  "Get the current WorkHub portfolio overview: projects, blocked/risk/overdue items, pending action items, and recent reportable facts.",
  {}
);

registerWorkHubTool(
  server,
  "health",
  "Check that the WorkHub Hermes endpoint is reachable.",
  {
    input: jsonObject.optional(),
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
