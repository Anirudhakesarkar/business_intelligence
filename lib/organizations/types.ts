export const INDUSTRY_TYPES = [
  "School",
  "Factory",
  "Society",
  "Hospital",
  "Retail",
  "Corporate",
  "Government"
] as const;

export const BUSINESS_TYPES = [
  "Single Site",
  "Multi Site",
  "Enterprise"
] as const;

export const ORGANIZATION_STATUSES = [
  "Draft",
  "Active",
  "On Hold",
  "Suspended",
  "Inactive"
] as const;

export type IndustryType = (typeof INDUSTRY_TYPES)[number];
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export type OrganizationRecord = {
  id: number;
  organization_name: string;
  organization_code: string;
  industry_type: IndustryType;
  business_type: BusinessType | null;
  website: string | null;
  registered_address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  gst_number: string | null;
  pan_number: string | null;
  primary_contact_name: string;
  primary_contact_mobile: string;
  primary_contact_email: string;
  billing_contact_name: string | null;
  billing_contact_mobile: string | null;
  billing_contact_email: string | null;
  organization_status: OrganizationStatus;
  remarks: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  created_by: number | null;
  updated_at: string | null;
  updated_by: number | null;
  deleted_at: string | null;
  deleted_by: number | null;
};

export type ListOrganizationsQuery = {
  search?: string;
  industryType?: string;
  businessType?: string;
  status?: string;
  city?: string;
  state?: string;
  page?: number;
  pageSize?: number;
};
