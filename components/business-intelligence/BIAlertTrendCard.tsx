'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export type AlertTrendPoint = {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

const DEMO_DATA: AlertTrendPoint[] = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(Date.now() - (6 - i) * 86400_000);
  return {
    date: d.toISOString().slice(0, 10),
    critical: Math.floor(Math.random() * 5),
    high: Math.floor(Math.random() * 10),
    medium: Math.floor(Math.random() * 15),
    low: Math.floor(Math.random() * 8),
  };
});

const TOOLTIP_STYLE = { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' };

type Props = { data?: AlertTrendPoint[]; isLoading?: boolean };

export function BIAlertTrendCard({ data, isLoading }: Props) {
  const chartData = data ?? DEMO_DATA;

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-100">Alert Volume Trend</CardTitle>
        <p className="text-xs text-slate-500">Alerts by severity over time</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-48 animate-pulse rounded bg-slate-800" />
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickFormatter={(v) => { const d = new Date(v); return `${d.getMonth()+1}/${d.getDate()}`; }} />
                <YAxis stroke="#64748b" fontSize={9} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => new Date(v).toLocaleDateString()} />
                <Bar dataKey="critical" stackId="a" fill="#ef4444" name="Critical" />
                <Bar dataKey="high" stackId="a" fill="#f97316" name="High" />
                <Bar dataKey="medium" stackId="a" fill="#eab308" name="Medium" />
                <Bar dataKey="low" stackId="a" fill="#64748b" name="Low" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {!data && !isLoading && (
          <p className="mt-2 text-center text-xs text-slate-600">Demo data — connect live alerts to see real trends</p>
        )}
      </CardContent>
    </Card>
  );
}
