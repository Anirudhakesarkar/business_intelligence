'use client';

import { useState } from 'react';
import { BellRing, AlertTriangle, Clock, RotateCcw, XCircle, Bot } from 'lucide-react';
import { BIFilterBar, type BIFilters } from '@/components/business-intelligence/BIFilterBar';
import { BIAlertTrendCard } from '@/components/business-intelligence/BIAlertTrendCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';

const DEMO_METRICS = [
  { label: 'Total Alerts', value: 247, icon: BellRing, color: 'text-blue-400' },
  { label: 'Critical Alerts', value: 18, icon: AlertTriangle, color: 'text-red-400' },
  { label: 'Repeated Alerts', value: 61, icon: RotateCcw, color: 'text-orange-400' },
  { label: 'Unacknowledged', value: 9, icon: XCircle, color: 'text-yellow-400' },
  { label: 'Avg Ack Time', value: '7.4m', icon: Clock, color: 'text-purple-400' },
  { label: 'Avg Resolution', value: '2.4h', icon: Clock, color: 'text-slate-400' },
];

const DEMO_RULE_PERF = [
  { rule: 'Intrusion Detection - Night', alerts: 42, type: 'Intrusion', repeated: 28 },
  { rule: 'Crowd Density - Main Gate', alerts: 31, type: 'Crowd', repeated: 19 },
  { rule: 'Vehicle Loitering - Parking', alerts: 18, type: 'Vehicle', repeated: 12 },
  { rule: 'Fire Smoke - Warehouse', alerts: 3, type: 'Fire', repeated: 0 },
];

const DEMO_UNRESOLVED = [
  { id: 'INC-0041', title: 'After-hours intrusion - Main Gate', age: '4d', severity: 'critical' },
  { id: 'INC-0038', title: 'Repeated crowd alert - Reception', age: '2d', severity: 'high' },
  { id: 'INC-0034', title: 'Vehicle loitering - Parking', age: '1d', severity: 'medium' },
];

export default function AlertIntelligencePage() {
  const [filters, setFilters] = useState<BIFilters>({ organizationId: '', siteId: '', dateRange: '7d' });

  const { data, isLoading } = useQuery({
    queryKey: ['bi-alerts', filters],
    queryFn: async () => {
      const res = await fetch(`/api/business-intelligence/alerts?dateRange=${filters.dateRange}`);
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const metrics = data?.metrics ?? DEMO_METRICS;
  const rulePerf = data?.rulePerformance ?? DEMO_RULE_PERF;
  const unresolved = data?.unresolvedAlerts ?? DEMO_UNRESOLVED;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">
          <BellRing className="h-7 w-7 text-blue-400" /> Alert Intelligence
        </h1>
        <p className="text-sm text-slate-400">Transform alerts into business insight — repeated patterns, ignored alerts, false positives, and SLA performance.</p>
      </div>

      <BIFilterBar filters={filters} onChange={setFilters} />

      {/* Metrics row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {DEMO_METRICS.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="border-slate-800 bg-slate-900">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">{m.label}</p>
                  <Icon className={`h-4 w-4 ${m.color}`} />
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-100">{m.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Alert trend + type breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BIAlertTrendCard data={data?.alertTrend} isLoading={isLoading} />

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-100">Alert Type Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { type: 'Intrusion', count: 89, pct: 36, color: 'bg-red-500' },
                { type: 'Crowd Density', count: 61, pct: 25, color: 'bg-orange-500' },
                { type: 'Vehicle', count: 48, pct: 19, color: 'bg-yellow-500' },
                { type: 'Camera Offline', count: 31, pct: 13, color: 'bg-blue-500' },
                { type: 'Other', count: 18, pct: 7, color: 'bg-slate-600' },
              ].map((t) => (
                <div key={t.type} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">{t.type}</span>
                    <span className="text-slate-400">{t.count} ({t.pct}%)</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div className={`h-full rounded-full ${t.color}`} style={{ width: `${t.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rule performance + unresolved aging */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-100">Rule Performance</CardTitle>
            <p className="text-xs text-slate-500">AI rules generating the most alerts</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rulePerf.map((r: typeof DEMO_RULE_PERF[0]) => (
                <div key={r.rule} className="flex items-center justify-between rounded-lg border border-slate-800 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-200">{r.rule}</p>
                    <p className="text-xs text-slate-500">{r.type}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    <span className="text-slate-400">{r.alerts} alerts</span>
                    {r.repeated > 0 && (
                      <Badge variant="warning">{r.repeated} repeated</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-100">Unresolved Alert Aging</CardTitle>
            <p className="text-xs text-slate-500">Old unresolved alerts requiring attention</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unresolved.map((a: typeof DEMO_UNRESOLVED[0]) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-800 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200">{a.id}</p>
                    <p className="truncate text-xs text-slate-500">{a.title}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="h-3.5 w-3.5" /> {a.age}
                    </span>
                    <Badge variant={a.severity === 'critical' ? 'destructive' : a.severity === 'high' ? 'warning' : 'secondary'} className="capitalize">
                      {a.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-slate-600">
        No live intelligence data available yet. Once alerts, camera health, and incidents are synced, Orion Alerts will calculate alert intelligence.
      </p>
    </div>
  );
}
