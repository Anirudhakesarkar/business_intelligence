type JsonRequestBody = unknown;

export function schoolApiGet<T = unknown>(url: string): Promise<T> {
  return fetch(url).then((response) => response.json() as Promise<T>);
}

export function schoolApiPost<T = unknown>(url: string, body: JsonRequestBody): Promise<T> {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then((response) => response.json() as Promise<T>);
}

export async function schoolApiPatch<T = unknown>(url: string, body: JsonRequestBody): Promise<T> {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data as T;
}

export async function schoolApiDelete<T = unknown>(url: string): Promise<T> {
  const response = await fetch(url, { method: 'DELETE' });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data as T;
}
