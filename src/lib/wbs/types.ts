import type {
  WbsDeliverableStatus,
  WbsExecutionStatus,
  WbsGateKey,
  WbsNodeKind,
  WbsProjectProfile,
  WbsProjectScope,
  WbsStage,
} from "@/lib/wbs/constants";

export interface WbsTemplateRow {
  sheetName: string;
  rowNumber: number;
  stage: WbsStage;
  role: string;
  packageCode: string | null;
  taskCode: string | null;
  parentCode: string | null;
  title: string;
  description: string;
  projectScopeLabel: string;
  projectScope: WbsProjectScope | null;
  processSupport: string;
  deliverableSpec: string;
}

export interface WbsTemplateNode {
  sheetName: string;
  rowNumber: number;
  stage: WbsStage;
  gateKey: WbsGateKey;
  kind: WbsNodeKind;
  code: string;
  parentCode: string | null;
  title: string;
  description: string;
  role: string;
  projectScope: WbsProjectScope;
  processSupport: string;
  deliverableSpec: string;
  sortOrder: number;
}

export type WbsIssueSeverity = "error" | "warning";

export interface WbsTemplateIssue {
  severity: WbsIssueSeverity;
  code: string;
  message: string;
  sheetName?: string;
  rowNumber?: number;
  recordCode?: string;
}

export interface WbsTemplateCorrection {
  sheetName: string;
  rowNumber: number;
  title: string;
  fromCode: string;
  toCode: string;
  field: "packageCode" | "taskCode";
}

export interface WbsGateSummary {
  gateKey: WbsGateKey;
  stage: WbsStage;
  packageRange: string;
  packageCodes: string[];
  taskCodes: string[];
  reviewTask: Pick<WbsTemplateNode, "code" | "title" | "role" | "sheetName" | "rowNumber"> | null;
  packageCount: number;
  taskCount: number;
  reviewTaskCount: number;
}

export interface WbsPreviewChangeSummary {
  add: number;
  update: number;
  ignore: number;
  remove: number;
}

export interface WbsTemplatePreview {
  sourceFileName: string;
  sourceHash: string;
  version: string;
  sheets: string[];
  parserNotes: string[];
  rows: WbsTemplateRow[];
  nodes: WbsTemplateNode[];
  gates: WbsGateSummary[];
  spmTaskCount: number;
  projectScopeTaskCounts: Record<WbsProjectScope, number>;
  issues: WbsTemplateIssue[];
  changes: WbsPreviewChangeSummary;
  hasStructuralErrors: boolean;
}

export interface WbsExecutionNodeState {
  kind: WbsNodeKind;
  status: WbsExecutionStatus | null;
  requiredDeliverables?: Array<{
    required: boolean;
    status: WbsDeliverableStatus;
  }>;
}

export interface WbsExecutionTransitionInput {
  currentStatus: WbsExecutionStatus;
  nextStatus: WbsExecutionStatus;
  completionNote?: string | null;
  blockedReason?: string | null;
  waiverReason?: string | null;
  completedAt?: string | null;
  requiredDeliverables?: Array<{
    required: boolean;
    status: WbsDeliverableStatus;
  }>;
}

export interface WbsExecutionTransitionResult {
  ok: boolean;
  errors: string[];
  completionNote: string | null;
  blockedReason: string | null;
  waiverReason: string | null;
  shouldSetCompletedAt: boolean;
  shouldClearCompletedAt: boolean;
}

export interface WbsReadinessSummary {
  status: "open" | "in_progress" | "blocked" | "closed";
  totalExecutionNodes: number;
  completedExecutionNodes: number;
  blockedNodes: number;
  pendingRequiredDeliverables: number;
  completionPercent: number;
  nextAction: string | null;
}

export interface WbsInitializationConflict {
  code: string;
  message: string;
  gateKey?: WbsGateKey;
  milestoneIds?: string[];
}

export interface WbsInitializationGatePreview {
  gateKey: WbsGateKey;
  stage: WbsStage;
  milestoneId: string | null;
  milestoneTitle: string | null;
  targetDate: string | null;
  matchedBy: "gateKey" | "title" | null;
  applicableNodeCount: number;
}

export interface WbsRoleSummary {
  roleAssignmentCount: number;
  roleCount: number;
  roles: string[];
}

export interface WbsExistingPlanSummary {
  id: string;
  profile: WbsProjectProfile;
  status: string;
  initializedAt: string | null;
  nodeCount: number;
}

export interface WbsInitializationPreview {
  project: { id: string; name: string; type: string };
  template: {
    id: string;
    version: string;
    sourceFileName: string;
    sourceHash: string;
    nodeCount: number;
  };
  profile: WbsProjectProfile;
  gates: WbsInitializationGatePreview[];
  counts: {
    nodes: number;
    packages: number;
    tasks: number;
    reviews: number;
    deliverables: number;
    executionItems: number;
  };
  roleSummary: WbsRoleSummary;
  existingPlan: WbsExistingPlanSummary | null;
  conflicts: WbsInitializationConflict[];
  ready: boolean;
}

export interface WbsInitializationResult {
  planId: string;
  templateId: string;
  profile: WbsProjectProfile;
  nodeCount: number;
  packageCount: number;
  taskCount: number;
  reviewCount: number;
  deliverableCreatedCount: number;
  executionItemCreatedCount: number;
  executionItemUpdatedCount: number;
  linkedGateCount: number;
  initializedAt: string;
}
