import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import {
  WBS_GATE_RULES,
  WBS_PROJECT_SCOPES,
  WBS_STAGE_BY_SHEET,
  WBS_TEMPLATE_SHEETS,
  applyWbsV20CodeCorrections,
  getGateRuleForCode,
  isScopeApplicable,
  isSpmRole,
  normalizeTemplateScope,
  shiftWbsV20FollowUpTaskCode,
} from "@/lib/wbs/constants";
import type { WbsProjectProfile, WbsProjectScope } from "@/lib/wbs/constants";
import { validateTemplateStructure } from "@/lib/wbs/validation";
import type {
  WbsGateSummary,
  WbsTemplateIssue,
  WbsTemplateCorrection,
  WbsTemplateNode,
  WbsTemplatePreview,
  WbsTemplateRow,
} from "@/lib/wbs/types";

type ExcelJsBuffer = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];

export function cellValueToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(cellValueToText).join("");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.richText)) {
      return record.richText
        .map((part) =>
          typeof part === "object" && part !== null
            ? cellValueToText((part as Record<string, unknown>).text)
            : cellValueToText(part),
        )
        .join("");
    }
    if (typeof record.text === "string") return record.text;
    if (record.text !== undefined) return cellValueToText(record.text);
    if (typeof record.result === "string") return record.result;
  }
  return "";
}

export function normalizeExcelCode(value: unknown, displayValue?: unknown): string {
  const displayed = cellValueToText(displayValue).trim();
  if (displayed) return displayed;
  return cellValueToText(value).trim();
}

function cellText(cell: ExcelJS.Cell): string {
  const displayed = typeof cell.text === "string" ? cell.text : "";
  return (displayed || cellValueToText(cell.value)).trim();
}

function issue(
  severity: WbsTemplateIssue["severity"],
  code: string,
  message: string,
  row: Pick<WbsTemplateRow, "sheetName" | "rowNumber" | "packageCode" | "taskCode">,
): WbsTemplateIssue {
  return {
    severity,
    code,
    message,
    sheetName: row.sheetName,
    rowNumber: row.rowNumber,
    recordCode: row.packageCode ?? row.taskCode ?? undefined,
  };
}

function buildRowFromWorksheet(
  worksheet: ExcelJS.Worksheet,
  sheetName: string,
  rowNumber: number,
  parentCode: string | null,
): WbsTemplateRow | null {
  const packageCode = normalizeExcelCode(worksheet.getCell(rowNumber, 3).value, worksheet.getCell(rowNumber, 3).text) || null;
  const taskCode = normalizeExcelCode(worksheet.getCell(rowNumber, 4).value, worksheet.getCell(rowNumber, 4).text) || null;
  if (!packageCode && !taskCode) return null;

  const stage = WBS_STAGE_BY_SHEET[sheetName as keyof typeof WBS_STAGE_BY_SHEET];
  return {
    sheetName,
    rowNumber,
    stage,
    role: cellText(worksheet.getCell(rowNumber, 2)),
    packageCode,
    taskCode,
    parentCode: taskCode ? parentCode : null,
    title: cellText(worksheet.getCell(rowNumber, 5)),
    description: cellText(worksheet.getCell(rowNumber, 6)),
    projectScopeLabel: cellText(worksheet.getCell(rowNumber, 8)),
    projectScope: normalizeTemplateScope(cellText(worksheet.getCell(rowNumber, 8))),
    processSupport: cellText(worksheet.getCell(rowNumber, 9)),
    deliverableSpec: cellText(worksheet.getCell(rowNumber, 7)),
  };
}

