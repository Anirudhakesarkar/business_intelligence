import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-score-engine/json';
import { createWeightProfile, listWeightProfiles } from '@/lib/school-score-engine/store';
import { authorizeSchoolRequest } from '@/lib/school-auth/rbac';
import { normalizeWeights } from '@/lib/school-score-engine/weights';
import type { ScoreModuleKey } from '@/lib/school-score-engine/types';

export async function GET(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  return json({ organizationId, profiles: listWeightProfiles(organizationId) });
}

export async function POST(req: NextRequest) {
  const auth = await authorizeSchoolRequest(req);
  if (!auth.ok) return err(auth.error, auth.status);
  if (auth.principal.role === 'site_viewer') return err('Forbidden', 403);
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const body = await req.json().catch(() => ({}));
  const effectiveFrom = (body.effectiveFrom as string) ?? new Date().toISOString().slice(0, 10);
  const weights = body.weights as Record<ScoreModuleKey, number> | undefined;
  const profileName = (body.profileName as string) ?? 'custom';
  if (!weights) return err('weights required');
  const rawSum = Object.values(weights).reduce((a, b) => a + b, 0);
  const normalized = normalizeWeights(weights);
  const profile = createWeightProfile(organizationId, effectiveFrom, normalized, profileName);
  return json({
    ok: true,
    profile,
    warning: Math.abs(rawSum - 1) > 0.01 ? 'Weights normalized to sum to 100%' : undefined,
  });
}
