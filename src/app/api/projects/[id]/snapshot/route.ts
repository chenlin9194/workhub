import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLocalDateString } from "@/lib/utils";

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
    planType: true;
    status: true;
    targetDate: true;
    actualDate: true;
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

    if (!milestone.targetDate) {
      return false;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return milestone.targetDate < startOfToday;
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
      ] =
        await Promise.all([
          prisma.projectMilestone.findMany({
            where: { projectId: project.id },
            select: {
              id: true,
              title: true,
              description: true,
              planType: true,
              status: true,
              targetDate: true,
              actualDate: true,
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
        ]);

      items = queriedItems;
      recentLogs = queriedRecentLogs;

      const { byHealth, topRisks, nextCheckpointItem } = buildSnapshot(items, today);
      const signals = {
        itemCount: items.length,
        logCount: projectLogCount,
        recentLogCount: recentLogs.length,
        p0p1Count: items.filter(
          (item) =>
            (item.priority === "P0" || item.priority === "P1") &&
            item.status !== "closed"
        ).length,
        blockedCount: items.filter((item) => item.status === "blocked").length,
        redYellowCount: items.filter(
          (item) => item.health === "red" || item.health === "yellow"
        ).length,
        overdueCount: items.filter(
          (item) => item.dueDate && item.dueDate < today && item.status !== "closed"
        ).length,
        topRiskCount: topRisks.length,
      };
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

    const { byHealth, topRisks, nextCheckpointItem } = buildSnapshot(items, today);

    return NextResponse.json({
      projectId: id,
      items,
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
