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
  status: string;
  targetDate?: string | Date | null;
  actualDate?: string | Date | null;
  owner?: string | null;
  sourceUrl?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
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
}
