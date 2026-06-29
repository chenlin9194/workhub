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

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const targetDate = parseOptionalDateInput(body.targetDate, "targetDate");
    if (!targetDate.ok) {
      return NextResponse.json({ error: targetDate.error }, { status: 400 });
    }

    const actualDate = parseOptionalDateInput(body.actualDate, "actualDate");
    if (!actualDate.ok) {
      return NextResponse.json({ error: actualDate.error }, { status: 400 });
    }

    const milestone = await prisma.projectMilestone.create({
      data: {
        projectId,
        title,
        description: normalizeOptionalString(body.description),
        status: normalizeStatus(body.status),
        targetDate: targetDate.value,
        actualDate: actualDate.value,
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
