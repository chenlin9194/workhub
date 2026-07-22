import { NextRequest, NextResponse } from "next/server";
import { getProjectWbsSummary, WbsProjectNotFoundError } from "@/lib/wbs/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    void request;
    const { id } = await params;
    return NextResponse.json(await getProjectWbsSummary(id));
  } catch (error) {
    if (error instanceof WbsProjectNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error fetching project WBS summary:", error);
    return NextResponse.json({ error: "获取项目 WBS 摘要失败" }, { status: 500 });
  }
}
