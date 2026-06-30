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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id: projectId, memberId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const currentMember = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
      select: { id: true },
    });

    if (!currentMember) {
      return NextResponse.json({ error: "Project member not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if ("name" in body) {
      const name = normalizeRequiredString(body.name);
      if (!name) {
        return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
      }
      data.name = name;
    }

    if ("role" in body) {
      data.role = normalizeOptionalString(body.role);
    }

    if ("team" in body) {
      data.team = normalizeOptionalString(body.team);
    }

    if ("responsibility" in body) {
      data.responsibility = normalizeOptionalString(body.responsibility);
    }

    if ("contact" in body) {
      data.contact = normalizeOptionalString(body.contact);
    }

    if ("isCore" in body && typeof body.isCore === "boolean") {
      data.isCore = body.isCore;
    }

    if (Number.isFinite(body.sortOrder)) {
      data.sortOrder = Number(body.sortOrder);
    }

    const member = await prisma.projectMember.update({
      where: { id: memberId },
      data,
    });

    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error updating project member:", error);
    return NextResponse.json({ error: "Failed to update project member" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    void request;
    const { id: projectId, memberId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const currentMember = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
      select: { id: true },
    });

    if (!currentMember) {
      return NextResponse.json({ error: "Project member not found" }, { status: 404 });
    }

    await prisma.projectMember.delete({
      where: { id: memberId },
    });

    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project member:", error);
    return NextResponse.json({ error: "Failed to delete project member" }, { status: 500 });
  }
}
