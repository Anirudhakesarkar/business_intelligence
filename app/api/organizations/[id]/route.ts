import '@/lib/school-persistence/init';
import {
  getOrganizationById,
  softDeleteOrganization,
  updateOrganization
} from "../../../../lib/organizations/repository";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const data = getOrganizationById(Number(ctx.params.id));
  if (!data) return json({ error: "Organization not found." }, 404);
  return json(data);
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const body = (await req.json()) as Record<string, unknown>;
  const isAdmin = true;
  const updated = updateOrganization(Number(ctx.params.id), body as never, 1, isAdmin);
  if (!updated.ok) return json({ errors: updated.errors }, 400);
  return json(updated.data);
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const deleted = softDeleteOrganization(Number(ctx.params.id), 1);
  if (!deleted.ok) return json({ errors: deleted.errors }, 404);
  return json({ success: true });
}
