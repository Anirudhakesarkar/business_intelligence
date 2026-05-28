/** Documented score formulas (task 11 / docx §9). Used for UI tooltips and PG seed alignment. */
export const SCORE_DEFINITIONS = [
  {
    moduleKey: 'safety',
    formulaVersion: '1',
    description: '100 − 25×Fall − 30×FireSmoke − 10×UnsafeClimbing',
    inputs: ['FallDetected', 'FireSmokeDetected', 'UnsafeClimbing'],
  },
  {
    moduleKey: 'security',
    formulaVersion: '1',
    description: '100 − 18×(RestrictedZoneEntry + ServerRoomEntry)',
    inputs: ['RestrictedZoneEntry', 'ServerRoomEntry'],
  },
  {
    moduleKey: 'teacher',
    formulaVersion: '1',
    description: 'conducted×0.25 + presence×0.25 + onTime×0.2 + activity×0.2 − gaps×6 − early×4',
    inputs: ['teacher_daily_intelligence'],
  },
] as const;
