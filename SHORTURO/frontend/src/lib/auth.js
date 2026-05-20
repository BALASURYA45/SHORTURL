const TOKEN_KEY = "shorturo_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function decodeBase64Url(input) {
  const s = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  try {
    return atob(s + pad);
  } catch {
    return null;
  }
}

export function getTokenPayload() {
  const token = getToken();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const json = decodeBase64Url(parts[1]);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getTokenSubject() {
  const token = getToken();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const payload = getTokenPayload();
  return payload?.sub ? String(payload.sub) : null;
}

export function setToken(token) {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event("shorturo:auth"));
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("shorturo:auth"));
}
