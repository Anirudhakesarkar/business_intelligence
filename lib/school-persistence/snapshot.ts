import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { persistRuntimeSnapshot } from '../school-db/persist-snapshot';
import { db as foundationDb, resetStoreForSeed } from '../school-foundation/store';
import { aiDb, resetAiSignalsStore } from '../school-ai-signals/store';
import { ruleDb, resetRuleEngineStore } from '../school-rule-engine/store';
import { dailyDb, resetDailySummariesStore } from '../school-daily-summaries/store';
import { scoreDb, resetScoreEngineStore } from '../school-score-engine/store';
import { gptDb, resetGptCopilotStore } from '../school-gpt-copilot/store';

const DATA_DIR = join(process.cwd(), '.data');
const SNAPSHOT_PATH = join(DATA_DIR, 'school-intelligence.json');

export function snapshotEnabled() {
  return process.env.SCHOOL_SNAPSHOT !== '0';
}

export function exportSnapshot() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    foundation: {
      sites: foundationDb.sites(),
      buildings: foundationDb.buildings(),
      floors: foundationDb.floors(),
      zones: foundationDb.zones(),
      rooms: foundationDb.rooms(),
      cameras: foundationDb.cameras(),
      classes: foundationDb.classes(),
      sections: foundationDb.sections(),
      subjects: foundationDb.subjects(),
      teachers: foundationDb.teachers(),
      staff: foundationDb.staff(),
      calendar: foundationDb.calendar(),
      timeWindows: foundationDb.timeWindows(),
      timetable: foundationDb.timetable(),
      rosters: foundationDb.rosters(),
      sectionRoomMappings: foundationDb.sectionRoomMappings(),
    },
    ai: {
      workers: aiDb.workers(),
      signals: aiDb.signals().slice(-5000),
      healthEvents: aiDb.healthEvents().slice(-500),
    },
    rules: { rules: ruleDb.rules(), events: ruleDb.events() },
    daily: {
      scoreInputs: dailyDb.scoreInputs(),
    },
    scores: {
      overall: scoreDb.overallScores(),
      modules: scoreDb.moduleScores(),
    },
    gpt: {
      summaries: gptDb.summaries(),
      recommendations: gptDb.recommendations(),
    },
  };
}

export function saveSnapshot() {
  if (!snapshotEnabled()) return { saved: false };
  mkdirSync(DATA_DIR, { recursive: true });
  const payload = exportSnapshot();
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(payload, null, 0));
  void persistRuntimeSnapshot(1, payload);
  return { saved: true, path: SNAPSHOT_PATH };
}

export function loadSnapshot() {
  if (!snapshotEnabled() || !existsSync(SNAPSHOT_PATH)) return { loaded: false };
  const data = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as ReturnType<typeof exportSnapshot>;
  resetStoreForSeed();
  resetAiSignalsStore();
  resetRuleEngineStore();
  resetDailySummariesStore();
  resetScoreEngineStore();
  resetGptCopilotStore();
  const f = data.foundation;
  for (const arr of Object.values(f)) {
    if (Array.isArray(arr)) {
      // push into foundation arrays via db getters - they're live refs
    }
  }
  // Direct array mutation - foundation db returns refs
  foundationDb.sites().push(...f.sites);
  foundationDb.buildings().push(...f.buildings);
  foundationDb.floors().push(...f.floors);
  foundationDb.zones().push(...f.zones);
  foundationDb.rooms().push(...f.rooms);
  foundationDb.cameras().push(...f.cameras);
  foundationDb.classes().push(...f.classes);
  foundationDb.sections().push(...f.sections);
  foundationDb.subjects().push(...f.subjects);
  foundationDb.teachers().push(...f.teachers);
  foundationDb.staff().push(...f.staff);
  foundationDb.calendar().push(...f.calendar);
  foundationDb.timeWindows().push(...f.timeWindows);
  foundationDb.timetable().push(...f.timetable);
  foundationDb.rosters().push(...(f.rosters ?? []));
  foundationDb.sectionRoomMappings().push(...(f.sectionRoomMappings ?? []));
  aiDb.workers().push(...(data.ai?.workers ?? []));
  aiDb.signals().push(...(data.ai?.signals ?? []));
  aiDb.healthEvents().push(...(data.ai?.healthEvents ?? []));
  ruleDb.rules().push(...(data.rules?.rules ?? []));
  ruleDb.events().push(...(data.rules?.events ?? []));
  dailyDb.scoreInputs().push(...(data.daily?.scoreInputs ?? []));
  scoreDb.overallScores().push(...(data.scores?.overall ?? []));
  scoreDb.moduleScores().push(...(data.scores?.modules ?? []));
  gptDb.summaries().push(...(data.gpt?.summaries ?? []));
  gptDb.recommendations().push(...(data.gpt?.recommendations ?? []));
  return { loaded: true, path: SNAPSHOT_PATH, savedAt: data.savedAt };
}

let lastLoadedMtime = 0;

export function ensureSnapshotLoaded() {
  if (!snapshotEnabled()) return;
  if (!existsSync(SNAPSHOT_PATH)) return;
  const mtime = statSync(SNAPSHOT_PATH).mtimeMs;
  if (mtime === lastLoadedMtime) return;
  loadSnapshot();
  lastLoadedMtime = mtime;
}
