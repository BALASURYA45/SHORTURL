const maxmind = require("maxmind");

let readerPromise = null;

function normalizeIp(raw) {
  if (!raw) return null;
  const ip = String(raw).trim();
  if (!ip) return null;
  if (ip === "::1") return "127.0.0.1";
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  return ip;
}

async function getReader(mmdbPath) {
  if (!mmdbPath) return null;
  if (!readerPromise) {
    readerPromise = maxmind.open(mmdbPath).catch(() => null);
  }
  return readerPromise;
}

async function lookupGeo({ mmdbPath, ip }) {
  const normalizedIp = normalizeIp(ip);
  if (!normalizedIp) return null;
  const reader = await getReader(mmdbPath);
  if (!reader) return null;

  try {
    const res = reader.get(normalizedIp);
    if (!res) return null;
    return {
      country: res.country?.iso_code || null,
      region: res.subdivisions?.[0]?.iso_code || null,
      city: res.city?.names?.en || null,
      latitude: Number.isFinite(res.location?.latitude) ? res.location.latitude : null,
      longitude: Number.isFinite(res.location?.longitude) ? res.location.longitude : null
    };
  } catch {
    return null;
  }
}

module.exports = { lookupGeo, normalizeIp };

