'use client';

import { useMemo, useState } from 'react';
import {
  CalendarClock,
  FileText,
  Mail,
  MessageCircle,
  Play,
  Plus,
  Send,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { todayIso } from '@/components/school-intelligence/useSchoolDailySummaries';
import {
  AUTOMATION_DELIVERY_CHANNELS,
  AUTOMATION_FREQUENCIES,
  AUTOMATION_REPORT_TEMPLATES,
  SAMPLE_AUTOMATION_RUNS,
  formatAutomationSchedule,
  formatDeliveryTargets,
  parseRecipientList,
  templateLabel,
  type AutomationFrequency,
  type AutomationReportTemplate,
  type VisionAutomationRun,
} from '@/lib/school-intelligence/vision-copilot-automation';
import { cn } from '@/lib/utils';

type FormState = {
  name: string;
  template: AutomationReportTemplate;
  customPrompt: string;
  frequency: AutomationFrequency;
  runDate: string;
  runTime: string;
  sendEmail: boolean;
  emailRecipients: string;
  sendWhatsApp: boolean;
  whatsappRecipients: string;
  enabled: boolean;
};

const EMPTY_FORM = (date: string): FormState => ({
  name: '',
  template: 'camera-health',
  customPrompt: '',
  frequency: 'weekly',
  runDate: date,
  runTime: '08:00',
  sendEmail: true,
  emailRecipients: '',
  sendWhatsApp: false,
  whatsappRecipients: '',
  enabled: true,
});

const inputClass =
  'w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600';

const labelClass = 'mb-1 block text-xs font-medium text-slate-400';

export function VisionAutomationRuns() {
  const defaultDate = todayIso();
  const [runs, setRuns] = useState<VisionAutomationRun[]>(SAMPLE_AUTOMATION_RUNS);
  const [form, setForm] = useState<FormState>(() => EMPTY_FORM(defaultDate));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const templateMeta = useMemo(
    () => AUTOMATION_REPORT_TEMPLATES.find((t) => t.value === form.template),
    [form.template]
  );

  const resetForm = () => {
    setForm(EMPTY_FORM(todayIso()));
    setEditingId(null);
    setFormError(null);
  };

  const loadRunIntoForm = (run: VisionAutomationRun) => {
    setForm({
      name: run.name,
      template: run.template,
      customPrompt: run.customPrompt ?? '',
      frequency: run.frequency,
      runDate: run.runDate,
      runTime: run.runTime,
      sendEmail: run.emailRecipients.length > 0,
      emailRecipients: run.emailRecipients.join(', '),
      sendWhatsApp: run.whatsappRecipients.length > 0,
      whatsappRecipients: run.whatsappRecipients.join(', '),
      enabled: run.enabled,
    });
    setEditingId(run.id);
    setFormError(null);
  };

  const toggleEnabled = (id: string) => {
    setRuns((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const removeRun = (id: string) => {
    setRuns((prev) => prev.filter((r) => r.id !== id));
    if (editingId === id) resetForm();
  };

  const saveRun = () => {
    const name = form.name.trim();
    if (!name) {
      setFormError('Report name is required.');
      return;
    }
    if (form.template === 'custom' && !form.customPrompt.trim()) {
      setFormError('Describe your custom report prompt.');
      return;
    }
    if (!form.runDate || !form.runTime) {
      setFormError('Schedule date and time are required.');
      return;
    }

    const emailRecipients = form.sendEmail ? parseRecipientList(form.emailRecipients) : [];
    const whatsappRecipients = form.sendWhatsApp ? parseRecipientList(form.whatsappRecipients) : [];

    if (!form.sendEmail && !form.sendWhatsApp) {
      setFormError('Select at least one delivery channel (Email or WhatsApp).');
      return;
    }
    if (form.sendEmail && emailRecipients.length === 0) {
      setFormError('Add at least one email address.');
      return;
    }
    if (form.sendWhatsApp && whatsappRecipients.length === 0) {
      setFormError('Add at least one WhatsApp number.');
      return;
    }

    const payload: VisionAutomationRun = {
      id: editingId ?? `auto-${Date.now()}`,
      name,
      template: form.template,
      customPrompt: form.template === 'custom' ? form.customPrompt.trim() : undefined,
      frequency: form.frequency,
      runDate: form.runDate,
      runTime: form.runTime,
      emailRecipients,
      whatsappRecipients,
      enabled: form.enabled,
      createdAt: editingId
        ? runs.find((r) => r.id === editingId)?.createdAt ?? new Date().toISOString()
        : new Date().toISOString(),
    };

    setRuns((prev) => {
      if (editingId) {
        return prev.map((r) => (r.id === editingId ? payload : r));
      }
      return [payload, ...prev];
    });
    resetForm();
  };

  const runNow = (run: VisionAutomationRun) => {
    const targets = formatDeliveryTargets(run).join('\n');
    window.alert(
      `Running "${run.name}" now (UI preview).\n\nWill send to:\n${targets || 'No recipients configured'}`
    );
  };

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-slate-100">
          <Workflow className="h-4 w-4 text-sky-400" aria-hidden />
          Automation runs
        </CardTitle>
        <p className="text-xs text-slate-500">
          Build custom reports, schedule delivery, and send to email or WhatsApp recipients.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-slate-200">
                {editingId ? 'Edit automation' : 'New custom report'}
              </h3>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Cancel edit
                </button>
              )}
            </div>

            <div>
              <label className={labelClass} htmlFor="automation-name">
                Report name
              </label>
              <input
                id="automation-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Weekly gate activity summary"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="automation-template">
                Report type
              </label>
              <select
                id="automation-template"
                value={form.template}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    template: e.target.value as AutomationReportTemplate,
                  }))
                }
                className={inputClass}
              >
                {AUTOMATION_REPORT_TEMPLATES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {templateMeta && (
                <p className="mt-1.5 text-[11px] text-slate-500">{templateMeta.description}</p>
              )}
            </div>

            {form.template === 'custom' && (
              <div>
                <label className={labelClass} htmlFor="automation-prompt">
                  Custom report prompt
                </label>
                <textarea
                  id="automation-prompt"
                  value={form.customPrompt}
                  onChange={(e) => setForm((f) => ({ ...f, customPrompt: e.target.value }))}
                  rows={3}
                  placeholder="e.g. Summarize Main Gate queue length and critical incidents for the last 7 days."
                  className={cn(inputClass, 'resize-y min-h-[80px]')}
                />
              </div>
            )}

            <div className="space-y-3 rounded-md border border-slate-800 bg-slate-900/50 p-3">
              <div className="flex items-center gap-2">
                <Send className="h-3.5 w-3.5 text-sky-400" aria-hidden />
                <p className="text-xs font-medium text-slate-300">Send report to</p>
              </div>

              {AUTOMATION_DELIVERY_CHANNELS.map((channel) => {
                const isEmail = channel.value === 'email';
                const enabled = isEmail ? form.sendEmail : form.sendWhatsApp;
                const recipients = isEmail ? form.emailRecipients : form.whatsappRecipients;
                const Icon = isEmail ? Mail : MessageCircle;
                const toggleKey = isEmail ? 'sendEmail' : 'sendWhatsApp';
                const recipientsKey = isEmail ? 'emailRecipients' : 'whatsappRecipients';
                const inputId = `automation-${channel.value}-recipients`;

                return (
                  <div
                    key={channel.value}
                    className={cn(
                      'rounded-md border p-3 transition-colors',
                      enabled ? 'border-sky-800/60 bg-slate-950/60' : 'border-slate-800 bg-slate-950/30'
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon
                          className={cn('h-4 w-4', enabled ? 'text-sky-400' : 'text-slate-600')}
                          aria-hidden
                        />
                        <div>
                          <p className="text-xs font-medium text-slate-200">{channel.label}</p>
                          <p className="text-[11px] text-slate-500">{channel.description}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            [toggleKey]: !enabled,
                          }))
                        }
                        className="flex items-center gap-1 text-xs"
                        aria-pressed={enabled}
                        aria-label={`${enabled ? 'Disable' : 'Enable'} ${channel.label} delivery`}
                      >
                        {enabled ? (
                          <ToggleRight className="h-5 w-5 text-green-400" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-slate-600" />
                        )}
                      </button>
                    </div>
                    {enabled && (
                      <div className="mt-2">
                        <label className={labelClass} htmlFor={inputId}>
                          {isEmail ? 'Email addresses' : 'WhatsApp numbers'}
                        </label>
                        <input
                          id={inputId}
                          type="text"
                          value={recipients}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              [recipientsKey]: e.target.value,
                            }))
                          }
                          placeholder={channel.placeholder}
                          className={inputClass}
                        />
                        <p className="mt-1 text-[11px] text-slate-600">Separate multiple with commas.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className={labelClass} htmlFor="automation-frequency">
                  Frequency
                </label>
                <select
                  id="automation-frequency"
                  value={form.frequency}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      frequency: e.target.value as AutomationFrequency,
                    }))
                  }
                  className={inputClass}
                >
                  {AUTOMATION_FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="automation-date">
                  {form.frequency === 'once' ? 'Run date' : 'Start date'}
                </label>
                <input
                  id="automation-date"
                  type="date"
                  value={form.runDate}
                  onChange={(e) => setForm((f) => ({ ...f, runDate: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="automation-time">
                  Run time
                </label>
                <input
                  id="automation-time"
                  type="time"
                  value={form.runTime}
                  onChange={(e) => setForm((f) => ({ ...f, runTime: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-slate-300">Automation status</p>
                <p className="text-[11px] text-slate-500">
                  {form.enabled ? 'Schedule is active and will run on time.' : 'Disabled — no runs until enabled.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
                className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs transition-colors hover:border-slate-600"
                aria-pressed={form.enabled}
              >
                {form.enabled ? (
                  <>
                    <ToggleRight className="h-5 w-5 text-green-400" aria-hidden />
                    <span className="text-green-400">Enabled</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="h-5 w-5 text-slate-500" aria-hidden />
                    <span className="text-slate-500">Disabled</span>
                  </>
                )}
              </button>
            </div>

            {formError && <p className="text-xs text-red-400">{formError}</p>}

            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={saveRun}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              {editingId ? 'Save changes' : 'Schedule automation'}
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-200">Scheduled runs</h3>
              <span className="text-xs text-slate-500">{runs.length} total</span>
            </div>

            {runs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center">
                <FileText className="mx-auto mb-2 h-7 w-7 text-slate-600" aria-hidden />
                <p className="text-sm text-slate-500">No automations yet. Create a custom report on the left.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {runs.map((run) => (
                  <li
                    key={run.id}
                    className={cn(
                      'rounded-lg border border-slate-800 bg-slate-950/50 p-3 transition-opacity',
                      !run.enabled && 'opacity-60'
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-100">{run.name}</p>
                          <Badge variant={run.enabled ? 'success' : 'secondary'}>
                            {run.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{templateLabel(run.template)}</p>
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                          <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
                          {formatAutomationSchedule(run)}
                        </p>
                        {formatDeliveryTargets(run).map((line) => (
                          <p
                            key={line}
                            className="mt-1 flex items-start gap-1 text-[11px] text-slate-400"
                          >
                            {line.startsWith('Email') ? (
                              <Mail className="mt-0.5 h-3 w-3 shrink-0 text-sky-400/80" aria-hidden />
                            ) : (
                              <MessageCircle className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400/80" aria-hidden />
                            )}
                            <span>{line}</span>
                          </p>
                        ))}
                        {run.customPrompt && (
                          <p className="mt-1 line-clamp-2 text-[11px] italic text-slate-500">
                            &ldquo;{run.customPrompt}&rdquo;
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleEnabled(run.id)}
                        className="flex shrink-0 items-center gap-1 text-xs"
                        title={run.enabled ? 'Disable automation' : 'Enable automation'}
                        aria-label={run.enabled ? 'Disable automation' : 'Enable automation'}
                      >
                        {run.enabled ? (
                          <ToggleRight className="h-5 w-5 text-green-400" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-slate-600" />
                        )}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 border-slate-700 text-xs text-slate-300"
                        onClick={() => runNow(run)}
                        disabled={!run.enabled}
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                        Run now
                      </Button>
                      <button
                        type="button"
                        onClick={() => loadRunIntoForm(run)}
                        className="text-xs text-sky-400 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRun(run.id)}
                        className="inline-flex items-center gap-1 text-xs text-red-400/90 hover:text-red-300"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden />
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
