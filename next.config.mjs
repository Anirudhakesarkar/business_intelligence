/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/dashboard/command-center/executive-summary',
        destination: '/dashboard',
        permanent: false,
      },
      {
        source: '/dashboard/command-center/activity-feed',
        destination: '/dashboard/incidents/alert-console',
        permanent: false,
      },
      {
        source: '/dashboard/infrastructure/device-registry',
        destination: '/dashboard/command-center/device-registry',
        permanent: false,
      },
      {
        source: '/dashboard/infrastructure/edge-nodes',
        destination: '/dashboard/command-center/device-registry',
        permanent: false,
      },
      {
        source: '/dashboard/infrastructure/camera-management',
        destination: '/dashboard/command-center/device-registry',
        permanent: false,
      },
      {
        source: '/dashboard/infrastructure/storage-policies',
        destination: '/dashboard/infrastructure/network-topology',
        permanent: false,
      },
      {
        source: '/dashboard/live-ops/site-map',
        destination: '/dashboard/live-ops/video-wall',
        permanent: false,
      },
      {
        source: '/dashboard/live-ops/operator-workspace',
        destination: '/dashboard/incidents/alert-console',
        permanent: false,
      },
      {
        source: '/dashboard/incidents',
        destination: '/dashboard/incidents/alert-console',
        permanent: false,
      },
      {
        source: '/dashboard/incidents/detail',
        destination: '/dashboard/incidents/alert-console',
        permanent: false,
      },
      {
        source: '/dashboard/incidents/rule-engine',
        destination: '/dashboard/incidents/escalation',
        permanent: false,
      },
      {
        source: '/dashboard/incidents/workflow-templates',
        destination: '/dashboard/incidents/escalation',
        permanent: false,
      },
      {
        source: '/dashboard/incidents/dispatch-board',
        destination: '/dashboard/incidents/escalation',
        permanent: false,
      },
      {
        source: '/dashboard/forensics/case-builder',
        destination: '/dashboard/forensics/smart-search',
        permanent: false,
      },
      {
        source: '/dashboard/forensics/bookmarks',
        destination: '/dashboard/forensics/smart-search',
        permanent: false,
      },
      {
        source: '/dashboard/forensics/chain-of-custody',
        destination: '/dashboard/forensics/smart-search',
        permanent: false,
      },
      {
        source: '/dashboard/analytics/ai-accuracy',
        destination: '/dashboard/analytics/operational-reports',
        permanent: false,
      },
      {
        source: '/dashboard/analytics/workforce',
        destination: '/dashboard/analytics/operational-reports',
        permanent: false,
      },
      {
        source: '/dashboard/school-intelligence/teacher-supervision',
        destination: '/dashboard/school-intelligence/teacher-productivity',
        permanent: false,
      },
      {
        source: '/dashboard/school-intelligence/student-occupancy',
        destination: '/dashboard/school-intelligence/space-utilization',
        permanent: false,
      },
      {
        source: '/dashboard/school-intelligence/occupancy',
        destination: '/dashboard/school-intelligence/space-utilization',
        permanent: false,
      },
      {
        source: '/dashboard/school-intelligence/academic-operations',
        destination: '/dashboard/school-intelligence/teacher-productivity',
        permanent: false,
      },
      {
        source: '/dashboard/school-intelligence/staff-deployment',
        destination: '/dashboard/school-intelligence/parent-experience',
        permanent: false,
      },
      {
        source: '/dashboard/school-intelligence/gate-flow',
        destination: '/dashboard/school-intelligence/parent-experience',
        permanent: false,
      },
      {
        source: '/dashboard/school-intelligence/discipline',
        destination: '/dashboard/school-intelligence/campus-safety',
        permanent: false,
      },
      {
        source: '/dashboard/school-intelligence/digest',
        destination: '/dashboard/school-intelligence',
        permanent: false,
      },
      {
        source: '/dashboard/school-intelligence/actions',
        destination: '/dashboard/school-intelligence',
        permanent: false,
      },
      {
        source: '/dashboard/school-intelligence/zones-schedule',
        destination: '/dashboard/school-intelligence',
        permanent: false,
      },
      {
        source: '/dashboard/school-intelligence/rules',
        destination: '/dashboard/school-intelligence',
        permanent: false,
      },
      {
        source: '/dashboard/school-intelligence/score-settings',
        destination: '/dashboard/school-intelligence',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
