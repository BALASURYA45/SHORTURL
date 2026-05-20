import { getToken, setToken } from "./auth.js";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export class ApiError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch(path, { method = "GET", body, token, headers } = {}) {
  const authToken = token ?? getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : null),
      ...(headers || null)
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
      try {
        sessionStorage.setItem("shorturo_session_expired", "1");
      } catch {
        // ignore
      }
      window.dispatchEvent(new Event("shorturo:session-expired"));
    }
    const message = data?.error || `Request failed (${res.status})`;
    throw new ApiError(message, { status: res.status });
  }

  return data;
}

async function apiFetchBlob(path, { method = "GET", token, headers } = {}) {
  const authToken = token ?? getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : null),
      ...(headers || null)
    }
  });

  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
      try {
        sessionStorage.setItem("shorturo_session_expired", "1");
      } catch {
        // ignore
      }
      window.dispatchEvent(new Event("shorturo:session-expired"));
    }
    let message = `Request failed (${res.status})`;
    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    if (isJson) {
      const data = await res.json().catch(() => null);
      message = data?.error || message;
    }
    throw new ApiError(message, { status: res.status });
  }

  return res.blob();
}

export async function apiFetchText(path, { method = "GET", token, headers } = {}) {
  const authToken = token ?? getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : null),
      ...(headers || null)
    }
  });

  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
      try {
        sessionStorage.setItem("shorturo_session_expired", "1");
      } catch {
        // ignore
      }
      window.dispatchEvent(new Event("shorturo:session-expired"));
    }
    let message = `Request failed (${res.status})`;
    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    if (isJson) {
      const data = await res.json().catch(() => null);
      message = data?.error || message;
    }
    throw new ApiError(message, { status: res.status });
  }

  return res.text();
}

export function signup({ email, password }) {
  return apiFetch("/api/auth/signup", { method: "POST", body: { email, password } });
}

export function login({ email, password }) {
  return apiFetch("/api/auth/login", { method: "POST", body: { email, password } });
}

export function createLink({ originalUrl, customSlug, expiresAt }) {
  return apiFetch("/api/links", { method: "POST", body: { originalUrl, customSlug, expiresAt } });
}

export function listLinks() {
  return apiFetch("/api/links", { method: "GET" });
}

export function deleteLink(id) {
  return apiFetch(`/api/links/${id}`, { method: "DELETE" });
}

export function getLinkAnalytics(id) {
  return apiFetch(`/api/links/${id}/analytics`, { method: "GET" });
}

export function updateLink(id, { originalUrl, customSlug, expiresAt, active }) {
  return apiFetch(`/api/links/${id}`, { method: "PATCH", body: { originalUrl, customSlug, expiresAt, active } });
}

export function getLinkQrPng(id) {
  return apiFetchBlob(`/api/links/${id}/qr`, { method: "GET" });
}

export function getLinkQr(id, { format = "png", size = 320, margin = 1, ecc = "M", dark = "#111827", light = "#FFFFFF" } = {}) {
  const qs = new URLSearchParams();
  qs.set("format", String(format));
  qs.set("size", String(size));
  qs.set("margin", String(margin));
  qs.set("ecc", String(ecc));
  qs.set("dark", String(dark));
  qs.set("light", String(light));
  return apiFetchBlob(`/api/links/${id}/qr?${qs.toString()}`, { method: "GET" });
}

export function getLinkTrends(id, { days = 30 } = {}) {
  return apiFetch(`/api/links/${id}/trends?days=${encodeURIComponent(String(days))}`, { method: "GET" });
}

export function getLinkAdvancedAnalytics(id, { days = 30 } = {}) {
  return apiFetch(`/api/links/${id}/advanced?days=${encodeURIComponent(String(days))}`, { method: "GET" });
}

export function exportLinkCsv(id, { kind = "click", days = 30 } = {}) {
  return apiFetchText(
    `/api/links/${encodeURIComponent(String(id))}/export.csv?kind=${encodeURIComponent(String(kind))}&days=${encodeURIComponent(String(days))}`,
    { method: "GET" }
  );
}

export function getPublicStats(slug, { days = 30 } = {}) {
  return apiFetch(`/api/public/${encodeURIComponent(String(slug))}?days=${encodeURIComponent(String(days))}`, {
    method: "GET",
    token: null
  });
}

export function bulkCreateLinks(items) {
  return apiFetch("/api/links/bulk", { method: "POST", body: { items } });
}

export function getLinkBreakdown(id, { days = 30 } = {}) {
  return apiFetch(`/api/links/${id}/breakdown?days=${encodeURIComponent(String(days))}`, { method: "GET" });
}

export function getLinkGeo(id, { days = 30 } = {}) {
  return apiFetch(`/api/links/${id}/geo?days=${encodeURIComponent(String(days))}`, { method: "GET" });
}

export function regenerateLinkSlug(id) {
  return apiFetch(`/api/links/${id}/regenerate-slug`, { method: "POST" });
}

export function getMe() {
  return apiFetch("/api/account/me", { method: "GET" });
}

export function adminListUsers({ q = "" } = {}) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", String(q));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/admin/users${suffix}`, { method: "GET" });
}

export function adminUpdateUserPlan(id, { plan }) {
  return apiFetch(`/api/admin/users/${encodeURIComponent(String(id))}`, { method: "PATCH", body: { plan } });
}
