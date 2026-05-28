/** True when demo seed UI and non-production snapshot fallback are allowed. */
export function isSchoolDemoUiEnabled(): boolean {
  if (process.env.SCHOOL_PRODUCTION_MODE === '1') return false;
  if (process.env.SCHOOL_SNAPSHOT === '0') return false;
  return true;
}
