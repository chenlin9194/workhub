import { NextRequest, NextResponse } from "next/server";
import { revalidateWorkHubPaths } from "@/lib/revalidate";
import {
  splitWbsNodeIntoWorkItem,
  WbsInvalidNodeInputError,
  WbsNodeNotFoundError,
} from "@/lib/wbs/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> },
) {
  try {
    const { id, nodeId } = await params;
    const body = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "请求体必须是 JSON 对象" }, { status: 400 });
    }
    const item = await splitWbsNodeIntoWorkItem(id, nodeId, body as Record<string, unknown>);
    revalidateWorkHubPaths({ projectId: id, itemId: item.id });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "请求体必须是有效 JSON" }, { status: 400 });
    }
    if (error instanceof WbsInvalidNodeInputError || error instanceof WbsNodeNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error splitting WBS node into work item:", error);
    return NextResponse.json({ error: "从 WBS 任务创建普通事项失败" }, { status: 500 });
  }
}
