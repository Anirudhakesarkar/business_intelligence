'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Field = { key: string; label: string; type?: string };

type Props = {
  title: string;
  fields: Field[];
  onSubmit: (values: Record<string, string>) => Promise<void> | void;
};

export function SMQuickAdd({ title, fields, onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(values);
      setValues({});
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Add {title}</Button>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/80 p-4">
      <p className="text-sm font-medium text-slate-200">New {title}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <label key={f.key} className="text-xs text-slate-500">
            {f.label}
            <input
              type={f.type ?? 'text'}
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            />
          </label>
        ))}
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
