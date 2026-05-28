#!/usr/bin/env node
/**
 * School Management CRUD + Postgres verification (agent.md steps 4–7).
 *
 * Usage:
 *   node scripts/school-management-acceptance.mjs [--base http://localhost:3002]
 *   node scripts/school-management-acceptance.mjs --strict
 *   npm run accept:school-management:strict
 *
 * Strict mode (--strict): requires the *running dev server* to have SCHOOL_SNAPSHOT=0
 * (set in .env.local, then restart `npm run dev`). Checks /api/school-db/status.strictDbMode.
 *
 * Bulk paths (T5): master-data multipart dry-run/commit (+ invalid CSV), camera/timetable/staff-duty
 * validate-import dry-run+commit with Postgres verification. Seeds foundation via master-data if empty.
 */
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(root, '.env') });
config({ path: join(root, '.env.local') });

const STRICT = process.argv.includes('--strict');
const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : process.env.SM_ACCEPTANCE_BASE ?? 'http://localhost:3002';
const ORG = 1;
const TAG = `accept-${Date.now()}`;

const log = [];
function pass(msg) {
  log.push({ ok: true, msg });
  console.log(`✓ ${msg}`);
}
function fail(msg) {
  log.push({ ok: false, msg });
  console.error(`✗ ${msg}`);
}

async function api(path, init = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body, url };
}

async function pgCount(pool, sql, params = []) {
  const r = await pool.query(sql, params);
  return Number(r.rows[0]?.count ?? 0);
}

async function apiMultipart(path, formData) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { method: 'POST', body: formData });
  const body = await res.json().catch(() => ({}));
  return { res, body, url };
}

function masterDataFoundationCsv(tag) {
  const site = `Accept Site ${tag}`;
  const bld = `Accept Bld ${tag}`;
  const floor = `Floor 1 ${tag}`;
  const zone = `Accept Zone ${tag}`;
  return [
    'type,name,site_name,building_name,floor_name,zone_name,room_code,room_name,class_name,level_no,capacity',
    `site,${site},,,,,,,,`,
    `building,${bld},${site},,,,,,,`,
    `floor,${floor},,${bld},,,,,,0`,
    `zone,${zone},,${bld},${floor},,,,,`,
    `room,,,,,${zone},R-${tag},Room ${tag},,,30`,
    `class,Grade ${tag},,,,,,,,`,
    `section,A,,,,,,,Grade ${tag},,,30`,
    `staff,Staff ${tag},,,,,,,,,`,
    `teacher,Teacher ${tag},,,,,,,,,`,
    `subject,Math ${tag},,,,,,,,,`,
  ].join('\n');
}

function masterDataInvalidCsv() {
  return ['type,name,site_name', 'site,', 'building,Orphan Bld,Missing Site'].join('\n');
}

async function masterDataBulkImport(csvText, dryRun) {
  const fd = new FormData();
  fd.append('file', new Blob([csvText], { type: 'text/csv' }), 'acceptance.csv');
  if (dryRun) fd.append('dryRun', 'true');
  return apiMultipart('/api/master-data/bulk-import', fd);
}

async function loadFoundationIds() {
  const [zones, rooms, sections, staff, teachers, subjects, classes] = await Promise.all([
    api(`/api/zones?organizationId=${ORG}`),
    api(`/api/rooms?organizationId=${ORG}`),
    api(`/api/sections?organizationId=${ORG}`),
    api(`/api/staff-members?organizationId=${ORG}`),
    api(`/api/teachers?organizationId=${ORG}`),
    api(`/api/subjects?organizationId=${ORG}`),
    api(`/api/classes?organizationId=${ORG}`),
  ]);
  const room =
    rooms.body?.find((r) => String(r.roomCode).startsWith('R-accept')) ??
    rooms.body?.find((r) => String(r.roomCode).startsWith('R-')) ??
    rooms.body?.[0];
  const section = sections.body?.[0];
  const cls = classes.body?.find((c) => section && c.id === section.classId) ?? classes.body?.[0];
  return {
    zoneId: zones.body?.[0]?.id,
    zoneName: zones.body?.[0]?.name,
    roomId: room?.id,
    roomCode: room?.roomCode,
    sectionId: section?.id,
    className: cls?.name,
    sectionName: section?.name,
    staffMemberId: staff.body?.[0]?.id,
    staffName: staff.body?.[0]?.name,
    teacherId: teachers.body?.[0]?.id,
    teacherName: teachers.body?.[0]?.name,
    subjectId: subjects.body?.[0]?.id,
    subjectName: subjects.body?.[0]?.name,
  };
}

