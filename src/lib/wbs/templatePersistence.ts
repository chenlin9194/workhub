import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { WbsTemplateNode, WbsTemplatePreview } from "@/lib/wbs/types";

export interface WbsTemplateImportDiff {
  add: number;
  update: number;
  ignore: number;
  remove: number;
}

function templateNodeKey(node: { stage: string; gateKey: string; code: string }): string {
  return `${node.stage}|${node.gateKey}|${node.code}`;
}

function templateNodeData(node: WbsTemplateNode, templateId: string, parentId: string | null) {
  return {
    templateId,
    parentId,
    kind: node.kind,
    stage: node.stage,
    gateKey: node.gateKey,
    code: node.code,
    title: node.title,
    description: node.description || null,
    role: node.role || null,
    projectScope: node.projectScope,
    processSupport: node.processSupport || null,
    deliverableSpec: node.deliverableSpec || null,
    sortOrder: node.sortOrder,
  };
}

function templateNodeChanged(
  existing: {
    parentId: string | null;
    kind: string;
    stage: string;
    gateKey: string;
    code: string;
    title: string;
    description: string | null;
    role: string | null;
    projectScope: string;
    processSupport: string | null;
    deliverableSpec: string | null;
    sortOrder: number;
  },
  node: WbsTemplateNode,
): boolean {
  return (
    existing.kind !== node.kind ||
    existing.stage !== node.stage ||
    existing.gateKey !== node.gateKey ||
    existing.code !== node.code ||
    existing.title !== node.title ||
    existing.description !== (node.description || null) ||
    existing.role !== (node.role || null) ||
    existing.projectScope !== node.projectScope ||
    existing.processSupport !== (node.processSupport || null) ||
    existing.deliverableSpec !== (node.deliverableSpec || null) ||
    existing.sortOrder !== node.sortOrder
  );
}

export async function getWbsTemplateImportDiff(
  preview: WbsTemplatePreview,
): Promise<WbsTemplateImportDiff> {
  const existing = await prisma.wbsTemplate.findUnique({
    where: { version: preview.version },
    include: { nodes: true },
  });
  if (!existing) return { add: preview.nodes.length, update: 0, ignore: 0, remove: 0 };

  const existingByKey = new Map(existing.nodes.map((node) => [templateNodeKey(node), node]));
  let add = 0;
  let update = 0;
  let ignore = 0;
  const incomingKeys = new Set(preview.nodes.map(templateNodeKey));
  for (const node of preview.nodes) {
    const previous = existingByKey.get(templateNodeKey(node));
    if (!previous) add += 1;
    else if (templateNodeChanged(previous, node)) update += 1;
    else ignore += 1;
  }
  const remove = existing.nodes.filter((node) => !incomingKeys.has(templateNodeKey(node))).length;
  return { add, update, ignore, remove };
}

export async function importWbsTemplate(preview: WbsTemplatePreview): Promise<{
  templateId: string;
  nodeCount: number;
  diff: WbsTemplateImportDiff;
}> {
  if (preview.hasStructuralErrors) {
    throw new Error("模板存在结构错误，拒绝写入 WbsTemplate");
  }

  const diff = await getWbsTemplateImportDiff(preview);
  const result = await prisma.$transaction(async (tx) => {
    await tx.wbsTemplate.updateMany({
      where: { status: "active", NOT: { version: preview.version } },
      data: { status: "archived" },
    });

    const template = await tx.wbsTemplate.upsert({
      where: { version: preview.version },
      create: {
        name: "WorkHub WBS 模板",
        version: preview.version,
        sourceFileName: preview.sourceFileName,
        sourceHash: preview.sourceHash,
        status: "active",
        importedAt: new Date(),
      },
      update: {
        name: "WorkHub WBS 模板",
        sourceFileName: preview.sourceFileName,
        sourceHash: preview.sourceHash,
        status: "active",
        importedAt: new Date(),
      },
    });

    const nodeIdByKey = new Map<string, string>();
    const existingNodes = await tx.wbsTemplateNode.findMany({
      where: { templateId: template.id },
      select: { id: true, stage: true, gateKey: true, code: true },
    });
    const incomingKeys = new Set(preview.nodes.map(templateNodeKey));
    const staleIds = existingNodes
      .filter((node) => !incomingKeys.has(templateNodeKey(node)))
      .map((node) => node.id);
    if (staleIds.length > 0) {
      await tx.wbsTemplateNode.deleteMany({ where: { id: { in: staleIds } } });
    }
    const orderedNodes = [...preview.nodes].sort((left, right) => {
      if (left.kind === "task" && right.kind !== "task") return 1;
      if (left.kind !== "task" && right.kind === "task") return -1;
      return left.sortOrder - right.sortOrder;
    });

    for (const node of orderedNodes) {
      const parentId = node.parentCode
        ? nodeIdByKey.get(`${node.stage}|${node.gateKey}|${node.parentCode}`) ?? null
        : null;
      if (node.kind === "task" && !parentId) {
        throw new Error(`任务 ${node.code} 找不到同 STR 工作包父节点`);
      }

      const data = templateNodeData(node, template.id, parentId);
      const persisted = await tx.wbsTemplateNode.upsert({
        where: {
          templateId_stage_gateKey_code: {
            templateId: template.id,
            stage: node.stage,
            gateKey: node.gateKey,
            code: node.code,
          },
        },
        create: data,
        update: data,
      });
      nodeIdByKey.set(templateNodeKey(node), persisted.id);
    }

    return { templateId: template.id, nodeCount: preview.nodes.length };
  });

  return { ...result, diff };
}

export type WbsTemplateTransactionClient = Prisma.TransactionClient;
