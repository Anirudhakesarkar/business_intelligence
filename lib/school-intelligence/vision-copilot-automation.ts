export type AutomationReportTemplate =
  | 'camera-health'
  | 'incident-digest'
  | 'zone-activity'
  | 'custom';

export type AutomationFrequency = 'once' | 'daily' | 'weekly' | 'monthly';

export type AutomationDeliveryChannel = 'email' | 'whatsapp';

export type VisionAutomationRun = {
  id: string;
  name: string;
  template: AutomationReportTemplate;
  customPrompt?: string;
  frequency: AutomationFrequency;
  runDate: string;
  runTime: string;
  emailRecipients: string[];
  whatsappRecipients: string[];
  enabled: boolean;
  createdAt: string;
};

export const AUTOMATION_DELIVERY_CHANNELS: {
  value: AutomationDeliveryChannel;
  label: string;
  description: string;
  placeholder: string;
}[] = [
  {
    value: 'email',
    label: 'Email',
    description: 'Send the report as a PDF or summary link.',
    placeholder: 'ops@school.edu, principal@school.edu',
  },
  {
    value: 'whatsapp',
    label: 'WhatsApp',
    description: 'Deliver a short summary with a link to the full report.',
    placeholder: '+91 98765 43210, +91 91234 56789',
  },
];

export const AUTOMATION_REPORT_TEMPLATES: {
  value: AutomationReportTemplate;
  label: string;
  description: string;
}[] = [
  {
    value: 'camera-health',
    label: 'Camera health summary',
    description: 'Online/offline status, stream quality, and attention-ranked cameras.',
  },
  {
    value: 'incident-digest',
    label: 'Incident digest',
    description: 'Open and critical events with evidence links from the selected period.',
  },
  {
    value: 'zone-activity',
    label: 'Zone activity report',
    description: 'Motion, dwell, and crowd patterns grouped by zone and time block.',
  },
  {
    value: 'custom',
    label: 'Custom report',
    description: 'Define your own question or KPI set for Vision Copilot to answer.',
  },
];

export const AUTOMATION_FREQUENCIES: { value: AutomationFrequency; label: string }[] = [
  { value: 'once', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export const SAMPLE_AUTOMATION_RUNS: VisionAutomationRun[] = [
  {
    id: 'auto-1',
    name: 'Morning camera health',
    template: 'camera-health',
    frequency: 'daily',
    runDate: '2026-05-29',
    runTime: '07:30',
    emailRecipients: ['ops-lead@eurokids.demo', 'security@eurokids.demo'],
    whatsappRecipients: [],
    enabled: true,
    createdAt: '2026-05-20T10:00:00.000Z',
  },
  {
    id: 'auto-2',
    name: 'Friday incident rollup',
    template: 'incident-digest',
    frequency: 'weekly',
    runDate: '2026-05-30',
    runTime: '17:00',
    emailRecipients: ['principal@eurokids.demo'],
    whatsappRecipients: ['+91 98765 43210'],
    enabled: false,
    createdAt: '2026-05-18T14:00:00.000Z',
  },
];

/** Split comma- or newline-separated recipient strings into trimmed entries. */
export function parseRecipientList(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatDeliveryTargets(run: VisionAutomationRun): string[] {
  const lines: string[] = [];
  if (run.emailRecipients.length > 0) {
    lines.push(`Email → ${run.emailRecipients.join(', ')}`);
  }
  if (run.whatsappRecipients.length > 0) {
    lines.push(`WhatsApp → ${run.whatsappRecipients.join(', ')}`);
  }
  return lines;
}

export function templateLabel(template: AutomationReportTemplate): string {
  return AUTOMATION_REPORT_TEMPLATES.find((t) => t.value === template)?.label ?? template;
}

export function frequencyLabel(frequency: AutomationFrequency): string {
  return AUTOMATION_FREQUENCIES.find((f) => f.value === frequency)?.label ?? frequency;
}

export function formatAutomationSchedule(run: VisionAutomationRun): string {
  const time = run.runTime || '00:00';
  if (run.frequency === 'once') {
    return `Once · ${run.runDate} at ${time}`;
  }
  return `${frequencyLabel(run.frequency)} · from ${run.runDate} at ${time}`;
}

export function hasDeliveryTarget(run: VisionAutomationRun): boolean {
  return run.emailRecipients.length > 0 || run.whatsappRecipients.length > 0;
}
