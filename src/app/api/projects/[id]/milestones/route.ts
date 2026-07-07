import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  PROJECT_MILESTONE_STAGE_VALUES,
  normalizeDateMode,
  normalizePlanType,
  normalizeStage,
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    void request;
    const { id: projectId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const milestones = await prisma.projectMilestone.findMany({
      where: { projectId },
      orderBy: [
        { sortOrder: "asc" },
        { targetDate: "asc" },
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json(milestones);
  } catch (error) {
    console.error("Error fetching project milestones:", error);
    return NextResponse.json({ error: "Failed to fetch project milestones" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const title = normalizeRequiredString(body.title);
    const description = normalizeOptionalString(body.description);

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const planType = normalizePlanType(body.planType);
    const dateMode = normalizeDateMode(body.dateMode, planType);
    if (typeof body.stage !== "string" || !PROJECT_MILESTONE_STAGE_VALUES.has(body.stage.trim())) {
      return NextResponse.json({ error: "stage is required" }, { status: 400 });
    }
    const stage = normalizeStage(body.stage, { title, description });

    const plannedStartDate = parseOptionalDateInput(body.plannedStartDate, "plannedStartDate");
    if (!plannedStartDate.ok) {
      return NextResponse.json({ error: plannedStartDate.error }, { status: 400 });
    }

    const plannedEndDate = parseOptionalDateInput(body.plannedEndDate ?? body.targetDate, "plannedEndDate");
    if (!plannedEndDate.ok) {
      return NextResponse.json({ error: plannedEndDate.error }, { status: 400 });
    }

    const actualStartDate = parseOptionalDateInput(body.actualStartDate, "actualStartDate");
    if (!actualStartDate.ok) {
      return NextResponse.json({ error: actualStartDate.error }, { status: 400 });
    }

    const actualEndDate = parseOptionalDateInput(body.actualEndDate ?? body.actualDate, "actualEndDate");
    if (!actualEndDate.ok) {
      return NextResponse.json({ error: actualEndDate.error }, { status: 400 });
    }

    if (dateMode === "range") {
      const plannedRangeError = validateDateRange(plannedStartDate.value, plannedEndDate.value, "planned");
      if (plannedRangeError) return NextResponse.json({ error: plannedRangeError }, { status: 400 });

      const actualRangeError = validateDateRange(actualStartDate.value, actualEndDate.value, "actual");
      if (actualRangeError) return NextResponse.json({ error: actualRangeError }, { status: 400 });
    }

    if (actualEndDate.value && !plannedEndDate.value) {
      return NextResponse.json({ error: "plannedEndDate is required before actualEndDate" }, { status: 400 });
    }

    const milestone = await prisma.projectMilestone.create({
      data: {
        projectId,
        title,
        description,
        stage,
        planType,
        dateMode,
        status: normalizeStatus(body.status),
        targetDate: plannedEndDate.value,
        actualDate: actualEndDate.value,
        plannedStartDate: dateMode === "range" ? plannedStartDate.value : null,
        plannedEndDate: plannedEndDate.value,
        actualStartDate: dateMode === "range" ? actualStartDate.value : null,
        actualEndDate: actualEndDate.value,
        owner: normalizeOptionalString(body.owner),
        sourceUrl: normalizeOptionalString(body.sourceUrl),
        sortOrder: Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0,
      },
    });

    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);

    return NextResponse.json(milestone, { status: 201 });
  } catch (error) {
    console.error("Error creating project milestone:", error);
    return NextResponse.json({ error: "Failed to create project milestone" }, { status: 500 });
  }
}
