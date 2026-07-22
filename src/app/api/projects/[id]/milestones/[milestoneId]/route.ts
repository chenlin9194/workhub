import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  PROJECT_MILESTONE_STAGE_VALUES,
  normalizeDateMode,
  normalizePlanType,
} from "@/lib/projectMilestones";
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

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? { ok: false as const, error: `${fieldName} must be a valid date` }
      : { ok: true as const, value };
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

function validateDateRange(start: Date | null, end: Date | null, label: string) {
  if (start && end && start.getTime() > end.getTime()) {
    return `${label} start date cannot be later than end date`;
  }

  return "";
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
    });

    if (!currentMilestone) {
      return NextResponse.json({ error: "Project milestone not found" }, { status: 404 });
    }

    const body = await request.json();
    const wbsNodeCount = await prisma.projectWbsNode.count({ where: { milestoneId } });
    if (wbsNodeCount > 0 && ("status" in body || "actualDate" in body || "actualStartDate" in body || "actualEndDate" in body)) {
      return NextResponse.json({ error: "该 STR 里程碑状态由 WBS 执行节点派生，请在 WBS 执行页维护" }, { status: 409 });
    }
    const data: Record<string, unknown> = {};
    const nextTitle = "title" in body ? normalizeRequiredString(body.title) : currentMilestone.title;
    const nextDescription = "description" in body ? normalizeOptionalString(body.description) : currentMilestone.description;

    if ("title" in body) {
      if (!nextTitle) {
        return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
      }
      data.title = nextTitle;
    }

    if ("description" in body) {
      data.description = nextDescription;
    }

    if ("status" in body) {
      data.status = normalizeStatus(body.status);
    }

    const nextPlanType = "planType" in body ? normalizePlanType(body.planType) : currentMilestone.planType;
    const nextDateMode = "dateMode" in body || "planType" in body
      ? normalizeDateMode(body.dateMode, nextPlanType)
      : normalizeDateMode(currentMilestone.dateMode, nextPlanType);
    if ("stage" in body) {
      if (typeof body.stage !== "string" || !PROJECT_MILESTONE_STAGE_VALUES.has(body.stage.trim())) {
        return NextResponse.json({ error: "stage cannot be empty" }, { status: 400 });
      }
      data.stage = body.stage.trim();
    }

    if ("planType" in body) {
      data.planType = nextPlanType;
    }

    if ("dateMode" in body || "planType" in body) {
      data.dateMode = nextDateMode;
    }

    const rawPlannedStart = "plannedStartDate" in body ? body.plannedStartDate : currentMilestone.plannedStartDate;
    const rawPlannedEnd = "plannedEndDate" in body
      ? body.plannedEndDate
      : "targetDate" in body
        ? body.targetDate
        : currentMilestone.plannedEndDate ?? currentMilestone.targetDate;
    const rawActualStart = "actualStartDate" in body ? body.actualStartDate : currentMilestone.actualStartDate;
    const rawActualEnd = "actualEndDate" in body
      ? body.actualEndDate
      : "actualDate" in body
        ? body.actualDate
        : currentMilestone.actualEndDate ?? currentMilestone.actualDate;

    const plannedStartDate = parseOptionalDateInput(rawPlannedStart, "plannedStartDate");
    if (!plannedStartDate.ok) {
      return NextResponse.json({ error: plannedStartDate.error }, { status: 400 });
    }

    const plannedEndDate = parseOptionalDateInput(rawPlannedEnd, "plannedEndDate");
    if (!plannedEndDate.ok) {
      return NextResponse.json({ error: plannedEndDate.error }, { status: 400 });
    }

    const actualStartDate = parseOptionalDateInput(rawActualStart, "actualStartDate");
    if (!actualStartDate.ok) {
      return NextResponse.json({ error: actualStartDate.error }, { status: 400 });
    }

    const actualEndDate = parseOptionalDateInput(rawActualEnd, "actualEndDate");
    if (!actualEndDate.ok) {
      return NextResponse.json({ error: actualEndDate.error }, { status: 400 });
    }

    if (nextDateMode === "range") {
      const plannedRangeError = validateDateRange(plannedStartDate.value, plannedEndDate.value, "planned");
      if (plannedRangeError) return NextResponse.json({ error: plannedRangeError }, { status: 400 });

      const actualRangeError = validateDateRange(actualStartDate.value, actualEndDate.value, "actual");
      if (actualRangeError) return NextResponse.json({ error: actualRangeError }, { status: 400 });
    }

    if (actualEndDate.value && !plannedEndDate.value) {
      return NextResponse.json({ error: "plannedEndDate is required before actualEndDate" }, { status: 400 });
    }

    if (
      "plannedStartDate" in body ||
      "plannedEndDate" in body ||
      "actualStartDate" in body ||
      "actualEndDate" in body ||
      "targetDate" in body ||
      "actualDate" in body ||
      "dateMode" in body ||
      "planType" in body
    ) {
      data.plannedStartDate = nextDateMode === "range" ? plannedStartDate.value : null;
      data.plannedEndDate = plannedEndDate.value;
      data.actualStartDate = nextDateMode === "range" ? actualStartDate.value : null;
      data.actualEndDate = actualEndDate.value;
      data.targetDate = plannedEndDate.value;
      data.actualDate = actualEndDate.value;
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

    const wbsNodeCount = await prisma.projectWbsNode.count({ where: { milestoneId } });
    if (wbsNodeCount > 0) {
      return NextResponse.json({ error: "该 STR 里程碑已被 WBS 引用，请先处理 WBS 计划后再删除" }, { status: 409 });
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
