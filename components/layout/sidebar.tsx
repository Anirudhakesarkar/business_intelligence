'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Monitor, ShieldAlert, Search, BarChart3,
  Server, Brain, Plug, Wrench,
  Video, ChevronRight, X,
  BrainCircuit, GraduationCap, School,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';

type SubItem = { href: string; label: string };

type NavSection = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  items: SubItem[];
};

const navSections: NavSection[] = [
  {
    id: 'command-center',
    label: '1. System Overview',
    icon: LayoutDashboard,
    items: [
      { href: '/dashboard', label: 'Global Dashboard' },
      { href: '/dashboard/command-center/sla-board', label: 'SLA / Response Board' },
      { href: '/dashboard/command-center/health-telemetry', label: 'AI Server Health' },
      { href: '/dashboard/command-center/device-registry', label: 'Camera Health' },
      { href: '/dashboard/command-center/threat-heatmap', label: '3D Heatmap' },
      { href: '/dashboard/command-center/announcements', label: 'Announcement Center' },
    ],
  },
  {
    id: 'live-ops',
    label: '2. Live Operations',
    icon: Monitor,
    items: [
      { href: '/dashboard/live-ops/video-wall', label: 'Video Wall / Grid' },
      { href: '/dashboard/live-ops/camera-tour', label: 'Camera Tour / Guard Patrol' },
      { href: '/dashboard/live-ops/digital-signage', label: 'Digital Signage / Wallboard' },
      { href: '/dashboard/live-ops/audio-talkback', label: 'Audio / Talkback Console' },
    ],
  },
  {
    id: 'incidents',
    label: '3. Incident Management',
    icon: ShieldAlert,
    items: [
      { href: '/dashboard/incidents/alert-console', label: 'Alert Console' },
      { href: '/dashboard/incidents/timeline', label: 'Incident Timeline' },
      { href: '/dashboard/incidents/escalation', label: 'Escalation Center' },
    ],
  },
  {
    id: 'forensics',
    label: '4. Forensics',
    icon: Search,
    items: [
      { href: '/dashboard/forensics/smart-search', label: 'Smart Search' },
      { href: '/dashboard/forensics/evidence-locker', label: 'Evidence Locker' },
      { href: '/dashboard/forensics/chain-of-custody', label: 'Chain of Custody' },
      { href: '/dashboard/forensics/bookmarks', label: 'Bookmark Manager' },
      { href: '/dashboard/forensics/redaction', label: 'Redaction Studio' },
    ],
  },
  {
    id: 'analytics',
    label: '5. Analytics & Compliance',
    icon: BarChart3,
    items: [
      { href: '/dashboard/analytics/operational-reports', label: 'Operational Reports' },
      { href: '/dashboard/analytics/ai-accuracy', label: 'AI Accuracy Dashboard' },
      { href: '/dashboard/analytics/compliance-audits', label: 'Compliance Audits' },
      { href: '/dashboard/analytics/utilization', label: 'Utilization Reports' },
      { href: '/dashboard/analytics/incident-trends', label: 'Incident Trends' },
      { href: '/dashboard/analytics/scheduled-reports', label: 'Scheduled Reports' },
    ],
  },
  {
    id: 'infrastructure',
    label: '6. Infrastructure',
    icon: Server,
    items: [
      { href: '/dashboard/infrastructure/network-topology', label: 'Network Topology View' },
    ],
  },
  {
    id: 'ai-config',
    label: '7. AI Configuration',
    icon: Brain,
    items: [
      { href: '/dashboard/ai-config/model-library', label: 'Model Library' },
      { href: '/dashboard/ai-config/model-assignment', label: 'Model Assignment' },
    ],
  },
  {
    id: 'ecosystem',
    label: '8. Ecosystem',
    icon: Plug,
    items: [
      { href: '/dashboard/ecosystem/connectors', label: 'Connectors Hub' },
      { href: '/dashboard/ecosystem/api-management', label: 'API Management' },
      { href: '/dashboard/ecosystem/webhooks', label: 'Webhook Center' },
      { href: '/dashboard/ecosystem/access-control', label: 'Access Control Integration' },
      { href: '/dashboard/ecosystem/iot-sensors', label: 'IoT / Sensor Fusion' },
      { href: '/dashboard/ecosystem/messaging', label: 'Messaging Integrations' },
      { href: '/dashboard/ecosystem/siem-soc', label: 'SIEM / SOC Integration' },
      { href: '/dashboard/ecosystem/erp-hr', label: 'ERP / HR Integration' },
    ],
  },
  {
    id: 'tenant-admin',
    label: 'Admin',
    icon: Building2,
    items: [
      { href: '/dashboard/tenant-admin', label: 'Overview' },
      { href: '/dashboard/tenant-admin/organizations', label: 'Organizations' },
      { href: '/dashboard/tenant-admin/sites', label: 'Sites' },
      { href: '/dashboard/tenant-admin/edge-servers', label: 'Edge servers' },
      { href: '/dashboard/tenant-admin/users', label: 'Users' },
      { href: '/dashboard/tenant-admin/roles', label: 'Roles & permissions' },
      { href: '/dashboard/tenant-admin/license', label: 'License & usage' },
    ],
  },
  {
    id: 'maintenance',
    label: '9. Maintenance & Service',
    icon: Wrench,
    items: [
      { href: '/dashboard/maintenance/preventive', label: 'Preventive Maintenance' },
      { href: '/dashboard/maintenance/service-tickets', label: 'Service Tickets' },
      { href: '/dashboard/maintenance/amc-warranty', label: 'AMC / Warranty Tracker' },
    ],
  },
  {
    id: 'business-intelligence',
    label: '10. Business Intelligence',
    icon: BrainCircuit,
    items: [
      { href: '/dashboard/business-intelligence', label: 'Overview' },
      { href: '/dashboard/business-intelligence/site', label: 'Site Intelligence' },
      { href: '/dashboard/business-intelligence/area', label: 'Area Intelligence' },
      { href: '/dashboard/business-intelligence/alerts', label: 'Alert Intelligence' },
      { href: '/dashboard/business-intelligence/camera-health', label: 'Camera Health' },
      { href: '/dashboard/business-intelligence/operational-risk', label: 'Operational Risk' },
      { href: '/dashboard/business-intelligence/recommendations', label: 'Recommendations' },
      { href: '/dashboard/business-intelligence/copilot', label: 'AI Copilot' },
      { href: '/dashboard/business-intelligence/snapshots', label: 'Insight Snapshots' },
    ],
  },

  {
    id: 'school-management',
    label: '11. School Management',
    icon: School,
    items: [
      { href: '/dashboard/school-management', label: 'Overview' },
      { href: '/dashboard/school-management/master-data', label: 'Master Data' },
      { href: '/dashboard/school-management/cameras', label: 'Cameras & Mapping' },
      { href: '/dashboard/school-management/timetable', label: 'Timetable' },
      { href: '/dashboard/school-management/calendar', label: 'School Calendar' },
      { href: '/dashboard/school-management/staff-duty', label: 'Staff Duty' },
      { href: '/dashboard/school-management/settings', label: 'Settings' },
    ],
  },
  {
    id: 'school-intelligence',
    label: '12. School Intelligence',
    icon: GraduationCap,
    items: [
      { href: '/dashboard/school-intelligence', label: 'Overview' },
      { href: '/dashboard/school-intelligence/master-data', label: 'Master Data Setup' },
      { href: '/dashboard/school-intelligence/overall-score', label: 'Overall School Score' },
      { href: '/dashboard/school-intelligence/campus-safety', label: 'Campus Safety' },
      { href: '/dashboard/school-intelligence/teacher-productivity', label: 'Teacher Productivity' },
      { href: '/dashboard/school-intelligence/teacher-supervision', label: 'Teacher Supervision' },
      { href: '/dashboard/school-intelligence/student-occupancy', label: 'Student Occupancy' },
      { href: '/dashboard/school-intelligence/academic-operations', label: 'Academic Operations' },
      { href: '/dashboard/school-intelligence/staff-deployment', label: 'Staff Deployment' },
      { href: '/dashboard/school-intelligence/space-utilization', label: 'Space Utilization' },
      { href: '/dashboard/school-intelligence/gate-flow', label: 'Gate Flow' },
      { href: '/dashboard/school-intelligence/parent-experience', label: 'Parent Experience' },
      { href: '/dashboard/school-intelligence/discipline', label: 'Discipline' },
      { href: '/dashboard/school-intelligence/compliance', label: 'Compliance' },
      { href: '/dashboard/school-intelligence/zones-schedule', label: 'Zones & Schedule' },
      { href: '/dashboard/school-intelligence/events', label: 'Events Inbox' },
      { href: '/dashboard/school-intelligence/rules', label: 'Intelligence Rules' },
      { href: '/dashboard/school-intelligence/actions', label: 'Action Tasks' },
      { href: '/dashboard/school-intelligence/digest', label: 'Daily Digest' },
      { href: '/dashboard/school-intelligence/score-settings', label: 'Score Settings' },
    ],
  },
];

