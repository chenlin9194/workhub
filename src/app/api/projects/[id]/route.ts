import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getLocalDateString, toNullableString } from "@/lib/utils";
import { getWbsStageReadiness } from "@/lib/wbs/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { updatedAt: "desc" },
          take: 50,
        },
        logs: {
          orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
          take: 50,
        },
        _count: {
          select: { items: true, logs: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json({ error: "获取项目详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const currentProject = await prisma.project.findUnique({ where: { id }, include: { wbsPlan: true } });

    if (!currentProject) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    let wbsStageReadiness: Awaited<ReturnType<typeof getWbsStageReadiness>> | null = null;
    const nextStage = typeof body.stage === "string" ? body.stage.trim() : "";
    const exceptionReason = typeof body.wbsExceptionReason === "string" ? body.wbsExceptionReason.trim() : "";
    if (currentProject.wbsPlan?.status === "active" && nextStage && nextStage !== currentProject.stage) {
      wbsStageReadiness = await getWbsStageReadiness(id, nextStage);
      if (!wbsStageReadiness.ready && !exceptionReason) {
        return NextResponse.json({ error: "当前 WBS 存在未闭环 STR，阶段切换需要例外原因", readiness: wbsStageReadiness }, { status: 409 });
      }
    }

    const data: Record<string, unknown> = {};

    if ("name" in body) data.name = body.name;
    if ("code" in body) data.code = toNullableString(body.code);
    if ("description" in body) data.description = toNullableString(body.description);
    if ("type" in body) data.type = body.type;
    if ("status" in body) data.status = body.status;
    if ("stage" in body) data.stage = toNullableString(body.stage);
    if ("health" in body) data.health = body.health;
    if ("owner" in body) data.owner = toNullableString(body.owner);
    if ("pm" in body) data.pm = toNullableString(body.pm);
    if ("startDate" in body) data.startDate = body.startDate ? new Date(`${body.startDate}T00:00:00`) : null;
    if ("targetDate" in body) data.targetDate = body.targetDate ? new Date(`${body.targetDate}T00:00:00`) : null;
    if ("releaseDate" in body) data.releaseDate = body.releaseDate ? new Date(`${body.releaseDate}T00:00:00`) : null;
    if ("currentSummary" in body) data.currentSummary = toNullableString(body.currentSummary);
    if ("nextMilestone" in body) data.nextMilestone = toNullableString(body.nextMilestone);
    if ("nextAction" in body) data.nextAction = toNullableString(body.nextAction);
    if ("sourceSystem" in body) data.sourceSystem = toNullableString(body.sourceSystem);
    if ("sourceId" in body) data.sourceId = toNullableString(body.sourceId);
    if ("sourceUrl" in body) data.sourceUrl = toNullableString(body.sourceUrl);
    if ("tags" in body) data.tags = toNullableString(body.tags);

    const project = wbsStageReadiness && !wbsStageReadiness.ready && exceptionReason
      ? await prisma.$transaction(async (tx) => {
          const updatedProject = await tx.project.update({ where: { id }, data });
          await tx.workLog.create({
            data: {
              workDate: getLocalDateString(),
              title: `WBS 阶段切换例外：${currentProject.stage || "未设置"} → ${nextStage}`,
              content: exceptionReason,
              type: "decision",
              source: "manual",
              project: currentProject.name,
              projectId: currentProject.id,
              reportable: true,
            },
          });
          return updatedProject;
        })
      : await prisma.project.update({ where: { id }, data });

    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json({ error: "更新项目失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Unlink dependent records and delete the project as one all-or-nothing operation.
    await prisma.$transaction([
      prisma.projectWbsPlan.deleteMany({ where: { projectId: id } }),
      prisma.workItem.deleteMany({ where: { projectId: id, managedBy: "wbs" } }),
      prisma.workItem.updateMany({
        where: { projectId: id },
        data: { projectId: null },
      }),
      prisma.workLog.updateMany({
        where: { projectId: id },
        data: { projectId: null },
      }),
      prisma.project.delete({ where: { id } }),
    ]);

    revalidatePath("/");
    revalidatePath("/projects");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json({ error: "删除项目失败" }, { status: 500 });
  }
}
