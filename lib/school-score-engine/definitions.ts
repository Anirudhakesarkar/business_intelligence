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
  {
    moduleKey: 'occupancy',
    formulaVersion: '1',
    description: 'match − 8×Overcrowding − 5×Underuse − 10×EmptyRoom (match defaults to 90)',
    inputs: ['expected_match', 'expected_match_pct', 'overcrowding_count', 'underuse_count', 'empty_room_count'],
  },
  {
    moduleKey: 'academic',
    formulaVersion: '1',
    description: 'conducted − 5×LateStart − 12×MissedPeriod (conducted defaults to 92; inputs from classroom bundle)',
    inputs: ['conducted_pct', 'late_count', 'missed_count'],
  },
  {
    moduleKey: 'staff',
    formulaVersion: '1',
    description: 'coverage − 15×Gaps (coverage defaults to 95)',
    inputs: ['coverage_pct', 'gap_count'],
  },
  {
    moduleKey: 'space',
    formulaVersion: '1',
    description: 'util + 20 − 10×OvercrowdedRooms − 6×UnderusedRooms (util defaults to 60)',
    inputs: ['avg_utilization_pct', 'overcrowded_room_count', 'underused_room_count'],
  },
  {
    moduleKey: 'discipline',
    formulaVersion: '1',
    description: '100 − 8×Running − 5×Loitering − 12×Unsafe − 6×Crowding',
    inputs: ['running_count', 'loitering_count', 'unsafe_count', 'unsafe_movement_count', 'crowding_count'],
  },
  {
    moduleKey: 'parent',
    formulaVersion: '1',
    description: '0.5×Smooth + 0.3×(100 − 2×DispersalCongestion) − 8×Overlap − 2×Delay (Smooth defaults to 90)',
    inputs: ['arrival_smooth_score', 'dispersal_congestion_min', 'overlap_count', 'delay_min'],
  },
  {
    moduleKey: 'compliance',
    formulaVersion: '1',
    description: '100 − 10×Violations − 12×CameraOffline − 8×SupervisionGaps',
    inputs: ['violation_count', 'camera_offline_count', 'supervision_gap_count'],
  },
] as const;
