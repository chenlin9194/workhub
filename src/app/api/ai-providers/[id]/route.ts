import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT /api/ai-providers/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.aiProvider.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

    // If set as default, unset others
    if (body.isDefault) {
      await prisma.aiProvider.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
    }

    const provider = await prisma.aiProvider.update({
      where: { id },
      data: {
        name: body.name?.trim() ?? existing.name,
        label: body.label?.trim() ?? existing.label,
        baseUrl: body.baseUrl?.trim() ?? existing.baseUrl,
        apiKey: body.apiKey?.trim() ?? existing.apiKey,
        model: body.model?.trim() ?? existing.model,
        isDefault: body.isDefault ?? existing.isDefault,
      },
    });

    return NextResponse.json({
      ...provider,
      apiKey: provider.apiKey.slice(0, 8) + "****" + provider.apiKey.slice(-4),
    });
  } catch (error) {
    console.error("PUT /api/ai-providers/[id] error:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

// DELETE /api/ai-providers/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.aiProvider.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

    await prisma.aiProvider.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/ai-providers/[id] error:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
