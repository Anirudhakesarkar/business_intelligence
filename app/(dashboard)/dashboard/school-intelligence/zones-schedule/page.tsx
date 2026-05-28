'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, MapPin, Clock, Users, BookOpen,
  CheckCircle2, Circle, AlertTriangle, RefreshCw, Loader2, LayoutGrid,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SIModuleHeader } from '@/components/school-intelligence/SIModuleHeader';
import { todayIso } from '@/components/school-intelligence/useSchoolDailySummaries';

const ORG_ID = 1;

type TimetableEntry = {
  id: number;
  organizationId: number;
  classId: number;
  sectionId?: number;
  subjectId?: number;
  teacherId?: number;
  roomId?: number;
  dayOfWeek: number; // 0=Sun…6=Sat
  startTime: string; // "HH:MM"
  endTime: string;
  periodLabel?: string;
  isActive: boolean;
};

type Zone = {
  id: number;
  name: string;
  zoneType: string;
  isRiskZone: boolean;
  capacity?: number;
};

type Room = {
  id: number;
  zoneId: number;
  roomCode: string;
  roomName: string;
  roomType: string;
  capacity: number;
  isActive: boolean;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ZONE_TYPE_COLORS: Record<string, string> = {
  classroom: 'border-blue-800/50 bg-blue-950/20',
  lab: 'border-purple-800/50 bg-purple-950/20',
  corridor: 'border-slate-700 bg-slate-900/50',
  playground: 'border-green-800/40 bg-green-950/10',
  office: 'border-amber-800/40 bg-amber-950/10',
  gate: 'border-indigo-800/40 bg-indigo-950/10',
  parking: 'border-slate-700 bg-slate-900/40',
  washroom: 'border-slate-700 bg-slate-900/40',
  canteen: 'border-orange-800/40 bg-orange-950/10',
  server: 'border-red-800/50 bg-red-950/20',
};

const ROOM_TYPE_COLORS: Record<string, string> = {
  Classroom: 'text-blue-400',
  Lab: 'text-purple-400',
  Library: 'text-teal-400',
  Office: 'text-amber-400',
  Hall: 'text-indigo-400',
  Storage: 'text-slate-400',
};

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isPeriodNow(start: string, end: string): boolean {
  const now = nowHHMM();
  return now >= start && now <= end;
}

function isPeriodSoon(start: string): boolean {
  const now = nowHHMM();
  const [h, m] = start.split(':').map(Number);
  const [nh, nm] = now.split(':').map(Number);
  const diffMin = (h * 60 + m) - (nh * 60 + nm);
  return diffMin > 0 && diffMin <= 30;
}

function isPeriodPast(end: string): boolean {
  return nowHHMM() > end;
}

function PeriodStatus({ start, end }: { start: string; end: string }) {
  if (isPeriodNow(start, end)) {
    return <span className="inline-flex items-center gap-1 rounded bg-green-500/20 px-1.5 py-0.5 text-xs text-green-300"><span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />Live</span>;
  }
  if (isPeriodSoon(start)) {
    return <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-300"><Clock className="h-3 w-3" />Soon</span>;
  }
  if (isPeriodPast(end)) {
    return <span className="text-xs text-slate-600">Done</span>;
  }
  return <span className="text-xs text-slate-500">Upcoming</span>;
}

export default function ZonesSchedulePage() {
  const [date, setDate] = useState(todayIso);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'schedule' | 'zones' | 'rooms'>('schedule');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ttRes, zRes, rRes] = await Promise.all([
        fetch(`/api/timetable?organizationId=${ORG_ID}`),
        fetch(`/api/zones`),
        fetch(`/api/rooms?organizationId=${ORG_ID}`),
      ]);
      const [ttData, zData, rData] = await Promise.all([ttRes.json(), zRes.json(), rRes.json()]);
      setTimetable(Array.isArray(ttData) ? ttData : ttData.entries ?? []);
      setZones(Array.isArray(zData) ? zData : zData.zones ?? []);
      setRooms(Array.isArray(rData) ? rData : rData.rooms ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter timetable by day of week of selected date
  const selectedDow = new Date(date + 'T12:00:00').getDay();
  const todayEntries = useMemo(() =>
    timetable.filter((t) => t.dayOfWeek === selectedDow),
    [timetable, selectedDow]
  );

  const liveEntries = todayEntries.filter((t) => isPeriodNow(t.startTime, t.endTime));
  const upcomingEntries = todayEntries.filter((t) => !isPeriodPast(t.endTime) && !isPeriodNow(t.startTime, t.endTime));
  const pastEntries = todayEntries.filter((t) => isPeriodPast(t.endTime));

  // Rooms that are currently scheduled (occupied) vs empty
  const scheduledRoomIds = new Set(liveEntries.map((t) => t.roomId).filter(Boolean));
  const occupiedRooms = rooms.filter((r) => scheduledRoomIds.has(r.id));
  const emptyRooms = rooms.filter((r) => r.isActive && !scheduledRoomIds.has(r.id));

  // Group periods by time slot
  const timeSlots = useMemo(() => {
    const slots: Record<string, TimetableEntry[]> = {};
    todayEntries.forEach((t) => {
      const key = `${t.startTime}–${t.endTime}`;
      if (!slots[key]) slots[key] = [];
      slots[key].push(t);
    });
    return Object.entries(slots).sort(([a], [b]) => a.localeCompare(b));
  }, [todayEntries]);

  const riskZones = zones.filter((z) => z.isRiskZone);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/school-intelligence" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-400">
        <ArrowLeft className="h-4 w-4" /> Back to School Intelligence
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SIModuleHeader
          title="Zones & Schedule"
          description="Live timetable periods, room occupancy status, and campus zone overview."
          icon={<LayoutGrid className="h-6 w-6" />}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <Calendar className="h-4 w-4" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
            />
          </label>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="mr-1 h-3 w-3" /> Refresh
          </Button>
        </div>
      </div>

      {/* Day summary bar */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Calendar className="h-4 w-4 text-sky-400" />
            <span className="font-medium">{DAY_NAMES[selectedDow]}</span>
            <span className="text-slate-500">{date}</span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1 text-green-400">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              {liveEntries.length} live
            </span>
            <span className="text-amber-400">{upcomingEntries.length} upcoming</span>
            <span className="text-slate-500">{pastEntries.length} past</span>
            <span className="text-sky-400">{todayEntries.length} total periods</span>
          </div>
          {todayEntries.length === 0 && (
            <span className="text-xs text-amber-400">No timetable data for this day — seed foundation data first.</span>
          )}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/40 p-1 w-fit">
        {[
          { id: 'schedule', label: 'Schedule', icon: BookOpen },
          { id: 'rooms', label: 'Rooms', icon: Users },
          { id: 'zones', label: 'Zones', icon: MapPin },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveView(id as typeof activeView)}
            className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-medium transition-colors ${
              activeView === id ? 'bg-sky-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : (
        <>
          {/* SCHEDULE VIEW */}
          {activeView === 'schedule' && (
            <div className="space-y-4">
              {timeSlots.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center">
                  <BookOpen className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                  <p className="text-sm text-slate-500">No timetable entries for {DAY_NAMES[selectedDow]}.</p>
                  <Link href="/dashboard/school-management/timetable" className="mt-2 inline-block text-xs text-sky-400 hover:underline">
                    Configure timetable →
                  </Link>
                </div>
              ) : (
                timeSlots.map(([slot, entries]) => {
                  const [start, end] = slot.split('–');
                  const isNow = isPeriodNow(start, end);
                  const isSoon = isPeriodSoon(start);
                  return (
                    <div key={slot} className={`rounded-lg border p-4 transition-colors ${isNow ? 'border-green-800/60 bg-green-950/10' : isSoon ? 'border-amber-800/40 bg-amber-950/5' : 'border-slate-800 bg-slate-900/40'}`}>
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-slate-500" />
                          <span className="font-mono text-sm font-medium text-slate-200">{start} – {end}</span>
                        </div>
                        <PeriodStatus start={start} end={end} />
                        <span className="text-xs text-slate-500">{entries.length} section{entries.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {entries.map((entry) => (
                          <div key={entry.id} className={`rounded-md border p-2.5 text-xs ${isNow ? 'border-green-800/40 bg-green-950/20' : 'border-slate-800 bg-slate-800/50'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-slate-200">
                                {entry.periodLabel ?? `Period ${entry.id}`}
                              </span>
                              {entry.roomId && (
                                <span className="text-slate-400">Room #{entry.roomId}</span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-slate-500">
                              {entry.classId && <span>Class #{entry.classId}</span>}
                              {entry.teacherId && <span>Teacher #{entry.teacherId}</span>}
                              {entry.subjectId && <span>Subject #{entry.subjectId}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ROOMS VIEW */}
          {activeView === 'rooms' && (
            <div className="space-y-4">
              {/* Occupancy summary */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Card className="border-green-900/40 bg-green-950/10">
                  <CardContent className="p-3">
                    <p className="text-xs text-green-500">Occupied now</p>
                    <p className="text-2xl font-bold text-green-300">{occupiedRooms.length}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardContent className="p-3">
                    <p className="text-xs text-slate-500">Empty</p>
                    <p className="text-2xl font-bold text-slate-400">{emptyRooms.length}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardContent className="p-3">
                    <p className="text-xs text-slate-500">Total rooms</p>
                    <p className="text-2xl font-bold text-slate-200">{rooms.length}</p>
                  </CardContent>
                </Card>
              </div>

              {rooms.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center">
                  <p className="text-sm text-slate-500">No rooms configured.</p>
                  <Link href="/dashboard/school-management/master-data" className="mt-2 inline-block text-xs text-sky-400 hover:underline">Configure rooms →</Link>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {rooms.map((room) => {
                    const isOccupied = scheduledRoomIds.has(room.id);
                    const schedule = liveEntries.filter((t) => t.roomId === room.id);
                    return (
                      <div
                        key={room.id}
                        className={`rounded-lg border p-3 text-sm transition-colors ${
                          isOccupied ? 'border-green-800/50 bg-green-950/15' : 'border-slate-800 bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-200">{room.roomCode}</p>
                            <p className="text-xs text-slate-500">{room.roomName}</p>
                          </div>
                          {isOccupied ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 text-slate-600" />
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span className={ROOM_TYPE_COLORS[room.roomType] ?? 'text-slate-400'}>{room.roomType}</span>
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{room.capacity}</span>
                        </div>
                        {schedule.length > 0 && (
                          <p className="mt-1.5 rounded bg-green-900/30 px-2 py-1 text-xs text-green-300">
                            {schedule[0].startTime}–{schedule[0].endTime}
                            {schedule[0].subjectId ? ` · Subject #${schedule[0].subjectId}` : ''}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ZONES VIEW */}
          {activeView === 'zones' && (
            <div className="space-y-4">
              {riskZones.length > 0 && (
                <div className="rounded-lg border border-amber-900/40 bg-amber-950/10 p-3">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" /> Risk Zones ({riskZones.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {riskZones.map((z) => (
                      <span key={z.id} className="rounded border border-amber-800/40 bg-amber-950/20 px-2 py-1 text-xs text-amber-300">
                        ⚠ {z.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {zones.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center">
                  <p className="text-sm text-slate-500">No zones configured.</p>
                  <Link href="/dashboard/school-management/master-data" className="mt-2 inline-block text-xs text-sky-400 hover:underline">Configure zones →</Link>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {zones.map((zone) => {
                    const zoneRooms = rooms.filter((r) => r.zoneId === zone.id);
                    const occupiedInZone = zoneRooms.filter((r) => scheduledRoomIds.has(r.id)).length;
                    const colorCls = ZONE_TYPE_COLORS[zone.zoneType.toLowerCase()] ?? 'border-slate-800 bg-slate-900/50';
                    return (
                      <Card key={zone.id} className={`border ${colorCls}`}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-slate-200">{zone.name}</p>
                              <p className="text-xs text-slate-500 capitalize">{zone.zoneType}</p>
                            </div>
                            {zone.isRiskZone && (
                              <span className="rounded border border-amber-700/50 bg-amber-950/20 px-1.5 py-0.5 text-xs text-amber-400">⚠ Risk</span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                            <span>{zoneRooms.length} rooms</span>
                            {zone.capacity && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{zone.capacity} cap.</span>}
                          </div>
                          {zoneRooms.length > 0 && (
                            <div className="mt-2 h-1.5 rounded-full bg-slate-700">
                              <div
                                className="h-1.5 rounded-full bg-sky-600"
                                style={{ width: `${zoneRooms.length > 0 ? (occupiedInZone / zoneRooms.length) * 100 : 0}%` }}
                              />
                            </div>
                          )}
                          {zoneRooms.length > 0 && (
                            <p className="mt-1 text-xs text-slate-600">{occupiedInZone}/{zoneRooms.length} rooms occupied</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Quick links */}
      <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
        <Link href="/dashboard/school-management/timetable" className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-sky-600 hover:text-sky-300">
          Edit timetable →
        </Link>
        <Link href="/dashboard/school-management/master-data" className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-sky-600 hover:text-sky-300">
          Manage rooms & zones →
        </Link>
        <Link href="/dashboard/school-intelligence/space-utilization" className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-sky-600 hover:text-sky-300">
          Space utilization scores →
        </Link>
      </div>
    </div>
  );
}
