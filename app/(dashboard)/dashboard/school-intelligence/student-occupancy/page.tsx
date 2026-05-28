'use client';

import { useEffect, useState } from 'react';
import { Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SchoolDailyModuleView } from '@/components/school-intelligence/SchoolDailyModuleView';

type Room     = { id: number; roomCode: string; roomName: string; capacity: number; roomType: string; isActive: boolean };
type Section  = { id: number; name: string; classId: number; expectedStudentCount: number };
type TEntry   = { id: number; sectionId: number; roomId: number; dayOfWeek: number; startTime: string; endTime: string; isActive: boolean };
type OccEvent = { id: number; eventType: string; severity: string; detectedAt: string; description?: string; status: string };

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isNowActive(start: string, end: string) {
  const now = nowHHMM();
  return now >= start && now < end;
}

type OccStatus = 'overcrowded' | 'match' | 'underused' | 'empty';

function occupancyStatus(expected: number, capacity: number): OccStatus {
  if (expected === 0) return 'empty';
  const ratio = expected / capacity;
  if (ratio > 1.1) return 'overcrowded';
  if (ratio >= 0.75) return 'match';
  return 'underused';
}

const STATUS_STYLE: Record<OccStatus, { bar: string; badge: string; label: string }> = {
  overcrowded: { bar: 'bg-red-500',   badge: 'bg-red-500/10 text-red-400 border-red-500/30',     label: 'Overcrowded' },
  match:       { bar: 'bg-green-500', badge: 'bg-green-500/10 text-green-400 border-green-500/30', label: 'On track' },
  underused:   { bar: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30', label: 'Under-used' },
  empty:       { bar: 'bg-slate-700', badge: 'bg-slate-700 text-slate-500 border-slate-600',        label: 'Empty' },
};

function OccupancyPanel({ date, orgId }: { date: string; orgId: number }) {
  const [rooms, setRooms]       = useState<Room[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [timetable, setTimetable] = useState<TEntry[]>([]);
  const [events, setEvents]     = useState<OccEvent[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    const dow = new Date(date + 'T12:00:00').getDay();
    void Promise.all([
      fetch(`/api/rooms?organizationId=${orgId}`).then((r) => r.json()),
      fetch(`/api/sections`).then((r) => r.json()),
      fetch(`/api/timetable?organizationId=${orgId}`).then((r) => r.json()),
      fetch(`/api/intelligence-events?organizationId=${orgId}&eventType=StudentOccupancy&from=${date}&to=${date}`)
        .then((r) => r.json()).then((j) => j.events ?? []).catch(() => []),
    ]).then(([rm, sec, tt, evts]) => {
      setRooms(Array.isArray(rm) ? rm : []);
      setSections(Array.isArray(sec) ? sec : []);
      const todayEntries = (Array.isArray(tt) ? tt : []).filter((e: TEntry) => e.dayOfWeek === dow);
      setTimetable(todayEntries);
      setEvents(Array.isArray(evts) ? evts : []);
    }).finally(() => setLoading(false));
  }, [date, orgId]);

  // Build room occupancy grid: for each room, find what section is currently assigned
  type RoomOccRow = {
    room: Room;
    section: Section | null;
    activeEntry: TEntry | null;
    status: OccStatus;
  };

  const secMap = Object.fromEntries(sections.map((s) => [s.id, s]));
  const isToday = date === new Date().toISOString().slice(0, 10);

  const rows: RoomOccRow[] = rooms
    .filter((r) => r.isActive)
    .map((room) => {
      const activeEntry = timetable.find(
        (e) => e.roomId === room.id && (!isToday || isNowActive(e.startTime, e.endTime))
      ) ?? null;
      const section = activeEntry ? (secMap[activeEntry.sectionId] ?? null) : null;
      const expected = section?.expectedStudentCount ?? 0;
      const status = occupancyStatus(expected, room.capacity);
      return { room, section, activeEntry, status };
    })
    .sort((a, b) => {
      // Overcrowded first, then underused, then match, then empty
      const order: OccStatus[] = ['overcrowded', 'underused', 'match', 'empty'];
      return order.indexOf(a.status) - order.indexOf(b.status);
    });

  const overcrowded = rows.filter((r) => r.status === 'overcrowded').length;
  const underused   = rows.filter((r) => r.status === 'underused').length;
  const occupied    = rows.filter((r) => r.status !== 'empty').length;

  return (
    <div className="space-y-5">
      {/* Summary stat row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Occupied rooms', value: occupied,    cls: 'border-sky-900/40 bg-sky-950/10 text-sky-300' },
          { label: 'Over capacity',  value: overcrowded, cls: 'border-red-900/40 bg-red-950/10 text-red-300' },
          { label: 'Under-used',     value: underused,   cls: 'border-amber-900/40 bg-amber-950/10 text-amber-300' },
        ].map(({ label, value, cls }) => (
          <Card key={label} className={`border ${cls.split(' ')[0]}`}>
            <CardContent className={`p-3 ${cls.split(' ').slice(1).join(' ')}`}>
              <p className="text-xs opacity-70">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Room occupancy grid */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm text-slate-300">
            <span className="flex items-center gap-2"><Users className="h-4 w-4 text-sky-400" /> Room Occupancy Grid</span>
            <span className="text-xs text-slate-500">{rows.length} rooms · {isToday ? 'live' : date}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">No rooms found. Seed demo data from Master Data.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map(({ room, section, activeEntry, status }) => {
                const cfg = STATUS_STYLE[status];
                const expected = section?.expectedStudentCount ?? 0;
                const fillPct  = room.capacity > 0 ? Math.min(100, Math.round((expected / room.capacity) * 100)) : 0;
                return (
                  <div key={room.id} className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono text-xs font-medium text-slate-300">{room.roomCode}</p>
                        <p className="text-xs text-slate-500">{room.roomName}</p>
                      </div>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    {/* Fill bar */}
                    <div className="mt-2 h-1.5 rounded-full bg-slate-700">
                      <div className={`h-1.5 rounded-full ${cfg.bar} transition-all`} style={{ width: `${fillPct}%` }} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {section ? (
                          <>{section.name} · <span className="text-slate-400">{expected}</span> students</>
                        ) : (
                          <span className="italic text-slate-600">No class scheduled</span>
                        )}
                      </span>
                      <span>cap {room.capacity}</span>
                    </div>
                    {activeEntry && (
                      <p className="mt-1 text-[10px] text-slate-600">{activeEntry.startTime}–{activeEntry.endTime}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Occupancy events */}
      {events.length > 0 && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <AlertTriangle className="h-4 w-4 text-amber-400" /> Occupancy Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {events.slice(0, 8).map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-800/30 p-3">
                  <p className="text-sm text-slate-300">{e.description ?? e.eventType}</p>
                  <span className="shrink-0 text-xs text-slate-500">
                    {new Date(e.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {events.length === 0 && !loading && (
        <div className="flex items-center gap-2 rounded-lg border border-green-800/30 bg-green-950/10 px-4 py-3 text-sm text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> No occupancy anomalies for this date.
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <SchoolDailyModuleView
      module="occupancy"
      title="Student Occupancy Intelligence"
      description="Expected vs actual occupancy across all rooms and classes."
      icon={<Users className="h-6 w-6" />}
      kpiKeys={[
        { key: 'expected_match_pct', label: 'Expected match %' },
        { key: 'overcrowding_count', label: 'Overcrowding' },
        { key: 'underuse_count',     label: 'Under-use' },
      ]}
      extra={(date, orgId) => <OccupancyPanel date={date} orgId={orgId} />}
    />
  );
}
