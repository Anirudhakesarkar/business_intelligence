'use client';

export function DataTable({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) {
  if (!rows.length) return <p className="text-sm text-slate-500">No records yet. Load demo seed or create entries.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-left text-xs uppercase text-slate-500">
          <tr>{columns.map((c) => <th key={c} className="px-3 py-2">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-800 text-slate-300">
              {columns.map((c) => <td key={c} className="px-3 py-2">{String(row[c] ?? row[c.toLowerCase()] ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
