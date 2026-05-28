export default function DashboardHomePage() {
  if (typeof window !== 'undefined') {
    window.location.href = '/dashboard/school-management';
  }
  return null;
}
