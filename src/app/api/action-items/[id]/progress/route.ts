import { NextRequest, NextResponse } from "next/server";
import { revalidateWorkHubPaths } from "@/lib/revalidate";
import {
  addActionItemProgressLog,
  isActionItemWorkflowError,
} from "@/lib/actionItemWorkflow";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await addActionItemProgressLog(id, await request.json());
    revalidateWorkHubPaths({
      itemId: result.itemId || undefined,
      projectId: result.projectId || undefined,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (isActionItemWorkflowError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error creating action item progress log:", error);
    return NextResponse.json({ error: "记录行动项进展失败" }, { status: 500 });
  }
}
