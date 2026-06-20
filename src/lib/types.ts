export interface Note {
  id: string;
  title: string;
  content: string;
  project: string | null;
  module: string | null;
  type: string;
  priority: string;
  status: string;
  owner: string | null;
  dueDate: string | null;
  source: string;
  tags: string | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface AiProvider {
  id: string;
  name: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isDefault: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
