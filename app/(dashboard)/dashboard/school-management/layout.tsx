import { SchoolManagementShell } from '@/components/school-management/SchoolManagementShell';

export default function SchoolManagementLayout({ children }: { children: React.ReactNode }) {
  return <SchoolManagementShell>{children}</SchoolManagementShell>;
}