async function ensureFoundation(tag) {
  const zones = await api(`/api/zones?organizationId=${ORG}`);
  if (zones.body?.length) {
    pass(`Foundation present (${zones.body.length} zone(s))`);
    return loadFoundationIds();
  }
  console.log('  No zones — seeding foundation via master-data bulk import…');
  const csv = masterDataFoundationCsv(tag);
  const dry = await masterDataBulkImport(csv, true);
  if (!dry.res.ok) {
    fail(`Master-data dry-run HTTP ${dry.res.status}: ${dry.body?.error ?? 'unknown'}`);
    return null;
  }
  if ((dry.body.totalErrors ?? 0) > 0) {
    fail(`Master-data dry-run errors: ${dry.body.totalErrors}`);
    return null;
  }
  pass(`Master-data dry-run would create ${dry.body.totalCreated} row(s)`);

  const commit = await masterDataBulkImport(csv, false);
  if (!commit.res.ok) {
    fail(`Master-data commit HTTP ${commit.res.status}: ${commit.body?.error ?? 'unknown'}`);
    return null;
  }
  if (commit.body.atomicAborted) {
    fail('Master-data commit atomicAborted');
    return null;
  }
  if (!commit.body.committed) {
    fail('Master-data commit not committed');
    return null;
  }
  pass(`Master-data commit created ${commit.body.totalCreated} row(s)`);
  return loadFoundationIds();
}

const RESIDUE_CONFIRM = 'REMOVE_ACCEPTANCE_RESIDUE';

async function clearAcceptanceResidueIfPresent() {
  const preview = await api(`/api/school-management/acceptance-residue?organizationId=${ORG}`);
  if (!preview.res.ok) {
    fail('Acceptance residue preview failed');
    return;
  }
  const total = preview.body?.counts?.total ?? 0;
  if (total === 0) {
    pass('No acceptance residue in Postgres');
    return;
  }
  const del = await api('/api/school-management/acceptance-residue', {
    method: 'POST',
    body: JSON.stringify({ organizationId: ORG, dryRun: false, confirm: RESIDUE_CONFIRM }),
  });
  if (del.res.ok) pass(`Cleared ${total} acceptance residue row(s)`);
  else fail(`Acceptance residue cleanup: ${del.body?.error ?? del.res.status}`);
}

