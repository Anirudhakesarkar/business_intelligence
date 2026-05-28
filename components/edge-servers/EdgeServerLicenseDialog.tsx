'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/providers/auth-provider';
import { apiPost } from '@/lib/api-client';

export type EdgeLicenseDevice = {
  license_key?: string;
  license_expires_at?: string | null;
  licensed_camera_limit?: number | null;
};

type Props = {
  edgeServerId: string;
  edgeServerName: string;
  hasLicense: boolean;
  defaultCameraLimit?: number;
  open: boolean;
  onClose: () => void;
  onApplied?: (licenseKey: string) => void;
};

function formatExpiry(iso: string | null | undefined) {
  if (!iso) return 'No expiry';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : String(iso);
}

export function EdgeServerLicenseDialog({
  edgeServerId,
  edgeServerName,
  hasLicense,
  defaultCameraLimit = 50,
  open,
  onClose,
  onApplied,
}: Props) {
  const { config } = useAuth();
  const qc = useQueryClient();
  const [cameraLimit, setCameraLimit] = useState(defaultCameraLimit);
  const [validityMonths, setValidityMonths] = useState(12);
  const [issued, setIssued] = useState<EdgeLicenseDevice | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCameraLimit(defaultCameraLimit > 0 ? defaultCameraLimit : 50);
    setValidityMonths(12);
    setIssued(null);
    setCopied(false);
  }, [open, defaultCameraLimit, edgeServerId]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!config) throw new Error('Not configured');
      const path = hasLicense
        ? `/v1/admin/edge-servers/${encodeURIComponent(edgeServerId)}/rotate-license`
        : `/v1/admin/edge-servers/${encodeURIComponent(edgeServerId)}/issue-license`;
      return apiPost<{
        ok: boolean;
        license?: EdgeLicenseDevice;
      }>(config, path, {
        licensed_camera_limit: cameraLimit > 0 ? cameraLimit : undefined,
        validity_months: validityMonths >= 0 ? validityMonths : 12,
      });
    },
    onSuccess: (res) => {
      const lic = res?.license;
      if (lic?.license_key) {
        setIssued(lic);
        onApplied?.(String(lic.license_key));
        void qc.invalidateQueries({ queryKey: ['edge-detail', edgeServerId] });
        void qc.invalidateQueries({ queryKey: ['edge-list'] });
      }
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-900 shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base text-slate-100">
            {issued?.license_key ? 'License key' : hasLicense ? 'Rotate license' : 'Issue license'}
          </CardTitle>
          <Button type="button" variant="ghost" size="sm" className="text-slate-400" onClick={onClose}>
            Close
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {issued?.license_key ? (
            <>
              <p className="text-xs text-slate-500">
                Copy this license key for the edge desktop app. It is stored on this edge server record.
              </p>
              <code className="block rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-emerald-200 break-all select-all">
                {issued.license_key}
              </code>
              <p className="text-xs text-slate-500">Expires: {formatExpiry(issued.license_expires_at)}</p>
              <p className="text-xs text-slate-500">
                Camera limit on this server: {issued.licensed_camera_limit ?? '—'}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(String(issued.license_key));
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                >
                  {copied ? 'Copied' : 'Copy license key'}
                </Button>
                <Button type="button" className="flex-1" onClick={onClose}>
                  Done
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-300">{edgeServerName}</p>
              <p className="text-xs text-slate-500">
                Generates a license key for this edge server and links it to the org entitlement. Save as Draft when
                registering hardware; issue the license when you are ready to activate.
              </p>
              <label className="block text-sm text-slate-200">
                Camera limit (this server)
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                  value={cameraLimit}
                  onChange={(e) => setCameraLimit(Number(e.target.value))}
                />
              </label>
              <label className="block text-sm text-slate-200">
                Validity (months)
                <input
                  type="number"
                  min={0}
                  max={60}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                  value={validityMonths}
                  onChange={(e) => setValidityMonths(Number(e.target.value))}
                />
                <span className="mt-1 block text-xs text-slate-500">0 = never expires</span>
              </label>
              {mutation.isError ? (
                <p className="text-sm text-rose-400">
                  {mutation.error instanceof Error ? mutation.error.message : 'Failed to issue license'}
                </p>
              ) : null}
              <Button
                type="button"
                className="w-full"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? 'Working…' : hasLicense ? 'Rotate license' : 'Issue license'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
