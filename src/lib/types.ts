export interface Project {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  type: string;
  status: string;
  stage?: string | null;
  health: string;
  owner?: string | null;
  pm?: string | null;
  startDate?: string | Date | null;
  targetDate?: string | Date | null;
  releaseDate?: string | Date | null;
  currentSummary?: string | null;
  nextMilestone?: string | null;
  nextAction?: string | null;
  sourceSystem?: string | null;
  sourceId?: string | null;
  sourceUrl?: string | null;
  tags?: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { items: number; logs: number };
  items?: WorkItem[];
  logs?: WorkLog[];
  links?: ProjectLink[];
  milestones?: ProjectMilestone[];
  members?: ProjectMember[];
  actionItems?: ActionItem[];
  portfolioSignals?: ProjectPortfolioSignals | null;
}

export interface ActionItem {
  id: string;
  title: string;
  status: string;
  owner?: string | null;
  dueDate?: string | null;
  sortOrder: number;
  workItemId?: string | null;
  workLogId?: string | null;
  projectId?: string | null;
  doneAt?: string | Date | null;
  doneNote?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ProjectPortfolioMilestone {
  id: string;
  title: string;
  status: string;
  stage?: string | null;
  planType?: string | null;
  dateMode?: string | null;
  targetDate?: string | Date | null;
  plannedEndDate?: string | Date | null;
}

export interface ProjectPortfolioLink {
  id: string;
  title: string;
  url: string;
  category: string;
  isPrimary: boolean;
}

export interface ProjectPortfolioSignals {
  p0p1Count?: number;
  blockedCount?: number;
  redYellowCount?: number;
  overdueCount?: number;
  recentReportableLogCount?: number;
  memberCount?: number;
  coreMemberCount?: number;
  nextOpenMilestone?: ProjectPortfolioMilestone | null;
  primaryLink?: ProjectPortfolioLink | null;
}

export interface ProjectLink {
  id: string;
  projectId: string;
  title: string;
  url: string;
  category: string;
  description?: string | null;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  stage?: string | null;
  planType: string;
  dateMode?: string | null;
  status: string;
  targetDate?: string | Date | null;
  actualDate?: string | Date | null;
  plannedStartDate?: string | Date | null;
  plannedEndDate?: string | Date | null;
  actualStartDate?: string | Date | null;
  actualEndDate?: string | Date | null;
  owner?: string | null;
  sourceUrl?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  name: string;
  role?: string | null;
  team?: string | null;
  responsibility?: string | null;
  contact?: string | null;
  isCore: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type ProjectSnapshotHealthKey = "red" | "yellow" | "green" | "unknown";

export interface ProjectSnapshotProject {
  id: string;
  name: string;
  code?: string | null;
  type: string;
  status: string;
  stage?: string | null;
  health: string;
  owner?: string | null;
  pm?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  releaseDate?: string | null;
  currentSummary?: string | null;
  nextMilestone?: string | null;
  nextAction?: string | null;
  sourceUrl?: string | null;
  tags?: string | null;
}

export interface ProjectSnapshotSummary {
  name: string;
  code?: string | null;
  type: string;
  status: string;
  stage?: string | null;
  health: string;
  owner?: string | null;
  pm?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  releaseDate?: string | null;
  currentSummary?: string | null;
  nextMilestone?: string | null;
  nextAction?: string | null;
}

export interface ProjectSnapshotItem {
  id?: string;
  title: string;
  description?: string | null;
  type?: string;
  priority?: string;
  status: string;
  health: string;
  owner?: string | null;
  dueDate?: string | null;
  nextAction?: string | null;
  trackingReason?: string | null;
  sourceSystem?: string | null;
  sourceId?: string | null;
  sourceUrl?: string | null;
  currentSummary?: string | null;
  nextCheckpoint?: string | null;
  reportLevel?: string;
  tags?: string | null;
  closedAt?: string | null;
}

export interface ProjectSnapshotLogItem {
  id: string;
  title: string;
}

export interface ProjectSnapshotLog {
  id?: string;
  workDate: string;
  title: string;
  content: string;
  type: string;
  source: string;
  project?: string | null;
  module?: string | null;
  tags?: string | null;
  item?: ProjectSnapshotLogItem | null;
  sourceUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectSnapshotMilestone {
  id?: string;
  title: string;
  description?: string | null;
  stage?: string | null;
  planType: string;
  dateMode?: string | null;
  status: string;
  targetDate?: string | null;
  actualDate?: string | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  owner?: string | null;
  sourceUrl?: string | null;
  sortOrder?: number;
}

export interface ProjectSnapshotLink {
  id?: string;
  title: string;
  url: string;
  category: string;
  description?: string | null;
  isPrimary?: boolean;
  sortOrder?: number;
}

export interface ProjectSnapshotMember {
  id?: string;
  name: string;
  role?: string | null;
  team?: string | null;
  responsibility?: string | null;
  contact?: string | null;
  isCore?: boolean;
  sortOrder?: number;
}

export interface ProjectSnapshotSignals {
  itemCount: number;
  logCount: number;
  recentLogCount: number;
  p0p1Count: number;
  blockedCount: number;
  redYellowCount: number;
  overdueCount: number;
  topRiskCount: number;
}

export interface ProjectSnapshotMemberSummary {
  memberCount: number;
  coreMemberCount: number;
}

export interface ProjectSnapshotTimeline {
  milestones?: ProjectSnapshotMilestone[];
  delayedMilestones: ProjectSnapshotMilestone[];
  nextOpenMilestone: ProjectSnapshotMilestone | null;
}

export interface ProjectSnapshotKeyLinks {
  primaryLink: ProjectSnapshotLink | null;
  items: ProjectSnapshotLink[];
}

export interface ProjectSnapshotData {
  projectId: string;
  projectName?: string;
  project?: ProjectSnapshotProject | null;
  summary?: ProjectSnapshotSummary | null;
  signals?: ProjectSnapshotSignals | null;
  memberSummary?: ProjectSnapshotMemberSummary | null;
  timeline?: ProjectSnapshotTimeline | null;
  keyLinks?: ProjectSnapshotKeyLinks | null;
  members?: ProjectSnapshotMember[];
  milestones?: ProjectSnapshotMilestone[];
  links?: ProjectSnapshotLink[];
  items?: ProjectSnapshotItem[];
  byHealth?: Record<ProjectSnapshotHealthKey, ProjectSnapshotItem[]>;
  topRisks?: ProjectSnapshotItem[];
  recentLogs?: ProjectSnapshotLog[];
  nextCheckpointItem?: ProjectSnapshotItem | null;
}

export interface WorkItem {
  id: string;
  title: string;
  description?: string | null;
  project?: string | null;
  projectId?: string | null;
  projectRef?: Project | null;
  module?: string | null;
  type: 'requirement' | 'milestone' | 'commitment' | 'action' | 'change' | 'risk' | 'issue' | 'decision' | 'blocker' | 'other';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'open' | 'following' | 'blocked' | 'closed';
  owner?: string | null;
  dueDate?: string | null;
  nextAction?: string | null;
  trackingReason?: string | null;
  sourceSystem?: string | null;
  sourceId?: string | null;
  sourceUrl?: string | null;
  health: string;
  currentSummary?: string | null;
  nextCheckpoint?: string | null;
  reportLevel: string;
  tags?: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date | null;
  logs?: WorkLog[];
  actionItems?: ActionItem[];
}

export interface WorkLog {
  id: string;
  workDate: string;
  title: string;
  content: string;
  type: 'note' | 'meeting' | 'update' | 'risk' | 'decision' | 'todo' | 'feishu' | 'issue' | 'blocker' | 'other';
  source: 'manual' | 'meeting' | 'feishu' | 'phone' | 'mail' | 'other';
  project?: string | null;
  projectId?: string | null;
  projectRef?: Project | null;
  module?: string | null;
  tags?: string | null;
  reportable: boolean;
  sourceUrl?: string | null;
  itemId?: string | null;
  item?: WorkItem | null;
  createdAt: Date;
  updatedAt: Date;
  actionItems?: ActionItem[];
}

export interface ActionItemDraft {
  title: string;
  status: string;
  owner: string;
  dueDate: string;
}
