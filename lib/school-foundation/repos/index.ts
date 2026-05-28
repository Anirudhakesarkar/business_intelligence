export { DbDisabledError, requirePool, isDbEnabled } from './shared';
export * from './sites';
export * from './foundation-spatial';
export * from './foundation-org';
export * from './foundation-cameras';
export * from './foundation-schedule';
export * from './timetable-import';
export * from './timetable-sample';

import { hydrateBuildingsFromPg, hydrateFloorsFromPg, hydrateRoomsFromPg, hydrateZonesFromPg } from './foundation-spatial';
import { hydrateClassesFromPg, hydrateSectionsFromPg, hydrateStaffFromPg, hydrateSubjectsFromPg, hydrateTeachersFromPg } from './foundation-org';
import { hydrateCamerasFromPg } from './foundation-cameras';
import { hydrateCalendarFromPg, hydrateRostersFromPg, hydrateTimeWindowsFromPg, hydrateTimetableFromPg } from './foundation-schedule';
import { hydrateSitesFromPg } from './sites';

/** Load all foundation master data from Postgres into the in-memory cache (once per process). */
export async function hydrateFoundationFromPg() {
  const parts = await Promise.all([
    hydrateSitesFromPg(),
    hydrateBuildingsFromPg(),
    hydrateFloorsFromPg(),
    hydrateZonesFromPg(),
    hydrateRoomsFromPg(),
    hydrateClassesFromPg(),
    hydrateSectionsFromPg(),
    hydrateSubjectsFromPg(),
    hydrateTeachersFromPg(),
    hydrateStaffFromPg(),
    hydrateCamerasFromPg(),
    hydrateCalendarFromPg(),
    hydrateTimeWindowsFromPg(),
    hydrateTimetableFromPg(),
    hydrateRostersFromPg(),
  ]);
  return { hydrated: parts.reduce((s, p) => s + p.hydrated, 0), parts };
}
