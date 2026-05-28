export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export function err(message: string, status = 400) {
  return json({ error: message }, status);
}