export function readTemplateRowsFromWorkbook(workbook: ExcelJS.Workbook): {
  rows: WbsTemplateRow[];
  issues: WbsTemplateIssue[];
  corrections: WbsTemplateCorrection[];
} {
  const rows: WbsTemplateRow[] = [];
  const issues: WbsTemplateIssue[] = [];
  const corrections: WbsTemplateCorrection[] = [];

  for (const sheetName of WBS_TEMPLATE_SHEETS) {
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      issues.push({ severity: "error", code: "missing-sheet", message: `缺少必需工作表：${sheetName}`, sheetName });
      continue;
    }

    let currentPackageCode: string | null = null;
    let shiftFollowingOneFiveTaskCodes = false;
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const rawRow = buildRowFromWorksheet(worksheet, sheetName, rowNumber, currentPackageCode);
      if (!rawRow) continue;
      const correctedCodes = applyWbsV20CodeCorrections(rawRow);
      let correctedTaskCode = correctedCodes.taskCode;
      const row: WbsTemplateRow = {
        ...rawRow,
        packageCode: correctedCodes.packageCode,
        taskCode: correctedTaskCode,
      };
      for (const correction of correctedCodes.applied) {
        corrections.push({
          sheetName,
          rowNumber,
          title: row.title,
          fromCode: correction.fromCode,
          toCode: correction.toCode,
          field: correction.field,
        });
      }
      const imageRequirementCorrectionApplied = correctedCodes.applied.some(
        (correction) => correction.title === "输出影像需求PD",
      );
      if (shiftFollowingOneFiveTaskCodes && sheetName === "01-概念阶段" && correctedTaskCode) {
        const shiftedTaskCode = shiftWbsV20FollowUpTaskCode(correctedTaskCode);
        if (shiftedTaskCode) {
          corrections.push({
            sheetName,
            rowNumber,
            title: row.title,
            fromCode: correctedTaskCode,
            toCode: shiftedTaskCode,
            field: "taskCode",
          });
          correctedTaskCode = shiftedTaskCode;
          row.taskCode = shiftedTaskCode;
        }
      }
      if (imageRequirementCorrectionApplied) shiftFollowingOneFiveTaskCodes = true;
      if (row.packageCode && row.taskCode) {
        issues.push(issue("error", "both-package-and-task-code", "同一行不能同时填写工作包编号和任务编号", row));
        continue;
      }
      if (row.packageCode) {
        currentPackageCode = row.packageCode;
        if (getGateRuleForCode(row.packageCode)?.reviewCode === row.packageCode) currentPackageCode = null;
      }
      rows.push(row);
    }
  }

  return { rows, issues, corrections };
}

function nodeFromRow(row: WbsTemplateRow, sortOrder: number): { node: WbsTemplateNode | null; issues: WbsTemplateIssue[] } {
  const issues: WbsTemplateIssue[] = [];
  const code = row.packageCode ?? row.taskCode ?? "";
  const gateRule = getGateRuleForCode(code);
  if (!gateRule) {
    issues.push(issue("error", "unknown-str", `编号无法映射到本期六个 STR：${code}`, row));
    return { node: null, issues };
  }
  if (row.projectScope === null) {
    issues.push(issue("error", "unknown-project-scope", `未知项目类型：${row.projectScopeLabel || "空值"}`, row));
    return { node: null, issues };
  }
  if (!row.title) issues.push(issue("error", "missing-title", "任务或工作包标题不能为空", row));

  const isReview = gateRule.reviewCode === code;
  const kind = row.taskCode ? "task" : isReview ? "gate" : "package";
  if (kind === "task" && !row.role) issues.push(issue("error", "missing-role", "二层执行任务角色不能为空", row));
  if (kind === "task" && !row.parentCode) {
    issues.push(issue("error", "missing-parent", `任务没有可用的工作包父节点：${code}`, row));
  }

  return {
    node: {
      sheetName: row.sheetName,
      rowNumber: row.rowNumber,
      stage: row.stage,
      gateKey: gateRule.gateKey,
      kind,
      code,
      parentCode: row.parentCode,
      title: row.title,
      description: row.description,
      role: row.role,
      projectScope: row.projectScope,
      processSupport: row.processSupport,
      deliverableSpec: row.deliverableSpec,
      sortOrder,
    },
    issues,
  };
}

export function parseWbsTemplateRows(rows: readonly WbsTemplateRow[], initialIssues: readonly WbsTemplateIssue[] = []): {
  nodes: WbsTemplateNode[];
  issues: WbsTemplateIssue[];
} {
  const issues = [...initialIssues];
  const nodes: WbsTemplateNode[] = [];
  for (const [index, row] of rows.entries()) {
    const result = nodeFromRow(row, index + 1);
    issues.push(...result.issues);
    if (result.node) nodes.push(result.node);
  }
  issues.push(...validateTemplateStructure(nodes));
  return { nodes, issues };
}

