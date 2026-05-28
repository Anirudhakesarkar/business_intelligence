import '@/lib/school-persistence/init';
import {
  createOrganization,
  listOrganizations
} from "../../../lib/organizations/repository";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const result = listOrganizations({
    search: url.searchParams.get("search") ?? undefined,
    industryType: url.searchParams.get("industryType") ?? undefined,
    businessType: url.searchParams.get("businessType") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    city: url.searchParams.get("city") ?? undefined,
    state: url.searchParams.get("state") ?? undefined,
    page: Number(url.searchParams.get("page") ?? 1),
    pageSize: Number(url.searchParams.get("pageSize") ?? 20)
  });
  return json(result);
}

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const created = createOrganization(body as never, 1);
  if (!created.ok) return json({ errors: created.errors }, 400);
  return json(created.data, 201);
}
