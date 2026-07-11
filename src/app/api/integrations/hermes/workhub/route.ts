import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { revalidateWorkHubPaths } from "@/lib/revalidate";
import { collectWorkItemChanges, createWorkItemChangeLog } from "@/lib/workItemChangeLog";
import {
  PROJECT_MILESTONE_STAGE_VALUES,
  normalizeDateMode,
  normalizePlanType,
} from "@/lib/projectMilestones";
import { getLocalDateString, getWeekRange, isValidYmdDateString, toNullableString } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MAX_CANDIDATES = 5;
const DEFAULT_PROJECT_PAGE_SIZE = 5;
const REPORTABLE_LOG_TYPES = new Set(["decision", "risk", "blocker", "issue"]);

type ToolName =
  | "health"
  | "search_project"
  | "get_project_snapshot"
  | "create_project"
  | "update_project"
  | "list_project_milestones"
  | "create_project_milestone"
  | "update_project_milestone"
  | "list_project_members"
  | "create_project_member"
  | "update_project_member"
  | "list_project_links"
  | "create_project_link"
  | "update_project_link"
  | "list_work_items"
  | "get_work_item"
  | "create_work_item_with_actions"
  | "update_work_item"
  | "close_work_item"
  | "list_work_logs"
  | "get_work_log"
  | "create_project_log"
  | "create_log_with_followup_action"
  | "update_work_log"
  | "list_action_items"
  | "get_action_item"
  | "update_action_item"
  | "complete_action_item"
  | "get_today_facts"
  | "get_weekly_facts"
  | "get_range_facts"
  | "get_workhub_overview";

type ToolRequest = {
  tool?: ToolName;
  input?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
};

type ProjectCandidate = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  stage: string | null;
  health: string;
};

type ProjectResolution =
  | { project: ProjectCandidate }
  | { needsConfirmation: boolean; message: string; candidates: ProjectCandidate[] }
  | { error: string; status: number }
  | { none: true };

type NormalizedActionInput = {
  title: string;
  owner: string | null;
  dueDate: string | null;
  status: string;
  sortOrder: number;
};

function jsonOk(data: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

function jsonError(message: string, status = 400, data?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...data }, { status });
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : "";
}

function assertAuthorized(request: NextRequest) {
  const expectedToken = process.env.HERMES_WORKHUB_TOKEN;
  if (!expectedToken) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "HERMES_WORKHUB_TOKEN must be set in production" };
    }
    return { ok: true, warning: "HERMES_WORKHUB_TOKEN is not set; local MVP endpoint is unauthenticated." };
  }

  return getBearerToken(request) === expectedToken
    ? { ok: true }
    : { ok: false, error: "Unauthorized" };
}

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown) {
  return typeof value === "string" ? toNullableString(value.trim()) : null;
}

function optionalBoolean(value: unknown, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return value === true || value === "true" || value === 1 || value === "1";
}

function parseSortOrder(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeYmd(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") return null;
  if (!isValidYmdDateString(value)) {
    throw new Error(`${fieldName} must be YYYY-MM-DD`);
  }
  return value;
}

function normalizeDateValue(value: unknown, fieldName: string) {
  const ymd = normalizeYmd(value, fieldName);
  return ymd ? new Date(`${ymd}T00:00:00`) : null;
}

function validateDateRange(start: Date | null, end: Date | null, label: string) {
  if (start && end && start.getTime() > end.getTime()) {
    return label + " start date cannot be later than end date";
  }

  return "";
}

function toProjectCandidate(project: ProjectCandidate) {
  return {
    id: project.id,
    name: project.name,
    code: project.code,
    status: project.status,
    stage: project.stage,
    health: project.health,
  };
}

async function searchProjects(keyword: string, pageSize = DEFAULT_PROJECT_PAGE_SIZE) {
  const take = Math.min(Math.max(pageSize, 1), 20);
  const where = keyword
    ? {
        OR: [
          { name: { contains: keyword } },
          { code: { contains: keyword } },
          { description: { contains: keyword } },
          { tags: { contains: keyword } },
        ],
      }
    : {};

  return prisma.project.findMany({
    where,
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      stage: true,
      health: true,
      owner: true,
      pm: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take,
  });
}

async function resolveProject(input: Record<string, unknown>) {
  const projectId = trimString(input.projectId);
  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, code: true, status: true, stage: true, health: true },
    });
    if (!project) return { error: "Project not found", status: 404 as const };
    return { project };
  }

  const keyword = trimString(input.projectKeyword || input.projectName || input.project);
  if (!keyword) {
    return { error: "projectId or projectKeyword is required", status: 400 as const };
  }

  const projects = await searchProjects(keyword, MAX_CANDIDATES);
  if (projects.length === 0) {
    return { error: "No matching project found", status: 404 as const };
  }

  if (projects.length > 1) {
    return {
      needsConfirmation: true,
      message: "Multiple projects matched. Ask the user to choose one projectId.",
      candidates: projects.map(toProjectCandidate),
    };
  }

  return { project: projects[0] };
}

async function resolveMilestone(projectId: string, input: Record<string, unknown>) {
  const milestoneId = trimString(input.milestoneId);
  if (milestoneId) {
    const milestone = await prisma.projectMilestone.findFirst({
      where: { id: milestoneId, projectId },
    });
    if (!milestone) return { error: "Milestone not found", status: 404 as const };
    return { milestone };
  }

  const keyword = trimString(input.milestoneKeyword || input.milestoneTitle);
  if (!keyword) {
    return { error: "milestoneId or milestoneKeyword is required", status: 400 as const };
  }

  const milestones = await prisma.projectMilestone.findMany({
    where: {
      projectId,
      OR: [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { targetDate: "asc" }, { createdAt: "asc" }],
    take: MAX_CANDIDATES,
  });

  if (milestones.length === 0) {
    return { error: "No matching milestone found", status: 404 as const };
  }

  if (milestones.length > 1) {
    return {
      needsConfirmation: true,
      message: "Multiple milestones matched. Ask the user to choose one milestoneId.",
      candidates: milestones.map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        status: milestone.status,
        stage: milestone.stage,
        planType: milestone.planType,
        plannedEndDate: milestone.plannedEndDate,
        targetDate: milestone.targetDate,
      })),
    };
  }

  return { milestone: milestones[0] };
}

async function handleSearchProject(input: Record<string, unknown>) {
  const keyword = trimString(input.keyword || input.projectKeyword || input.projectName);
  const pageSize = parseSortOrder(input.pageSize) || DEFAULT_PROJECT_PAGE_SIZE;
  const projects = await searchProjects(keyword, pageSize);
  return jsonOk({
    projects: projects.map((project) => ({
      ...toProjectCandidate(project),
      owner: project.owner,
      pm: project.pm,
      updatedAt: project.updatedAt,
    })),
  });
}

