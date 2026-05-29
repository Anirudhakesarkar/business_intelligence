/** Safe client fetch when API may return empty body (e.g. 503) or invalid JSON. */
export async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    const text = await res.text();
    if (!text.trim()) return fallback;
    const data = JSON.parse(text) as T;
    if (!res.ok) return fallback;
    return data;
  } catch {
    return fallback;
  }
}

export class FetchJsonError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Production fetch — throws on HTTP/JSON failures instead of returning fallback data. */
export async function fetchJsonStrict<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const text = await res.text();
  if (!text.trim()) {
    throw new FetchJsonError(`Empty response from ${url}`, res.status);
  }
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new FetchJsonError(`Invalid JSON from ${url}`, res.status);
  }
  if (!res.ok) {
    const errMsg =
      typeof data === 'object' && data != null && 'error' in data
        ? String((data as { error?: string }).error)
        : `HTTP ${res.status}`;
    throw new FetchJsonError(errMsg, res.status);
  }
  return data;
}
