import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/ai-providers
export async function GET() {
  try {
    const providers = await prisma.aiProvider.findMany({
      orderBy: { createdAt: "desc" },
    });
    // Mask API keys for security
    const masked = providers.map((p) => ({
      ...p,
      apiKey: p.apiKey ? p.apiKey.slice(0, 8) + "****" + p.apiKey.slice(-4) : "",
    }));
    return NextResponse.json(masked);
  } catch (error) {
    console.error("GET /api/ai-providers error:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

// POST /api/ai-providers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.name?.trim()) return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    if (!body.baseUrl?.trim()) return NextResponse.json({ error: "API Base URL 不能为空" }, { status: 400 });
    if (!body.apiKey?.trim()) return NextResponse.json({ error: "API Key 不能为空" }, { status: 400 });
    if (!body.model?.trim()) return NextResponse.json({ error: "模型名称不能为空" }, { status: 400 });

    // If set as default, unset others
    if (body.isDefault) {
      await prisma.aiProvider.updateMany({ data: { isDefault: false } });
    }

    const provider = await prisma.aiProvider.create({
      data: {
        name: body.name.trim(),
        label: body.label?.trim() || body.name.trim(),
        baseUrl: body.baseUrl.trim(),
        apiKey: body.apiKey.trim(),
        model: body.model.trim(),
        isDefault: body.isDefault || false,
      },
    });

    return NextResponse.json({
      ...provider,
      apiKey: provider.apiKey.slice(0, 8) + "****" + provider.apiKey.slice(-4),
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/ai-providers error:", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
