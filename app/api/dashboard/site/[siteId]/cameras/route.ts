import '@/lib/school-persistence/init';
import { NextRequest, NextResponse } from 'next/server';
import { isAllowedApiOrigin, normalizeApiOrigin } from '@/lib/allowed-api-origins';

export async function POST(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  try {
    const body = await request.json();
    const { serverUrl, apiKey } = body as { serverUrl?: string; apiKey?: string };
    const { siteId } = params;

    if (!serverUrl || !apiKey) {
      return NextResponse.json({ error: 'serverUrl and apiKey are required' }, { status: 400 });
    }
    if (!siteId) {
      return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
    }
    if (!isAllowedApiOrigin(serverUrl)) {
      return NextResponse.json({ error: 'Server URL is not allowed' }, { status: 403 });
    }

    const base = normalizeApiOrigin(serverUrl);
    if (!base) {
      return NextResponse.json({ error: 'Invalid serverUrl' }, { status: 400 });
    }

    const url = `${base}/v1/dashboard/site/${siteId}/cameras`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'X-Site-Id': siteId,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const data = await response.json();

      return NextResponse.json(
        { ok: response.ok, status: response.status, data },
        { status: response.status }
      );
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json({ error: 'Request timeout' }, { status: 504 });
      }
      throw error;
    }
  } catch (error) {
    console.error('Dashboard cameras error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
