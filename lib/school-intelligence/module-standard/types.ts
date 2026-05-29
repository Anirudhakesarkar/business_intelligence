import type { ReactNode } from 'react';
import type { ScoreModuleKey } from '@/lib/school-score-engine/types';
import type { IntelligenceModule } from '@/lib/school-rule-engine/types';

export type SIObservationSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export type SIObservationStatus =
  | 'Open'
  | 'Observed'
  | 'Acknowledged'
  | 'Assigned'
  | 'Resolved';

export type SIObservation = {
  id: string | number;
  type: string;
  label: string;
  severity: SIObservationSeverity;
  status: SIObservationStatus;
  startedAt: string;
  summary: string;
  cameraId?: number | string;
  location?: string;
  owner?: string;
  metadata?: Record<string, string | number | null>;
};

export type SIObservationTypeConfig = {
  type: string;
  label: string;
  severity: SIObservationSeverity;
  defaultSummary: string;
  /** Short capability line shown under the label in the observation types grid. */
  description?: string;
  isCritical?: boolean;
  isHigh?: boolean;
  /** Optional rotating copy for demo observations when live events are empty. */
  demoSummaries?: string[];
};

export type SIMetricCard = {
  label: string;
  value: number | string;
  tone?: 'default' | 'warn' | 'critical';
};

export type SIStandardModuleConfig = {
  id: string;
  breadcrumb: string;
  scoreTitle: string;
  scoreModuleKey: ScoreModuleKey;
  /** Include live events tagged with this rule-engine module (even if type is aliased elsewhere). */
  intelligenceModule?: IntelligenceModule;
  eventTypes: string[];
  /** Maps rule-engine / legacy event types onto this module's observation types. */
  eventTypeAliases?: Record<string, string>;
  /** When true, demo mode seeds one observation per type (no type left at zero). */
  demoSeedAllTypes?: boolean;
  observationTypes: SIObservationTypeConfig[];
  metricCards: (observations: SIObservation[]) => SIMetricCard[];
  typeIcons: Record<string, ReactNode>;
  emptyFeedMessage?: string;
};

export type ObservationBucket = {
  key: string;
  label: string;
  subLabel?: string;
  count: number;
};
