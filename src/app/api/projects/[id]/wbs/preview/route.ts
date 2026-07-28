import { NextRequest, NextResponse } from "next/server";
import {
  buildWbsInitializationPreview,
  WbsProjectNotFoundError,
  WbsTemplateNotFoundError,
} from "@/lib/wbs/service";

function previewInput(value: unknown): { version?: string } | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;
  const version = typeof body.version === "string" && body.version.trim() ? body.version.trim() : "V2.0";
  return { version };
}

async function buildResponse(projectId: string, input: { version?: string }) {
  return NextResponse.json(await buildWbsInitializationPreview(projectId, input.version));
}

function errorResponse(error: unknown) {
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "请求体必须是有效 JSON" }, { status: 400 });
  }
  if (error instanceof WbsProjectNotFoundError || error instanceof WbsTemplateNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
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
    const version = request.nextUrl.searchParams.get("version") ?? "V2.0";
    return await buildResponse(id, { version });
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
      return NextResponse.json({ error: "请求体必须是 JSON 对象" }, { status: 400 });
    }
    return await buildResponse(id, input);
  } catch (error) {
    return errorResponse(error);
  }
}
