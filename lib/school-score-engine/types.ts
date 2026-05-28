export type ScoreModuleKey =
  | 'safety'
  | 'security'
  | 'teacher'
  | 'occupancy'
  | 'academic'
  | 'staff'
  | 'space'
  | 'discipline'
  | 'parent'
  | 'compliance';

export type ScoreDriver = {
  key: string;
  label: string;
  impact: number;
  detail?: string;
  /** Phase 4 drilldown metric (not raw signals). */
  metricKey?: string;
};

export type ModuleScore = {
  id: number;
  organizationId: number;
  siteId?: number;
  scoreDate: string;
  moduleKey: ScoreModuleKey;
  score: number;
  drivers: ScoreDriver[];
  weightProfileId?: number;
  createdAt: string;
};

export type DailyOverallScore = {
  id: number;
  organizationId: number;
  siteId?: number;
  scoreDate: string;
  overallScore: number;
  weightProfileId: number;
  moduleScores: ModuleScore[];
  weights: Record<ScoreModuleKey, number>;
  mvp3Mode?: boolean;
  createdAt: string;
};

export type WeightProfile = {
  id: number;
  organizationId: number;
  profileName: string;
  effectiveFrom: string;
  weights: Record<ScoreModuleKey, number>;
  mvp3Mode?: boolean;
  createdAt: string;
};

export type ScoreInputsBundle = Record<string, unknown>;
