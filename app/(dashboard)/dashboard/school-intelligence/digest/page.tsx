'use client';

import { useState } from 'react';
import { SMPageHeader } from '@/components/school-management/SMPageHeader';
import { SchoolCopilotPanel } from '@/components/school-intelligence/SchoolCopilotPanel';
import { SchoolCopilotQA } from '@/components/school-intelligence/SchoolCopilotQA';
import { SchoolRecommendationsStrip } from '@/components/school-intelligence/SchoolRecommendationsStrip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, CalendarDays, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';

const ORG_ID = 1;

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function offsetDate(base: string, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDisplayDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function DigestPage() {
  const [date, setDate] = useState(todayIso);
  const today = todayIso();

  return (
    <div className="space-y-6">
      <SMPageHeader
        title="Daily Principal Digest"
        subtitle="GPT-generated school intelligence summary, Q&A copilot, and action recommendations."
      />

      {/* Date navigator */}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDate((d) => offsetDate(d, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2">
          <CalendarDays className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-medium text-slate-200">{formatDisplayDate(date)}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ml-2 rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-300"
          />
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setDate((d) => offsetDate(d, 1))}
          disabled={date >= today}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {date !== today && (
          <Button size="sm" variant="ghost" className="text-sky-400" onClick={() => setDate(today)}>
            Today
          </Button>
        )}
      </div>

      {/* Pipeline status hint */}
      <Card className="border-sky-900/30 bg-sky-950/10">
        <CardContent className="flex items-start gap-3 p-3 text-xs text-sky-300/70">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
          <span>
            The digest pipeline requires: seeded foundation data → AI signals → rule evaluation → daily summaries → score engine → GPT generation.
            If the summary is empty, use the regenerate button or seed each phase in order.
          </span>
        </CardContent>
      </Card>

      {/* 3-column layout on large screens, stacked on mobile */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main summary — takes 2 cols */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-200">Principal Summary</h2>
          </div>
          <SchoolCopilotPanel organizationId={ORG_ID} date={date} />

          {/* Q&A copilot */}
          <div className="flex items-center gap-2 pt-2">
            <h2 className="text-sm font-semibold text-slate-200">Ask School Intelligence</h2>
          </div>
          <SchoolCopilotQA organizationId={ORG_ID} date={date} />
        </div>

        {/* Recommendations sidebar */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-200">Recommendations</h2>
          </div>
          <SchoolRecommendationsStrip organizationId={ORG_ID} date={date} />

          {/* Quick seed helper */}
          <Card className="border-slate-800 bg-slate-900/40">
            <CardContent className="p-3 text-xs text-slate-500 space-y-2">
              <p className="font-medium text-slate-400">Pipeline setup</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>School Management → Master Data → Seed demo</li>
                <li>School Management → Signals → Seed signals</li>
                <li>Intelligence → Rules → Seed default rules</li>
                <li>Intelligence → Events → Evaluate rules</li>
                <li>Then regenerate this digest</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
