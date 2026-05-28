import { dailyDb } from '../school-daily-summaries/store';
import { dbQuery, isDbEnabled } from './pool';

async function deleteOrgDate(table: string, organizationId: number, date: string) {
  await dbQuery(`DELETE FROM ${table} WHERE organization_id = $1 AND summary_date = $2`, [organizationId, date]);
}

/** Persist in-memory daily summary rows to Postgres after aggregateDay. */
export async function persistDailyAggregation(organizationId: number, date: string) {
  if (!isDbEnabled()) return;
  const match = <T extends { organizationId: number; summaryDate: string }>(rows: T[]) =>
    rows.filter((r) => r.organizationId === organizationId && r.summaryDate === date);

  await deleteOrgDate('school_teacher_daily_intelligence', organizationId, date);
  await deleteOrgDate('school_classroom_daily_intelligence', organizationId, date);
  await deleteOrgDate('school_student_occupancy_daily', organizationId, date);
  await deleteOrgDate('school_process_daily_intelligence', organizationId, date);
  await deleteOrgDate('school_staff_deployment_daily', organizationId, date);
  await deleteOrgDate('school_space_utilization_daily', organizationId, date);
  await deleteOrgDate('school_discipline_daily_intelligence', organizationId, date);
  await deleteOrgDate('school_parent_experience_daily', organizationId, date);
  await deleteOrgDate('school_compliance_daily_intelligence', organizationId, date);
  await deleteOrgDate('school_daily_score_inputs', organizationId, date);

  for (const r of match(dailyDb.teacher())) {
    await dbQuery(
      `INSERT INTO school_teacher_daily_intelligence (organization_id, site_id, summary_date, teacher_id, metrics, facts)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
      [r.organizationId, r.siteId ?? null, r.summaryDate, r.teacherId ?? null, JSON.stringify(r.metrics), JSON.stringify(r.facts)]
    );
  }
  for (const r of match(dailyDb.classroom())) {
    await dbQuery(
      `INSERT INTO school_classroom_daily_intelligence (organization_id, site_id, summary_date, room_id, metrics, facts)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
      [r.organizationId, r.siteId ?? null, r.summaryDate, r.roomId ?? null, JSON.stringify(r.metrics), JSON.stringify(r.facts)]
    );
  }
  for (const r of match(dailyDb.occupancy())) {
    await dbQuery(
      `INSERT INTO school_student_occupancy_daily (organization_id, site_id, summary_date, room_id, metrics, facts)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
      [r.organizationId, r.siteId ?? null, r.summaryDate, r.roomId ?? null, JSON.stringify(r.metrics), JSON.stringify(r.facts)]
    );
  }
  for (const r of match(dailyDb.process())) {
    await dbQuery(
      `INSERT INTO school_process_daily_intelligence (organization_id, site_id, summary_date, time_window, metrics, facts)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
      [r.organizationId, r.siteId ?? null, r.summaryDate, (r as { timeWindow?: string }).timeWindow ?? null, JSON.stringify(r.metrics), JSON.stringify(r.facts)]
    );
  }
  for (const r of match(dailyDb.staff())) {
    await dbQuery(
      `INSERT INTO school_staff_deployment_daily (organization_id, site_id, summary_date, zone_id, duty_role, metrics, facts)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
      [r.organizationId, r.siteId ?? null, r.summaryDate, (r as { zoneId?: number }).zoneId ?? null, (r as { dutyRole?: string }).dutyRole ?? null, JSON.stringify(r.metrics), JSON.stringify(r.facts)]
    );
  }
  for (const r of match(dailyDb.space())) {
    await dbQuery(
      `INSERT INTO school_space_utilization_daily (organization_id, site_id, summary_date, room_id, metrics, facts)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
      [r.organizationId, r.siteId ?? null, r.summaryDate, r.roomId ?? null, JSON.stringify(r.metrics), JSON.stringify(r.facts)]
    );
  }
  for (const r of match(dailyDb.discipline())) {
    await dbQuery(
      `INSERT INTO school_discipline_daily_intelligence (organization_id, site_id, summary_date, zone_id, metrics, facts)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
      [r.organizationId, r.siteId ?? null, r.summaryDate, (r as { zoneId?: number }).zoneId ?? null, JSON.stringify(r.metrics), JSON.stringify(r.facts)]
    );
  }
  for (const r of match(dailyDb.parent())) {
    await dbQuery(
      `INSERT INTO school_parent_experience_daily (organization_id, site_id, summary_date, metrics, facts)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)`,
      [r.organizationId, r.siteId ?? null, r.summaryDate, JSON.stringify(r.metrics), JSON.stringify(r.facts)]
    );
  }
  for (const r of match(dailyDb.compliance())) {
    await dbQuery(
      `INSERT INTO school_compliance_daily_intelligence (organization_id, site_id, summary_date, metrics, facts)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)`,
      [r.organizationId, r.siteId ?? null, r.summaryDate, JSON.stringify(r.metrics), JSON.stringify(r.facts)]
    );
  }
  for (const r of match(dailyDb.scoreInputs())) {
    await dbQuery(
      `INSERT INTO school_daily_score_inputs (organization_id, site_id, summary_date, inputs_json, facts)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)`,
      [r.organizationId, r.siteId ?? null, r.summaryDate, JSON.stringify(r.inputsJson), JSON.stringify(r.facts)]
    );
  }
}
