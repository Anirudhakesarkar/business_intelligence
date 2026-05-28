
import type { DigestPayload } from './types';
import { buildOverviewSummary } from './summary-templates';
import { calculateSchoolScores, DEMO_METRICS } from './safety-scores';

export function buildDemoDigest(schoolName = 'Eurokids Academy'): DigestPayload {
  const scores = calculateSchoolScores(DEMO_METRICS);
  return {
    generatedAt: new Date().toISOString(),
    schoolName,
    sections: [
      {
        id: 'summary',
        title: 'Executive summary',
        bullets: [buildOverviewSummary(scores), 'Demo digest — replace with nightly job output in production.'],
      },
      {
        id: 'safety',
        title: 'Campus safety highlights',
        bullets: [
          '3 after-hours alerts at Main Gate (demo).',
          'Playground crowd threshold approached during lunch break.',
          'Camera health at 94% online (demo).',
        ],
      },
      {
        id: 'actions',
        title: 'Recommended actions',
        bullets: [
          'Verify duty roster coverage for Block A corridor.',
          'Tune playground occupancy thresholds before assembly week.',
        ],
      },
    ],
  };
}
