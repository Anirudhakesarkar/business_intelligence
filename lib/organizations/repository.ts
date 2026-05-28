import { generateOrganizationCode } from "./codegen";
import { ListOrganizationsQuery, OrganizationRecord, OrganizationStatus } from "./types";
import { normalizeOrganizationInput, validateOrganizationInput } from "../validations/organization.schema";

const organizations: OrganizationRecord[] = [];
let nextId = 1;

function now() {
  return new Date().toISOString();
}

function isCodeTaken(code: string, ignoreId?: number): boolean {
  return organizations.some((o) => !o.is_deleted && o.organization_code === code && o.id !== ignoreId);
}

export function listOrganizations(query: ListOrganizationsQuery) {
  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
  const search = (query.search ?? "").toLowerCase().trim();

  const filtered = organizations.filter((o) => {
    if (o.is_deleted) return false;
    if (search && !(o.organization_name.toLowerCase().includes(search) || o.organization_code.toLowerCase().includes(search))) return false;
    if (query.industryType && o.industry_type !== query.industryType) return false;
    if (query.businessType && o.business_type !== query.businessType) return false;
    if (query.status && o.organization_status !== query.status) return false;
    if (query.city && o.city.toLowerCase() !== query.city.toLowerCase()) return false;
    if (query.state && o.state.toLowerCase() !== query.state.toLowerCase()) return false;
    return true;
  });

  return {
    data: filtered.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, pageSize, total: filtered.length }
  };
}

export function getOrganizationById(id: number) {
  return organizations.find((o) => o.id === id && !o.is_deleted) ?? null;
}

export function createOrganization(input: Partial<OrganizationRecord>, actorId: number | null = null) {
  const normalized = normalizeOrganizationInput(input);
  const errors = validateOrganizationInput(normalized);
  if (errors.length) return { ok: false as const, errors };

  const code = normalized.organization_code?.trim().length
    ? normalized.organization_code
    : generateOrganizationCode(normalized.organization_name!, organizations);

  if (isCodeTaken(code)) {
    return { ok: false as const, errors: [{ field: "organization_code", message: "Organization Code already exists." }] };
  }

  const record: OrganizationRecord = {
    id: nextId++,
    organization_name: normalized.organization_name!,
    organization_code: code,
    industry_type: normalized.industry_type as OrganizationRecord["industry_type"],
    business_type: (normalized.business_type as OrganizationRecord["business_type"]) ?? null,
    website: normalized.website ?? null,
    registered_address: normalized.registered_address!,
    city: normalized.city!,
    state: normalized.state!,
    country: normalized.country || "India",
    pincode: normalized.pincode!,
    gst_number: normalized.gst_number ?? null,
    pan_number: normalized.pan_number ?? null,
    primary_contact_name: normalized.primary_contact_name!,
    primary_contact_mobile: normalized.primary_contact_mobile!,
    primary_contact_email: normalized.primary_contact_email!,
    billing_contact_name: normalized.billing_contact_name ?? null,
    billing_contact_mobile: normalized.billing_contact_mobile ?? null,
    billing_contact_email: normalized.billing_contact_email ?? null,
    organization_status: (normalized.organization_status as OrganizationStatus) ?? "Draft",
    remarks: normalized.remarks ?? null,
    is_active: true,
    is_deleted: false,
    created_at: now(),
    created_by: actorId,
    updated_at: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null
  };

  organizations.push(record);
  return { ok: true as const, data: record };
}

export function updateOrganization(id: number, input: Partial<OrganizationRecord>, actorId: number | null = null, canEditCode = false) {
  const existing = getOrganizationById(id);
  if (!existing) return { ok: false as const, errors: [{ field: "id", message: "Organization not found." }] };

  if (existing.is_deleted) return { ok: false as const, errors: [{ field: "id", message: "Cannot edit deleted organization." }] };

  const normalized = normalizeOrganizationInput(input);
  const merged = { ...existing, ...normalized };
  if (!canEditCode) merged.organization_code = existing.organization_code;
  const errors = validateOrganizationInput(merged);
  if (errors.length) return { ok: false as const, errors };

  if (merged.organization_code !== existing.organization_code && isCodeTaken(merged.organization_code, id)) {
    return { ok: false as const, errors: [{ field: "organization_code", message: "Organization Code already exists." }] };
  }

  Object.assign(existing, merged, { updated_at: now(), updated_by: actorId });
  return { ok: true as const, data: existing };
}

export function updateOrganizationStatus(id: number, status: OrganizationStatus, actorId: number | null = null) {
  const existing = getOrganizationById(id);
  if (!existing) return { ok: false as const, errors: [{ field: "id", message: "Organization not found." }] };
  existing.organization_status = status;
  existing.is_active = status === "Active";
  existing.updated_at = now();
  existing.updated_by = actorId;
  return { ok: true as const, data: existing };
}

export function softDeleteOrganization(id: number, actorId: number | null = null) {
  const existing = getOrganizationById(id);
  if (!existing) return { ok: false as const, errors: [{ field: "id", message: "Organization not found." }] };
  existing.is_deleted = true;
  existing.is_active = false;
  existing.organization_status = "Inactive";
  existing.deleted_at = now();
  existing.deleted_by = actorId;
  existing.updated_at = now();
  existing.updated_by = actorId;
  return { ok: true as const, data: existing };
}
