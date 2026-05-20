const crypto = require("crypto");

function parseCookies(header) {
  const out = {};
  const raw = String(header || "");
  if (!raw) return out;
  const parts = raw.split(";");
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function safeString(input, { max = 512 } = {}) {
  if (input === undefined || input === null) return null;
  const s = String(input).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function getReferrerHost(referrer) {
  const r = safeString(referrer, { max: 1024 });
  if (!r) return null;
  try {
    const url = new URL(r);
    return url.host || null;
  } catch {
    return null;
  }
}

function mergeQueryIntoDestination(originalUrl, queryObj) {
  try {
    const url = new URL(originalUrl);
    const q = queryObj || {};
    for (const [k, v] of Object.entries(q)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, String(item));
      } else {
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  } catch {
    return originalUrl;
  }
}

function getOrSetVisitorId(req, res, { cookieName = "sr_vid", secure = false } = {}) {
  const cookies = parseCookies(req.headers.cookie);
  const existing = safeString(cookies[cookieName], { max: 128 });
  if (existing && /^[a-zA-Z0-9_-]{12,128}$/.test(existing)) return existing;

  const next = crypto.randomBytes(18).toString("base64url");
  // 1 year
  res.cookie(cookieName, next, {
    httpOnly: true,
    sameSite: "lax",
    secure: Boolean(secure),
    maxAge: 1000 * 60 * 60 * 24 * 365
  });
  return next;
}

module.exports = {
  parseCookies,
  safeString,
  getReferrerHost,
  mergeQueryIntoDestination,
  getOrSetVisitorId
};

