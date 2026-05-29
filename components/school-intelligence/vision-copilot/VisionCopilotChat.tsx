'use client';

import { useState } from 'react';
import { Bot, Send, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CANNED_RESPONSE, SUGGESTED_PROMPTS } from '@/lib/school-intelligence/vision-copilot-mock';
import { cn } from '@/lib/utils';

type Message = { id: string; role: 'user' | 'assistant'; text: string };

export function VisionCopilotChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', text: CANNED_RESPONSE },
      ]);
      setLoading(false);
    }, 700);
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
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendMessage(prompt)}
              disabled={loading}
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
                  : 'mr-auto border border-slate-800 bg-slate-900 text-slate-200'
              )}
            >
              {msg.text}
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
            sendMessage(input);
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about cameras, risk, or evidence…"
            disabled={loading}
            className="min-h-[44px] flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600 disabled:opacity-50"
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()} aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
