// Thin fetch wrapper. The SPA has one origin (the gateway); tool calls carry
// the active company as X-Company-Id so the backend can scope by tenant.

const ACTIVE_COMPANY_KEY = 'activeCompanyId';

export function getActiveCompanyId(): string | null {
  return localStorage.getItem(ACTIVE_COMPANY_KEY);
}

export function setActiveCompanyId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_COMPANY_KEY, id);
  else localStorage.removeItem(ACTIVE_COMPANY_KEY);
}

/**
 * Fetch a tool endpoint under /api/tools/*, injecting the active company header.
 * Do NOT set content-type when passing FormData — the browser sets the multipart
 * boundary itself.
 */
export function toolFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const company = getActiveCompanyId();
  const headers = new Headers(init.headers);
  if (company) headers.set('X-Company-Id', company);
  return fetch(path, { ...init, headers });
}
