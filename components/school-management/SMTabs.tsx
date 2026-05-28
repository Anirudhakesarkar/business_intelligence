'use client';

type Tab = { id: string; label: string };

type Props = {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
};

export function SMTabs({ tabs, active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={
            active === t.id
              ? 'rounded-md bg-sky-600/20 px-3 py-1.5 text-sm text-sky-400 ring-1 ring-sky-500/40'
              : 'rounded-md px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