export function filterWbsNodesForProfile(
  nodes: readonly WbsTemplateNode[],
  profile: WbsProjectProfile,
): WbsTemplateNode[] {
  const applicable = nodes.filter((node) => isScopeApplicable(node.projectScope, profile));
  const applicableTaskParents = new Set(
    applicable.filter((node) => node.kind === "task").map((node) => `${node.stage}|${node.gateKey}|${node.parentCode}`),
  );
  return applicable.filter(
    (node) =>
      node.kind !== "package" ||
      applicableTaskParents.has(`${node.stage}|${node.gateKey}|${node.code}`),
  );
}

function gateSummaries(nodes: readonly WbsTemplateNode[]): WbsGateSummary[] {
  return WBS_GATE_RULES.map((rule) => {
    const gateNodes = nodes.filter((node) => node.gateKey === rule.gateKey);
    const packages = gateNodes.filter((node) => node.kind === "package");
    const tasks = gateNodes.filter((node) => node.kind === "task");
    const review = gateNodes.find((node) => node.kind === "gate") ?? null;
    return {
      gateKey: rule.gateKey,
      stage: rule.stage,
      packageRange: `${rule.packageStart}–${rule.packageEnd}`,
      packageCodes: packages.map((node) => node.code),
      taskCodes: tasks.map((node) => node.code),
      reviewTask: review
        ? { code: review.code, title: review.title, role: review.role, sheetName: review.sheetName, rowNumber: review.rowNumber }
        : null,
      packageCount: packages.length,
      taskCount: tasks.length,
      reviewTaskCount: review ? 1 : 0,
    };
  });
}

function countByScope(nodes: readonly WbsTemplateNode[]): Record<WbsProjectScope, number> {
  const counts = Object.fromEntries(WBS_PROJECT_SCOPES.map((scope) => [scope, 0])) as Record<WbsProjectScope, number>;
  for (const node of nodes) {
    if (node.kind === "task" || node.kind === "gate") counts[node.projectScope] += 1;
  }
  return counts;
}

export function buildTemplatePreview(args: {
  sourceFileName: string;
  sourceHash: string;
  version: string;
  sheets: string[];
  parserNotes?: string[];
  corrections?: WbsTemplateCorrection[];
  rows: WbsTemplateRow[];
  initialIssues?: WbsTemplateIssue[];
}): WbsTemplatePreview {
  const parsed = parseWbsTemplateRows(args.rows, args.initialIssues);
  const errors = parsed.issues.filter((entry) => entry.severity === "error");
  const warnings = parsed.issues.filter((entry) => entry.severity === "warning");
  return {
    sourceFileName: args.sourceFileName,
    sourceHash: args.sourceHash,
    version: args.version,
    sheets: args.sheets,
    parserNotes: args.parserNotes ?? [],
    rows: args.rows,
    nodes: parsed.nodes,
    gates: gateSummaries(parsed.nodes),
    spmTaskCount: parsed.nodes.filter((node) => (node.kind === "task" || node.kind === "gate") && isSpmRole(node.role)).length,
    projectScopeTaskCounts: countByScope(parsed.nodes),
    issues: [...errors, ...warnings],
    changes: { add: parsed.nodes.length, update: 0, ignore: 0, remove: 0 },
    hasStructuralErrors: errors.length > 0,
  };
}

function removeEmptyRichTextNodes(xml: string): string {
  return xml.replace(/(<si\b[^>]*>)([\s\S]*?)(<\/si>)/g, (_, open, body, close) => {
    if (!body.includes("<r")) return open + body + close;
    return open + body.replace(/<t(?:\s[^>]*)?\/>/g, "").replace(/<t(?:\s[^>]*)?>\s*<\/t>/g, "") + close;
  });
}

