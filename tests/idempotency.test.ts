import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOperationId } from "@/lib/idempotency";
import { createWorkItemWithActions } from "@/lib/recordingTransaction";
import { POST } from "@/app/api/integrations/hermes/workhub/route";

const isolatedDatabaseUrl = process.env.DATABASE_URL || "";
const isolatedDatabasePath = process.env.IDEMPOTENCY_TEST_DB_PATH || "";
const isIsolatedDatabase = isolatedDatabaseUrl.includes("idempotency-");

type IdempotentResult = {
  item: { id: string };
  actionItems: Array<{ id: string }>;
  operationId: string;
  idempotentReplay: boolean;
};

let projectId = "";

async function cleanDatabase() {
  if (!isIsolatedDatabase) return;
  await prisma.actionItem.deleteMany();
  await prisma.workItem.deleteMany();
  await prisma.idempotencyOperation.deleteMany();
  await prisma.project.deleteMany();
  const project = await prisma.project.create({ data: { name: "Idempotency Test Project" } });
  projectId = project.id;
}

function payload(title = "安全写入") {
  return {
    title,
    projectId,
    description: "Hermes 幂等测试",
    priority: "P1",
    actionItems: [
      { title: "确认范围", owner: "owner-a", sortOrder: 0 },
      { title: "完成执行", owner: "owner-b", sortOrder: 1 },
    ],
  };
}

function run(operationId: string, input: Record<string, unknown>) {
  return createWorkItemWithActions(input, { operationId }) as Promise<IdempotentResult>;
}

function postTool(input: Record<string, unknown>, idempotencyKey?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  return POST(new NextRequest("http://localhost/api/integrations/hermes/workhub", {
    method: "POST",
    headers,
    body: JSON.stringify({ tool: "create_work_item_with_actions", input }),
  }));
}

const isolatedDescribe = isIsolatedDatabase ? describe : describe.skip;

isolatedDescribe("persistent WorkHub idempotency", () => {
  beforeEach(cleanDatabase);

  afterAll(async () => {
    if (!isIsolatedDatabase) return;
    await cleanDatabase();
    await prisma.$disconnect();
    if (isolatedDatabasePath) {
      await Promise.all([
        rm(isolatedDatabasePath, { force: true }),
        rm(`${isolatedDatabasePath}-journal`, { force: true }),
        rm(`${isolatedDatabasePath}-wal`, { force: true }),
        rm(`${isolatedDatabasePath}-shm`, { force: true }),
      ]);
    }
  });

  it("creates one item and action items on the first call", async () => {
    const result = await run("op-1", payload());

    expect(result.operationId).toBe("op-1");
    expect(result.idempotentReplay).toBe(false);
    expect(result.actionItems).toHaveLength(2);
    await expect(prisma.workItem.count()).resolves.toBe(1);
    await expect(prisma.actionItem.count()).resolves.toBe(2);
    await expect(prisma.idempotencyOperation.findUnique({
      where: { scope_operationId: { scope: "create_work_item_with_actions", operationId: "op-1" } },
    })).resolves.toMatchObject({
      state: "succeeded",
      resultObjectId: result.item.id,
    });
  });

  it("replays the same result for a sequential duplicate", async () => {
    const first = await run("op-sequential", payload());
    const second = await run("op-sequential", payload());

    expect(second.idempotentReplay).toBe(true);
    expect(second.item.id).toBe(first.item.id);
    expect(second.actionItems.map((item) => item.id)).toEqual(first.actionItems.map((item) => item.id));
    await expect(prisma.workItem.count()).resolves.toBe(1);
    await expect(prisma.actionItem.count()).resolves.toBe(2);
  });

  it("serializes concurrent duplicates through the unique operation key", async () => {
    const results = await Promise.all([
      run("op-concurrent", payload()),
      run("op-concurrent", payload()),
    ]);

    expect(new Set(results.map((result) => result.item.id)).size).toBe(1);
    expect(results.filter((result) => result.idempotentReplay).length).toBe(1);
    await expect(prisma.workItem.count()).resolves.toBe(1);
    await expect(prisma.actionItem.count()).resolves.toBe(2);
  });

  it("returns the committed result when the first response is lost", async () => {
    const first = await run("op-lost-response", payload());
    const retry = await run("op-lost-response", payload());

    expect(retry.idempotentReplay).toBe(true);
    expect(retry.item.id).toBe(first.item.id);
    await expect(prisma.workItem.count()).resolves.toBe(1);
  });

  it("replays the original result after the project is renamed", async () => {
    const first = await run("op-project-renamed", payload());
    await prisma.project.update({
      where: { id: projectId },
      data: { name: "Renamed Idempotency Test Project" },
    });

    const retry = await run("op-project-renamed", payload());

    expect(retry.idempotentReplay).toBe(true);
    expect(retry.item.id).toBe(first.item.id);
    await expect(prisma.workItem.count()).resolves.toBe(1);
    await expect(prisma.actionItem.count()).resolves.toBe(2);
  });

  it("rejects a reused operation key with a different payload", async () => {
    await run("op-different-payload", payload());

    await expect(run("op-different-payload", payload("不同标题"))).rejects.toMatchObject({
      code: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
      status: 409,
    });
    await expect(prisma.workItem.count()).resolves.toBe(1);
    await expect(prisma.actionItem.count()).resolves.toBe(2);
  });

  it("requires an operation id and rejects conflicting sources", () => {
    expect(() => resolveOperationId({}, null)).toThrowError(expect.objectContaining({
      code: "OPERATION_ID_REQUIRED",
      status: 400,
    }));
    expect(resolveOperationId({ operation_id: "op-snake" }, null)).toBe("op-snake");
    expect(resolveOperationId({}, "op-header")).toBe("op-header");
    expect(() => resolveOperationId({ operationId: "op-a" }, "op-b")).toThrowError(expect.objectContaining({
      code: "IDEMPOTENCY_KEY_CONFLICT",
      status: 409,
    }));
  });

  it("maps missing and conflicting operation ids to the API error responses", async () => {
    const missing = await postTool({ projectId, title: "缺少 key" });
    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toMatchObject({
      code: "OPERATION_ID_REQUIRED",
    });

    const conflict = await postTool({ projectId, title: "冲突 key", operationId: "op-body" }, "op-header");
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({
      code: "IDEMPOTENCY_KEY_CONFLICT",
    });
  });

  it("rolls back a mid-write action failure and permits a retry", async () => {
    await expect(run("op-action-failure", {
      ...payload(),
      actionItems: [
        { title: "先写入", sortOrder: 0 },
        { title: "触发失败", sortOrder: Number.MAX_SAFE_INTEGER },
      ],
    })).rejects.toThrow();

    await expect(prisma.workItem.count()).resolves.toBe(0);
    await expect(prisma.actionItem.count()).resolves.toBe(0);
    await expect(prisma.idempotencyOperation.count()).resolves.toBe(0);

    const retry = await run("op-action-failure", payload());
    expect(retry.idempotentReplay).toBe(false);
    await expect(prisma.workItem.count()).resolves.toBe(1);
    await expect(prisma.actionItem.count()).resolves.toBe(2);
  });
});
