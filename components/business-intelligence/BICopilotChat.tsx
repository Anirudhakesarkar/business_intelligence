'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SUGGESTED_QUESTIONS } from '@/lib/business-intelligence/copilot-context-builder';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

type Props = {
  organizationId?: string;
  siteId?: string;
  dateRange?: string;
};

export function BICopilotChat({ organizationId, siteId, dateRange = '7d' }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Hello! I\'m your Orion Alerts Business Intelligence Copilot. Ask me about site safety, camera health, alert trends, or what management should improve. I use your live structured data to answer.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(question: string) {
    if (!question.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/business-intelligence/copilot/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: organizationId ? parseInt(organizationId) : 1,
          siteId: siteId ? parseInt(siteId) : undefined,
          dateRange,
          question,
        }),
      });
      const json = await res.json();
      const answer = json.answer || 'Unable to process your question at this time. Please try again.';
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: answer, timestamp: new Date() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Connection error. Please check your network and try again.', timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-slate-100">
          <div className="rounded-lg bg-blue-600/20 p-1.5">
            <Bot className="h-5 w-5 text-blue-400" />
          </div>
          AI Copilot
          <Sparkles className="h-4 w-4 text-blue-400" />
        </CardTitle>
        <p className="text-xs text-slate-500">Powered by structured BI data — not raw database queries</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Suggested questions */}
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.slice(0, 4).map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="rounded-full border border-blue-700/40 bg-blue-950/30 px-3 py-1 text-xs text-blue-300 hover:bg-blue-900/40 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Message list */}
        <div className="h-72 overflow-y-auto space-y-3 pr-1">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`shrink-0 rounded-full p-1.5 ${msg.role === 'assistant' ? 'bg-blue-600/20' : 'bg-slate-700'}`}>
                {msg.role === 'assistant'
                  ? <Bot className="h-3.5 w-3.5 text-blue-400" />
                  : <span className="text-xs text-slate-300">Me</span>
                }
              </div>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role === 'assistant' ? 'bg-slate-800 text-slate-200' : 'bg-blue-700 text-white'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-blue-600/20 p-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
              </div>
              <div className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-400">Analyzing…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
            placeholder="Ask about your site, alerts, cameras, or risks…"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <Button size="sm" onClick={() => sendMessage(input)} disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
