export const SITE_TYPES = [
  'School / Campus',
  'Residential Society',
  'Factory / Manufacturing Plant',
  'Warehouse / Logistics',
  'Hospital',
  'Retail / Mall',
  'Office / Commercial Building',
  'Hotel / Hospitality',
  'Government / Public Facility',
  'Parking Area',
  'Outdoor Zone',
  'Other',
] as const;

export const SITE_STATUSES = [
  'Draft',
  'Survey Pending',
  'Installation Pending',
  'Edge Setup Pending',
  'Camera Mapping Pending',
  'AI Configuration Pending',
  'User Training Pending',
  'Live',
  'On Hold',
  'Inactive',
] as const;

export const SITE_DOCUMENT_TYPES = [
  'Site Layout / Floor Plan',
  'Site Survey Document',
  'Network Diagram',
  'Installation Photos',
  'Other Documents',
] as const;

export type SiteStatus = (typeof SITE_STATUSES)[number];

export type SiteRecord = {
  id: string;
  organization_id: string;
  organization_name?: string;
  site_name: string;
  site_code: string;
  site_type: string;
  site_status: SiteStatus;
  site_address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  google_map_link: string | null;
  latitude: number | null;
  longitude: number | null;
  site_contact_name: string;
  site_contact_mobile: string;
  site_contact_email: string | null;
  building_count: number | null;
  floor_count: number | null;
  expected_camera_count: number | null;
  remarks: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string | null;
};

export type SiteDocument = {
  id: string;
  site_id: string;
  organization_id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  file_mime_type: string | null;
  file_size_bytes: number | null;
  remarks: string | null;
  uploaded_at: string;
};
