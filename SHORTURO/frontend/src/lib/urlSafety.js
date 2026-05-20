function hasSuspiciousStructure(hostname) {
  const host = String(hostname || "").toLowerCase();
  const labels = host.split(".").filter(Boolean);
  if (host.includes("xn--")) return true;
  if (labels.length >= 5) return true;
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

  if (brandCount > 0 && suspiciousCount > 0) return true;
  if (suspiciousCount >= 3) return true;
  if (path.includes("/@")) return true;
  if (search.includes("redirect=") || search.includes("return=") || search.includes("url=") || search.includes("next=")) {
    return true;
  }
  return false;
}

export function isSuspiciousUrl(input) {
  let url;
  try {
    url = new URL(String(input || "").trim());
  } catch {
    return false;
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") return true;
  if (url.username || url.password) return true;
  if (!url.hostname) return true;
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local")) return true;
  if (hasSuspiciousStructure(url.hostname)) return true;
  if (hasSuspiciousTerms(url)) return true;
  return false;
}

