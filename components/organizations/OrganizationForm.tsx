'use client';

import { BUSINESS_TYPES, INDUSTRY_TYPES, ORGANIZATION_STATUSES, type Organization, type OrganizationStatus } from './types';

export type OrganizationFormValues = {
  organization_name: string;
  organization_code: string;
  industry_type: string;
  business_type: string;
  website: string;
  registered_address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  gst_number: string;
  pan_number: string;
  primary_contact_name: string;
  primary_contact_mobile: string;
  primary_contact_email: string;
  billing_contact_name: string;
  billing_contact_mobile: string;
  billing_contact_email: string;
  organization_status: OrganizationStatus;
  remarks: string;
};

export const emptyOrganizationForm: OrganizationFormValues = {
  organization_name: '',
  organization_code: '',
  industry_type: '',
  business_type: '',
  website: '',
  registered_address: '',
  city: '',
  state: '',
  country: 'India',
  pincode: '',
  gst_number: '',
  pan_number: '',
  primary_contact_name: '',
  primary_contact_mobile: '',
  primary_contact_email: '',
  billing_contact_name: '',
  billing_contact_mobile: '',
  billing_contact_email: '',
  organization_status: 'Draft',
  remarks: '',
};

export function mapOrganizationToForm(org: Organization): OrganizationFormValues {
  return {
    organization_name: org.organization_name ?? '',
    organization_code: org.organization_code ?? '',
    industry_type: org.industry_type ?? '',
    business_type: org.business_type ?? '',
    website: org.website ?? '',
    registered_address: org.registered_address ?? '',
    city: org.city ?? '',
    state: org.state ?? '',
    country: org.country ?? 'India',
    pincode: org.pincode ?? '',
    gst_number: org.gst_number ?? '',
    pan_number: org.pan_number ?? '',
    primary_contact_name: org.primary_contact_name ?? '',
    primary_contact_mobile: org.primary_contact_mobile ?? '',
    primary_contact_email: org.primary_contact_email ?? '',
    billing_contact_name: org.billing_contact_name ?? '',
    billing_contact_mobile: org.billing_contact_mobile ?? '',
    billing_contact_email: org.billing_contact_email ?? '',
    organization_status: org.organization_status ?? 'Draft',
    remarks: org.remarks ?? '',
  };
}

