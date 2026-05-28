/** Vision API base URL default for login / settings (not the Next.js page origin in dev). */
export const LOCAL_DEV_API_URL = 'http://localhost:8788';

/**
 * Default backend URL: env override → same host as dashboard (production) → localhost (dev).
 */
export function resolveDefaultServerUrl(): string {
  const configured = process.env.NEXT_PUBLIC_DEFAULT_SERVER_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return origin.replace(/\/+$/, '');
    }
  }

  return LOCAL_DEV_API_URL;
}
