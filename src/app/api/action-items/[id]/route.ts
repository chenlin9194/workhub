import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNullableString } from "@/lib/utils";
import { revalidateWorkHubPaths } from "@/lib/revalidate";
import { ACTION_ITEM_STATUS_VALUES, optionalYmdDate, requireText } from "@/lib/inputValidation";
import { validateActionItemCompletion } from "@/lib/actionItemCompletion";
import {
  completeActionItem,
  findActionItemContext,
  isActionItemWorkflowError,
  rescheduleActionItem,
} from "@/lib/actionItemWorkflow";

const VALID_STATUSES = ACTION_ITEM_STATUS_VALUES;

function parseOptionalSortOrder(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeStatus(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return { value: undefined as string | undefined };
  }

  const status = String(value);
  if (!VALID_STATUSES.has(status)) {
    return { value: undefined as string | undefined, error: "Invalid action item status" };
  }

  return { value: status };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actionItem = await prisma.actionItem.findUnique({
      where: { id },
      include: {
        progressLogs: {
          orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
        },
      },
    });

    if (!actionItem) {
      return NextResponse.json({ error: "Action Item 不存在" }, { status: 404 });
    }

    return NextResponse.json(actionItem);
  } catch (error) {
    console.error("Error fetching action item:", error);
    return NextResponse.json({ error: "Failed to fetch action item" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const currentActionItem = await findActionItemContext(prisma, id);

    if (!currentActionItem) {
      return NextResponse.json({ error: "Action Item 不存在" }, { status: 404 });
    }

    if ("dueDate" in body) {
      const dueDateResult = optionalYmdDate(body.dueDate, "dueDate");
      if (dueDateResult.error) {
        return NextResponse.json({ error: dueDateResult.error }, { status: 400 });
      }
      if (dueDateResult.value !== currentActionItem.dueDate) {
        const result = await rescheduleActionItem(id, body);
        revalidateWorkHubPaths({
          itemId: currentActionItem.workItemId || undefined,
          projectId: currentActionItem.projectId || undefined,
        });
        return NextResponse.json(result);
      }
    }

    if (body.status === "done" && currentActionItem.status !== "done") {
      const completionResult = validateActionItemCompletion(
        currentActionItem.status,
        "done",
        body.doneNote ?? body.completionNote,
      );
      if (completionResult.error) {
        return NextResponse.json({ error: completionResult.error }, { status: 400 });
      }
      const result = await completeActionItem(id, body);
      revalidateWorkHubPaths({
        itemId: currentActionItem.workItemId || undefined,
        projectId: currentActionItem.projectId || undefined,
      });
      return NextResponse.json(result);
    }

    const data: Record<string, unknown> = {};
    let nextStatus = currentActionItem.status;

    if ("title" in body) {
      const titleResult = requireText(body.title, "Action Item 标题");
      if (titleResult.error) return NextResponse.json({ error: titleResult.error }, { status: 400 });
      data.title = titleResult.value;
    }

    if ("owner" in body) {
      data.owner = toNullableString(body.owner);
    }

    if ("sortOrder" in body) {
      const sortOrder = parseOptionalSortOrder(body.sortOrder);
      if (sortOrder !== undefined) {
        data.sortOrder = sortOrder;
      }
    }

    if ("doneNote" in body) {
      data.doneNote = toNullableString(body.doneNote);
    }

    if ("status" in body) {
      const statusResult = normalizeStatus(body.status);
      if (statusResult.error) {
        return NextResponse.json({ error: statusResult.error }, { status: 400 });
      }
      if (statusResult.value) {
        nextStatus = statusResult.value;
        data.status = statusResult.value;
      }
    }

    const completionResult = validateActionItemCompletion(
      currentActionItem.status,
      nextStatus,
      body.doneNote
    );
    if (completionResult.error) {
      return NextResponse.json({ error: completionResult.error }, { status: 400 });
    }

    if (nextStatus === "done") {
      data.doneAt = currentActionItem.status === "done" ? undefined : new Date();
      if (completionResult.value) data.doneNote = completionResult.value;
    } else if (currentActionItem.status === "done" || "status" in body) {
      data.doneAt = null;
      if (!("doneNote" in body)) data.doneNote = null;
    }

    const actionItem = await prisma.actionItem.update({
      where: { id },
      data,
    });

    revalidateWorkHubPaths({
      itemId: actionItem.workItemId || undefined,
      projectId: actionItem.projectId || undefined,
    });

    return NextResponse.json(actionItem);
  } catch (error) {
    if (isActionItemWorkflowError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error updating action item:", error);
    return NextResponse.json({ error: "更新 Action Item 失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentActionItem = await prisma.actionItem.findUnique({
      where: { id },
      select: {
        workItemId: true,
        workLogId: true,
        projectId: true,
      },
    });

    if (!currentActionItem) {
      return NextResponse.json({ error: "Action Item 不存在" }, { status: 404 });
    }

    await prisma.actionItem.delete({ where: { id } });

    revalidateWorkHubPaths({
      itemId: currentActionItem.workItemId || undefined,
      logId: currentActionItem.workLogId || undefined,
      projectId: currentActionItem.projectId || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting action item:", error);
    return NextResponse.json({ error: "删除 Action Item 失败" }, { status: 500 });
  }
}
