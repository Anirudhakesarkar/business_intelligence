'use client';

import { useState } from 'react';
import { Loader2, MessageCircle, ArrowUp } from 'lucide-react';
import { SISection } from '@/components/school-intelligence/SISection';

const SUGGESTED = [
  'Why is teacher productivity low today?',
  'What happened at gate during dispersal?',
  'Which rooms were underused?',
  'Summarize today for the principal.',
];

export function SchoolCopilotQA({ organizationId = 1, date }: { organizationId?: number; date: string }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();

  async function ask(q: string) {
    const text = q.trim();
    if (!text) return;
    setLoading(true);
    setQuestion(text);
    try {
      const res = await fetch('/api/gpt/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId, date, question: text, conversationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ask failed');
      setAnswer(data.answer);
      setCitations(data.citations ?? []);
      setConversationId(data.conversationId);
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : 'Ask failed');
      setCitations([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SISection
      icon={<MessageCircle className="h-4 w-4" />}
      eyebrow="Copilot · ask"
      title="Ask School Intelligence"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full border border-slate-800 bg-slate-950/40 px-2.5 py-1 text-xs text-slate-400 transition-colors hover:border-sky-500/30 hover:bg-sky-500/10 hover:text-sky-200"
              onClick={() => ask(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="relative">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about scores, gates, teachers…"
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3.5 py-2.5 pr-11 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500/40 focus:outline-none focus:ring-2 focus:ring-sky-500/15"
            onKeyDown={(e) => e.key === 'Enter' && ask(question)}
          />
          <button
            type="button"
            aria-label="Send question"
            onClick={() => ask(question)}
            disabled={loading || !question.trim()}
            className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-sky-500/90 text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
          </button>
        </div>
        {answer && (
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-200">
            <p className="whitespace-pre-wrap leading-relaxed">{answer}</p>
            {citations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {citations.map((c) => (
                  <span
                    key={c}
                    className="rounded-md border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-300"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </SISection>
  );
}