async function handleCreateProject(input: Record<string, unknown>) {
  const name = trimString(input.name);
  if (!name) return jsonError("project name is required");

  const project = await prisma.project.create({
    data: {
      name,
      code: optionalString(input.code),
      description: optionalString(input.description),
      type: trimString(input.type) || "project",
      status: trimString(input.status) || "active",
      stage: optionalString(input.stage),
      health: trimString(input.health) || "unknown",
      owner: optionalString(input.owner),
      pm: optionalString(input.pm),
      startDate: normalizeDateValue(input.startDate, "startDate"),
      targetDate: normalizeDateValue(input.targetDate, "targetDate"),
      releaseDate: normalizeDateValue(input.releaseDate, "releaseDate"),
      currentSummary: optionalString(input.currentSummary),
      nextMilestone: optionalString(input.nextMilestone),
      nextAction: optionalString(input.nextAction),
      sourceSystem: optionalString(input.sourceSystem),
      sourceId: optionalString(input.sourceId),
      sourceUrl: optionalString(input.sourceUrl),
      tags: optionalString(input.tags),
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/projects/" + project.id);

  return jsonOk({ project }, 201);
}

async function handleGetProjectSnapshot(input: Record<string, unknown>) {
  const resolved = await resolveProject(input);
  if ("needsConfirmation" in resolved) return jsonOk({ needsConfirmation: true, ...resolved });
  if ("error" in resolved) return jsonError(resolved.error || "Project lookup failed", resolved.status || 400);
  if (!("project" in resolved)) return jsonError("Project lookup failed");

  const project = await prisma.project.findUnique({
    where: { id: resolved.project.id },
    include: {
      members: { orderBy: [{ isCore: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }] },
      milestones: { orderBy: [{ sortOrder: "asc" }, { targetDate: "asc" }, { createdAt: "asc" }] },
      links: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }] },
      items: { where: { status: { not: "closed" } }, orderBy: { updatedAt: "desc" }, take: 20 },
      logs: { orderBy: [{ workDate: "desc" }, { createdAt: "desc" }], take: 10 },
      _count: { select: { items: true, logs: true } },
    },
  });

  return jsonOk({ project });
}

async function handleListProjectMilestones(input: Record<string, unknown>) {
  const resolved = await resolveProject(input);
  if ("needsConfirmation" in resolved) return jsonOk({ needsConfirmation: true, ...resolved });
  if ("error" in resolved) return jsonError(resolved.error || "Project lookup failed", resolved.status || 400);
  if (!("project" in resolved)) return jsonError("Project lookup failed");

  const milestones = await prisma.projectMilestone.findMany({
    where: { projectId: resolved.project.id },
    orderBy: [{ sortOrder: "asc" }, { targetDate: "asc" }, { createdAt: "asc" }],
  });

  return jsonOk({ project: resolved.project, milestones });
}

