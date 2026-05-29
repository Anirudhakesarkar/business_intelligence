import { dbQuery, isDbEnabled } from '../school-db/pool';
import type { ListOrganizationsQuery, OrganizationRecord } from './types';

function rowToOrg(r: Record<string, unknown>): OrganizationRecord {
  const id = Number(r.id);
  const name = String(r.name ?? r.organization_name ?? '');
  return {
    id,
    organization_name: name,
    organization_code: String(r.organization_code ?? `ORG-${id}`),
    industry_type: String(r.industry_type ?? 'School') as OrganizationRecord['industry_type'],
    business_type: (r.business_type as OrganizationRecord['business_type']) ?? null,
    website: r.website != null ? String(r.website) : null,
    registered_address: String(r.registered_address ?? name),
    city: String(r.city ?? ''),
    state: String(r.state ?? ''),
    country: String(r.country ?? 'India'),
    pincode: String(r.pincode ?? ''),
    gst_number: r.gst_number != null ? String(r.gst_number) : null,
    pan_number: r.pan_number != null ? String(r.pan_number) : null,
    primary_contact_name: String(r.primary_contact_name ?? 'Contact'),
    primary_contact_mobile: String(r.primary_contact_mobile ?? ''),
    primary_contact_email: String(r.primary_contact_email ?? ''),
    billing_contact_name: r.billing_contact_name != null ? String(r.billing_contact_name) : null,
    billing_contact_mobile: r.billing_contact_mobile != null ? String(r.billing_contact_mobile) : null,
    billing_contact_email: r.billing_contact_email != null ? String(r.billing_contact_email) : null,
    organization_status: String(r.organization_status ?? r.status ?? 'Active') as OrganizationRecord['organization_status'],
    remarks: r.remarks != null ? String(r.remarks) : null,
    is_active: r.is_active !== false,
    is_deleted: r.is_deleted === true,
    created_at:
      r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? new Date().toISOString()),
    created_by: r.created_by != null ? Number(r.created_by) : null,
    updated_at:
      r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at ? String(r.updated_at) : null,
    updated_by: r.updated_by != null ? Number(r.updated_by) : null,
    deleted_at:
      r.deleted_at instanceof Date ? r.deleted_at.toISOString() : r.deleted_at ? String(r.deleted_at) : null,
    deleted_by: r.deleted_by != null ? Number(r.deleted_by) : null,
  };
}

export async function listOrganizationsFromPg(query: ListOrganizationsQuery) {
  if (!isDbEnabled()) return null;

  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
  const search = (query.search ?? '').toLowerCase().trim();

  const params: unknown[] = [];
  const clauses = ['COALESCE(is_deleted, false) = false'];

  if (search) {
    params.push(`%${search}%`);
    clauses.push(
      `(LOWER(name) LIKE $${params.length} OR LOWER(COALESCE(organization_code, '')) LIKE $${params.length})`,
    );
  }
  if (query.industryType) {
    params.push(query.industryType);
    clauses.push(`industry_type = $${params.length}`);
  }
  if (query.businessType) {
    params.push(query.businessType);
    clauses.push(`business_type = $${params.length}`);
  }
  if (query.status) {
    params.push(query.status);
    clauses.push(`COALESCE(organization_status, status) = $${params.length}`);
  }
  if (query.city) {
    params.push(query.city);
    clauses.push(`LOWER(city) = LOWER($${params.length})`);
  }
  if (query.state) {
    params.push(query.state);
    clauses.push(`LOWER(state) = LOWER($${params.length})`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const countR = await dbQuery<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM organizations ${where}`,
    params,
  );
  const total = Number(countR?.rows?.[0]?.count ?? 0);

  params.push(pageSize, (page - 1) * pageSize);
  const dataR = await dbQuery<Record<string, unknown>>(
    `SELECT * FROM organizations ${where}
     ORDER BY name ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    data: (dataR?.rows ?? []).map(rowToOrg),
    pagination: { page, pageSize, total },
  };
}