export function OrganizationForm({
  values,
  errors,
  onChange,
  onSubmit,
  submitLabel,
  disableCodeEdit = false,
  saving = false,
}: {
  values: OrganizationFormValues;
  errors: Record<string, string>;
  onChange: (name: keyof OrganizationFormValues, value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  submitLabel: string;
  disableCodeEdit?: boolean;
  saving?: boolean;
}) {
  const inputCls =
    'mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  const renderError = (name: string) =>
    errors[name] ? <p className="mt-1 text-xs text-red-400">{errors[name]}</p> : null;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-base font-semibold text-slate-100">Basic Organization Details</h2>
        <div>
          <label className="text-sm text-slate-300">Organization Name *</label>
          <input className={inputCls} value={values.organization_name} onChange={(e) => onChange('organization_name', e.target.value)} />
          {renderError('organization_name')}
        </div>
        <div>
          <label className="text-sm text-slate-300">Organization Code *</label>
          <input className={inputCls} value={values.organization_code} disabled={disableCodeEdit} onChange={(e) => onChange('organization_code', e.target.value.toUpperCase())} />
          {renderError('organization_code')}
        </div>
        <div>
          <label className="text-sm text-slate-300">Industry Type *</label>
          <select className={inputCls} value={values.industry_type} onChange={(e) => onChange('industry_type', e.target.value)}>
            <option value="">Select industry</option>
            {INDUSTRY_TYPES.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
          {renderError('industry_type')}
        </div>
        <div>
          <label className="text-sm text-slate-300">Business Type</label>
          <select className={inputCls} value={values.business_type} onChange={(e) => onChange('business_type', e.target.value)}>
            <option value="">Select business type</option>
            {BUSINESS_TYPES.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-300">Website</label>
          <input className={inputCls} value={values.website} onChange={(e) => onChange('website', e.target.value)} />
          {renderError('website')}
        </div>
        <div>
          <label className="text-sm text-slate-300">Organization Status *</label>
          <select className={inputCls} value={values.organization_status} onChange={(e) => onChange('organization_status', e.target.value)}>
            {ORGANIZATION_STATUSES.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-base font-semibold text-slate-100">Registered Address</h2>
        <div className="sm:col-span-2">
          <label className="text-sm text-slate-300">Registered Address *</label>
          <textarea className={inputCls} value={values.registered_address} onChange={(e) => onChange('registered_address', e.target.value)} />
          {renderError('registered_address')}
        </div>
        {['city','state','country','pincode'].map((f)=>(
          <div key={f}>
            <label className="text-sm capitalize text-slate-300">{f} *</label>
            <input className={inputCls} value={values[f as keyof OrganizationFormValues] as string} onChange={(e)=>onChange(f as keyof OrganizationFormValues,e.target.value)} />
            {renderError(f)}
          </div>
        ))}
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-base font-semibold text-slate-100">Legal / Billing Identity</h2>
        <div>
          <label className="text-sm text-slate-300">GST Number</label>
          <input className={inputCls} value={values.gst_number} onChange={(e) => onChange('gst_number', e.target.value.toUpperCase())} />
          {renderError('gst_number')}
        </div>
        <div>
          <label className="text-sm text-slate-300">PAN Number</label>
          <input className={inputCls} value={values.pan_number} onChange={(e) => onChange('pan_number', e.target.value.toUpperCase())} />
          {renderError('pan_number')}
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4 sm:grid-cols-3">
        <h2 className="sm:col-span-3 text-base font-semibold text-slate-100">Primary Contact Details</h2>
        <div>
          <label className="text-sm text-slate-300">Primary Contact Name *</label>
          <input className={inputCls} value={values.primary_contact_name} onChange={(e) => onChange('primary_contact_name', e.target.value)} />
          {renderError('primary_contact_name')}
        </div>
        <div>
          <label className="text-sm text-slate-300">Primary Contact Mobile *</label>
          <input className={inputCls} value={values.primary_contact_mobile} onChange={(e) => onChange('primary_contact_mobile', e.target.value)} />
          {renderError('primary_contact_mobile')}
        </div>
        <div>
          <label className="text-sm text-slate-300">Primary Contact Email *</label>
          <input className={inputCls} value={values.primary_contact_email} onChange={(e) => onChange('primary_contact_email', e.target.value)} />
          {renderError('primary_contact_email')}
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4 sm:grid-cols-3">
        <h2 className="sm:col-span-3 text-base font-semibold text-slate-100">Billing Contact Details</h2>
        <div>
          <label className="text-sm text-slate-300">Billing Contact Name</label>
          <input className={inputCls} value={values.billing_contact_name} onChange={(e) => onChange('billing_contact_name', e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-slate-300">Billing Contact Mobile</label>
          <input className={inputCls} value={values.billing_contact_mobile} onChange={(e) => onChange('billing_contact_mobile', e.target.value)} />
          {renderError('billing_contact_mobile')}
        </div>
        <div>
          <label className="text-sm text-slate-300">Billing Contact Email</label>
          <input className={inputCls} value={values.billing_contact_email} onChange={(e) => onChange('billing_contact_email', e.target.value)} />
          {renderError('billing_contact_email')}
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-base font-semibold text-slate-100">Internal Notes</h2>
        <label className="mt-3 block text-sm text-slate-300">Remarks</label>
        <textarea className={inputCls} value={values.remarks} onChange={(e) => onChange('remarks', e.target.value)} />
      </section>

      <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
        {saving ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
