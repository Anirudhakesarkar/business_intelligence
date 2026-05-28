import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authorizeSchoolRequest, isSchoolApiPath } from '@/lib/school-auth/rbac';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isSchoolApiPath(pathname)) {
    return NextResponse.next();
  }

  const auth = await authorizeSchoolRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const headers = new Headers(request.headers);
  headers.set('x-school-principal', JSON.stringify(auth.principal));
  headers.set('x-school-permission', auth.permission);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/api/:path*'],
};