async function loadWorkbook(buffer: Buffer): Promise<{ workbook: ExcelJS.Workbook; compatibilitySanitized: boolean }> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJsBuffer);
    return { workbook, compatibilitySanitized: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Cannot create property 'richText' on string")) throw error;
    const zip = await JSZip.loadAsync(buffer as unknown as Buffer);
    const sharedStrings = zip.file("xl/sharedStrings.xml");
    if (!sharedStrings) throw error;
    const xml = await sharedStrings.async("string");
    zip.file("xl/sharedStrings.xml", removeEmptyRichTextNodes(xml));
    const compatibleBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const compatibleWorkbook = new ExcelJS.Workbook();
    await compatibleWorkbook.xlsx.load(compatibleBuffer as unknown as ExcelJsBuffer);
    return { workbook: compatibleWorkbook, compatibilitySanitized: true };
  }
}

export async function readWbsTemplateFile(filePath: string, version: string): Promise<WbsTemplatePreview> {
  const buffer = await readFile(filePath);
  const sourceHash = createHash("sha256").update(buffer).digest("hex");
  const loaded = await loadWorkbook(buffer);
  const extracted = readTemplateRowsFromWorkbook(loaded.workbook);
  const correctionNotes = extracted.corrections.map(
    (correction) =>
      `已按 V2.0 纠正 ${correction.sheetName} 第${correction.rowNumber}行 ${correction.title}：${correction.fromCode} → ${correction.toCode}`,
  );
  return buildTemplatePreview({
    sourceFileName: basename(filePath),
    sourceHash,
    version,
    sheets: WBS_TEMPLATE_SHEETS.slice(),
    parserNotes: loaded.compatibilitySanitized
      ? ["源文件含空富文本节点，已在内存中做兼容性清理；未修改源 XLSX 文件。", ...correctionNotes]
      : correctionNotes,
    rows: extracted.rows,
    initialIssues: extracted.issues,
  });
}

function listOrDash(values: readonly string[]): string {
  return values.length ? values.join(", ") : "-";
}

export function formatTemplatePreview(preview: WbsTemplatePreview): string {
  const lines = [
    "WBS V2.0 模板预览（未执行项目实例化）",
    `文件：${preview.sourceFileName}`,
    `SHA-256：${preview.sourceHash}`,
    `模板版本：${preview.version}`,
    `读取 Sheet：${preview.sheets.join("、")}`,
    `解析记录：${preview.rows.length}；候选节点：${preview.nodes.length}`,
    `SPM/项目经理可负责任务：${preview.spmTaskCount}`,
    `项目类型任务数量：ALL=${preview.projectScopeTaskCounts.all}，仅tOS=${preview.projectScopeTaskCounts.tos}，仅tOS大版本=${preview.projectScopeTaskCounts.tos_major}，仅整机=${preview.projectScopeTaskCounts.device}`,
    "",
    "六个 STR 映射结果：",
  ];

  for (const gate of preview.gates) {
    lines.push(
      `${gate.gateKey} [${gate.stage}] 前置工作包 ${gate.packageRange}：工作包 ${gate.packageCount}（${listOrDash(gate.packageCodes)}）；执行任务 ${gate.taskCount}（${listOrDash(gate.taskCodes)}）；评审任务 ${gate.reviewTaskCount}（${gate.reviewTask ? `${gate.reviewTask.code} ${gate.reviewTask.title}` : "缺失"}）`,
    );
  }

  lines.push(
    "",
    `变更模拟：新增 ${preview.changes.add}，更新 ${preview.changes.update}，忽略 ${preview.changes.ignore}，删除 ${preview.changes.remove}`,
    `结构错误：${preview.issues.filter((entry) => entry.severity === "error").length}；警告：${preview.issues.filter((entry) => entry.severity === "warning").length}`,
  );
  if (preview.parserNotes.length) {
    lines.push("解析说明：", ...preview.parserNotes.map((note) => `- ${note}`));
  }
  if (preview.issues.length) {
    lines.push("问题清单：");
    for (const entry of preview.issues) {
      const location = entry.sheetName ? `${entry.sheetName} 第${entry.rowNumber ?? "?"}行` : "模板";
      lines.push(`- [${entry.severity}] ${location}${entry.recordCode ? ` ${entry.recordCode}` : ""}：${entry.message}`);
    }
  }
  lines.push(
    preview.hasStructuralErrors
      ? "结论：存在结构错误，--apply 必须拒绝；未写入数据库。"
      : "结论：未发现结构错误；可执行模板入库或项目初始化预览。",
  );
  return lines.join("\n");
}
