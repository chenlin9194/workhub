import { NextRequest, NextResponse } from "next/server";
import {
  initializeProjectWbs,
  WbsInitializationConflictError,
  WbsProjectNotFoundError,
  WbsTemplateNotFoundError,
} from "@/lib/wbs/service";

function errorResponse(error: unknown) {
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "请求体必须是有效 JSON" }, { status: 400 });
  }
  if (error instanceof WbsInitializationConflictError) {
    return NextResponse.json({ error: error.message, preview: error.preview }, { status: error.status });
  }
  if (error instanceof WbsProjectNotFoundError || error instanceof WbsTemplateNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Error initializing project WBS:", error);
  return NextResponse.json({ error: "初始化项目 WBS 失败" }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "请求体必须是 JSON 对象" }, { status: 400 });
    }
    const record = body as Record<string, unknown>;
    const version = typeof record.version === "string" && record.version.trim() ? record.version.trim() : "V2.0";
    return NextResponse.json(await initializeProjectWbs(id, version), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
