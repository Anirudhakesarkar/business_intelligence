'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Megaphone, AlertTriangle, ChevronRight, Globe, Building2, Clock, X, ExternalLink } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { apiGet, apiPost } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'critical' | 'high' | 'normal' | 'low';

type Announcement = {
  announcement_id: string;
  title: string;
  body: string;
  priority: Priority;
  target_type: 'all' | 'specific_sites';
  site_ids: string[];
  is_active: boolean;
  created_by_name: string;
  created_at: string;
  expires_at: string | null;
};

type AnnouncementsApi = {
  ok: boolean;
  announcements: Announcement[];
  total: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function isExpired(a: Announcement): boolean {
  if (!a.is_active) return true;
  if (!a.expires_at) return false;
  return new Date(a.expires_at).getTime() < Date.now();
}

function daysLeft(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const d = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS);
  if (d < 0) return 'Expired';
  if (d === 0) return 'Expires today';
  if (d === 1) return 'Expires tomorrow';
  return `Expires in ${d}d`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const PRIORITY_COLOR: Record<Priority, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  normal: 'bg-blue-500',
  low: 'bg-slate-500',
};

const PRIORITY_TEXT: Record<Priority, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  normal: 'text-blue-400',
  low: 'text-slate-400',
};

// IDs dismissed locally this session (persisted to localStorage)
const DISMISSED_KEY = 'ann_dismissed';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)));
  } catch { /* ignore */ }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NotificationBell() {
  const { config } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => getDismissed());
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Fetch active announcements — poll every 60 s
  const { data } = useQuery<AnnouncementsApi>({
    queryKey: ['announcements-bell', config?.token, config?.serverUrl],
    queryFn: async () => {
      if (!config?.serverUrl) return { ok: false, announcements: [], total: 0 };
      try {
        return await apiGet<AnnouncementsApi>(
          config,
          '/api/announcements?status=active&limit=50',
        );
      } catch {
        return { ok: false, announcements: [], total: 0 };
      }
    },
    enabled: !!config?.serverUrl && !!(config.token || config.apiKey),
    retry: false,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const allActive = (data?.announcements ?? []).filter((a) => !isExpired(a));

  // Unread = active & not locally dismissed
  const unread = allActive.filter((a) => !dismissed.has(a.announcement_id));
  const badgeCount = unread.length;

  // In the panel show everything active, marking dismissed ones as "read"
  const panelItems = allActive.slice(0, 20);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleOpen = () => {
    setOpen((o) => !o);
  };

  const dismissOne = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
    // Best-effort mark-read on server
    if (config) {
      apiPost(config, `/api/announcements/${id}/read`, {}).catch(() => {});
    }
  }, [config]);

  const dismissAll = useCallback(() => {
    const ids = new Set(allActive.map((a) => a.announcement_id));
    setDismissed((prev) => {
      const next = new Set([...prev, ...ids]);
      saveDismissed(next);
      return next;
    });
  }, [allActive]);

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={handleOpen}
        aria-label="Announcements"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <Bell className="h-5 w-5" />
        {badgeCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold leading-none text-white shadow-sm">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-96 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-100">Announcements</span>
              {badgeCount > 0 && (
                <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-xs font-semibold text-red-400">
                  {badgeCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {badgeCount > 0 && (
                <button
                  onClick={dismissAll}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Items */}
          <div className="max-h-[420px] overflow-y-auto">
            {panelItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-2">
                <Bell className="h-8 w-8 text-slate-700" />
                <p className="text-sm">No active announcements</p>
              </div>
            ) : (
              panelItems.map((a) => {
                const isRead = dismissed.has(a.announcement_id);
                const expiry = daysLeft(a.expires_at);
                return (
                  <div
                    key={a.announcement_id}
                    className={`relative border-b border-slate-800/60 px-4 py-3 transition-colors hover:bg-slate-800/30 ${
                      isRead ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Unread dot */}
                    {!isRead && (
                      <span className={`absolute left-1.5 top-4 h-1.5 w-1.5 rounded-full ${PRIORITY_COLOR[a.priority]}`} />
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 pl-1">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${PRIORITY_TEXT[a.priority]}`}>
                            {a.priority}
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                            {a.target_type === 'all'
                              ? <><Globe className="h-2.5 w-2.5" /> All sites</>
                              : <><Building2 className="h-2.5 w-2.5" /> {a.site_ids.length} site{a.site_ids.length !== 1 ? 's' : ''}</>
                            }
                          </span>
                          {expiry && (
                            <>
                              <span className="text-slate-600">·</span>
                              <span className="flex items-center gap-0.5 text-[10px] text-amber-500/80">
                                <Clock className="h-2.5 w-2.5" /> {expiry}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-200 leading-snug">{a.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">{a.body}</p>
                        <p className="mt-1 text-[10px] text-slate-600">
                          {a.created_by_name} · {timeAgo(a.created_at)}
                        </p>
                      </div>

                      {/* Dismiss button */}
                      {!isRead && (
                        <button
                          onClick={(e) => dismissOne(a.announcement_id, e)}
                          className="mt-0.5 flex-shrink-0 rounded p-0.5 text-slate-600 hover:bg-slate-700 hover:text-slate-300 transition-colors"
                          title="Dismiss"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-800 px-4 py-2.5">
            <Link
              href="/dashboard/command-center/announcements"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                View all in Announcement Center
              </span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
