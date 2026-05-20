function isPrivateHostname(hostname) {
  const h = String(hostname || "").trim().toLowerCase();
  if (!h) return true;
  if (h === "localhost") return true;
  if (h.endsWith(".localhost")) return true;
  if (h === "127.0.0.1" || h === "::1") return true;
  if (h.endsWith(".local")) return true;
  return false;
}

function isPrivateIpv4(ip) {
  const parts = String(ip || "")
    .trim()
    .split(".")
    .map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isIpLike(hostname) {
  const h = String(hostname || "").trim();
  if (!h) return false;
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;
  // very rough IPv6 check
  if (h.includes(":")) return true;
  return false;
}

function heuristicCheck(originalUrl) {
  let url;
  try {
    url = new URL(String(originalUrl || "").trim());
  } catch {
    return { ok: false, verdict: "unsafe", reason: "invalid_url" };
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return { ok: false, verdict: "unsafe", reason: "unsupported_protocol" };
  }

  // Block credentials in URL (phishing + header injection risks).
  if (url.username || url.password) return { ok: false, verdict: "unsafe", reason: "userinfo_not_allowed" };

  const hostname = url.hostname;
  if (!hostname) return { ok: false, verdict: "unsafe", reason: "missing_hostname" };

  if (isPrivateHostname(hostname)) return { ok: false, verdict: "unsafe", reason: "private_host" };
  if (isIpLike(hostname) && isPrivateIpv4(hostname)) return { ok: false, verdict: "unsafe", reason: "private_ip" };

  // Prevent common open-redirect tricks in path/query (basic).
  const raw = (url.pathname + url.search + url.hash).toLowerCase();
  if (raw.includes("javascript:") || raw.includes("data:")) return { ok: false, verdict: "unsafe", reason: "script_scheme" };

  return { ok: true, verdict: "safe" };
}

async function safeBrowsingCheck(originalUrl, apiKey) {
  const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`;
  const body = {
    client: { clientId: "shorturo", clientVersion: "0.1.0" },
    threatInfo: {
      threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: [{ url: String(originalUrl) }]
    }
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = new Error(`Safe Browsing request failed (${res.status})`);
    err.statusCode = 503;
    throw err;
  }

  const data = await res.json().catch(() => null);
  const matches = Array.isArray(data?.matches) ? data.matches : [];
  return { ok: matches.length === 0, matches };
}

/**
 * URL threat detection
 *
 * Modes:
 * - "heuristic": basic checks only
 * - "safebrowsing": heuristic + Google Safe Browsing (requires SAFE_BROWSING_API_KEY)
 */
async function checkUrlSafety(originalUrl, { mode = "heuristic", safeBrowsingApiKey = "" } = {}) {
  const heuristic = heuristicCheck(originalUrl);
  if (!heuristic.ok) return heuristic;

  if (mode === "heuristic") return heuristic;

  if (mode === "safebrowsing") {
    if (!safeBrowsingApiKey) {
      return { ok: false, verdict: "unverified", reason: "global_list_unavailable" };
    }
    const sb = await safeBrowsingCheck(originalUrl, safeBrowsingApiKey);
    if (!sb.ok) return { ok: false, verdict: "unsafe", reason: "threat_list_match" };
    return { ok: true, verdict: "safe" };
  }

  return heuristic;
}

module.exports = { checkUrlSafety };

