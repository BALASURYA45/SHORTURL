const dotenv = require("dotenv");
const path = require("path");

// Load env vars from .env. Support running the process from either:
// - backend/ (normal: `npm run dev`)
// - backend/src or other working dirs (e.g. some nodemon setups)
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function readEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === null || value === "") return fallback;
  return value;
}

function requireEnv(name) {
  const value = readEnv(name, null);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function normalizeBaseUrl(input) {
  const base = (input || "").trim().replace(/\/+$/, "");
  return base || null;
}

function readBool(name, fallback) {
  const raw = readEnv(name, null);
  if (raw === null) return fallback;
  const v = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(v)) return true;
  if (["0", "false", "no", "n", "off"].includes(v)) return false;
  return fallback;
}

function readCsvLower(name) {
  const raw = readEnv(name, "");
  return String(raw)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const env = {
  nodeEnv: readEnv("NODE_ENV", "development"),
  port: Number.parseInt(readEnv("PORT", "4000"), 10),
  // Comma-separated list is supported. Wildcards like "*.vercel.app" are supported in app-level CORS checks.
  frontendOrigin: readEnv("FRONTEND_ORIGIN", "http://localhost:5173"),
  frontendOrigins: null,
  baseUrl: normalizeBaseUrl(readEnv("BASE_URL", "http://localhost:4000")),

  // required later 
  jwtSecret: readEnv("JWT_SECRET", null),
  mongoUri: readEnv("MONGODB_URI", null),
  slugSecret: readEnv("SLUG_SECRET", readEnv("JWT_SECRET", null)),

  // optional
  geoLite2CityMmdbPath: readEnv("GEOLITE2_CITY_MMDB_PATH", null),
  trustProxy: readBool("TRUST_PROXY", false),
  adminEmails: readCsvLower("ADMIN_EMAILS"),

  // URL safety checks
  urlSafetyMode: readEnv("URL_SAFETY_MODE", "heuristic"),
  safeBrowsingApiKey: readEnv("SAFE_BROWSING_API_KEY", "")
};

env.frontendOrigins = readCsvLower("FRONTEND_ORIGIN");
if (!env.frontendOrigins.length && env.frontendOrigin) env.frontendOrigins = [String(env.frontendOrigin).trim().toLowerCase()];

function assertValidEnv() {
  if (!Number.isFinite(env.port) || env.port <= 0) throw new Error("PORT must be a valid number");
  requireEnv("MONGODB_URI");
  requireEnv("JWT_SECRET");
}

module.exports = { env, requireEnv, assertValidEnv };
