import { NextRequest, NextResponse } from "next/server";
import { revalidateWorkHubPaths } from "@/lib/revalidate";
import {
  getProjectWbsSummary,
  updateWbsNode,
  WbsInvalidNodeInputError,
  WbsNodeNotFoundError,
  WbsProjectNotFoundError,
} from "@/lib/wbs/service";

function errorResponse(error: unknown) {
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "请求体必须是有效 JSON" }, { status: 400 });
  }
  if (error instanceof WbsProjectNotFoundError || error instanceof WbsNodeNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof WbsInvalidNodeInputError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Error updating project WBS node:", error);
  return NextResponse.json({ error: "更新 WBS 节点失败" }, { status: 500 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> },
) {
  try {
    const { id, nodeId } = await params;
    const summary = await getProjectWbsSummary(id);
    if (!summary.plan) return NextResponse.json({ error: "项目尚未初始化 WBS" }, { status: 404 });
    const node = summary.plan.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return NextResponse.json({ error: "WBS 节点不存在" }, { status: 404 });
    void request;
    return NextResponse.json(node);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> },
) {
  try {
    const { id, nodeId } = await params;
    const body = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "请求体必须是 JSON 对象" }, { status: 400 });
    }
    const result = await updateWbsNode(id, nodeId, body as Record<string, unknown>);
    revalidateWorkHubPaths({ projectId: id, itemId: result.executionItem?.id });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
