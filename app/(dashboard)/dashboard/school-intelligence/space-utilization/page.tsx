'use client';

import { useEffect, useState } from 'react';
import { LayoutGrid, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SchoolDailyModuleView } from '@/components/school-intelligence/SchoolDailyModuleView';

type Room    = { id: number; roomCode: string; roomName: string; capacity: number; roomType: string; isActive: boolean };
type TEntry  = { id: number; roomId: number; dayOfWeek: number; startTime: string; endTime: string; sectionId: number };
type SpEvent = { id: number; eventType: string; severity: string; detectedAt: string; description?: string };

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const ROOM_TYPE_ORDER = ['Classroom', 'Lab', 'Library', 'Hall', 'Office', 'StaffRoom', 'Reception', 'Storeroom'];

function SpacePanel({ date, orgId }: { date: string; orgId: number }) {
  const [rooms, setRooms]     = useState<Room[]>([]);
  const [timetable, setTT]    = useState<TEntry[]>([]);
  const [events, setEvents]   = useState<SpEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    setLoading(true);
    const dow = new Date(date + 'T12:00:00').getDay();
    void Promise.all([
      fetch(`/api/rooms?organizationId=${orgId}`).then((r) => r.json()),
      fetch(`/api/timetable?organizationId=${orgId}`).then((r) => r.json()),
      fetch(`/api/intelligence-events?organizationId=${orgId}&eventType=SpaceUtilization&from=${date}&to=${date}`)
        .then((r) => r.json()).then((j) => j.events ?? []).catch(() => []),
    ]).then(([rm, tt, evts]) => {
      setRooms(Array.isArray(rm) ? rm : []);
      const todayTT = (Array.isArray(tt) ? tt : []).filter((e: TEntry) => e.dayOfWeek === dow);
      setTT(todayTT);
      setEvents(Array.isArray(evts) ? evts : []);
    }).finally(() => setLoading(false));
  }, [date, orgId]);

  const isToday = date === new Date().toISOString().slice(0, 10);
  const now     = nowHHMM();

  // For each room: count periods today + is currently active
  type RoomRow = { room: Room; periodsToday: number; isOccupied: boolean; utilizationPct: number };
  const rows: RoomRow[] = rooms
    .filter((r) => r.isActive && (typeFilter === 'all' || r.roomType === typeFilter))
    .map((room) => {
      const roomPeriods   = timetable.filter((e) => e.roomId === room.id);
      const periodsToday  = roomPeriods.length;
      const isOccupied    = isToday && roomPeriods.some((e) => now >= e.startTime && now < e.endTime);
      // Rough utilization: assume 8 period-slots per day
      const utilizationPct = Math.min(100, Math.round((periodsToday / 8) * 100));
      return { room, periodsToday, isOccupied, utilizationPct };
    })
    .sort((a, b) => b.periodsToday - a.periodsToday);

  const occupied  = rows.filter((r) => r.isOccupied).length;
  const unused    = rows.filter((r) => r.periodsToday === 0).length;
  const avgUtil   = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.utilizationPct, 0) / rows.length) : 0;

  const types = ['all', ...ROOM_TYPE_ORDER.filter((t) => rooms.some((r) => r.roomType === t))];

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Occupied now', value: occupied,        cls: 'border-emerald-900/40 bg-emerald-950/10 text-emerald-300' },
          { label: 'Avg utilization', value: `${avgUtil}%`,cls: 'border-sky-900/40 bg-sky-950/10 text-sky-300' },
          { label: 'Unused today',  value: unused,         cls: unused > 0 ? 'border-amber-900/40 bg-amber-950/10 text-amber-300' : 'border-slate-800 bg-slate-900 text-slate-400' },
        ].map(({ label, value, cls }) => (
          <Card key={label} className={`border ${cls.split(' ')[0]}`}>
            <CardContent className={`p-3 ${cls}`}>
              <p className="text-xs opacity-70">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Room utilization grid */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm text-slate-300">
            <span className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-sky-400" />
              Room Utilization
            </span>
            <span className="text-xs text-slate-500">{rows.length} rooms</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Room-type filter */}
          {types.length > 2 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {types.map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs capitalize transition-colors ${
                    typeFilter === t ? 'border-sky-600 bg-sky-900/40 text-sky-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">No rooms found. Seed demo data from Master Data.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map(({ room, periodsToday, isOccupied, utilizationPct }) => (
                <div key={room.id} className={`rounded-lg border p-3 ${isOccupied ? 'border-emerald-800/40 bg-emerald-950/10' : periodsToday === 0 ? 'border-slate-800 bg-slate-900/40' : 'border-slate-700 bg-slate-800/30'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-xs font-medium text-slate-200">{room.roomCode}</p>
                      <p className="text-xs text-slate-500">{room.roomType}</p>
                    </div>
                    {isOccupied
                      ? <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">Occupied</span>
                      : periodsToday > 0
                        ? <span className="rounded border border-slate-600 bg-slate-700/40 px-1.5 py-0.5 text-[10px] text-slate-400">Scheduled</span>
                        : <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-600">Unused</span>}
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-700">
                    <div
                      className={`h-1.5 rounded-full transition-all ${utilizationPct >= 75 ? 'bg-green-500' : utilizationPct >= 40 ? 'bg-sky-500' : utilizationPct > 0 ? 'bg-amber-500' : 'bg-slate-700'}`}
                      style={{ width: `${utilizationPct}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{periodsToday} period{periodsToday !== 1 ? 's' : ''} today</span>
                    <span>{utilizationPct}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {events.length === 0 && !loading && (
        <div className="flex items-center gap-2 rounded-lg border border-green-800/30 bg-green-950/10 px-4 py-3 text-sm text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> No space-utilization anomalies for this date.
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <SchoolDailyModuleView
      module="space"
      title="Space Utilization"
      description="Room usage efficiency — occupied, scheduled, and unused spaces across campus."
      icon={<LayoutGrid className="h-6 w-6" />}
      kpiKeys={[{ key: 'utilization_pct', label: 'Utilization %' }]}
      extra={(date, orgId) => <SpacePanel date={date} orgId={orgId} />}
    />
  );
}