async function handleCreateProjectMilestone(input: Record<string, unknown>) {
  const resolved = await resolveProject(input);
  if ("needsConfirmation" in resolved) return jsonOk({ needsConfirmation: true, ...resolved });
  if ("error" in resolved) return jsonError(resolved.error || "Project lookup failed", resolved.status || 400);
  if (!("project" in resolved)) return jsonError("Project lookup failed");

  const title = trimString(input.title);
  if (!title) return jsonError("milestone title is required");

  if (typeof input.stage !== "string" || !PROJECT_MILESTONE_STAGE_VALUES.has(input.stage.trim())) {
    return jsonError("stage is required");
  }

  const planType = normalizePlanType(input.planType);
  const dateMode = normalizeDateMode(input.dateMode, planType);
  const plannedStartDate = normalizeDateValue(input.plannedStartDate, "plannedStartDate");
  const plannedEndDate = normalizeDateValue(input.plannedEndDate ?? input.targetDate, "plannedEndDate");
  const actualStartDate = normalizeDateValue(input.actualStartDate, "actualStartDate");
  const actualEndDate = normalizeDateValue(input.actualEndDate ?? input.actualDate, "actualEndDate");

  if (dateMode === "range") {
    const plannedRangeError = validateDateRange(plannedStartDate, plannedEndDate, "planned");
    if (plannedRangeError) return jsonError(plannedRangeError);

    const actualRangeError = validateDateRange(actualStartDate, actualEndDate, "actual");
    if (actualRangeError) return jsonError(actualRangeError);
  }

  if (actualEndDate && !plannedEndDate) {
    return jsonError("plannedEndDate is required before actualEndDate");
  }

  const milestone = await prisma.projectMilestone.create({
    data: {
      projectId: resolved.project.id,
      title,
      description: optionalString(input.description),
      stage: input.stage.trim(),
      planType,
      dateMode,
      status: trimString(input.status) || "planned",
      targetDate: plannedEndDate,
      actualDate: actualEndDate,
      plannedStartDate: dateMode === "range" ? plannedStartDate : null,
      plannedEndDate,
      actualStartDate: dateMode === "range" ? actualStartDate : null,
      actualEndDate,
      owner: optionalString(input.owner),
      sourceUrl: optionalString(input.sourceUrl),
      sortOrder: parseSortOrder(input.sortOrder),
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/projects/" + resolved.project.id);

  return jsonOk({ project: resolved.project, milestone }, 201);
}

async function handleUpdateProjectMilestone(input: Record<string, unknown>) {
  const resolvedProject = await resolveProject(input);
  if ("needsConfirmation" in resolvedProject) return jsonOk({ needsConfirmation: true, ...resolvedProject });
  if ("error" in resolvedProject) return jsonError(resolvedProject.error || "Project lookup failed", resolvedProject.status || 400);
  if (!("project" in resolvedProject)) return jsonError("Project lookup failed");

  const resolvedMilestone = await resolveMilestone(resolvedProject.project.id, input);
  if ("needsConfirmation" in resolvedMilestone) return jsonOk({ needsConfirmation: true, ...resolvedMilestone });
  if ("error" in resolvedMilestone) return jsonError(resolvedMilestone.error || "Milestone lookup failed", resolvedMilestone.status || 400);
  if (!("milestone" in resolvedMilestone)) return jsonError("Milestone lookup failed");

  const patch = (input.patch && typeof input.patch === "object" ? input.patch : input) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  const current = resolvedMilestone.milestone;
  const nextPlanType = "planType" in patch ? normalizePlanType(patch.planType) : current.planType;
  const nextDateMode = "dateMode" in patch || "planType" in patch
    ? normalizeDateMode(patch.dateMode, nextPlanType)
    : normalizeDateMode(current.dateMode, nextPlanType);

  if ("title" in patch) {
    const title = trimString(patch.title);
    if (!title) return jsonError("title cannot be empty");
    data.title = title;
  }
  if ("description" in patch) data.description = optionalString(patch.description);
  if ("status" in patch) data.status = trimString(patch.status) || "planned";
  if ("stage" in patch) {
    const stage = trimString(patch.stage);
    if (!PROJECT_MILESTONE_STAGE_VALUES.has(stage)) return jsonError("stage is invalid");
    data.stage = stage;
  }
  if ("planType" in patch) data.planType = nextPlanType;
  if ("dateMode" in patch || "planType" in patch) data.dateMode = nextDateMode;

  const hasDatePatch =
    "plannedStartDate" in patch ||
    "plannedEndDate" in patch ||
    "targetDate" in patch ||
    "actualStartDate" in patch ||
    "actualEndDate" in patch ||
    "actualDate" in patch ||
    "dateMode" in patch ||
    "planType" in patch;

  if (hasDatePatch) {
    const plannedStartDate = normalizeDateValue(
      "plannedStartDate" in patch ? patch.plannedStartDate : current.plannedStartDate,
      "plannedStartDate"
    );
    const plannedEndDate = normalizeDateValue(
      "plannedEndDate" in patch ? patch.plannedEndDate : "targetDate" in patch ? patch.targetDate : current.plannedEndDate || current.targetDate,
      "plannedEndDate"
    );
    const actualStartDate = normalizeDateValue(
      "actualStartDate" in patch ? patch.actualStartDate : current.actualStartDate,
      "actualStartDate"
    );
    const actualEndDate = normalizeDateValue(
      "actualEndDate" in patch ? patch.actualEndDate : "actualDate" in patch ? patch.actualDate : current.actualEndDate || current.actualDate,
      "actualEndDate"
    );

    data.plannedStartDate = nextDateMode === "range" ? plannedStartDate : null;
    data.plannedEndDate = plannedEndDate;
    data.targetDate = plannedEndDate;
    data.actualStartDate = nextDateMode === "range" ? actualStartDate : null;
    data.actualEndDate = actualEndDate;
    data.actualDate = actualEndDate;
  }

  if ("owner" in patch) data.owner = optionalString(patch.owner);
  if ("sourceUrl" in patch) data.sourceUrl = optionalString(patch.sourceUrl);
  if ("sortOrder" in patch) data.sortOrder = parseSortOrder(patch.sortOrder);

  const milestone = await prisma.projectMilestone.update({
    where: { id: current.id },
    data,
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${resolvedProject.project.id}`);

  return jsonOk({ project: resolvedProject.project, milestone });
}

async function handleCreateProjectMember(input: Record<string, unknown>) {
  const resolved = await resolveProject(input);
  if ("needsConfirmation" in resolved) return jsonOk({ needsConfirmation: true, ...resolved });
  if ("error" in resolved) return jsonError(resolved.error || "Project lookup failed", resolved.status || 400);
  if (!("project" in resolved)) return jsonError("Project lookup failed");

  const name = trimString(input.name || input.memberName);
  if (!name) return jsonError("member name is required");

  const member = await prisma.projectMember.create({
    data: {
      projectId: resolved.project.id,
      name,
      role: optionalString(input.role),
      team: optionalString(input.team),
      responsibility: optionalString(input.responsibility),
      contact: optionalString(input.contact),
      isCore: optionalBoolean(input.isCore),
      sortOrder: parseSortOrder(input.sortOrder),
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${resolved.project.id}`);

  return jsonOk({ project: resolved.project, member }, 201);
}

function normalizeActionInputs(value: unknown): NormalizedActionInput[] {
  if (!Array.isArray(value)) return [];
  const normalized: NormalizedActionInput[] = [];

  value.forEach((item, index) => {
    if (typeof item === "string") {
      const title = item.trim();
      if (title) {
        normalized.push({ title, owner: null, dueDate: null, status: "pending", sortOrder: index });
      }
      return;
    }

    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const title = trimString(record.title);
    if (!title) return;

    normalized.push({
      title,
      owner: optionalString(record.owner),
      dueDate: normalizeYmd(record.dueDate, "actionItems.dueDate"),
      status: trimString(record.status) || "pending",
      sortOrder: "sortOrder" in record ? parseSortOrder(record.sortOrder) : index,
    });
  });

  return normalized;
}

async function handleCreateWorkItemWithActions(input: Record<string, unknown>) {
  const resolved = await resolveProject(input);
  if ("needsConfirmation" in resolved) return jsonOk({ needsConfirmation: true, ...resolved });
  if ("error" in resolved) return jsonError(resolved.error || "Project lookup failed", resolved.status || 400);
  if (!("project" in resolved)) return jsonError("Project lookup failed");

  const title = trimString(input.title);
  if (!title) return jsonError("item title is required");

  const dueDate = normalizeYmd(input.dueDate, "dueDate");
  const nextCheckpoint = normalizeYmd(input.nextCheckpoint, "nextCheckpoint");
  const actionInputs = normalizeActionInputs(input.actionItems || input.actions || input.todos);

  const item = await prisma.workItem.create({
    data: {
      title,
      description: optionalString(input.description),
      project: resolved.project.name,
      projectId: resolved.project.id,
      module: optionalString(input.module),
      type: trimString(input.type) || "action",
      priority: trimString(input.priority) || "P2",
      status: trimString(input.status) || "open",
      owner: optionalString(input.owner),
      dueDate,
      nextAction: optionalString(input.nextAction),
      trackingReason: optionalString(input.trackingReason),
      sourceSystem: optionalString(input.sourceSystem) || "feishu-hermes",
      sourceId: optionalString(input.sourceId),
      sourceUrl: optionalString(input.sourceUrl),
      health: trimString(input.health) || "unknown",
      currentSummary: optionalString(input.currentSummary),
      nextCheckpoint,
      reportLevel: trimString(input.reportLevel) || "none",
      tags: optionalString(input.tags),
    },
  });

  const actionItems = await Promise.all(
    actionInputs.map((action) =>
      prisma.actionItem.create({
        data: {
          title: action.title,
          status: action.status || "pending",
          owner: action.owner,
          dueDate: action.dueDate,
          sortOrder: action.sortOrder,
          workItemId: item.id,
          projectId: resolved.project.id,
        },
      })
    )
  );

  revalidateWorkHubPaths({ itemId: item.id, projectId: resolved.project.id });

  return jsonOk({ project: resolved.project, item, actionItems }, 201);
}

async function handleCreateProjectLog(input: Record<string, unknown>) {
  const resolved = await resolveProject(input);
  if ("needsConfirmation" in resolved) return jsonOk({ needsConfirmation: true, ...resolved });
  if ("error" in resolved) return jsonError(resolved.error || "Project lookup failed", resolved.status || 400);
  if (!("project" in resolved)) return jsonError("Project lookup failed");

  const title = trimString(input.title);
  const content = trimString(input.content);
  if (!title || !content) return jsonError("log title and content are required");

  const type = trimString(input.type) || "note";
  const reportable = optionalBoolean(input.reportable, REPORTABLE_LOG_TYPES.has(type));
  const actionInputs = normalizeActionInputs(input.actionItems || input.actions || input.followups);
  const itemId = optionalString(input.itemId);

  const log = await prisma.workLog.create({
    data: {
      workDate: normalizeYmd(input.workDate, "workDate") || getLocalDateString(),
      title,
      content,
      type,
      source: trimString(input.source) || "feishu",
      project: resolved.project.name,
      projectId: resolved.project.id,
      module: optionalString(input.module),
      tags: optionalString(input.tags),
      itemId,
      reportable,
      sourceUrl: optionalString(input.sourceUrl),
    },
  });

  const actionItems = await Promise.all(
    actionInputs.map((action) =>
      prisma.actionItem.create({
        data: {
          title: action.title,
          status: action.status || "pending",
          owner: action.owner,
          dueDate: action.dueDate,
          sortOrder: action.sortOrder,
          workLogId: log.id,
          projectId: resolved.project.id,
        },
      })
    )
  );

  revalidateWorkHubPaths({ logId: log.id, itemId: itemId || undefined, projectId: resolved.project.id });

  return jsonOk({ project: resolved.project, log, actionItems }, 201);
}

function hasProjectLookup(input: Record<string, unknown>) {
  return Boolean(trimString(input.projectId || input.projectKeyword || input.projectName || input.project));
}

function getPatch(input: Record<string, unknown>) {
  return (input.patch && typeof input.patch === "object" ? input.patch : input) as Record<string, unknown>;
}

function revalidateProject(projectId: string) {
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

async function handleUpdateProject(input: Record<string, unknown>) {
  const resolved = await resolveProject(input);
  if ("needsConfirmation" in resolved) return jsonOk({ needsConfirmation: true, ...resolved });
  if ("error" in resolved) return jsonError(resolved.error || "Project lookup failed", resolved.status || 400);
  if (!("project" in resolved)) return jsonError("Project lookup failed");

  const patch = getPatch(input);
  const data: Record<string, unknown> = {};
  const stringFields = ["code", "description", "stage", "owner", "pm", "currentSummary", "nextMilestone", "nextAction", "sourceSystem", "sourceId", "sourceUrl", "tags"];
  const requiredStringFields = ["name", "type", "status", "health"];

  for (const field of stringFields) {
    if (field in patch) data[field] = optionalString(patch[field]);
  }
  for (const field of requiredStringFields) {
    if (field in patch) {
      const value = trimString(patch[field]);
      if (!value) return jsonError(`${field} cannot be empty`);
      data[field] = value;
    }
  }
  for (const field of ["startDate", "targetDate", "releaseDate"]) {
    if (field in patch) data[field] = normalizeDateValue(patch[field], field);
  }

  const project = await prisma.project.update({
    where: { id: resolved.project.id },
    data,
  });
  revalidateProject(project.id);
  return jsonOk({ project });
}

async function resolveProjectMember(projectId: string, input: Record<string, unknown>) {
  const memberId = trimString(input.memberId);
  if (memberId) {
    const member = await prisma.projectMember.findFirst({ where: { id: memberId, projectId } });
    if (!member) return { error: "Project member not found", status: 404 as const };
    return { member };
  }

  const keyword = trimString(input.memberKeyword || input.memberName || input.name);
  if (!keyword) return { error: "memberId or memberKeyword is required", status: 400 as const };

  const members = await prisma.projectMember.findMany({
    where: { projectId, OR: [{ name: { contains: keyword } }, { role: { contains: keyword } }, { responsibility: { contains: keyword } }] },
    orderBy: [{ isCore: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    take: MAX_CANDIDATES,
  });
  if (members.length === 0) return { error: "No matching project member found", status: 404 as const };
  if (members.length > 1) {
    return {
      needsConfirmation: true,
      message: "Multiple members matched. Ask the user to choose one memberId.",
      candidates: members.map((member) => ({ id: member.id, name: member.name, role: member.role, responsibility: member.responsibility })),
    };
  }
  return { member: members[0] };
}

async function handleListProjectMembers(input: Record<string, unknown>) {
  const resolved = await resolveProject(input);
  if ("needsConfirmation" in resolved) return jsonOk({ needsConfirmation: true, ...resolved });
  if ("error" in resolved) return jsonError(resolved.error || "Project lookup failed", resolved.status || 400);
  if (!("project" in resolved)) return jsonError("Project lookup failed");

  const members = await prisma.projectMember.findMany({
    where: { projectId: resolved.project.id },
    orderBy: [{ isCore: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return jsonOk({ project: resolved.project, members });
}

async function handleUpdateProjectMember(input: Record<string, unknown>) {
  const resolvedProject = await resolveProject(input);
  if ("needsConfirmation" in resolvedProject) return jsonOk({ needsConfirmation: true, ...resolvedProject });
  if ("error" in resolvedProject) return jsonError(resolvedProject.error || "Project lookup failed", resolvedProject.status || 400);
  if (!("project" in resolvedProject)) return jsonError("Project lookup failed");

  const resolvedMember = await resolveProjectMember(resolvedProject.project.id, input);
  if ("needsConfirmation" in resolvedMember) return jsonOk({ needsConfirmation: true, ...resolvedMember });
  if ("error" in resolvedMember) return jsonError(resolvedMember.error || "Member lookup failed", resolvedMember.status || 400);
  if (!("member" in resolvedMember)) return jsonError("Member lookup failed");

  const patch = getPatch(input);
  const data: Record<string, unknown> = {};
  if ("name" in patch) {
    const name = trimString(patch.name);
    if (!name) return jsonError("name cannot be empty");
    data.name = name;
  }
  for (const field of ["role", "team", "responsibility", "contact"]) {
    if (field in patch) data[field] = optionalString(patch[field]);
  }
  if ("isCore" in patch) data.isCore = optionalBoolean(patch.isCore);
  if ("sortOrder" in patch) data.sortOrder = parseSortOrder(patch.sortOrder);

  const member = await prisma.projectMember.update({ where: { id: resolvedMember.member.id }, data });
  revalidateProject(resolvedProject.project.id);
  return jsonOk({ project: resolvedProject.project, member });
}

async function resolveProjectLink(projectId: string, input: Record<string, unknown>) {
  const linkId = trimString(input.linkId);
  if (linkId) {
    const link = await prisma.projectLink.findFirst({ where: { id: linkId, projectId } });
    if (!link) return { error: "Project link not found", status: 404 as const };
    return { link };
  }

  const keyword = trimString(input.linkKeyword || input.linkTitle || input.title);
  if (!keyword) return { error: "linkId or linkKeyword is required", status: 400 as const };
  const links = await prisma.projectLink.findMany({
    where: { projectId, OR: [{ title: { contains: keyword } }, { url: { contains: keyword } }, { description: { contains: keyword } }] },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    take: MAX_CANDIDATES,
  });
  if (links.length === 0) return { error: "No matching project link found", status: 404 as const };
  if (links.length > 1) {
    return {
      needsConfirmation: true,
      message: "Multiple project links matched. Ask the user to choose one linkId.",
      candidates: links.map((link) => ({ id: link.id, title: link.title, url: link.url, category: link.category })),
    };
  }
  return { link: links[0] };
}

async function handleListProjectLinks(input: Record<string, unknown>) {
  const resolved = await resolveProject(input);
  if ("needsConfirmation" in resolved) return jsonOk({ needsConfirmation: true, ...resolved });
  if ("error" in resolved) return jsonError(resolved.error || "Project lookup failed", resolved.status || 400);
  if (!("project" in resolved)) return jsonError("Project lookup failed");

  const links = await prisma.projectLink.findMany({
    where: { projectId: resolved.project.id },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return jsonOk({ project: resolved.project, links });
}

async function handleCreateProjectLink(input: Record<string, unknown>) {
  const resolved = await resolveProject(input);
  if ("needsConfirmation" in resolved) return jsonOk({ needsConfirmation: true, ...resolved });
  if ("error" in resolved) return jsonError(resolved.error || "Project lookup failed", resolved.status || 400);
  if (!("project" in resolved)) return jsonError("Project lookup failed");

  const title = trimString(input.title);
  const url = trimString(input.url);
  const category = trimString(input.category);
  if (!title || !url || !category) return jsonError("title, url, and category are required");

  const link = await prisma.projectLink.create({
    data: {
      projectId: resolved.project.id,
      title,
      url,
      category,
      description: optionalString(input.description),
      isPrimary: optionalBoolean(input.isPrimary),
      sortOrder: parseSortOrder(input.sortOrder),
    },
  });
  revalidateProject(resolved.project.id);
  return jsonOk({ project: resolved.project, link }, 201);
}

async function handleUpdateProjectLink(input: Record<string, unknown>) {
  const resolvedProject = await resolveProject(input);
  if ("needsConfirmation" in resolvedProject) return jsonOk({ needsConfirmation: true, ...resolvedProject });
  if ("error" in resolvedProject) return jsonError(resolvedProject.error || "Project lookup failed", resolvedProject.status || 400);
  if (!("project" in resolvedProject)) return jsonError("Project lookup failed");

  const resolvedLink = await resolveProjectLink(resolvedProject.project.id, input);
  if ("needsConfirmation" in resolvedLink) return jsonOk({ needsConfirmation: true, ...resolvedLink });
  if ("error" in resolvedLink) return jsonError(resolvedLink.error || "Link lookup failed", resolvedLink.status || 400);
  if (!("link" in resolvedLink)) return jsonError("Link lookup failed");

  const patch = getPatch(input);
  const data: Record<string, unknown> = {};
  for (const field of ["title", "url", "category"]) {
    if (field in patch) {
      const value = trimString(patch[field]);
      if (!value) return jsonError(`${field} cannot be empty`);
      data[field] = value;
    }
  }
  if ("description" in patch) data.description = optionalString(patch.description);
  if ("isPrimary" in patch) data.isPrimary = optionalBoolean(patch.isPrimary);
  if ("sortOrder" in patch) data.sortOrder = parseSortOrder(patch.sortOrder);

  const link = await prisma.projectLink.update({ where: { id: resolvedLink.link.id }, data });
  revalidateProject(resolvedProject.project.id);
  return jsonOk({ project: resolvedProject.project, link });
}

async function resolveScopedProjectId(input: Record<string, unknown>): Promise<ProjectResolution> {
  if (!hasProjectLookup(input)) return { none: true };
  return resolveProject(input);
}

async function resolveWorkItem(input: Record<string, unknown>) {
  const itemId = trimString(input.itemId);
  const scopedProject = await resolveScopedProjectId(input);
  if ("needsConfirmation" in scopedProject || "error" in scopedProject) return scopedProject;
  const projectId = "project" in scopedProject ? scopedProject.project.id : undefined;

  if (itemId) {
    const item = await prisma.workItem.findUnique({ where: { id: itemId } });
    if (!item || (projectId && item.projectId !== projectId)) return { error: "Work item not found", status: 404 as const };
    return { item };
  }

  const keyword = trimString(input.itemKeyword || input.itemTitle || input.title);
  if (!keyword) return { error: "itemId or itemKeyword is required", status: 400 as const };
  const where: Record<string, unknown> = {
    OR: [
      { title: { contains: keyword } },
      { description: { contains: keyword } },
      { currentSummary: { contains: keyword } },
    ],
  };
  if (projectId) where.projectId = projectId;
  const items = await prisma.workItem.findMany({ where, orderBy: { updatedAt: "desc" }, take: MAX_CANDIDATES });
  if (items.length === 0) return { error: "No matching work item found", status: 404 as const };
  if (items.length > 1) {
    return {
      needsConfirmation: true,
      message: "Multiple work items matched. Ask the user to choose one itemId.",
      candidates: items.map((item) => ({ id: item.id, title: item.title, status: item.status, priority: item.priority, owner: item.owner, dueDate: item.dueDate, project: item.project })),
    };
  }
  return { item: items[0] };
}

async function handleListWorkItems(input: Record<string, unknown>) {
  const scopedProject = await resolveScopedProjectId(input);
  if ("needsConfirmation" in scopedProject) return jsonOk(scopedProject);
  if ("error" in scopedProject) return jsonError(scopedProject.error || "Project lookup failed", scopedProject.status || 400);
  const projectId = "project" in scopedProject ? scopedProject.project.id : undefined;
  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;
  const keyword = trimString(input.keyword || input.itemKeyword);
  if (keyword) {
    where.OR = [{ title: { contains: keyword } }, { description: { contains: keyword } }, { currentSummary: { contains: keyword } }];
  }
  for (const field of ["type", "priority", "status", "owner", "health", "reportLevel"]) {
    const value = trimString(input[field]);
    if (value) where[field] = value;
  }
  if (!trimString(input.status) && !optionalBoolean(input.includeClosed)) where.status = { not: "closed" };
  if (optionalBoolean(input.overdue)) {
    where.dueDate = { lt: getLocalDateString() };
    where.AND = [{ status: { not: "closed" } }];
  }
  const pageSize = Math.min(Math.max(parseSortOrder(input.pageSize) || 20, 1), 100);
  const items = await prisma.workItem.findMany({
    where,
    include: { actionItems: { orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
    take: pageSize,
  });
  return jsonOk({ project: "project" in scopedProject ? scopedProject.project : null, items });
}

async function handleGetWorkItem(input: Record<string, unknown>) {
  const resolved = await resolveWorkItem(input);
  if ("needsConfirmation" in resolved) return jsonOk({ needsConfirmation: true, ...resolved });
  if ("error" in resolved) return jsonError(resolved.error || "Work item lookup failed", resolved.status || 400);
  if (!("item" in resolved)) return jsonError("Work item lookup failed");
  const item = await prisma.workItem.findUnique({
    where: { id: resolved.item.id },
    include: {
      actionItems: { orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] },
      logs: { orderBy: [{ workDate: "desc" }, { createdAt: "desc" }], take: 50 },
      projectRef: { select: { id: true, name: true, code: true, status: true, health: true } },
    },
  });
  return jsonOk({ item });
}

async function handleUpdateWorkItem(input: Record<string, unknown>) {
  const resolved = await resolveWorkItem(input);
  if ("needsConfirmation" in resolved) return jsonOk({ needsConfirmation: true, ...resolved });
  if ("error" in resolved) return jsonError(resolved.error || "Work item lookup failed", resolved.status || 400);
  if (!("item" in resolved)) return jsonError("Work item lookup failed");

  const current = resolved.item;
  const patch = getPatch(input);
  const data: Record<string, unknown> = {};
  if ("title" in patch) {
    const title = trimString(patch.title);
    if (!title) return jsonError("title cannot be empty");
    data.title = title;
  }
  for (const field of ["description", "module", "owner", "nextAction", "trackingReason", "sourceSystem", "sourceId", "sourceUrl", "currentSummary", "tags"]) {
    if (field in patch) data[field] = optionalString(patch[field]);
  }
  for (const field of ["type", "priority", "status", "health", "reportLevel"]) {
    if (field in patch) {
      const value = trimString(patch[field]);
      if (!value) return jsonError(`${field} cannot be empty`);
      data[field] = value;
    }
  }
  for (const field of ["dueDate", "nextCheckpoint"]) {
    if (field in patch) data[field] = normalizeYmd(patch[field], field);
  }
  const nextStatus = typeof data.status === "string" ? data.status : current.status;
  if (nextStatus === "closed" && current.status !== "closed") data.closedAt = new Date();
  if (nextStatus !== "closed" && current.status === "closed") data.closedAt = null;

  const changes = collectWorkItemChanges(current, patch, data);
  const item = await prisma.workItem.update({ where: { id: current.id }, data });
  if (changes.length > 0) {
    try {
      await createWorkItemChangeLog(item, changes);
    } catch (logError) {
      console.error("Error creating Hermes work item change log:", logError);
    }
  }
  revalidateWorkHubPaths({ itemId: item.id, projectId: item.projectId || undefined });
  return jsonOk({ item });
}

async function handleCloseWorkItem(input: Record<string, unknown>) {
  const patch = { ...getPatch(input), status: "closed" };
  return handleUpdateWorkItem({ ...input, patch });
}

async function resolveWorkLog(input: Record<string, unknown>) {
  const logId = trimString(input.logId);
  const scopedProject = await resolveScopedProjectId(input);
  if ("needsConfirmation" in scopedProject || "error" in scopedProject) return scopedProject;
  const projectId = "project" in scopedProject ? scopedProject.project.id : undefined;
  if (logId) {
    const log = await prisma.workLog.findUnique({ where: { id: logId }, include: { item: { select: { projectId: true } } } });
    if (!log || (projectId && log.projectId !== projectId && log.item?.projectId !== projectId)) return { error: "Work log not found", status: 404 as const };
    return { log };
  }
  const keyword = trimString(input.logKeyword || input.logTitle || input.title);
  if (!keyword) return { error: "logId or logKeyword is required", status: 400 as const };
  const where: Record<string, unknown> = {
    OR: [{ title: { contains: keyword } }, { content: { contains: keyword } }],
  };
  if (projectId) where.AND = [{ OR: [{ projectId }, { item: { projectId } }] }];
  const logs = await prisma.workLog.findMany({
    where,
    include: { item: { select: { id: true, title: true, projectId: true } } },
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    take: MAX_CANDIDATES,
  });
  if (logs.length === 0) return { error: "No matching work log found", status: 404 as const };
  if (logs.length > 1) {
    return {
      needsConfirmation: true,
      message: "Multiple work logs matched. Ask the user to choose one logId.",
      candidates: logs.map((log) => ({ id: log.id, title: log.title, type: log.type, workDate: log.workDate, project: log.project, itemTitle: log.item?.title || null })),
    };
  }
  return { log: logs[0] };
}

async function handleListWorkLogs(input: Record<string, unknown>) {
  const scopedProject = await resolveScopedProjectId(input);
  if ("needsConfirmation" in scopedProject) return jsonOk(scopedProject);
  if ("error" in scopedProject) return jsonError(scopedProject.error || "Project lookup failed", scopedProject.status || 400);
  const projectId = "project" in scopedProject ? scopedProject.project.id : undefined;
  const where: Record<string, unknown> = {};
  const startDate = normalizeYmd(input.startDate, "startDate");
  const endDate = normalizeYmd(input.endDate, "endDate");
  if (startDate || endDate) where.workDate = { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) };
  if (projectId) where.OR = [{ projectId }, { item: { projectId } }];
  const keyword = trimString(input.keyword || input.logKeyword);
  if (keyword) {
    where.AND = [{ OR: [{ title: { contains: keyword } }, { content: { contains: keyword } }] }];
  }
  for (const field of ["type", "source"]) {
    const value = trimString(input[field]);
    if (value) where[field] = value;
  }
  if (input.reportable !== undefined && input.reportable !== "") where.reportable = optionalBoolean(input.reportable);
  const pageSize = Math.min(Math.max(parseSortOrder(input.pageSize) || 20, 1), 100);
  const logs = await prisma.workLog.findMany({
    where,
    include: { item: { select: { id: true, title: true, projectId: true } }, actionItems: { orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    take: pageSize,
  });
  return jsonOk({ project: "project" in scopedProject ? scopedProject.project : null, logs });
}

async function handleGetWorkLog(input: Record<string, unknown>) {
  const resolved = await resolveWorkLog(input);
  if ("needsConfirmation" in resolved) return jsonOk({ needsConfirmation: true, ...resolved });
  if ("error" in resolved) return jsonError(resolved.error || "Work log lookup failed", resolved.status || 400);
  if (!("log" in resolved)) return jsonError("Work log lookup failed");
  const log = await prisma.workLog.findUnique({
    where: { id: resolved.log.id },
    include: { item: true, actionItems: { orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] }, projectRef: { select: { id: true, name: true } } },
  });
  return jsonOk({ log });
}

async function handleUpdateWorkLog(input: Record<string, unknown>) {
  const resolved = await resolveWorkLog(input);
  if ("needsConfirmation" in resolved) return jsonOk({ needsConfirmation: true, ...resolved });
  if ("error" in resolved) return jsonError(resolved.error || "Work log lookup failed", resolved.status || 400);
  if (!("log" in resolved)) return jsonError("Work log lookup failed");
  const patch = getPatch(input);
  const data: Record<string, unknown> = {};
  if ("workDate" in patch) data.workDate = normalizeYmd(patch.workDate, "workDate");
  for (const field of ["title", "content", "type", "source"]) {
    if (field in patch) {
      const value = trimString(patch[field]);
      if (!value) return jsonError(`${field} cannot be empty`);
      data[field] = value;
    }
  }
  for (const field of ["module", "tags", "sourceUrl"]) {
    if (field in patch) data[field] = optionalString(patch[field]);
  }
  if ("reportable" in patch) data.reportable = optionalBoolean(patch.reportable);
  const log = await prisma.workLog.update({ where: { id: resolved.log.id }, data });
  revalidateWorkHubPaths({ logId: log.id, itemId: log.itemId || undefined, projectId: log.projectId || undefined });
  return jsonOk({ log });
}

async function resolveActionItem(input: Record<string, unknown>) {
  const actionItemId = trimString(input.actionItemId);
  const scopedProject = await resolveScopedProjectId(input);
  if ("needsConfirmation" in scopedProject || "error" in scopedProject) return scopedProject;
  const projectId = "project" in scopedProject ? scopedProject.project.id : undefined;
  if (actionItemId) {
    const actionItem = await prisma.actionItem.findUnique({ where: { id: actionItemId } });
    if (!actionItem || (projectId && actionItem.projectId !== projectId)) return { error: "Action item not found", status: 404 as const };
    return { actionItem };
  }
  const keyword = trimString(input.actionItemKeyword || input.actionItemTitle || input.title);
  if (!keyword) return { error: "actionItemId or actionItemKeyword is required", status: 400 as const };
  const where: Record<string, unknown> = { title: { contains: keyword } };
  if (projectId) where.projectId = projectId;
  const actionItems = await prisma.actionItem.findMany({
    where,
    include: { workItem: { select: { id: true, title: true } }, workLog: { select: { id: true, title: true } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    take: MAX_CANDIDATES,
  });
  if (actionItems.length === 0) return { error: "No matching action item found", status: 404 as const };
  if (actionItems.length > 1) {
    return {
      needsConfirmation: true,
      message: "Multiple action items matched. Ask the user to choose one actionItemId.",
      candidates: actionItems.map((actionItem) => ({ id: actionItem.id, title: actionItem.title, status: actionItem.status, owner: actionItem.owner, dueDate: actionItem.dueDate, workItemTitle: actionItem.workItem?.title || null, workLogTitle: actionItem.workLog?.title || null })),
    };
  }
  return { actionItem: actionItems[0] };
}

async function handleListActionItems(input: Record<string, unknown>) {
  const scopedProject = await resolveScopedProjectId(input);
  if ("needsConfirmation" in scopedProject) return jsonOk(scopedProject);
  if ("error" in scopedProject) return jsonError(scopedProject.error || "Project lookup failed", scopedProject.status || 400);
  const where: Record<string, unknown> = {};
  const projectId = "project" in scopedProject ? scopedProject.project.id : trimString(input.projectId) || undefined;
  if (projectId) where.projectId = projectId;
  const workItemId = trimString(input.workItemId);
  const workLogId = trimString(input.workLogId);
  if (workItemId) where.workItemId = workItemId;
  if (workLogId) where.workLogId = workLogId;
  const status = trimString(input.status);
  if (status) where.status = status;
  if (!status && !optionalBoolean(input.includeDone)) where.status = { not: "done" };
  const keyword = trimString(input.keyword || input.actionItemKeyword);
  if (keyword) where.title = { contains: keyword };
  const pageSize = Math.min(Math.max(parseSortOrder(input.pageSize) || 50, 1), 100);
  const actionItems = await prisma.actionItem.findMany({
    where,
    include: { workItem: { select: { id: true, title: true } }, workLog: { select: { id: true, title: true } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    take: pageSize,
  });
  return jsonOk({ project: "project" in scopedProject ? scopedProject.project : null, actionItems });
}

async function handleGetActionItem(input: Record<string, unknown>) {
  const resolved = await resolveActionItem(input);
  if ("needsConfirmation" in resolved) return jsonOk({ needsConfirmation: true, ...resolved });
  if ("error" in resolved) return jsonError(resolved.error || "Action item lookup failed", resolved.status || 400);
  if (!("actionItem" in resolved)) return jsonError("Action item lookup failed");
  const actionItem = await prisma.actionItem.findUnique({
    where: { id: resolved.actionItem.id },
    include: { workItem: { select: { id: true, title: true, projectId: true } }, workLog: { select: { id: true, title: true, projectId: true } }, project: { select: { id: true, name: true } } },
  });
  return jsonOk({ actionItem });
}

async function handleUpdateActionItem(input: Record<string, unknown>) {
  const resolved = await resolveActionItem(input);
  if ("needsConfirmation" in resolved) return jsonOk({ needsConfirmation: true, ...resolved });
  if ("error" in resolved) return jsonError(resolved.error || "Action item lookup failed", resolved.status || 400);
  if (!("actionItem" in resolved)) return jsonError("Action item lookup failed");
  const current = resolved.actionItem;
  const patch = getPatch(input);
  const data: Record<string, unknown> = {};
  if ("title" in patch) {
    const title = trimString(patch.title);
    if (!title) return jsonError("title cannot be empty");
    data.title = title;
  }
  if ("owner" in patch) data.owner = optionalString(patch.owner);
  if ("dueDate" in patch) data.dueDate = normalizeYmd(patch.dueDate, "dueDate");
  if ("sortOrder" in patch) data.sortOrder = parseSortOrder(patch.sortOrder);
  if ("doneNote" in patch) data.doneNote = optionalString(patch.doneNote);
  if ("status" in patch) {
    const status = trimString(patch.status);
    if (!status) return jsonError("status cannot be empty");
    data.status = status;
    if (status === "done" && current.status !== "done") data.doneAt = new Date();
    if (status !== "done" && current.status === "done") {
      data.doneAt = null;
      if (!("doneNote" in patch)) data.doneNote = null;
    }
  }
  const actionItem = await prisma.actionItem.update({ where: { id: current.id }, data });
  revalidateWorkHubPaths({ itemId: actionItem.workItemId || undefined, logId: actionItem.workLogId || undefined, projectId: actionItem.projectId || undefined });
  return jsonOk({ actionItem });
}

async function handleCompleteActionItem(input: Record<string, unknown>) {
  const patch = { ...getPatch(input), status: "done" };
  return handleUpdateActionItem({ ...input, patch });
}

function resolveFactRange(input: Record<string, unknown>, fallback: "today" | "week" | "explicit") {
  if (fallback === "today") {
    const today = getLocalDateString();
    return { start: today, end: today };
  }
  if (fallback === "week") return getWeekRange();
  const start = normalizeYmd(input.startDate || input.start, "startDate");
  const end = normalizeYmd(input.endDate || input.end, "endDate");
  if (!start || !end) throw new Error("startDate and endDate are required");
  if (start > end) throw new Error("startDate cannot be later than endDate");
  return { start, end };
}

async function handleFactPackage(input: Record<string, unknown>, fallback: "today" | "week" | "explicit") {
  const scopedProject = await resolveScopedProjectId(input);
  if ("needsConfirmation" in scopedProject) return jsonOk(scopedProject);
  if ("error" in scopedProject) return jsonError(scopedProject.error || "Project lookup failed", scopedProject.status || 400);
  const project = "project" in scopedProject ? scopedProject.project : null;
  const { start, end } = resolveFactRange(input, fallback);
  const startDate = new Date(`${start}T00:00:00`);
  const endExclusive = new Date(`${end}T00:00:00`);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const projectLogScope = project ? { OR: [{ projectId: project.id }, { item: { projectId: project.id } }] } : {};
  const projectItemScope = project ? { projectId: project.id } : {};
  const factsWhere = {
    AND: [
      { workDate: { gte: start, lte: end } },
      ...(project ? [projectLogScope] : []),
      { OR: [{ reportable: true }, { type: { in: ["risk", "blocker", "decision", "issue"] } }] },
    ],
  };

  const [workLogs, reportableFacts, closedItems, updatedItems, activeSignals, actionItems] = await Promise.all([
    prisma.workLog.findMany({
      where: { workDate: { gte: start, lte: end }, ...projectLogScope },
      include: { item: { select: { id: true, title: true, projectId: true } }, actionItems: { orderBy: [{ status: "asc" }, { sortOrder: "asc" }] } },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.workLog.findMany({
      where: factsWhere,
      include: { item: { select: { id: true, title: true, projectId: true } } },
      orderBy: [{ reportable: "desc" }, { workDate: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.workItem.findMany({
      where: { closedAt: { gte: startDate, lt: endExclusive }, ...projectItemScope },
      include: { actionItems: { orderBy: [{ status: "asc" }, { sortOrder: "asc" }] } },
      orderBy: { closedAt: "desc" },
      take: 100,
    }),
    prisma.workItem.findMany({
      where: { updatedAt: { gte: startDate, lt: endExclusive }, ...projectItemScope },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.workItem.findMany({
      where: {
        status: { not: "closed" },
        ...projectItemScope,
        OR: [
          { priority: { in: ["P0", "P1"] } },
          { status: "blocked" },
          { health: { in: ["red", "yellow"] } },
          { dueDate: { lte: getLocalDateString() } },
        ],
      },
      include: { actionItems: { where: { status: { not: "done" } }, orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }] } },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    prisma.actionItem.findMany({
      where: { status: { not: "done" }, ...(project ? { projectId: project.id } : {}) },
      include: { workItem: { select: { id: true, title: true } }, workLog: { select: { id: true, title: true } } },
      orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      take: 100,
    }),
  ]);

  return jsonOk({
    range: { start, end },
    project,
    summary: {
      workLogCount: workLogs.length,
      reportableFactCount: reportableFacts.length,
      closedItemCount: closedItems.length,
      updatedItemCount: updatedItems.length,
      activeSignalCount: activeSignals.length,
      pendingActionItemCount: actionItems.length,
    },
    reportableFacts,
    workLogs,
    closedItems,
    updatedItems,
    activeSignals,
    pendingActionItems: actionItems,
  });
}

async function handleWorkHubOverview() {
  const today = getLocalDateString();
  const [projects, openItems, blockedItems, riskItems, overdueItems, pendingActionItems, recentFacts] = await Promise.all([
    prisma.project.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.workItem.findMany({ where: { status: { not: "closed" } }, orderBy: [{ priority: "asc" }, { updatedAt: "desc" }], take: 100 }),
    prisma.workItem.findMany({ where: { status: "blocked" }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.workItem.findMany({ where: { status: { not: "closed" }, health: { in: ["red", "yellow"] } }, orderBy: [{ health: "asc" }, { updatedAt: "desc" }], take: 100 }),
    prisma.workItem.findMany({ where: { status: { not: "closed" }, dueDate: { lt: today } }, orderBy: [{ dueDate: "asc" }, { priority: "asc" }], take: 100 }),
    prisma.actionItem.findMany({ where: { status: { not: "done" } }, include: { workItem: { select: { id: true, title: true } }, workLog: { select: { id: true, title: true } }, project: { select: { id: true, name: true } } }, orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }], take: 100 }),
    prisma.workLog.findMany({ where: { OR: [{ reportable: true }, { type: { in: ["risk", "blocker", "decision", "issue"] } }] }, include: { item: { select: { id: true, title: true } } }, orderBy: [{ workDate: "desc" }, { createdAt: "desc" }], take: 30 }),
  ]);
  return jsonOk({
    generatedAt: new Date().toISOString(),
    summary: {
      projectCount: projects.length,
      activeProjectCount: projects.filter((project) => project.status === "active").length,
      openItemCount: openItems.length,
      blockedItemCount: blockedItems.length,
      riskItemCount: riskItems.length,
      overdueItemCount: overdueItems.length,
      pendingActionItemCount: pendingActionItems.length,
      recentFactCount: recentFacts.length,
    },
    projects,
    blockedItems,
    riskItems,
    overdueItems,
    pendingActionItems,
    recentFacts,
  });
}

function handleHealth(authWarning?: string) {
  return jsonOk({
    service: "workhub-hermes-v1",
    authWarning,
    tools: [
      "health",
      "search_project",
      "get_project_snapshot",
      "create_project",
      "update_project",
      "list_project_milestones",
      "create_project_milestone",
      "update_project_milestone",
      "list_project_members",
      "create_project_member",
      "update_project_member",
      "list_project_links",
      "create_project_link",
      "update_project_link",
      "list_work_items",
      "get_work_item",
      "create_work_item_with_actions",
      "update_work_item",
      "close_work_item",
      "list_work_logs",
      "get_work_log",
      "create_project_log",
      "create_log_with_followup_action",
      "update_work_log",
      "list_action_items",
      "get_action_item",
      "update_action_item",
      "complete_action_item",
      "get_today_facts",
      "get_weekly_facts",
      "get_range_facts",
      "get_workhub_overview",
    ],
    rules: [
      "Do not delete data through Hermes.",
      "Use YYYY-MM-DD for dates.",
      "If needsConfirmation is true, ask the user to choose a candidate id before reading details or writing.",
      "Use reportable facts for reporting; do not invent conclusions that are not stored in WorkHub.",
    ],
  });
}

export async function POST(request: NextRequest) {
  const auth = assertAuthorized(request);
  if (!auth.ok) return jsonError(auth.error || "Unauthorized", 401);

  try {
    const body = (await request.json()) as ToolRequest;
    const tool = body.tool;
    const input = body.input || body.parameters || {};

    if (!tool || tool === "health") return handleHealth(auth.warning);
    if (tool === "search_project") return handleSearchProject(input);
    if (tool === "get_project_snapshot") return handleGetProjectSnapshot(input);
    if (tool === "create_project") return handleCreateProject(input);
    if (tool === "update_project") return handleUpdateProject(input);
    if (tool === "list_project_milestones") return handleListProjectMilestones(input);
    if (tool === "create_project_milestone") return handleCreateProjectMilestone(input);
    if (tool === "update_project_milestone") return handleUpdateProjectMilestone(input);
    if (tool === "list_project_members") return handleListProjectMembers(input);
    if (tool === "create_project_member") return handleCreateProjectMember(input);
    if (tool === "update_project_member") return handleUpdateProjectMember(input);
    if (tool === "list_project_links") return handleListProjectLinks(input);
    if (tool === "create_project_link") return handleCreateProjectLink(input);
    if (tool === "update_project_link") return handleUpdateProjectLink(input);
    if (tool === "list_work_items") return handleListWorkItems(input);
    if (tool === "get_work_item") return handleGetWorkItem(input);
    if (tool === "create_work_item_with_actions") return handleCreateWorkItemWithActions(input);
    if (tool === "update_work_item") return handleUpdateWorkItem(input);
    if (tool === "close_work_item") return handleCloseWorkItem(input);
    if (tool === "list_work_logs") return handleListWorkLogs(input);
    if (tool === "get_work_log") return handleGetWorkLog(input);
    if (tool === "create_project_log" || tool === "create_log_with_followup_action") {
      return handleCreateProjectLog(input);
    }
    if (tool === "update_work_log") return handleUpdateWorkLog(input);
    if (tool === "list_action_items") return handleListActionItems(input);
    if (tool === "get_action_item") return handleGetActionItem(input);
    if (tool === "update_action_item") return handleUpdateActionItem(input);
    if (tool === "complete_action_item") return handleCompleteActionItem(input);
    if (tool === "get_today_facts") return handleFactPackage(input, "today");
    if (tool === "get_weekly_facts") return handleFactPackage(input, "week");
    if (tool === "get_range_facts") return handleFactPackage(input, "explicit");
    if (tool === "get_workhub_overview") return handleWorkHubOverview();

    return jsonError(`Unsupported tool: ${tool}`, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hermes WorkHub tool failed";
    console.error("Hermes WorkHub MVP error:", error);
    return jsonError(message, 500);
  }
}