async function runNegativeValidationTests(ids) {
  console.log('\n— Negative validation (SM-P0-06) —\n');

  const invalidMd = await masterDataBulkImport(masterDataInvalidCsv(), true);
  if (invalidMd.res.ok && (invalidMd.body.totalErrors ?? 0) > 0) {
    pass('Master-data invalid CSV rejected on dry-run');
  } else {
    fail('Master-data invalid CSV should report errors');
  }

  const badCam = await api('/api/cameras/validate-import', {
    method: 'POST',
    body: JSON.stringify({
      organizationId: ORG,
      commit: false,
      rows: [
        {
          cameraCode: `BAD-ZONE-${TAG}`,
          name: 'Bad zone',
          purpose: 'Corridor',
          processOwner: 'Compliance',
          zoneId: 999999999,
        },
      ],
    }),
  });
  if (badCam.res.ok && badCam.body.valid === false) pass('Camera import rejects invalid zoneId');
  else fail('Camera import should reject invalid zoneId');

  if (ids?.zoneId) {
    const dupCode = `DUP-${TAG}`;
    const first = await api('/api/cameras', {
      method: 'POST',
      body: JSON.stringify({
        organizationId: ORG,
        cameraCode: dupCode,
        name: 'Dup cam',
        purpose: 'Corridor',
        processOwner: 'Compliance',
        zoneId: ids.zoneId,
        status: 'Active',
      }),
    });
    if (first.res.ok && first.body?.id) {
      const dup = await api('/api/cameras', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: ORG,
          cameraCode: dupCode,
          name: 'Dup cam 2',
          purpose: 'Corridor',
          processOwner: 'Compliance',
          zoneId: ids.zoneId,
          status: 'Active',
        }),
      });
      if (!dup.res.ok) pass('Duplicate camera code rejected on POST');
      else fail('Duplicate camera code should be rejected');
      await api(`/api/cameras/${first.body.id}`, { method: 'DELETE' });
    } else {
      fail('Could not create camera for duplicate test');
    }
  }

  if (ids?.sectionId && ids?.roomId && ids?.className) {
    const baseRow = {
      className: ids.className,
      sectionName: ids.sectionName ?? 'A',
      subjectName: ids.subjectName,
      teacherName: ids.teacherName,
      roomCode: ids.roomCode,
      day: 'Tuesday',
      startTime: '16:00',
      endTime: '17:00',
      periodType: 'Period',
    };
    const overlap = await api('/api/timetable/validate-import', {
      method: 'POST',
      body: JSON.stringify({
        organizationId: ORG,
        commit: false,
        rows: [baseRow, { ...baseRow, startTime: '16:30', endTime: '17:30' }],
      }),
    });
    if (overlap.res.ok && overlap.body.valid === false) pass('Timetable import rejects room overlap');
    else fail('Timetable import should reject overlapping periods');
  }
}

async function verifySetupHealthMatchesPg(pool) {
  console.log('\n— Setup health ↔ Postgres (SM-P0-05) —\n');
  const { body: health } = await api(`/api/school-management/setup-health?organizationId=${ORG}`);
  const pgActiveCam = await pgCount(
    pool,
    `SELECT COUNT(*)::text AS count FROM school_mgmt_cameras WHERE organization_id = $1 AND status = 'Active'`,
    [ORG],
  );
  if (health.camerasMapped?.total === pgActiveCam) pass('Setup health camera total matches PG active cameras');
  else fail(`Setup health cameras ${health.camerasMapped?.total} vs PG ${pgActiveCam}`);

  const pgTt = await pgCount(
    pool,
    `SELECT COUNT(*)::text AS count FROM school_timetable_entries WHERE organization_id = $1 AND is_active = TRUE`,
    [ORG],
  );
  if (health.timetableEntries === pgTt) pass('Setup health timetable matches PG active rows');
  else fail(`Setup health timetable ${health.timetableEntries} vs PG ${pgTt}`);

  const pgRoster = await pgCount(
    pool,
    `SELECT COUNT(*)::text AS count FROM school_staff_duty_rosters WHERE organization_id = $1 AND is_active = TRUE`,
    [ORG],
  );
  if (health.rosterEntries === pgRoster) pass('Setup health roster matches PG active rows');
  else fail(`Setup health roster ${health.rosterEntries} vs PG ${pgRoster}`);
}

