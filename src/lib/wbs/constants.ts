export const WBS_TEMPLATE_SHEETS = [
  "01-概念阶段",
  "02-计划阶段",
  "03-开发验证阶段",
] as const;

export type WbsTemplateSheet = (typeof WBS_TEMPLATE_SHEETS)[number];

export const WBS_STAGE_BY_SHEET: Record<WbsTemplateSheet, WbsStage> = {
  "01-概念阶段": "concept",
  "02-计划阶段": "planning",
  "03-开发验证阶段": "development_validation",
};

export const WBS_STAGES = ["concept", "planning", "development_validation"] as const;
export type WbsStage = (typeof WBS_STAGES)[number];

export const WBS_GATE_KEYS = ["STR1", "STR2", "STR3", "STR4", "STR4A", "STR5"] as const;
export type WbsGateKey = (typeof WBS_GATE_KEYS)[number];

export const WBS_NODE_KINDS = ["package", "task", "gate"] as const;
export type WbsNodeKind = (typeof WBS_NODE_KINDS)[number];

export const WBS_EXECUTION_STATUSES = ["not_started", "in_progress", "blocked", "done", "waived"] as const;
export type WbsExecutionStatus = (typeof WBS_EXECUTION_STATUSES)[number];

export const WBS_DELIVERABLE_STATUSES = ["pending", "delivered"] as const;
export type WbsDeliverableStatus = (typeof WBS_DELIVERABLE_STATUSES)[number];

export const WBS_PROJECT_PROFILES = ["tos", "tos_major", "device"] as const;
export type WbsProjectProfile = (typeof WBS_PROJECT_PROFILES)[number];

export const WBS_PROJECT_SCOPES = ["all", "tos", "tos_major", "device"] as const;
export type WbsProjectScope = (typeof WBS_PROJECT_SCOPES)[number];

export const WBS_TEMPLATE_SCOPE_LABELS: Record<WbsProjectScope, string> = {
  all: "ALL",
  tos: "仅tOS项目",
  tos_major: "仅tOS大版本",
  device: "仅整机项目",
};

export const WBS_TEMPLATE_SCOPE_BY_LABEL: Record<string, WbsProjectScope> = {
  ALL: "all",
  "仅tOS项目": "tos",
  "仅tOS大版本": "tos_major",
  "仅整机项目": "device",
};

export interface WbsGateRule {
  gateKey: WbsGateKey;
  stage: WbsStage;
  packageStart: string;
  packageEnd: string;
  reviewCode: string;
  reviewTitle: string;
}

export const WBS_GATE_RULES: readonly WbsGateRule[] = [
  {
    gateKey: "STR1",
    stage: "concept",
    packageStart: "1.1",
    packageEnd: "1.10",
    reviewCode: "1.11",
    reviewTitle: "STR1评审",
  },
  {
    gateKey: "STR2",
    stage: "planning",
    packageStart: "2.1",
    packageEnd: "2.6",
    reviewCode: "2.7",
    reviewTitle: "STR2评审",
  },
  {
    gateKey: "STR3",
    stage: "planning",
    packageStart: "2.8",
    packageEnd: "2.10",
    reviewCode: "2.11",
    reviewTitle: "STR3评审",
  },
  {
    gateKey: "STR4",
    stage: "development_validation",
    packageStart: "3.1",
    packageEnd: "3.9",
    reviewCode: "3.10",
    reviewTitle: "STR4评审",
  },
  {
    gateKey: "STR4A",
    stage: "development_validation",
    packageStart: "3.11",
    packageEnd: "3.17",
    reviewCode: "3.18",
    reviewTitle: "STR4A评审",
  },
  {
    gateKey: "STR5",
    stage: "development_validation",
    packageStart: "3.19",
    packageEnd: "3.20",
    reviewCode: "3.21",
    reviewTitle: "STR5评审",
  },
];

export interface WbsV20CodeCorrection {
  sheetName: string;
  title: string;
  field: "packageCode" | "taskCode";
  fromCode: string;
  toCode: string;
}

