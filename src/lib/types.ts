export interface WorkItem {
  id: string;
  title: string;
  description?: string | null;
  project?: string | null;
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
  module?: string | null;
  tags?: string | null;
  reportable: boolean;
  sourceUrl?: string | null;
  itemId?: string | null;
  item?: WorkItem | null;
  createdAt: Date;
  updatedAt: Date;
}
