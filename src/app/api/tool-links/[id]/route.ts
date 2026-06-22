import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};

    if ("name" in body) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
      }
      data.name = name;
    }

    if ("url" in body) {
      const url = typeof body.url === "string" ? body.url.trim() : "";
      if (!url) {
        return NextResponse.json({ error: "链接不能为空" }, { status: 400 });
      }
      data.url = url;
    }

    if ("enabled" in body) {
      data.enabled = Boolean(body.enabled);
    }

    if ("sortOrder" in body) {
      const sortOrder = Number(body.sortOrder);
      data.sortOrder = Number.isFinite(sortOrder) ? sortOrder : 0;
    }

    const toolLink = await prisma.toolLink.update({
      where: { id },
      data,
    });

    return NextResponse.json(toolLink);
  } catch (error) {
    console.error("Error updating tool link:", error);
    return NextResponse.json({ error: "更新常用工具失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.toolLink.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tool link:", error);
    return NextResponse.json({ error: "删除常用工具失败" }, { status: 500 });
  }
}