async function runBulkImportTests(tag, ids, pool) {
  console.log('\n— Bulk import paths —\n');

  const invalidDry = await masterDataBulkImport(masterDataInvalidCsv(), true);
  if (invalidDry.res.ok && (invalidDry.body.totalErrors ?? 0) > 0) {
    pass(`Master-data invalid CSV dry-run rejected (${invalidDry.body.totalErrors} error(s))`);
  } else {
    fail('Master-data invalid CSV dry-run should report errors');
  }

  if (!ids?.zoneId) {
    fail('Bulk imports skipped — no foundation ids');
    return;
  }

  const camCode = `BULK-${tag}`;
  const camRows = [
    {
      cameraCode: camCode,
      name: `Bulk Cam ${tag}`,
      purpose: 'Corridor',
      processOwner: 'Compliance',
      zoneId: ids.zoneId,
    },
  ];
  const camDry = await api('/api/cameras/validate-import', {
    method: 'POST',
    body: JSON.stringify({ organizationId: ORG, commit: false, rows: camRows }),
  });
  if (camDry.res.ok && camDry.body.valid) pass('Camera import dry-run valid');
  else fail(`Camera import dry-run: ${camDry.body?.errors?.[0]?.message ?? camDry.res.status}`);

  let pgCamBulkBefore = 0;
  if (pool) {
    pgCamBulkBefore = await pgCount(
      pool,
      `SELECT COUNT(*)::text AS count FROM school_mgmt_cameras WHERE organization_id = $1 AND camera_code = $2`,
      [ORG, camCode],
    );
  }
  const camCommit = await api('/api/cameras/validate-import', {
    method: 'POST',
    body: JSON.stringify({ organizationId: ORG, commit: true, rows: camRows }),
  });
  if (camCommit.res.ok && camCommit.body.committed && (camCommit.body.created ?? 0) >= 1) {
    pass(`Camera import commit created=${camCommit.body.created}`);
  } else {
    fail(`Camera import commit: ${camCommit.body?.errors?.[0]?.message ?? camCommit.res.status}`);
  }
  if (pool && camCommit.body?.created >= 1) {
    const pgCamBulkAfter = await pgCount(
      pool,
      `SELECT COUNT(*)::text AS count FROM school_mgmt_cameras WHERE organization_id = $1 AND camera_code = $2`,
      [ORG, camCode],
    );
    if (pgCamBulkAfter === pgCamBulkBefore + 1) pass('Postgres camera row after bulk commit');
    else fail(`Postgres camera bulk count expected ${pgCamBulkBefore + 1}, got ${pgCamBulkAfter}`);
  }
  const camList = await api(`/api/cameras?organizationId=${ORG}`);
  const bulkCam = camList.body?.find((c) => c.cameraCode === camCode);
  if (bulkCam?.id) {
    await api(`/api/cameras/${bulkCam.id}`, { method: 'DELETE' });
    pass('Bulk camera cleaned up (deactivate)');
  }

  if (ids.sectionId && ids.roomId && ids.className) {
    const ttRows = [
      {
        className: ids.className,
        sectionName: ids.sectionName ?? 'A',
        subjectName: ids.subjectName,
        teacherName: ids.teacherName,
        roomCode: ids.roomCode,
        day: 'Monday',
        startTime: '14:00',
        endTime: '14:30',
        periodType: 'Period',
      },
    ];
    const ttDry = await api('/api/timetable/validate-import', {
      method: 'POST',
      body: JSON.stringify({ organizationId: ORG, commit: false, rows: ttRows }),
    });
    if (ttDry.res.ok && ttDry.body.valid) pass('Timetable import dry-run valid');
    else fail(`Timetable import dry-run: ${ttDry.body?.errors?.[0] ?? ttDry.res.status}`);

    const ttCommit = await api('/api/timetable/validate-import', {
      method: 'POST',
      body: JSON.stringify({ organizationId: ORG, commit: true, rows: ttRows }),
    });
    if (ttCommit.res.ok && (ttCommit.body.created ?? 0) >= 1) {
      pass(`Timetable import commit created=${ttCommit.body.created}`);
    } else {
      fail(`Timetable import commit: ${ttCommit.body?.error ?? ttCommit.res.status}`);
    }
    if (pool && (ttCommit.body.created ?? 0) >= 1) {
      const pgTt = await pgCount(
        pool,
        `SELECT COUNT(*)::text AS count FROM school_timetable_entries
         WHERE organization_id = $1 AND section_id = $2 AND start_time = '14:00' AND is_active = true`,
        [ORG, ids.sectionId],
      );
      if (pgTt >= 1) pass('Postgres timetable row after bulk commit');
      else fail('Postgres timetable row missing after bulk commit');
    }
    const ttList = await api(`/api/timetable?organizationId=${ORG}`);
    const bulkTt = ttList.body?.find(
      (t) => t.sectionId === ids.sectionId && t.startTime === '14:00' && t.endTime === '14:30',
    );
    if (bulkTt?.id) {
      await api(`/api/timetable/${bulkTt.id}`, { method: 'DELETE' });
      pass('Bulk timetable cleaned up (deactivate)');
    }
  } else {
    fail('Timetable bulk import skipped — missing section/room/class');
  }

  if (ids.staffMemberId && ids.zoneName) {
    const dutyRows = [
      {
        staffName: ids.staffName,
        zoneName: ids.zoneName,
        dutyType: 'Gate',
        day: 'Monday',
        startTime: '15:00',
        endTime: '16:00',
      },
    ];
    const dutyDry = await api('/api/staff-duty-rosters/validate-import', {
      method: 'POST',
      body: JSON.stringify({ organizationId: ORG, commit: false, rows: dutyRows }),
    });
    if (dutyDry.res.ok && dutyDry.body.valid) pass('Staff-duty import dry-run valid');
    else {
      const msg = dutyDry.body?.errors?.map((e) => `Row ${e.row}: ${e.message}`).join('; ');
      fail(`Staff-duty import dry-run: ${msg ?? dutyDry.res.status}`);
    }

    const dutyCommit = await api('/api/staff-duty-rosters/validate-import', {
      method: 'POST',
      body: JSON.stringify({ organizationId: ORG, commit: true, rows: dutyRows }),
    });
    if (dutyCommit.res.ok && (dutyCommit.body.created ?? 0) >= 1) {
      pass(`Staff-duty import commit created=${dutyCommit.body.created}`);
    } else {
      fail(`Staff-duty import commit: ${dutyCommit.body?.error ?? dutyCommit.res.status}`);
    }
    if (pool && (dutyCommit.body.created ?? 0) >= 1) {
      const pgDuty = await pgCount(
        pool,
        `SELECT COUNT(*)::text AS count FROM school_staff_duty_rosters
         WHERE organization_id = $1 AND staff_member_id = $2 AND start_time = '15:00' AND is_active = true`,
        [ORG, ids.staffMemberId],
      );
      if (pgDuty >= 1) pass('Postgres staff-duty row after bulk commit');
      else fail('Postgres staff-duty row missing after bulk commit');
    }
    const rosterList = await api(`/api/staff-duty-rosters?organizationId=${ORG}`);
    const bulkRoster = rosterList.body?.find(
      (r) => r.staffMemberId === ids.staffMemberId && r.startTime === '15:00',
    );
    if (bulkRoster?.id) {
      await api(`/api/staff-duty-rosters/${bulkRoster.id}`, { method: 'DELETE' });
      pass('Bulk staff-duty cleaned up (deactivate)');
    }
  } else {
    fail('Staff-duty bulk import skipped — missing staff/zone');
  }
}

