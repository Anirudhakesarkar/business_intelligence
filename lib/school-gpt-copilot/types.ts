export const CONTRACT_VERSION = 'school-gpt-v1';

export type GptModuleScore = {
  key: string;
  label: string;
  score: number;
  weight?: number;
  drivers: Array<{ key: string; label: string; impact: number; detail?: string }>;
};

export type GptSummaryFact = {
  module: string;
  text: string;
};

export type GptTopEvent = {
  eventType: string;
  severity: string;
  durationMinutes?: number;
  summary: string;
};

export type SchoolGptContext = {
  contract_version: string;
  date: string;
  org_id: number;
  site_id?: number;
  timezone: string;
  overall_score: number | null;
  module_scores: GptModuleScore[];
  summary_facts: GptSummaryFact[];
  top_events: GptTopEvent[];
};

export type GptSummaryRecord = {
  id: number;
  organizationId: number;
  siteId?: number;
  summaryType: 'daily' | 'weekly';
  summaryDate: string;
  weekStart?: string;
  content: string;
  citations: string[];
  model: string;
  createdAt: string;
};

export type GptRecommendation = {
  id: number;
  organizationId: number;
  siteId?: number;
  summaryDate: string;
  priority: 'High' | 'Medium' | 'Low';
  moduleKey: string;
  title: string;
  rationale: string;
  suggestedAction: string;
  expectedImpact?: string;
  citations: string[];
  createdAt: string;
};

export type GptActionTask = {
  id: number;
  organizationId: number;
  recommendationId?: number;
  summaryDate: string;
  title: string;
  assignee?: string;
  status: 'open' | 'completed' | 'cancelled';
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
};

export type GptChatMessage = {
  id: number;
  organizationId: number;
  conversationId: string;
  summaryDate: string;
  question: string;
  answer: string;
  citations: string[];
  createdAt: string;
};
