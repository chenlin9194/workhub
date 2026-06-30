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

function normalizeSortOrder(value: unknown) {
  return Number.isFinite(value) ? Number(value) : 0;
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

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      orderBy: [
        { isCore: "desc" },
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("Error fetching project members:", error);
    return NextResponse.json({ error: "Failed to fetch project members" }, { status: 500 });
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
    const name = normalizeRequiredString(body.name);

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId,
        name,
        role: normalizeOptionalString(body.role),
        team: normalizeOptionalString(body.team),
        responsibility: normalizeOptionalString(body.responsibility),
        contact: normalizeOptionalString(body.contact),
        isCore: body.isCore === true,
        sortOrder: normalizeSortOrder(body.sortOrder),
      },
    });

    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("Error creating project member:", error);
    return NextResponse.json({ error: "Failed to create project member" }, { status: 500 });
  }
}
