// Builds the safe structured context summary sent to GPT/custom AI.
// GPT never has unrestricted DB access — it receives this pre-built summary.

export interface CopilotContext {
  organizationId: number;
  siteId?: number;
  dateFrom: string;
  dateTo: string;
  scores: {
    safetyScore: number;
    cameraHealthScore: number;
    responseScore: number;
    complianceScore: number;
    operationalRiskScore: number;
    riskLevel: string;
  };
  alertSummary: {
    total: number;
    critical: number;
    repeated: number;
    unacknowledged: number;
    avgAckMinutes: number;
    avgResolutionMinutes: number;
    slaBreaches: number;
  };
  cameraSummary: {
    total: number;
    online: number;
    streamDrops: number;
    offlineCritical: number;
  };
  incidentSummary: {
    open: number;
    unresolved: number;
    avgAgeDays: number;
  };
  topRiskAreas: Array<{ name: string; riskLevel: string; alertCount: number; category?: string }>;
  recommendations: Array<{ title: string; priority: string; action: string }>;
}

export function buildCopilotPrompt(context: CopilotContext, userQuestion: string): string {
  const ctx = JSON.stringify(context, null, 2);
  return `You are an Orion Alerts Business Intelligence assistant.

Structured context (use ONLY this data to answer):
\`\`\`json
${ctx}
\`\`\`

User question: ${userQuestion}

Instructions:
- Answer using only the data in the structured context above.
- Be concise and management-friendly.
- Always suggest a specific action when relevant.
- If data is insufficient to answer, say so clearly.`;
}

export const SUGGESTED_QUESTIONS = [
  'Summarize this site for today.',
  'Which area has the highest risk?',
  'Why did critical alerts increase this week?',
  'Which cameras need maintenance?',
  'What should management fix first?',
  'Which rules are creating repeated alerts?',
  'Are operators responding within SLA?',
  'What is our safety score trend?',
];
