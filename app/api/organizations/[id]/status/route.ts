import '@/lib/school-persistence/init';
import { updateOrganizationStatus } from "../../../../../lib/organizations/repository";
import { ORGANIZATION_STATUSES } from "../../../../../lib/organizations/types";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const body = (await req.json()) as { status?: string };
  if (!body.status || !ORGANIZATION_STATUSES.includes(body.status as never)) {
    return json({ error: "Invalid status." }, 400);
  }
  const updated = updateOrganizationStatus(Number(ctx.params.id), body.status as never, 1);
  if (!updated.ok) return json({ errors: updated.errors }, 404);
  return json(updated.data);
}
