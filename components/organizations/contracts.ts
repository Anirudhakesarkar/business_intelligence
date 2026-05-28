import { ORGANIZATION_STATUSES, type Organization, type OrganizationListResponse } from './types';

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asNullableString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asStatus(v: unknown) {
  return ORGANIZATION_STATUSES.includes(v as never) ? (v as Organization['organization_status']) : 'Draft';
}

export function parseOrganization(input: unknown): Organization {
  if (!isObj(input)) {
    throw new Error('Invalid organization payload');
  }

  return {
    id: asString(input.id),
    organization_name: asString(input.organization_name),
    organization_code: asString(input.organization_code),
    industry_type: asString(input.industry_type) as Organization['industry_type'],
    business_type: (input.business_type ?? null) as Organization['business_type'],
    website: asNullableString(input.website),
    registered_address: asString(input.registered_address),
    city: asString(input.city),
    state: asString(input.state),
    country: asString(input.country),
    pincode: asString(input.pincode),
    gst_number: asNullableString(input.gst_number),
    pan_number: asNullableString(input.pan_number),
    primary_contact_name: asString(input.primary_contact_name),
    primary_contact_mobile: asString(input.primary_contact_mobile),
    primary_contact_email: asString(input.primary_contact_email),
    billing_contact_name: asNullableString(input.billing_contact_name),
    billing_contact_mobile: asNullableString(input.billing_contact_mobile),
    billing_contact_email: asNullableString(input.billing_contact_email),
    organization_status: asStatus(input.organization_status),
    remarks: asNullableString(input.remarks),
    is_active: asBool(input.is_active, true),
    is_deleted: asBool(input.is_deleted, false),
    created_at: asString(input.created_at),
    created_by: asNullableString(input.created_by),
    updated_at: asNullableString(input.updated_at),
    updated_by: asNullableString(input.updated_by),
    deleted_at: asNullableString(input.deleted_at),
    deleted_by: asNullableString(input.deleted_by),
  };
}

export function parseOrganizationListResponse(input: unknown): OrganizationListResponse {
  if (!isObj(input)) {
    throw new Error('Invalid organizations list response');
  }

  const rawList = Array.isArray(input.data) ? input.data : [];
  const pagination = isObj(input.pagination) ? input.pagination : {};

  return {
    ok: input.ok === true,
    data: rawList.map(parseOrganization),
    pagination: {
      page: Number(pagination.page ?? 1),
      pageSize: Number(pagination.pageSize ?? 20),
      total: Number(pagination.total ?? rawList.length),
    },
  };
}

export function parseOrganizationItemResponse(input: unknown): { ok: boolean; organization: Organization } {
  if (!isObj(input) || !isObj(input.organization)) {
    throw new Error('Invalid organization detail response');
  }

  return {
    ok: input.ok === true,
    organization: parseOrganization(input.organization),
  };
}
