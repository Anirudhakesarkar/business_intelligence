'use client';

export function SetupProgressBar({ percent }: { percent: number }) {
  const color = percent >= 85 ? 'bg-green-500' : percent >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span>Foundation setup</span><span>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full transition-all ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
