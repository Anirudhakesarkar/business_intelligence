'use client';

import { useCallback, useState } from 'react';
import { SchoolIntelligenceBreadcrumbs } from '@/components/school-intelligence/SchoolIntelligenceBreadcrumbs';
import { SIFilterBar } from '@/components/school-intelligence/SIFilterBar';
import { VisionCopilotChat } from '@/components/school-intelligence/vision-copilot/VisionCopilotChat';
import { VisionAutomationRuns } from '@/components/school-intelligence/vision-copilot/VisionAutomationRuns';
import { usePageHeaderRefresh } from '@/components/layout/page-header-context';
import type { SIFilters } from '@/lib/school-intelligence/types';

export default function VisionCopilotPage() {
  const [filters, setFilters] = useState<SIFilters>({ organizationId: '', siteId: '', dateRange: '7d' });
  const [chatKey, setChatKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setChatKey((k) => k + 1);
  }, []);

  usePageHeaderRefresh(handleRefresh);

  return (
    <div className="space-y-6">
      <SchoolIntelligenceBreadcrumbs current="Vision Copilot" />
      <SIFilterBar filters={filters} onChange={setFilters} />
      <VisionCopilotChat key={chatKey} />
      <VisionAutomationRuns />
    </div>
  );
}
