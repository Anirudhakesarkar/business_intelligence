'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Send, Sparkles, Loader2, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SUGGESTED_PROMPTS } from '@/lib/school-intelligence/vision-copilot-mock';
import { cn } from '@/lib/utils';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
  citations?: string[];
};

type AskSuccess = {
  ok: true;
  answer: string;
  citations?: string[];
  conversationId?: string;
};

type AskFailure = { error?: string; code?: string };

type Props = {
  organizationId?: number;
  date?: string;
  siteId?: number;
};

const GPT_UNAVAILABLE_MSG =
  'GPT is not configured for this environment. Set OPENAI_API_KEY to enable Vision Copilot answers.';

export function VisionCopilotChat({ organizationId = 1, date, siteId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [openaiConfigured, setOpenaiConfigured] = useState<boolean | null>(null);
  const [pipelineReady, setPipelineReady] = useState<boolean | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  const askDate = date ?? new Date().toISOString().slice(0, 10);
  const isProduction = process.env.NODE_ENV === 'production';

  const checkStatus = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/school-db/status', { signal });
      if (!res.ok) return;
      const data = (await res.json()) as { openai?: { configured?: boolean } };
      setOpenaiConfigured(data?.openai?.configured ?? false);
    } catch {
      setOpenaiConfigured(null);
    }
  }, []);

  // Check if pipeline has data for today by probing the scores endpoint
  const checkPipeline = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(
        `/api/school-scores/overall?organizationId=${organizationId}&date=${askDate}`,
        { signal }
      );
      const data = (await res.json()) as { overallScore?: number } | null;
      setPipelineReady(data != null && (data as { overallScore?: number }).overallScore != null);
    } catch {
      setPipelineReady(null);
    }
  }, [organizationId, askDate]);

  useEffect(() => {
    const controller = new AbortController();
    void checkStatus(controller.signal);
    void checkPipeline(controller.signal);
    return () => controller.abort();
  }, [checkStatus, checkPipeline]);

  const runBootstrap = async () => {
    setBootstrapping(true);
    try {
      await fetch(
        `/api/school-intelligence/bootstrap?organizationId=${organizationId}&date=${askDate}`,
        { method: 'POST' }
      );
      await checkPipeline();
      appendAssistantMessage(
        'Pipeline run complete. If cards are still empty, add foundation data in School Management first (sites → cameras → teachers → timetable).',
        false
      );
    } catch {
      appendAssistantMessage('Bootstrap failed — check server logs.', true);
    } finally {
      setBootstrapping(false);
    }
  };

  const appendAssistantMessage = (text: string, error = false, citations?: string[]) => {
    setMessages((prev) => [
      ...prev,
      { id: `a-${Date.now()}`, role: 'assistant', text, error, citations },
    ]);
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    if (isProduction && openaiConfigured === false) {
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: 'user', text: trimmed },
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: GPT_UNAVAILABLE_MSG,
          error: true,
        },
      ]);
      setInput('');
      return;
    }

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/gpt/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          date: askDate,
          question: trimmed,
          conversationId,
          ...(siteId != null ? { siteId } : {}),
        }),
      });
      const data = (await res.json()) as AskSuccess | AskFailure;
      if (!res.ok) {
        const fail = data as AskFailure;
        // pipeline not seeded yet — mark it so the UI shows the bootstrap banner
        if (fail.code === 'pipeline_order' || res.status === 422) {
          setPipelineReady(false);
        }
        throw new Error(fail.error ?? 'Ask failed');
      }
      const success = data as AskSuccess;
      if (!success.answer?.trim()) {
        throw new Error('GPT returned an empty answer.');
      }
      appendAssistantMessage(success.answer, false, success.citations ?? []);
      if (success.conversationId) setConversationId(success.conversationId);
    } catch (e) {
      appendAssistantMessage(e instanceof Error ? e.message : 'Ask failed', true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex h-full flex-col border-slate-800 bg-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-slate-100">
          <Bot className="h-4 w-4 text-violet-400" aria-hidden />
          Copilot
          <Sparkles className="h-3.5 w-3.5 text-violet-400" aria-hidden />
        </CardTitle>
        <p className="text-xs text-slate-500">Ask about cameras, incidents, and evidence.</p>
        {isProduction && openaiConfigured === false && (
          <p className="text-xs text-amber-400/90">GPT is unavailable — configure OPENAI_API_KEY to enable answers.</p>
        )}
        {pipelineReady === false && (
          <div className="mt-1 flex items-center gap-2 rounded-md border border-amber-700/40 bg-amber-900/20 px-3 py-2">
            <PlayCircle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
            <p className="flex-1 text-xs text-amber-200">
              No school data for today. Run the pipeline to enable GPT answers.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-amber-700/50 px-2 text-xs text-amber-300 hover:bg-amber-900/40"
              onClick={() => void runBootstrap()}
              disabled={bootstrapping}
            >
              {bootstrapping ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Run pipeline'}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void sendMessage(prompt)}
              disabled={loading || (isProduction && openaiConfigured === false)}
              className="rounded-md border border-slate-800 bg-slate-950/50 px-2.5 py-1 text-left text-[11px] text-slate-400 transition-colors hover:border-sky-700/50 hover:text-sky-200 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="min-h-[200px] flex-1 space-y-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          {messages.length === 0 && (
            <p className="text-xs text-slate-500">Select a prompt or type a question to begin.</p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'max-w-[95%] rounded-lg px-3 py-2 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'ml-auto bg-sky-600/20 text-sky-100'
                  : msg.error
                    ? 'mr-auto border border-red-900/60 bg-red-950/30 text-red-200'
                    : 'mr-auto border border-slate-800 bg-slate-900 text-slate-200'
              )}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {msg.citations.map((c) => (
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
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Analyzing scene context…
            </div>
          )}
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about cameras, risk, or evidence…"
            disabled={loading || (isProduction && openaiConfigured === false)}
            className="min-h-[44px] flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600 disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon"
            disabled={loading || !input.trim() || (isProduction && openaiConfigured === false)}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
