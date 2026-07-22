import { NextRequest, NextResponse } from "next/server";
import type { WbsProjectProfile } from "@/lib/wbs/constants";
import {
  buildWbsInitializationPreview,
  isWbsProjectProfile,
  WbsProjectNotFoundError,
  WbsTemplateNotFoundError,
} from "@/lib/wbs/service";

function previewInput(value: unknown): { profile: WbsProjectProfile; version: string } | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;
  if (!isWbsProjectProfile(body.profile)) return null;
  const version = typeof body.version === "string" && body.version.trim() ? body.version.trim() : "V2.0";
  return { profile: body.profile, version };
}

async function buildResponse(projectId: string, input: { profile: WbsProjectProfile; version: string }) {
  return NextResponse.json(await buildWbsInitializationPreview(projectId, input.profile, input.version));
}

function errorResponse(error: unknown) {
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "请求体必须是有效 JSON" }, { status: 400 });
  }
  if (error instanceof WbsProjectNotFoundError || error instanceof WbsTemplateNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && error.message.startsWith("不支持的 WBS 项目类型")) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("Error previewing project WBS initialization:", error);
  return NextResponse.json({ error: "生成项目 WBS 初始化预览失败" }, { status: 500 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const profile = request.nextUrl.searchParams.get("profile") ?? "tos";
    const version = request.nextUrl.searchParams.get("version") ?? "V2.0";
    if (!isWbsProjectProfile(profile)) {
      return NextResponse.json({ error: "profile 必须是 tos、tos_major 或 device" }, { status: 400 });
    }
    return await buildResponse(id, { profile, version });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const input = previewInput(await request.json());
    if (!input) {
      return NextResponse.json({ error: "profile 必须是 tos、tos_major 或 device" }, { status: 400 });
    }
    return await buildResponse(id, input);
  } catch (error) {
    return errorResponse(error);
  }
}
