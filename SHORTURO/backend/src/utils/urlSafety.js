const dns = require("node:dns/promises");

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

function isPrivateIpv6(ip) {
  const s = String(ip || "").trim().toLowerCase();
  if (!s) return false;
  if (s === "::1") return true;
  if (s.startsWith("fc") || s.startsWith("fd")) return true; // unique local
  if (s.startsWith("fe80:")) return true; // link-local
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

function hasSuspiciousStructure(hostname) {
  const host = String(hostname || "").toLowerCase();
  const labels = host.split(".").filter(Boolean);
  if (host.includes("xn--")) return true; // punycode/homograph risk
  if (labels.length >= 5) return true; // excessive subdomains
  if ((host.match(/-/g) || []).length >= 4) return true;
  if ((host.match(/\d/g) || []).length >= 8) return true;
  return false;
}

function hasSuspiciousTerms(url) {
  const host = String(url.hostname || "").toLowerCase();
  const path = String(url.pathname || "").toLowerCase();
  const search = String(url.search || "").toLowerCase();
  const raw = `${host} ${path} ${search}`;

  const suspiciousTerms = [
    "login",
    "signin",
    "verify",
    "verification",
    "secure",
    "security",
    "update",
    "wallet",
    "bank",
    "bonus",
    "gift",
    "claim",
    "airdrop",
    "crypto",
    "seedphrase",
    "password",
    "support"
  ];

  const brandTerms = [
    "paypal",
    "google",
    "microsoft",
    "apple",
    "amazon",
    "instagram",
    "facebook",
    "whatsapp",
    "telegram",
    "binance",
    "coinbase",
    "metamask"
  ];

  const suspiciousCount = suspiciousTerms.filter((t) => raw.includes(t)).length;
  const brandCount = brandTerms.filter((t) => raw.includes(t)).length;

  // Brand + auth/urgency language is a common phishing shape.
  if (brandCount > 0 && suspiciousCount > 0) return true;
  if (suspiciousCount >= 3) return true;
  if (path.includes("/@")) return true;
  if (search.includes("redirect=") || search.includes("return=") || search.includes("url=") || search.includes("next=")) {
    return true;
  }
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
  if (hasSuspiciousStructure(hostname)) return { ok: false, verdict: "unsafe", reason: "suspicious_host" };
  if (hasSuspiciousTerms(url)) return { ok: false, verdict: "unsafe", reason: "suspicious_terms" };

  // Prevent common open-redirect tricks in path/query (basic).
  const raw = (url.pathname + url.search + url.hash).toLowerCase();
  if (raw.includes("javascript:") || raw.includes("data:")) return { ok: false, verdict: "unsafe", reason: "script_scheme" };

  return { ok: true, verdict: "safe" };
}

async function dnsCheck(hostname) {
  const host = String(hostname || "").trim();
  if (!host) return { ok: false, verdict: "unsafe", reason: "missing_hostname" };

  // If hostname is an IP literal, just validate it.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    if (isPrivateIpv4(host)) return { ok: false, verdict: "unsafe", reason: "private_ip" };
    return { ok: true, verdict: "safe", dns: { a: [host], aaaa: [] } };
  }
  if (host.includes(":")) {
    if (isPrivateIpv6(host)) return { ok: false, verdict: "unsafe", reason: "private_ip" };
    return { ok: true, verdict: "safe", dns: { a: [], aaaa: [host] } };
  }

  try {
    const [a, aaaa] = await Promise.allSettled([dns.resolve4(host), dns.resolve6(host)]);
    const aRecords = a.status === "fulfilled" ? a.value : [];
    const aaaaRecords = aaaa.status === "fulfilled" ? aaaa.value : [];

    if (!aRecords.length && !aaaaRecords.length) {
      return { ok: false, verdict: "unverified", reason: "dns_no_records" };
    }
    if (aRecords.some(isPrivateIpv4) || aaaaRecords.some(isPrivateIpv6)) {
      return { ok: false, verdict: "unsafe", reason: "dns_private_ip" };
    }
    return { ok: true, verdict: "safe", dns: { a: aRecords, aaaa: aaaaRecords } };
  } catch {
    return { ok: false, verdict: "unverified", reason: "dns_error" };
  }
}

function safeJsonParse(text) {
  if (!text) return null;
  const s = String(text);
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function openAiUrlClassify({ originalUrl, dnsInfo, apiKey, model }) {
  const endpoint = "https://api.openai.com/v1/responses";
  const payload = {
    model: model || "gpt-4o-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "text",
            text:
              "You are a URL safety classifier for a URL shortener. " +
              "You must ONLY use the provided URL string and DNS/IP information. " +
              "Do NOT browse the web or fetch the URL. " +
              "Return STRICT JSON with keys: verdict (safe|unsafe|unverified), confidence (0-1), reason (short string). " +
              "Be conservative: if unsure, return unverified."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify({ url: String(originalUrl), dns: dnsInfo || null })
          }
        ]
      }
    ],
    // Keep costs/latency low; we only need a short JSON.
    max_output_tokens: 120
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = new Error(`OpenAI classify failed (${res.status})`);
    err.statusCode = 503;
    throw err;
  }

  const data = await res.json().catch(() => null);
  const outputText = Array.isArray(data?.output)
    ? data.output
        .flatMap((o) => (Array.isArray(o?.content) ? o.content : []))
        .filter((c) => c?.type === "output_text")
        .map((c) => c.text)
        .join("\n")
    : "";

  const parsed = safeJsonParse(outputText);
  if (!parsed || !parsed.verdict) return { ok: false, verdict: "unverified", reason: "ai_parse_failed" };
  const verdict = String(parsed.verdict || "").toLowerCase();
  if (verdict === "safe") return { ok: true, verdict: "safe" };
  if (verdict === "unsafe") return { ok: false, verdict: "unsafe", reason: String(parsed.reason || "ai_flagged") };
  return { ok: false, verdict: "unverified", reason: String(parsed.reason || "ai_uncertain") };
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
async function checkUrlSafety(
  originalUrl,
  { mode = "heuristic", safeBrowsingApiKey = "", openaiApiKey = "", openaiModel = "gpt-4o-mini" } = {}
) {
  const heuristic = heuristicCheck(originalUrl);
  if (!heuristic.ok) return heuristic;

  // DNS check (no HTTP fetch) to prevent private-network targets / SSRF.
  let hostname = "";
  try {
    hostname = new URL(String(originalUrl).trim()).hostname;
  } catch {
    // already handled by heuristic
  }
  const dnsResult = await dnsCheck(hostname);
  if (!dnsResult.ok) return dnsResult;

  if (mode === "heuristic") return heuristic;

  if (mode === "safebrowsing") {
    if (!safeBrowsingApiKey) {
      return { ok: false, verdict: "unverified", reason: "global_list_unavailable" };
    }
    const sb = await safeBrowsingCheck(originalUrl, safeBrowsingApiKey);
    if (!sb.ok) return { ok: false, verdict: "unsafe", reason: "threat_list_match" };
    return { ok: true, verdict: "safe" };
  }

  if (mode === "ai") {
    if (!openaiApiKey) return { ok: false, verdict: "unverified", reason: "global_list_unavailable" };
    return openAiUrlClassify({ originalUrl, dnsInfo: dnsResult.dns || null, apiKey: openaiApiKey, model: openaiModel });
  }

  return heuristic;
}

module.exports = { checkUrlSafety };
