const dotenv = require("dotenv");

dotenv.config();

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

const env = {
  nodeEnv: readEnv("NODE_ENV", "development"),
  port: Number.parseInt(readEnv("PORT", "4000"), 10),
  frontendOrigin: readEnv("FRONTEND_ORIGIN", "http://localhost:5173"),
  baseUrl: normalizeBaseUrl(readEnv("BASE_URL", "http://localhost:4000")),

  // required later 
  jwtSecret: readEnv("JWT_SECRET", null),
  mongoUri: readEnv("MONGODB_URI", null)
};

function assertValidEnv() {
  if (!Number.isFinite(env.port) || env.port <= 0) throw new Error("PORT must be a valid number");
  requireEnv("MONGODB_URI");
  requireEnv("JWT_SECRET");
}

module.exports = { env, requireEnv, assertValidEnv };
