import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getMilestonePlannedEnd } from "@/lib/projectMilestones";
import { prisma } from "@/lib/prisma";
import { getLocalDateString, isValidYmdDateString } from "@/lib/utils";
import { deriveStrReadiness } from "@/lib/wbs/readiness";

const HEALTH_GROUPS = ["red", "yellow", "green", "unknown"] as const;
const ACTIVE_MILESTONE_STATUSES = new Set(["planned", "in_progress", "delayed"]);
const COMPLETED_MILESTONE_STATUSES = new Set(["done", "cancelled"]);

type WorkItemWithLogs = Prisma.WorkItemGetPayload<Prisma.WorkItemDefaultArgs>;
type WorkLogWithItem = Prisma.WorkLogGetPayload<{
  include: { item: { select: { id: true; title: true } } };
}>;
type SnapshotMilestone = Prisma.ProjectMilestoneGetPayload<{
  select: {
    id: true;
    title: true;
    description: true;
    stage: true;
    planType: true;
    dateMode: true;
    status: true;
    targetDate: true;
    actualDate: true;
    plannedStartDate: true;
    plannedEndDate: true;
    actualStartDate: true;
    actualEndDate: true;
    owner: true;
    sourceUrl: true;
    sortOrder: true;
    createdAt: true;
    updatedAt: true;
  };
}>;
type SnapshotLink = Prisma.ProjectLinkGetPayload<{
  select: {
    id: true;
    title: true;
    url: true;
    category: true;
    description: true;
    isPrimary: true;
    sortOrder: true;
    createdAt: true;
    updatedAt: true;
  };
}>;
type SnapshotMember = Prisma.ProjectMemberGetPayload<{
  select: {
    id: true;
    name: true;
    role: true;
    team: true;
    responsibility: true;
    contact: true;
    isCore: true;
    sortOrder: true;
  };
}>;

function buildSnapshot(items: WorkItemWithLogs[], today: string) {
  const byHealth = Object.fromEntries(
    HEALTH_GROUPS.map((health) => [
      health,
      items.filter((item) => item.health === health),
    ])
  );

  const topRisks = items.filter(
    (item) => item.health === "red" || item.status === "blocked"
  );

  const nextCheckpointItem =
    items
      .filter(
        (item) =>
          item.status !== "closed" &&
          item.nextCheckpoint !== null &&
          isValidYmdDateString(item.nextCheckpoint) &&
          item.nextCheckpoint >= today
      )
      .sort((a, b) =>
        (a.nextCheckpoint as string).localeCompare(b.nextCheckpoint as string)
      )[0] ?? null;

  return { byHealth, topRisks, nextCheckpointItem };
}

