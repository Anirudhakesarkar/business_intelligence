import {
  BUSINESS_TYPES,
  INDUSTRY_TYPES,
  ORGANIZATION_STATUSES,
  OrganizationRecord
} from "../organizations/types";

export type ValidationIssue = { field: string; message: string };

export type OrganizationInput = Partial<OrganizationRecord> & {
  organization_name?: string;
  organization_code?: string;
};

const MOBILE_RE = /^[6-9][0-9]{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const toStr = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function normalizeOrganizationInput(input: OrganizationInput): OrganizationInput {
  return {
    ...input,
    organization_name: toStr(input.organization_name),
    organization_code: toStr(input.organization_code).toUpperCase(),
    primary_contact_email: toStr(input.primary_contact_email).toLowerCase(),
    billing_contact_email: toStr(input.billing_contact_email).toLowerCase(),
    pan_number: toStr(input.pan_number).toUpperCase(),
    gst_number: toStr(input.gst_number).toUpperCase()
  };
}

export function validateOrganizationInput(input: OrganizationInput): ValidationIssue[] {
  const i = normalizeOrganizationInput(input);
  const errors: ValidationIssue[] = [];

  const req = (field: keyof OrganizationInput, label: string) => {
    if (!toStr(i[field]).length) errors.push({ field: String(field), message: `${label} is required.` });
  };

  req("organization_name", "Organization Name");
  req("industry_type", "Industry Type");
  req("registered_address", "Registered Address");
  req("city", "City");
  req("state", "State");
  req("country", "Country");
  req("pincode", "Pincode");
  req("primary_contact_name", "Primary Contact Name");
  req("primary_contact_mobile", "Primary Contact Mobile");
  req("primary_contact_email", "Primary Contact Email");
  req("organization_status", "Organization Status");

  if (toStr(i.organization_name).length < 2 || toStr(i.organization_name).length > 200) {
    errors.push({ field: "organization_name", message: "Organization Name must be 2-200 characters." });
  }

  if (i.organization_code && toStr(i.organization_code).length > 50) {
    errors.push({ field: "organization_code", message: "Organization Code must be <= 50 characters." });
  }

  if (i.industry_type && !INDUSTRY_TYPES.includes(i.industry_type as (typeof INDUSTRY_TYPES)[number])) {
    errors.push({ field: "industry_type", message: "Invalid Industry Type." });
  }
  if (i.business_type && !BUSINESS_TYPES.includes(i.business_type as (typeof BUSINESS_TYPES)[number])) {
    errors.push({ field: "business_type", message: "Invalid Business Type." });
  }
  if (i.organization_status && !ORGANIZATION_STATUSES.includes(i.organization_status as (typeof ORGANIZATION_STATUSES)[number])) {
    errors.push({ field: "organization_status", message: "Invalid Organization Status." });
  }

  if (i.website) {
    try {
      new URL(i.website);
    } catch {
      errors.push({ field: "website", message: "Website must be a valid URL." });
    }
  }

  if (toStr(i.primary_contact_mobile) && !MOBILE_RE.test(toStr(i.primary_contact_mobile))) {
    errors.push({ field: "primary_contact_mobile", message: "Invalid primary mobile format." });
  }
  if (i.billing_contact_mobile && !MOBILE_RE.test(toStr(i.billing_contact_mobile))) {
    errors.push({ field: "billing_contact_mobile", message: "Invalid billing mobile format." });
  }
  if (toStr(i.primary_contact_email) && !EMAIL_RE.test(toStr(i.primary_contact_email))) {
    errors.push({ field: "primary_contact_email", message: "Invalid primary email." });
  }
  if (i.billing_contact_email && !EMAIL_RE.test(toStr(i.billing_contact_email))) {
    errors.push({ field: "billing_contact_email", message: "Invalid billing email." });
  }
  if (i.pan_number && !PAN_RE.test(toStr(i.pan_number))) {
    errors.push({ field: "pan_number", message: "Invalid PAN format." });
  }
  if (i.gst_number && !GST_RE.test(toStr(i.gst_number))) {
    errors.push({ field: "gst_number", message: "Invalid GST format." });
  }

  return errors;
}
