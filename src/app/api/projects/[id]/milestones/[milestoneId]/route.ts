import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { toNullableString } from "@/lib/utils";

function normalizeRequiredString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? toNullableString(value.trim()) : null;
}

function normalizeStatus(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "planned";
}

function parseOptionalDateInput(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") {
    return { ok: true as const, value: null as Date | null };
  }

  if (typeof value !== "string") {
    return { ok: false as const, error: `${fieldName} must be a valid date string` };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true as const, value: null as Date | null };
  }

  const date = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return { ok: false as const, error: `${fieldName} must be a valid date` };
  }

  return { ok: true as const, value: date };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const { id: projectId, milestoneId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const currentMilestone = await prisma.projectMilestone.findFirst({
      where: { id: milestoneId, projectId },
      select: { id: true },
    });

    if (!currentMilestone) {
      return NextResponse.json({ error: "Project milestone not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if ("title" in body) {
      const title = normalizeRequiredString(body.title);
      if (!title) {
        return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
      }
      data.title = title;
    }

    if ("description" in body) {
      data.description = normalizeOptionalString(body.description);
    }

    if ("status" in body) {
      data.status = normalizeStatus(body.status);
    }

    if ("targetDate" in body) {
      const targetDate = parseOptionalDateInput(body.targetDate, "targetDate");
      if (!targetDate.ok) {
        return NextResponse.json({ error: targetDate.error }, { status: 400 });
      }
      data.targetDate = targetDate.value;
    }

    if ("actualDate" in body) {
      const actualDate = parseOptionalDateInput(body.actualDate, "actualDate");
      if (!actualDate.ok) {
        return NextResponse.json({ error: actualDate.error }, { status: 400 });
      }
      data.actualDate = actualDate.value;
    }

    if ("owner" in body) {
      data.owner = normalizeOptionalString(body.owner);
    }

    if ("sourceUrl" in body) {
      data.sourceUrl = normalizeOptionalString(body.sourceUrl);
    }

    if (Number.isFinite(body.sortOrder)) {
      data.sortOrder = Number(body.sortOrder);
    }

    const milestone = await prisma.projectMilestone.update({
      where: { id: milestoneId },
      data,
    });

    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);

    return NextResponse.json(milestone);
  } catch (error) {
    console.error("Error updating project milestone:", error);
    return NextResponse.json({ error: "Failed to update project milestone" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    void request;
    const { id: projectId, milestoneId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const currentMilestone = await prisma.projectMilestone.findFirst({
      where: { id: milestoneId, projectId },
      select: { id: true },
    });

    if (!currentMilestone) {
      return NextResponse.json({ error: "Project milestone not found" }, { status: 404 });
    }

    await prisma.projectMilestone.delete({
      where: { id: milestoneId },
    });

    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project milestone:", error);
    return NextResponse.json({ error: "Failed to delete project milestone" }, { status: 500 });
  }
}