async function main() {
  console.log(`\nSchool Management acceptance — ${BASE}${STRICT ? ' (strict DB)' : ''}\n`);

  if (STRICT) {
    if (!process.env.DATABASE_URL) fail('Strict mode requires DATABASE_URL in .env.local');
    if (process.env.SCHOOL_INTELLIGENCE_DB === '0') {
      fail('Strict mode requires SCHOOL_INTELLIGENCE_DB=1 (not 0)');
    }
    if (log.some((x) => !x.ok)) {
      console.error('\nFix env and retry.\n');
      process.exit(1);
    }
  }

  let pool = null;
  if (process.env.DATABASE_URL && process.env.SCHOOL_INTELLIGENCE_DB !== '0') {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await pool.query('SELECT 1');
      pass('Postgres connected');
    } catch (e) {
      fail(`Postgres: ${e.message}`);
      pool = null;
    }
  } else {
    if (STRICT) {
      fail('Strict mode requires DATABASE_URL — API-only checks are not enough');
    } else {
      console.warn('⚠ DATABASE_URL not set — API-only checks');
    }
  }

  const { res: statusRes, body: status } = await api('/api/school-db/status');
  if (!statusRes.ok) {
    fail(`Server not reachable at ${BASE} (${statusRes.status})`);
    console.error('\nStart dev server: npm run dev');
    process.exit(1);
  }
  pass(`school-db/status postgres.ok=${status.postgres?.ok}`);

  if (STRICT) {
    if (!status.postgres?.ok) {
      fail('Strict mode: postgres.ok must be true (run migrations, check DATABASE_URL)');
    }
    if (!status.strictDbMode) {
      fail(
        'Strict mode: server strictDbMode=false — set SCHOOL_SNAPSHOT=0 in .env.local and restart npm run dev',
      );
    } else {
      pass('strictDbMode=true (SCHOOL_SNAPSHOT=0 on server)');
    }
    if (status.snapshot?.enabled) {
      fail('Strict mode: snapshot still enabled on server');
    } else {
      pass('snapshot disabled on server');
    }
  }
  if (status.aggregator?.orphanSpatial) {
    const o = status.aggregator.orphanSpatial;
    console.log(`  orphan spatial: ${o.total} (${o.orphanZones} zones, ${o.orphanRooms} rooms)`);
  }

  if (STRICT) {
    await clearAcceptanceResidueIfPresent();
  }

  const routes = [
    '/dashboard/school-management',
    '/dashboard/school-management/master-data',
    '/dashboard/school-management/cameras',
    '/dashboard/school-management/timetable',
    '/dashboard/school-management/staff-duty',
  ];
  for (const r of routes) {
    const page = await fetch(`${BASE}${r}`);
    if (page.ok) pass(`Route ${r} → ${page.status}`);
    else fail(`Route ${r} → ${page.status}`);
  }

  // Orphan spatial dry-run
  const { res: orphanRes, body: orphan } = await api('/api/school-management/orphan-spatial');
  if (orphanRes.ok) {
    pass(`Orphan spatial preview: ${orphan.counts?.total ?? 0} row(s)`);
  } else fail('Orphan spatial preview failed');

  const demoPreview = await api(`/api/school-management/demo-cleanup?organizationId=${ORG}`);
  if (demoPreview.res.ok && demoPreview.body?.counts != null) {
    pass(`Demo cleanup preview: ${demoPreview.body.counts.total ?? 0} tagged row(s)`);
  } else {
    fail('Demo cleanup preview failed');
  }

  const demoDry = await api('/api/school-management/demo-cleanup', {
    method: 'POST',
    body: JSON.stringify({ organizationId: ORG, dryRun: true }),
  });
  if (demoDry.res.ok && demoDry.body?.dryRun === true) {
    pass('Demo cleanup POST dry-run');
  } else {
    fail('Demo cleanup POST dry-run failed');
  }

  // Setup health baseline
  const { body: healthBefore } = await api(`/api/school-management/setup-health?organizationId=${ORG}`);
  pass(`Setup health: ${healthBefore.completionPercent}% ready=${healthBefore.isReadyForPhase2}`);

  const foundationIds = await ensureFoundation(TAG);
  if (!foundationIds?.zoneId) {
    console.error('\nFoundation bootstrap failed — cannot continue CRUD/bulk tests.\n');
    if (pool) await pool.end();
    process.exit(1);
  }

  await runBulkImportTests(TAG, foundationIds, pool);
  await runNegativeValidationTests(foundationIds);

  const calDate = `2099-01-15`;
  const calBulk = await api('/api/school-calendar/bulk', {
    method: 'POST',
    body: JSON.stringify({
      days: [
        {
          organizationId: ORG,
          calendarDate: calDate,
          dayType: 'WorkingDay',
          label: `Acceptance ${TAG}`,
        },
      ],
    }),
  });
  let calendarId;
  if (calBulk.res.ok && calBulk.body?.count >= 1) {
    calendarId = calBulk.body.days?.[0]?.id;
    pass(`Calendar bulk upsert count=${calBulk.body.count}`);
    if (pool && calendarId) {
      const pgCal = await pgCount(
        pool,
        `SELECT COUNT(*)::text AS count FROM school_calendars WHERE id = $1`,
        [calendarId],
      );
      if (pgCal === 1) pass('Postgres calendar row after bulk upsert');
      else fail('Postgres calendar row missing after bulk');
    }
    const patchCal = await api(`/api/school-calendar/${calendarId}`, {
      method: 'PATCH',
      body: JSON.stringify({ label: `Patched ${TAG}` }),
    });
    if (patchCal.res.ok) pass('PATCH calendar day');
    else fail(`PATCH calendar: ${patchCal.body?.error ?? patchCal.res.status}`);
    const delCal = await api(`/api/school-calendar/${calendarId}`, { method: 'DELETE' });
    if (delCal.res.ok) pass('DELETE calendar day');
    else fail(`DELETE calendar: ${delCal.body?.error ?? delCal.res.status}`);
  } else {
    fail(`Calendar bulk: ${calBulk.body?.error ?? calBulk.res.status}`);
  }

  let cameraId;
  let timetableId;
  let rosterId;

  // Camera CRUD
  const camCode = `CAM-${TAG}`;
  const zoneId = foundationIds.zoneId;
  const roomId = foundationIds.roomId;

  let pgCamBefore = 0;
  if (pool) {
    pgCamBefore = await pgCount(
      pool,
      `SELECT COUNT(*)::text AS count FROM school_mgmt_cameras WHERE organization_id = $1 AND camera_code = $2`,
      [ORG, camCode],
    );
  }

  const createCam = await api('/api/cameras', {
    method: 'POST',
    body: JSON.stringify({
      organizationId: ORG,
      cameraCode: camCode,
      name: `Acceptance ${TAG}`,
      purpose: 'Corridor',
      processOwner: 'Compliance',
      zoneId,
      roomId: undefined,
      status: 'Active',
    }),
  });
  if (createCam.res.ok && createCam.body?.id) {
    cameraId = createCam.body.id;
    pass(`POST camera id=${cameraId}`);
  } else {
    fail(`POST camera: ${createCam.body?.error ?? createCam.res.status}`);
  }

  if (pool && cameraId) {
    const pgCamAfter = await pgCount(
      pool,
      `SELECT COUNT(*)::text AS count FROM school_mgmt_cameras WHERE id = $1`,
      [cameraId],
    );
    if (pgCamAfter === 1) pass('Postgres camera row exists after create');
    else fail('Postgres camera row missing after create');
  }

  if (cameraId) {
    const patchCam = await api(`/api/cameras/${cameraId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: `Acceptance patched ${TAG}` }),
    });
    if (patchCam.res.ok) pass('PATCH camera');
    else fail(`PATCH camera: ${patchCam.body?.error ?? patchCam.res.status}`);

    const delCam = await api(`/api/cameras/${cameraId}`, { method: 'DELETE' });
    if (delCam.res.ok && delCam.body?.status === 'Inactive') pass('DELETE camera (deactivate)');
    else fail(`DELETE camera: ${delCam.body?.error ?? delCam.res.status}`);

    if (pool) {
      const st = await pool.query(`SELECT status FROM school_mgmt_cameras WHERE id = $1`, [cameraId]);
      if (st.rows[0]?.status === 'Inactive') pass('Postgres camera status=Inactive after delete');
      else fail(`Postgres camera status=${st.rows[0]?.status}`);
    }
  }

  // Timetable CRUD
  const sectionId = foundationIds.sectionId;
  const teacherId = foundationIds.teacherId;
  const subjectId = foundationIds.subjectId;
  const roomIdTt = foundationIds.roomId;

  if (sectionId && roomIdTt) {
    const createTt = await api('/api/timetable', {
      method: 'POST',
      body: JSON.stringify({
        organizationId: ORG,
        sectionId,
        subjectId,
        roomId: roomIdTt,
        teacherId,
        periodType: 'Class',
        dayOfWeek: 1,
        startTime: '06:00',
        endTime: '06:30',
      }),
    });
    if (createTt.res.ok && createTt.body?.id) {
      timetableId = createTt.body.id;
      pass(`POST timetable id=${timetableId}`);
      const patchTt = await api(`/api/timetable/${timetableId}`, {
        method: 'PATCH',
        body: JSON.stringify({ endTime: '06:45' }),
      });
      if (patchTt.res.ok) pass('PATCH timetable');
      else fail(`PATCH timetable: ${patchTt.body?.error ?? patchTt.res.status}`);
      const delTt = await api(`/api/timetable/${timetableId}`, { method: 'DELETE' });
      if (delTt.res.ok) pass('DELETE timetable (deactivate)');
      else fail(`DELETE timetable: ${delTt.body?.error ?? delTt.res.status}`);
      if (pool) {
        const active = await pool.query(
          `SELECT is_active FROM school_timetable_entries WHERE id = $1`,
          [timetableId],
        );
        if (active.rows[0]?.is_active === false) pass('Postgres timetable is_active=false');
        else fail('Postgres timetable still active');
      }
    } else {
      fail(`POST timetable: ${createTt.body?.error ?? createTt.res.status}`);
    }
  } else {
    fail('Skip timetable — missing section/room');
  }

  // Staff duty CRUD
  const staffMemberId = foundationIds.staffMemberId;
  if (staffMemberId && zoneId) {
    const createRoster = await api('/api/staff-duty-rosters', {
      method: 'POST',
      body: JSON.stringify({
        organizationId: ORG,
        staffMemberId,
        zoneId,
        dutyType: 'Gate',
        dayOfWeek: 1,
        startTime: '06:00',
        endTime: '07:00',
        isCriticalWindow: false,
      }),
    });
    if (createRoster.res.ok && createRoster.body?.id) {
      rosterId = createRoster.body.id;
      pass(`POST staff-duty id=${rosterId}`);
      const patchRoster = await api(`/api/staff-duty-rosters/${rosterId}`, {
        method: 'PATCH',
        body: JSON.stringify({ endTime: '07:15' }),
      });
      if (patchRoster.res.ok) pass('PATCH staff-duty');
      else fail(`PATCH staff-duty: ${patchRoster.body?.error ?? patchRoster.res.status}`);
      const delRoster = await api(`/api/staff-duty-rosters/${rosterId}`, { method: 'DELETE' });
      if (delRoster.res.ok) pass('DELETE staff-duty (deactivate)');
      else fail(`DELETE staff-duty: ${delRoster.body?.error ?? delRoster.res.status}`);
      if (pool) {
        const active = await pool.query(
          `SELECT is_active FROM school_staff_duty_rosters WHERE id = $1`,
          [rosterId],
        );
        if (active.rows[0]?.is_active === false) pass('Postgres roster is_active=false');
        else fail('Postgres roster still active');
      }
    } else {
      fail(`POST staff-duty: ${createRoster.body?.error ?? createRoster.res.status}`);
    }
  } else {
    fail('Skip staff-duty — missing staff/zone');
  }

  const { body: healthAfter } = await api(`/api/school-management/setup-health?organizationId=${ORG}`);
  if (
    healthAfter.completionPercent === healthBefore.completionPercent &&
    Boolean(healthAfter.isReadyForPhase2) === Boolean(healthBefore.isReadyForPhase2)
  ) {
    pass('Setup health stable after acceptance CRUD');
  } else {
    console.log('  health before:', healthBefore.completionPercent, healthBefore.isReadyForPhase2);
    console.log('  health after:', healthAfter.completionPercent, healthAfter.isReadyForPhase2);
    pass('Setup health changed (review if expected)');
  }

  if (pool && STRICT) await verifySetupHealthMatchesPg(pool);

  if (pool) await pool.end();

  const failed = log.filter((x) => !x.ok).length;
  console.log(`\n${log.length - failed}/${log.length} checks passed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