/**
 * Exact match or descendant path (`/dashboard/...`). Global Dashboard (`/dashboard`) never
 * prefixes longer dashboard routes.
 */
function routeMatchesItem(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === '/dashboard') return false;
  return pathname.startsWith(`${href}/`);
}

/** Highlight only one submenu link per section: the longest matching href wins. */
function getMostSpecificActiveHref(sectionItems: readonly SubItem[], pathname: string): string | null {
  let best: string | null = null;
  let bestLen = -1;
  for (const { href } of sectionItems) {
    if (!routeMatchesItem(pathname, href)) continue;
    if (href.length > bestLen) {
      bestLen = href.length;
      best = href;
    }
  }
  return best;
}

function findSectionIdForPathname(pathname: string): string | null {
  for (const section of navSections) {
    if (section.items.some((i) => routeMatchesItem(pathname, i.href))) return section.id;
  }
  return null;
}

type SidebarProps = {
  open: boolean;
  onClose?: () => void;
  showAsDrawer: boolean;
};

export function Sidebar({ open, onClose, showAsDrawer }: SidebarProps) {
  const pathname = usePathname();
  useAuth(); // Auth context subscription for routed shell
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(() =>
    findSectionIdForPathname(pathname),
  );

  // Only the section containing the current route stays open when navigating
  useEffect(() => {
    setExpandedSectionId(findSectionIdForPathname(pathname));
  }, [pathname]);

  /** Accordion: opening a section closes others; same header click collapses. */
  const toggleSection = (id: string) =>
    setExpandedSectionId((current) => (current === id ? null : id));

  const asideShellClass =
    'fixed left-0 top-0 z-40 h-screen w-64 overflow-hidden border-r border-slate-800/80 bg-slate-900/92 shadow-xl shadow-black/25 backdrop-blur-md supports-[backdrop-filter]:bg-slate-900/85';

  const navContent = (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800/70 px-4">
        <Link
          href="/dashboard"
          className="group flex items-center gap-2 font-semibold text-slate-100 transition-colors duration-200 hover:text-white"
        >
          <Video className="h-6 w-6 shrink-0 text-blue-400 transition-colors duration-200 group-hover:text-blue-300" />
          Orion Alerts
        </Link>
        {showAsDrawer && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-md p-2 text-slate-400 transition-colors duration-200 hover:bg-slate-800/80 hover:text-slate-200 active:scale-95"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-1.5 [scrollbar-width:thin] [scrollbar-color:rgb(51_65_85)_transparent]">
        {navSections.map((section) => {
          const isExpanded = expandedSectionId === section.id;
          const activeSubHref = getMostSpecificActiveHref(section.items, pathname);
          const hasActive = activeSubHref != null;
          const Icon = section.icon;

          return (
            <div key={section.id} className="mb-1 px-1">
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => toggleSection(section.id)}
                className={cn(
                  'group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wider transition-all duration-200 ease-out outline-none ring-blue-500/0 focus-visible:ring-2',
                  hasActive
                    ? 'text-blue-400'
                    : 'text-slate-500 hover:text-slate-200',
                  isExpanded && 'bg-slate-800/35',
                  hasActive && isExpanded && 'bg-slate-800/45',
                  'hover:bg-slate-800/50 active:scale-[0.99]'
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90 transition-opacity duration-200 group-hover:opacity-100" />
                <span className="flex-1 truncate">{section.label}</span>
                <ChevronRight
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                    isExpanded && 'rotate-90 text-blue-400/80'
                  )}
                  aria-hidden
                />
              </button>
              <div
                className={cn(
                  'grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]',
                  isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <ul className="ml-4 space-y-0.5 border-l border-slate-800/70 py-2 pl-2.5">
                    {section.items.map((item) => {
                      const isActive = activeSubHref != null && item.href === activeSubHref;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={isActive ? 'page' : undefined}
                            onClick={showAsDrawer ? onClose : undefined}
                            className={cn(
                              'block rounded-md px-3 py-1.5 text-sm tracking-tight transition-all duration-200 ease-out outline-none ring-blue-500/0 focus-visible:ring-2',
                              isActive
                                ? 'translate-x-0 bg-slate-800/90 text-slate-100 shadow-sm ring-1 ring-blue-500/35'
                                : 'text-slate-400 hover:translate-x-0.5 hover:bg-slate-800/55 hover:text-slate-100'
                            )}
                          >
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    </>
  );

  if (showAsDrawer) {
    return (
      <>
        <button
          type="button"
          aria-hidden={!open}
          aria-label={open ? 'Close menu' : undefined}
          tabIndex={open ? 0 : -1}
          className={cn(
            'fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 ease-out lg:hidden',
            open ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
          onClick={onClose}
        />
        <aside
          className={cn(
            asideShellClass,
            'z-50 transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] will-change-transform lg:translate-x-0',
            open ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex h-full flex-col">{navContent}</div>
        </aside>
      </>
    );
  }

  return (
    <aside className={asideShellClass}>
      <div className="flex h-full flex-col">{navContent}</div>
    </aside>
  );
}