function buildMilestoneTimeline(milestones: SnapshotMilestone[]) {
  const delayedMilestones = milestones.filter((milestone) => {
    if (milestone.status === "delayed") {
      return true;
    }

    if (COMPLETED_MILESTONE_STATUSES.has(milestone.status)) {
      return false;
    }

    const plannedEnd = getMilestonePlannedEnd(milestone);
    if (!plannedEnd) {
      return false;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return new Date(plannedEnd) < startOfToday;
  });

  const nextOpenMilestone =
    milestones.find((milestone) => ACTIVE_MILESTONE_STATUSES.has(milestone.status)) ??
    null;

  return { delayedMilestones, nextOpenMilestone };
}

function buildKeyLinks(links: SnapshotLink[]) {
  const primaryLinks = links.filter((link) => link.isPrimary);
  const orderedLinks = [...primaryLinks, ...links.filter((link) => !link.isPrimary)];
  const keyLinks = orderedLinks.slice(0, 5);

  return {
    primaryLink: primaryLinks[0] ?? null,
    items: keyLinks,
  };
}

function buildMemberSummary(members: SnapshotMember[]) {
  return {
    memberCount: members.length,
    coreMemberCount: members.filter((member) => member.isCore).length,
  };
}

function buildSignals(items: WorkItemWithLogs[], recentLogs: WorkLogWithItem[], topRisks: WorkItemWithLogs[], today: string, logCount: number) {
  return {
    itemCount: items.length,
    logCount,
    recentLogCount: recentLogs.length,
    p0p1Count: items.filter(
      (item) => (item.priority === "P0" || item.priority === "P1") && item.status !== "closed"
    ).length,
    blockedCount: items.filter((item) => item.status === "blocked").length,
    redYellowCount: items.filter((item) => item.health === "red" || item.health === "yellow").length,
    overdueCount: items.filter(
      (item) => item.dueDate && item.dueDate < today && item.status !== "closed"
    ).length,
    topRiskCount: topRisks.length,
  };
}

function emptyTimeline() {
  return {
    milestones: [],
    delayedMilestones: [],
    nextOpenMilestone: null,
  };
}

function buildWbsFacts(plan: {
  profile: string;
  template: { version: string };
  nodes: Array<{ gateKey: string; code: string; title: string; kind: string; status: string | null; role: string | null; waiverReason: string | null; deliverables: Array<{ required: boolean; status: string }> }>;
}) {
  const gateKeys = ["STR1", "STR2", "STR3", "STR4", "STR4A", "STR5"] as const;
  const executionNodes = plan.nodes.filter((node) => node.kind === "task" || node.kind === "gate");
  const gates = gateKeys.map((gateKey) => {
    const nodes = executionNodes.filter((node) => node.gateKey === gateKey);
    const readiness = deriveStrReadiness(gateKey, nodes.map((node) => ({
      kind: node.kind as "task" | "gate",
      status: node.status as "not_started" | "in_progress" | "blocked" | "done" | "waived" | null,
      requiredDeliverables: node.deliverables.map((deliverable) => ({ required: deliverable.required, status: deliverable.status as "pending" | "delivered" })),
    })));
    return { gateKey, status: readiness.status, completed: readiness.completedExecutionNodes, total: readiness.totalExecutionNodes };
  });
  const roles = new Set(executionNodes.map((node) => node.role?.trim()).filter(Boolean));
  return {
    profile: plan.profile,
    templateVersion: plan.template.version,
    currentGate: gates.find((gate) => gate.status !== "closed")?.gateKey ?? null,
    roleTaskCount: executionNodes.filter((node) => node.role?.trim()).length,
    roleCount: roles.size,
    openTasks: executionNodes.filter((node) => node.status !== "done" && node.status !== "waived").length,
    blockedTasks: executionNodes.filter((node) => node.status === "blocked").length,
    pendingRequiredDeliverables: executionNodes.reduce((count, node) => count + node.deliverables.filter((deliverable) => deliverable.required && deliverable.status !== "delivered").length, 0),
    waivedTasks: executionNodes.filter((node) => node.status === "waived").length,
    waived: executionNodes
      .filter((node) => node.status === "waived")
      .map((node) => ({ gateKey: node.gateKey, code: node.code, title: node.title, reason: node.waiverReason || "未记录原因" })),
    gates,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const today = getLocalDateString();

    // Try to find real Project first
    const projectSelect = {
      id: true,
      name: true,
      code: true,
      type: true,
      status: true,
      stage: true,
      health: true,
      owner: true,
      pm: true,
      startDate: true,
      targetDate: true,
      releaseDate: true,
      currentSummary: true,
      nextMilestone: true,
      nextAction: true,
      sourceUrl: true,
      tags: true,
    } as const;

    const project = await prisma.project.findUnique({
      where: { id },
      select: projectSelect,
    });

    let items: WorkItemWithLogs[];
    let recentLogs: WorkLogWithItem[];

    if (project) {
      // Found real Project - query by projectId
      const [
        projectMilestones,
        projectLinks,
        projectMembers,
        queriedItems,
        queriedRecentLogs,
        projectLogCount,
        wbsPlan,
      ] =
        await Promise.all([
          prisma.projectMilestone.findMany({
            where: { projectId: project.id },
            select: {
              id: true,
              title: true,
              description: true,
              stage: true,
              planType: true,
              dateMode: true,
              status: true,
              targetDate: true,
              actualDate: true,
              plannedStartDate: true,
              plannedEndDate: true,
              actualStartDate: true,
              actualEndDate: true,
              owner: true,
              sourceUrl: true,
              sortOrder: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: [
              { sortOrder: "asc" },
              { targetDate: "asc" },
              { createdAt: "asc" },
            ],
            take: 10,
          }),
          prisma.projectLink.findMany({
            where: { projectId: project.id },
            select: {
              id: true,
              title: true,
              url: true,
              category: true,
              description: true,
              isPrimary: true,
              sortOrder: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            take: 8,
          }),
          prisma.projectMember.findMany({
            where: { projectId: project.id },
            select: {
              id: true,
              name: true,
              role: true,
              team: true,
              responsibility: true,
              contact: true,
              isCore: true,
              sortOrder: true,
            },
            orderBy: [
              { isCore: "desc" },
              { sortOrder: "asc" },
              { createdAt: "asc" },
            ],
            take: 20,
          }),
          prisma.workItem.findMany({
            where: { projectId: project.id },
            orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
          }),
          prisma.workLog.findMany({
            where: {
              OR: [{ projectId: project.id }, { item: { projectId: project.id } }],
            },
            include: { item: { select: { id: true, title: true } } },
            orderBy: { createdAt: "desc" },
            take: 10,
          }),
          prisma.workLog.count({
            where: {
              OR: [{ projectId: project.id }, { item: { projectId: project.id } }],
            },
          }),
          prisma.projectWbsPlan.findUnique({
            where: { projectId: project.id },
            select: {
              profile: true,
              template: { select: { version: true } },
              nodes: { select: { gateKey: true, code: true, title: true, kind: true, status: true, role: true, waiverReason: true, deliverables: { select: { required: true, status: true } } } },
            },
          }),
        ]);

      items = queriedItems;
      recentLogs = queriedRecentLogs;

      const { byHealth, topRisks, nextCheckpointItem } = buildSnapshot(items, today);
      const signals = buildSignals(items, recentLogs, topRisks, today, projectLogCount);
      const { delayedMilestones, nextOpenMilestone } =
        buildMilestoneTimeline(projectMilestones);
      const keyLinks = buildKeyLinks(projectLinks);
      const memberSummary = buildMemberSummary(projectMembers);

      return NextResponse.json({
        projectId: project.id,
        project,
        projectName: project.name,
        summary: {
          name: project.name,
          code: project.code,
          type: project.type,
          status: project.status,
          stage: project.stage,
          health: project.health,
          owner: project.owner,
          pm: project.pm,
          currentSummary: project.currentSummary,
          nextMilestone: project.nextMilestone,
          nextAction: project.nextAction,
        },
        members: projectMembers,
        memberSummary,
        signals,
        timeline: {
          milestones: projectMilestones,
          delayedMilestones,
          nextOpenMilestone,
        },
        keyLinks,
        milestones: projectMilestones,
        links: projectLinks,
        items,
        byHealth,
        topRisks,
        recentLogs,
        nextCheckpointItem,
        ...(wbsPlan ? { wbs: buildWbsFacts(wbsPlan) } : {}),
      });
    }

    // Fallback: query by project string (legacy)
    [items, recentLogs] = await Promise.all([
      prisma.workItem.findMany({
        where: { project: id },
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      }),
      prisma.workLog.findMany({
        where: {
          OR: [{ project: id }, { item: { project: id } }],
        },
        include: { item: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    const projectLogCount = await prisma.workLog.count({
      where: {
        OR: [{ project: id }, { item: { project: id } }],
      },
    });
    const { byHealth, topRisks, nextCheckpointItem } = buildSnapshot(items, today);
    const signals = buildSignals(items, recentLogs, topRisks, today, projectLogCount);

    return NextResponse.json({
      projectId: id,
      items,
      signals,
      timeline: emptyTimeline(),
      byHealth,
      topRisks,
      recentLogs,
      nextCheckpointItem,
    });
  } catch (error) {
    console.error("Error generating project snapshot:", error);
    return NextResponse.json({ error: "生成项目快照失败" }, { status: 500 });
  }
}
