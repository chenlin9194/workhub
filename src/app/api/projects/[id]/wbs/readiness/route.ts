import { NextRequest, NextResponse } from "next/server";
import { WBS_GATE_KEYS } from "@/lib/wbs/constants";
import type { WbsGateKey } from "@/lib/wbs/constants";
import {
  getWbsGateReadiness,
  getWbsStageReadiness,
  WbsProjectNotFoundError,
} from "@/lib/wbs/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const gateKey = request.nextUrl.searchParams.get("gateKey");
    if (gateKey) {
      if (!WBS_GATE_KEYS.includes(gateKey as WbsGateKey)) {
        return NextResponse.json({ error: "gateKey 必须是 STR1、STR2、STR3、STR4、STR4A 或 STR5" }, { status: 400 });
      }
      return NextResponse.json(await getWbsGateReadiness(id, gateKey as WbsGateKey));
    }
    const nextStage = request.nextUrl.searchParams.get("nextStage") ?? "development_validation";
    return NextResponse.json(await getWbsStageReadiness(id, nextStage));
  } catch (error) {
    if (error instanceof WbsProjectNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error fetching WBS readiness:", error);
    return NextResponse.json({ error: "获取 WBS 准备度失败" }, { status: 500 });
  }
}
