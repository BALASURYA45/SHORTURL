import { getToken, setToken } from "./auth.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

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

export function signup({ email, password }) {
  return apiFetch("/api/auth/signup", { method: "POST", body: { email, password } });
}

export function login({ email, password }) {
  return apiFetch("/api/auth/login", { method: "POST", body: { email, password } });
}

export function createLink({ originalUrl, customSlug }) {
  return apiFetch("/api/links", { method: "POST", body: { originalUrl, customSlug } });
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
