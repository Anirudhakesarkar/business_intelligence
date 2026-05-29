'use client';

import { SIStandardModulePage } from '@/components/school-intelligence/module-standard/SIStandardModulePage';
import { getModuleConfig } from '@/lib/school-intelligence/module-standard-config';

export default function SpaceUtilizationPage() {
  return <SIStandardModulePage config={getModuleConfig('space-utilization')} />;
}
