'use client';

import { SIStandardModulePage } from '@/components/school-intelligence/module-standard/SIStandardModulePage';
import { getModuleConfig } from '@/lib/school-intelligence/module-standard-config';

export default function TeacherProductivityPage() {
  return <SIStandardModulePage config={getModuleConfig('teacher-productivity')} />;
}
