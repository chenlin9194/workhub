import { NextRequest, NextResponse } from "next/server";
import { revalidateWorkHubPaths } from "@/lib/revalidate";
import {
  isActionItemWorkflowError,
  rescheduleActionItem,
} from "@/lib/actionItemWorkflow";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await rescheduleActionItem(id, await request.json());
    revalidateWorkHubPaths({
      itemId: result.actionItem.workItemId || undefined,
      projectId: result.actionItem.projectId || undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (isActionItemWorkflowError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error rescheduling action item:", error);
    return NextResponse.json({ error: "调整行动项计划失败" }, { status: 500 });
  }
}