export const WBS_V20_CODE_CORRECTIONS: readonly WbsV20CodeCorrection[] = [
  {
    sheetName: "01-概念阶段",
    title: "输出影像需求PD",
    field: "taskCode",
    fromCode: "1.5.2",
    toCode: "1.5.3",
  },
  {
    sheetName: "03-开发验证阶段",
    title: "输出粉丝试用报告",
    field: "taskCode",
    fromCode: "3.13.2",
    toCode: "3.12.2",
  },
  {
    sheetName: "03-开发验证阶段",
    title: "分析与优化粉丝问题",
    field: "taskCode",
    fromCode: "3.13.3",
    toCode: "3.12.3",
  },
  {
    sheetName: "03-开发验证阶段",
    title: "IR主观体验验收",
    field: "taskCode",
    fromCode: "3.12.1",
    toCode: "3.13.1",
  },
  {
    sheetName: "03-开发验证阶段",
    title: "进行项目认证",
    field: "packageCode",
    fromCode: "3.15",
    toCode: "3.16",
  },
  {
    sheetName: "03-开发验证阶段",
    title: "发布产品营销材料",
    field: "packageCode",
    fromCode: "3.16",
    toCode: "3.17",
  },
  {
    sheetName: "03-开发验证阶段",
    title: "STR4A评审",
    field: "packageCode",
    fromCode: "3.17",
    toCode: "3.18",
  },
  {
    sheetName: "03-开发验证阶段",
    title: "调研与改善Beta用户NPS",
    field: "packageCode",
    fromCode: "3.18",
    toCode: "3.19",
  },
];

export function applyWbsV20CodeCorrections(input: {
  sheetName: string;
  title: string;
  packageCode: string | null;
  taskCode: string | null;
}): { packageCode: string | null; taskCode: string | null; applied: WbsV20CodeCorrection[] } {
  let packageCode = input.packageCode;
  let taskCode = input.taskCode;
  const applied: WbsV20CodeCorrection[] = [];

  for (const correction of WBS_V20_CODE_CORRECTIONS) {
    if (correction.sheetName !== input.sheetName || correction.title !== input.title) continue;
    const currentCode = correction.field === "packageCode" ? packageCode : taskCode;
    if (currentCode !== correction.fromCode) continue;
    if (correction.field === "packageCode") packageCode = correction.toCode;
    else taskCode = correction.toCode;
    applied.push(correction);
  }

  return { packageCode, taskCode, applied };
}

export function shiftWbsV20FollowUpTaskCode(code: string | null): string | null {
  const match = code?.match(/^1\.5\.(\d+)$/);
  if (!match) return null;
  const suffix = Number(match[1]);
  if (!Number.isInteger(suffix) || suffix < 3) return null;
  return `1.5.${suffix + 1}`;
}

export function normalizeTemplateScope(value: unknown): WbsProjectScope | null {
  const label = typeof value === "string" ? value.trim() : "";
  return WBS_TEMPLATE_SCOPE_BY_LABEL[label] ?? null;
}

export function isSpmRole(role: string): boolean {
  const normalized = role.trim().toLocaleLowerCase();
  return normalized.includes("spm") || role.includes("项目经理");
}

function packageTuple(code: string): [number, number] | null {
  const parts = code.trim().split(".");
  if (parts.length < 2 || parts.some((part) => !/^\d+$/.test(part))) return null;
  return [Number(parts[0]), Number(parts[1])];
}

function comparePackageCodes(left: string, right: string): number {
  const leftTuple = packageTuple(left);
  const rightTuple = packageTuple(right);
  if (!leftTuple || !rightTuple) return Number.NaN;
  if (leftTuple[0] !== rightTuple[0]) return leftTuple[0] - rightTuple[0];
  return leftTuple[1] - rightTuple[1];
}

export function packageCodeFromTaskCode(code: string): string | null {
  const parts = code.trim().split(".");
  if (parts.length < 3 || parts.some((part) => !/^\d+$/.test(part))) return null;
  return `${Number(parts[0])}.${Number(parts[1])}`;
}

export function getGateRuleForCode(code: string): WbsGateRule | null {
  const normalized = code.trim();
  const exactReview = WBS_GATE_RULES.find((rule) => rule.reviewCode === normalized);
  if (exactReview) return exactReview;

  return (
    WBS_GATE_RULES.find(
      (rule) =>
        comparePackageCodes(normalized, rule.packageStart) >= 0 &&
        comparePackageCodes(normalized, rule.packageEnd) <= 0,
    ) ?? null
  );
}

export function isScopeApplicable(scope: WbsProjectScope, profile: WbsProjectProfile): boolean {
  if (scope === "all") return true;
  if (scope === "tos") return profile === "tos" || profile === "tos_major";
  if (scope === "tos_major") return profile === "tos_major";
  return profile === "device";
}
