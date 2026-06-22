import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const toolLinks = await prisma.toolLink.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ toolLinks });
  } catch (error) {
    console.error("Error fetching tool links:", error);
    return NextResponse.json({ error: "获取常用工具失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!name || !url) {
      return NextResponse.json({ error: "名称和链接不能为空" }, { status: 400 });
    }

    const toolLink = await prisma.toolLink.create({
      data: {
        name,
        url,
        enabled: body.enabled ?? true,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
      },
    });

    return NextResponse.json(toolLink, { status: 201 });
  } catch (error) {
    console.error("Error creating tool link:", error);
    return NextResponse.json({ error: "创建常用工具失败" }, { status: 500 });
  }
}
