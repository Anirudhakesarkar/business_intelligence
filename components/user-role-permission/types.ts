export const USER_STATUSES = ['Invited','Active','Inactive','Suspended'] as const;
export const DEPARTMENTS = ['Management','Security','Operations','Maintenance','Admin','IT','HR','Compliance','Support','Other'] as const;
export const LOGIN_PLATFORMS = ['Web Dashboard','Mobile App','Both Web & Mobile','No Login'] as const;
export const ROLE_CODES = ['ROLE_ORG_ADMIN','ROLE_SITE_ADMIN','ROLE_OPERATOR','ROLE_VIEWER'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type RoleRecord = { id: string; role_name: string; role_code: string; role_level: string; role_status: string; is_system_role: boolean; };
export type PermissionRecord = { id: string; permission_name: string; permission_key: string; permission_group: string; permission_status: string; };
export type UserRecord = {
  id: string;
  organization_id: string;
  organization_name?: string;
  full_name: string;
  email: string;
  mobile: string;
  department: string | null;
  user_status: UserStatus;
  login_allowed: boolean;
  role_id: string | null;
  role_name: string | null;
  assigned_sites: Array<{site_id:string; site_name:string}>;
};
