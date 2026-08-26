const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

const TOKEN_KEY = "wealth-loop-token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getAuthToken();
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${path} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `API ${path} failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; detail?: { error?: string } };
      message = data.error || data.detail?.error || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

async function send<T>(path: string, method: "PATCH" | "DELETE" | "PUT", body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    cache: "no-store",
    headers: authHeaders(body === undefined ? undefined : { "Content-Type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `API ${path} failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; detail?: { error?: string } | string };
      message =
        data.error ||
        (typeof data.detail === "string" ? data.detail : data.detail?.error) ||
        message;
    } catch {
      /* keep the status-code message */
    }
    throw new Error(message);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return send<T>(path, "PATCH", body);
}

export function apiDelete<T>(path: string): Promise<T> {
  return send<T>(path, "DELETE");
}

/**
 * Fetch a binary export and hand it to the browser as a download.
 * A plain <a href> can't carry the bearer token, so pull the bytes first.
 */
export async function apiDownload(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) {
    let message = `Export failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; detail?: { error?: string } };
      message = data.error || data.detail?.error || message;
    } catch {
      /* keep the status-code message */
    }
    throw new Error(message);
  }

  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? fallbackName;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export { API_BASE, TOKEN_KEY };
