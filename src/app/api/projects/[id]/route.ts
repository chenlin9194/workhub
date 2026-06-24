import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function toNullableString(value: unknown): string | null {
  return value === "" || value === undefined || value === null ? null : String(value);
}

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

    const currentProject = await prisma.project.findUnique({ where: { id } });

    if (!currentProject) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
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

    const project = await prisma.project.update({
      where: { id },
      data,
    });

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

    // Unlink WorkItem and WorkLog before deleting project
    await prisma.workItem.updateMany({
      where: { projectId: id },
      data: { projectId: null },
    });

    await prisma.workLog.updateMany({
      where: { projectId: id },
      data: { projectId: null },
    });

    await prisma.project.delete({ where: { id } });

    revalidatePath("/");
    revalidatePath("/projects");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json({ error: "删除项目失败" }, { status: 500 });
  }
}
