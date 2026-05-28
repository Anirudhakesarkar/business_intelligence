'use client';

import { ShieldCheck, Video, Clock, ClipboardCheck, ShieldAlert, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface ScoreData {
  safetyScore: number;
  cameraHealthScore: number;
  responseScore: number;
  complianceScore: number;
  operationalRiskScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  openIncidents?: number;
}

function scoreColor(score: number) {
  if (score >= 85) return 'text-green-400';
  if (score >= 65) return 'text-yellow-400';
  if (score >= 45) return 'text-orange-400';
  return 'text-red-400';
}

function scoreRing(score: number) {
  if (score >= 85) return 'border-green-500/40';
  if (score >= 65) return 'border-yellow-500/40';
  if (score >= 45) return 'border-orange-500/40';
  return 'border-red-500/40';
}

function riskVariant(level: string): 'success' | 'warning' | 'destructive' {
  if (level === 'Low') return 'success';
  if (level === 'Medium') return 'warning';
  return 'destructive';
}

type CardDef = {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof ShieldCheck;
  color: string;
  border: string;
};

export function BIScoreCards({ data }: { data: ScoreData }) {
  const cards: CardDef[] = [
    {
      label: 'Safety Score',
      value: data.safetyScore,
      sub: '/ 100',
      icon: ShieldCheck,
      color: scoreColor(data.safetyScore),
      border: scoreRing(data.safetyScore),
    },
    {
      label: 'Camera Health',
      value: data.cameraHealthScore,
      sub: '/ 100',
      icon: Video,
      color: scoreColor(data.cameraHealthScore),
      border: scoreRing(data.cameraHealthScore),
    },
    {
      label: 'Response Score',
      value: data.responseScore,
      sub: '/ 100',
      icon: Clock,
      color: scoreColor(data.responseScore),
      border: scoreRing(data.responseScore),
    },
    {
      label: 'Compliance Score',
      value: data.complianceScore,
      sub: '/ 100',
      icon: ClipboardCheck,
      color: scoreColor(data.complianceScore),
      border: scoreRing(data.complianceScore),
    },
    {
      label: 'Operational Risk',
      value: data.riskLevel,
      icon: ShieldAlert,
      color: data.riskLevel === 'Low' ? 'text-green-400' : data.riskLevel === 'Medium' ? 'text-yellow-400' : 'text-red-400',
      border: data.riskLevel === 'Low' ? 'border-green-500/40' : data.riskLevel === 'Medium' ? 'border-yellow-500/40' : 'border-red-500/40',
    },
    {
      label: 'Open Incidents',
      value: data.openIncidents ?? 0,
      icon: AlertCircle,
      color: (data.openIncidents ?? 0) > 10 ? 'text-red-400' : (data.openIncidents ?? 0) > 5 ? 'text-yellow-400' : 'text-slate-300',
      border: 'border-slate-800',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className={`border bg-slate-900 ${c.border}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{c.label}</p>
                <div className="rounded-md bg-slate-800 p-1.5">
                  <Icon className="h-4 w-4 text-slate-400" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className={`text-3xl font-bold ${c.color}`}>{c.value}</span>
                {c.sub && <span className="text-xs text-slate-500">{c.sub}</span>}
              </div>
              {c.label === 'Operational Risk' && (
                <div className="mt-1.5">
                  <Badge variant={riskVariant(data.riskLevel)} className="text-xs">{data.riskLevel} Risk</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function BIScoreCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="border-slate-800 bg-slate-900">
          <CardContent className="p-4">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-800" />
            <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-800" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
