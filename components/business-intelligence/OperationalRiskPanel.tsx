'use client';

import { ShieldAlert, AlertTriangle, Clock, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export type RiskItem = {
  title: string;
  reason: string[];
  riskLevel: 'High' | 'Medium' | 'Low';
};

const DEMO_RISKS: RiskItem[] = [
  {
    title: 'Main Gate',
    reason: [
      '18 intrusion alerts in 7 days',
      '4 alerts not acknowledged within SLA',
      'Camera health dropped twice',
      'Area marked Critical',
    ],
    riskLevel: 'High',
  },
  {
    title: 'Parking Area',
    reason: [
      '11 repeated alerts this week',
      'Average resolution time: 3.2 hours',
    ],
    riskLevel: 'Medium',
  },
];

function riskVariant(level: string): 'destructive' | 'warning' | 'success' {
  if (level === 'High') return 'destructive';
  if (level === 'Medium') return 'warning';
  return 'success';
}

type MetricCardProps = { label: string; value: string | number; icon: typeof ShieldAlert; color: string };

function MetricCard({ label, value, icon: Icon, color }: MetricCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
      <div className="rounded-md bg-slate-800 p-2">
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-100">{value}</p>
      </div>
    </div>
  );
}

type Props = {
  riskScore?: number;
  riskLevel?: 'High' | 'Medium' | 'Low';
  highRiskAreas?: number;
  criticalIncidents?: number;
  slaBreaches?: number;
  blindSpots?: number;
  risks?: RiskItem[];
  isLoading?: boolean;
};

export function OperationalRiskPanel({
  riskScore = 42,
  riskLevel = 'Medium',
  highRiskAreas = 2,
  criticalIncidents = 5,
  slaBreaches = 3,
  blindSpots = 1,
  risks,
  isLoading,
}: Props) {
  const items = risks ?? DEMO_RISKS;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Operational Risk Score" value={`${riskScore}/100`} icon={ShieldAlert} color="text-orange-400" />
        <MetricCard label="High-Risk Areas" value={highRiskAreas} icon={AlertTriangle} color="text-red-400" />
        <MetricCard label="SLA Breaches" value={slaBreaches} icon={Clock} color="text-yellow-400" />
        <MetricCard label="Camera Blind Spots" value={blindSpots} icon={WifiOff} color="text-red-400" />
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-slate-100">Critical Risk List</CardTitle>
            <Badge variant={riskVariant(riskLevel)}>{riskLevel} Risk</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded bg-slate-800" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((risk) => (
                <div key={risk.title} className={`rounded-lg border p-3 ${risk.riskLevel === 'High' ? 'border-red-500/30 bg-red-950/20' : 'border-yellow-500/30 bg-yellow-950/10'}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-200">{risk.title}</p>
                    <Badge variant={riskVariant(risk.riskLevel)}>{risk.riskLevel} Risk</Badge>
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {risk.reason.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
