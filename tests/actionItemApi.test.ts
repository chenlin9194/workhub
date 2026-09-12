import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findWorkItem: vi.fn(),
  findProject: vi.fn(),
  createAction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workItem: { findUnique: mocks.findWorkItem },
    project: { findUnique: mocks.findProject },
    actionItem: { create: mocks.createAction },
  },
}));

vi.mock("@/lib/revalidate", () => ({ revalidateWorkHubPaths: vi.fn() }));

import { POST } from "@/app/api/action-items/route";

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/action-items", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findWorkItem.mockResolvedValue({ id: "item-1", projectId: "project-1" });
  mocks.findProject.mockResolvedValue({ id: "project-1" });
  mocks.createAction.mockResolvedValue({ id: "action-1", workItemId: "item-1", projectId: "project-1" });
});

describe("ActionItem creation API", () => {
  it("rejects a new ActionItem without workItemId", async () => {
    const response = await POST(request({ title: "没有父事项" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "新建 Action Item 必须关联事项" });
    expect(mocks.createAction).not.toHaveBeenCalled();
  });

  it("rejects the legacy WorkLog-only creation path", async () => {
    const response = await POST(request({ title: "从日志创建", workLogId: "log-1" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "新建 Action Item 必须关联事项" });
    expect(mocks.findWorkItem).not.toHaveBeenCalled();
  });

  it("derives project relation from the parent WorkItem", async () => {
    const response = await POST(request({ title: "正确归属", workItemId: "item-1" }));
    expect(response.status).toBe(201);
    expect(mocks.createAction).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ workItemId: "item-1", projectId: "project-1", workLogId: null }),
    }));
  });
});
