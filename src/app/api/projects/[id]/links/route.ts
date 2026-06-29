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

    const links = await prisma.projectLink.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(links);
  } catch (error) {
    console.error("Error fetching project links:", error);
    return NextResponse.json({ error: "Failed to fetch project links" }, { status: 500 });
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
    const url = normalizeRequiredString(body.url);
    const category = normalizeRequiredString(body.category);

    if (!title || !url || !category) {
      return NextResponse.json({ error: "title, url, and category are required" }, { status: 400 });
    }

    const link = await prisma.projectLink.create({
      data: {
        projectId,
        title,
        url,
        category,
        description: normalizeDescription(body.description),
        isPrimary: body.isPrimary === true,
        sortOrder: Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0,
      },
    });

    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error("Error creating project link:", error);
    return NextResponse.json({ error: "Failed to create project link" }, { status: 500 });
  }
}
