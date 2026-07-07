import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getLocalDateString, toNullableString } from "@/lib/utils";

const COMPLETED_MILESTONE_STATUSES = ["done", "completed", "closed", "cancelled"];

function countByProjectId(rows: { projectId: string | null; _count: { _all: number } }[]) {
  return new Map(rows.flatMap((row) => (row.projectId ? [[row.projectId, row._count._all] as const] : [])));
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get("keyword");
    const status = searchParams.get("status");
    const health = searchParams.get("health");
    const type = searchParams.get("type");
    const owner = searchParams.get("owner");
    const pm = searchParams.get("pm");
    const stage = searchParams.get("stage");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (health) where.health = health;
    if (type) where.type = type;
    if (owner) where.owner = owner;
    if (pm) where.pm = pm;
    if (stage) where.stage = stage;
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
        { description: { contains: keyword } },
        { currentSummary: { contains: keyword } },
        { tags: { contains: keyword } },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          _count: {
            select: { items: true, logs: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.project.count({ where }),
    ]);

    const projectIds = projects.map((project) => project.id);
    const today = getLocalDateString();
    const sevenDaysAgoDate = new Date();
    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 6);
    const sevenDaysAgo = getLocalDateString(sevenDaysAgoDate);

    let projectsWithSignals = projects;

    if (projectIds.length > 0) {
      const [
        p0p1Rows,
        blockedRows,
        redYellowRows,
        overdueRows,
        recentReportableLogs,
        memberRows,
        coreMemberRows,
        nextOpenMilestones,
        primaryLinks,
      ] = await Promise.all([
        prisma.workItem.groupBy({
          by: ["projectId"],
          where: {
            projectId: { in: projectIds },
            status: { not: "closed" },
            priority: { in: ["P0", "P1"] },
          },
          _count: { _all: true },
        }),
        prisma.workItem.groupBy({
          by: ["projectId"],
          where: {
            projectId: { in: projectIds },
            status: "blocked",
          },
          _count: { _all: true },
        }),
        prisma.workItem.groupBy({
          by: ["projectId"],
          where: {
            projectId: { in: projectIds },
            status: { not: "closed" },
            health: { in: ["red", "yellow"] },
          },
          _count: { _all: true },
        }),
        prisma.workItem.groupBy({
          by: ["projectId"],
          where: {
            projectId: { in: projectIds },
            status: { not: "closed" },
            dueDate: { lt: today },
          },
          _count: { _all: true },
        }),
        prisma.workLog.findMany({
          where: {
            reportable: true,
            workDate: { gte: sevenDaysAgo },
            OR: [{ projectId: { in: projectIds } }, { item: { projectId: { in: projectIds } } }],
          },
          select: {
            projectId: true,
            item: { select: { projectId: true } },
          },
        }),
        prisma.projectMember.groupBy({
          by: ["projectId"],
          where: {
            projectId: { in: projectIds },
          },
          _count: { _all: true },
        }),
        prisma.projectMember.groupBy({
          by: ["projectId"],
          where: {
            projectId: { in: projectIds },
            isCore: true,
          },
          _count: { _all: true },
        }),
        prisma.projectMilestone.findMany({
          where: {
            projectId: { in: projectIds },
            status: { notIn: COMPLETED_MILESTONE_STATUSES },
            OR: [
              { plannedEndDate: { not: null } },
              { targetDate: { not: null } },
            ],
          },
          select: {
            id: true,
            projectId: true,
            title: true,
            status: true,
            stage: true,
            planType: true,
            dateMode: true,
            targetDate: true,
            plannedEndDate: true,
          },
          orderBy: [{ targetDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        }),
        prisma.projectLink.findMany({
          where: {
            projectId: { in: projectIds },
            isPrimary: true,
          },
          select: {
            id: true,
            projectId: true,
            title: true,
            url: true,
            category: true,
            isPrimary: true,
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        }),
      ]);

      const p0p1Counts = countByProjectId(p0p1Rows);
      const blockedCounts = countByProjectId(blockedRows);
      const redYellowCounts = countByProjectId(redYellowRows);
      const overdueCounts = countByProjectId(overdueRows);
      const recentReportableLogCounts = new Map<string, number>();
      for (const log of recentReportableLogs) {
        const projectId = log.projectId || log.item?.projectId;
        if (projectId) {
          recentReportableLogCounts.set(projectId, (recentReportableLogCounts.get(projectId) ?? 0) + 1);
        }
      }
      const memberCounts = countByProjectId(memberRows);
      const coreMemberCounts = countByProjectId(coreMemberRows);

      const nextOpenMilestoneByProjectId = new Map<string, (typeof nextOpenMilestones)[number]>();
      for (const milestone of nextOpenMilestones) {
        if (!nextOpenMilestoneByProjectId.has(milestone.projectId)) {
          nextOpenMilestoneByProjectId.set(milestone.projectId, milestone);
        }
      }

      const primaryLinkByProjectId = new Map<string, (typeof primaryLinks)[number]>();
      for (const link of primaryLinks) {
        if (!primaryLinkByProjectId.has(link.projectId)) {
          primaryLinkByProjectId.set(link.projectId, link);
        }
      }

      projectsWithSignals = projects.map((project) => {
        const nextOpenMilestone = nextOpenMilestoneByProjectId.get(project.id);
        const primaryLink = primaryLinkByProjectId.get(project.id);

        return {
          ...project,
          portfolioSignals: {
            p0p1Count: p0p1Counts.get(project.id) ?? 0,
            blockedCount: blockedCounts.get(project.id) ?? 0,
            redYellowCount: redYellowCounts.get(project.id) ?? 0,
            overdueCount: overdueCounts.get(project.id) ?? 0,
            recentReportableLogCount: recentReportableLogCounts.get(project.id) ?? 0,
            memberCount: memberCounts.get(project.id) ?? 0,
            coreMemberCount: coreMemberCounts.get(project.id) ?? 0,
            nextOpenMilestone: nextOpenMilestone
              ? {
                  id: nextOpenMilestone.id,
                  title: nextOpenMilestone.title,
                  status: nextOpenMilestone.status,
                  stage: nextOpenMilestone.stage,
                  planType: nextOpenMilestone.planType,
                  dateMode: nextOpenMilestone.dateMode,
                  targetDate: nextOpenMilestone.targetDate,
                  plannedEndDate: nextOpenMilestone.plannedEndDate,
                }
              : null,
            primaryLink: primaryLink
              ? {
                  id: primaryLink.id,
                  title: primaryLink.title,
                  url: primaryLink.url,
                  category: primaryLink.category,
                  isPrimary: primaryLink.isPrimary,
                }
              : null,
          },
        };
      });
    }

    return NextResponse.json({
      projects: projectsWithSignals,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "获取项目列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      code,
      description,
      type,
      status,
      stage,
      health,
      owner,
      pm,
      startDate,
      targetDate,
      releaseDate,
      currentSummary,
      nextMilestone,
      nextAction,
      sourceSystem,
      sourceId,
      sourceUrl,
      tags,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "项目名称不能为空" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        name,
        code: toNullableString(code),
        description: toNullableString(description),
        type: type || "project",
        status: status || "active",
        stage: toNullableString(stage),
        health: health || "unknown",
        owner: toNullableString(owner),
        pm: toNullableString(pm),
        startDate: startDate ? new Date(`${startDate}T00:00:00`) : null,
        targetDate: targetDate ? new Date(`${targetDate}T00:00:00`) : null,
        releaseDate: releaseDate ? new Date(`${releaseDate}T00:00:00`) : null,
        currentSummary: toNullableString(currentSummary),
        nextMilestone: toNullableString(nextMilestone),
        nextAction: toNullableString(nextAction),
        sourceSystem: toNullableString(sourceSystem),
        sourceId: toNullableString(sourceId),
        sourceUrl: toNullableString(sourceUrl),
        tags: toNullableString(tags),
      },
    });

    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath(`/projects/${project.id}`);

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "创建项目失败" }, { status: 500 });
  }
}
