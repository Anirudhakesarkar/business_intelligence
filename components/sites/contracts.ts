import { SITE_STATUSES, type SiteDocument, type SiteRecord } from './types';

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

const asStr = (v: unknown) => (typeof v === 'string' ? v : '');
const asNullableStr = (v: unknown) => (typeof v === 'string' ? v : null);
const asNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const asBool = (v: unknown, fallback = false) => (typeof v === 'boolean' ? v : fallback);

export function parseSite(input: unknown): SiteRecord {
  if (!isObj(input)) throw new Error('Invalid site payload');
  const statusRaw = asStr(input.site_status);
  const status = SITE_STATUSES.includes(statusRaw as never) ? (statusRaw as SiteRecord['site_status']) : 'Draft';
  return {
    id: asStr(input.id),
    organization_id: asStr(input.organization_id),
    organization_name: asStr(input.organization_name) || undefined,
    site_name: asStr(input.site_name),
    site_code: asStr(input.site_code),
    site_type: asStr(input.site_type),
    site_status: status,
    site_address: asStr(input.site_address),
    city: asStr(input.city),
    state: asStr(input.state),
    country: asStr(input.country) || 'India',
    pincode: asStr(input.pincode),
    google_map_link: asNullableStr(input.google_map_link),
    latitude: asNum(input.latitude),
    longitude: asNum(input.longitude),
    site_contact_name: asStr(input.site_contact_name),
    site_contact_mobile: asStr(input.site_contact_mobile),
    site_contact_email: asNullableStr(input.site_contact_email),
    building_count: asNum(input.building_count),
    floor_count: asNum(input.floor_count),
    expected_camera_count: asNum(input.expected_camera_count),
    remarks: asNullableStr(input.remarks),
    is_active: asBool(input.is_active, true),
    is_deleted: asBool(input.is_deleted, false),
    created_at: asStr(input.created_at),
    updated_at: asNullableStr(input.updated_at),
  };
}

export function parseSitesList(input: unknown) {
  if (!isObj(input)) throw new Error('Invalid sites list response');
  const arr = Array.isArray(input.data) ? input.data : [];
  const pagination = isObj(input.pagination) ? input.pagination : {};
  return {
    ok: input.ok === true,
    data: arr.map(parseSite),
    pagination: {
      page: Number(pagination.page ?? 1),
      pageSize: Number(pagination.pageSize ?? 20),
      total: Number(pagination.total ?? arr.length),
    },
  };
}

export function parseSiteDetail(input: unknown) {
  if (!isObj(input) || !isObj(input.site)) throw new Error('Invalid site detail response');
  return { ok: input.ok === true, site: parseSite(input.site) };
}

export function parseSiteDocuments(input: unknown): { ok: boolean; documents: SiteDocument[] } {
  if (!isObj(input)) throw new Error('Invalid site documents response');
  const arr = Array.isArray(input.documents) ? input.documents : [];
  const docs: SiteDocument[] = arr.map((d) => {
    if (!isObj(d)) throw new Error('Invalid site document item');
    return {
      id: asStr(d.id),
      site_id: asStr(d.site_id),
      organization_id: asStr(d.organization_id),
      document_type: asStr(d.document_type),
      file_name: asStr(d.file_name),
      file_url: asStr(d.file_url),
      file_mime_type: asNullableStr(d.file_mime_type),
      file_size_bytes: asNum(d.file_size_bytes),
      remarks: asNullableStr(d.remarks),
      uploaded_at: asStr(d.uploaded_at),
    };
  });
  return { ok: input.ok === true, documents: docs };
}
