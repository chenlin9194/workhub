import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { toNullableString } from "@/lib/utils";

function normalizeRequiredString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDescription(value: unknown) {
  return typeof value === "string" ? toNullableString(value.trim()) : null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    const { id: projectId, linkId } = await params;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const currentLink = await prisma.projectLink.findFirst({
      where: { id: linkId, projectId },
      select: { id: true },
    });

    if (!currentLink) {
      return NextResponse.json({ error: "Project link not found" }, { status: 404 });
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

    if ("url" in body) {
      const url = normalizeRequiredString(body.url);
      if (!url) {
        return NextResponse.json({ error: "url cannot be empty" }, { status: 400 });
      }
      data.url = url;
    }

    if ("category" in body) {
      const category = normalizeRequiredString(body.category);
      if (!category) {
        return NextResponse.json({ error: "category cannot be empty" }, { status: 400 });
      }
      data.category = category;
    }

    if ("description" in body) {
      data.description = normalizeDescription(body.description);
    }

    if (typeof body.isPrimary === "boolean") {
      data.isPrimary = body.isPrimary;
    }

    if (Number.isFinite(body.sortOrder)) {
      data.sortOrder = Number(body.sortOrder);
    }

    const link = await prisma.projectLink.update({
      where: { id: linkId },
      data,
    });

    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);

    return NextResponse.json(link);
  } catch (error) {
    console.error("Error updating project link:", error);
    return NextResponse.json({ error: "Failed to update project link" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    void request;
    const { id: projectId, linkId } = await params;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const currentLink = await prisma.projectLink.findFirst({
      where: { id: linkId, projectId },
      select: { id: true },
    });

    if (!currentLink) {
      return NextResponse.json({ error: "Project link not found" }, { status: 404 });
    }

    await prisma.projectLink.delete({
      where: { id: linkId },
    });

    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project link:", error);
    return NextResponse.json({ error: "Failed to delete project link" }, { status: 500 });
  }
}
