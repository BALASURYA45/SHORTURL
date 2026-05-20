const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { env } = require("./config/env");
const { notFound, errorHandler } = require("./middleware/errors");
const { authRequired } = require("./middleware/auth");
const { adminRequired } = require("./middleware/admin");
const authRoutes = require("./routes/auth");
const linksRoutes = require("./routes/links");
const redirectRoutes = require("./routes/redirect");
const publicRoutes = require("./routes/public");
const accountRoutes = require("./routes/account");
const adminRoutes = require("./routes/admin");

function isAllowedOrigin(origin, allowed) {
  if (!origin) return true; // server-to-server / curl
  const o = String(origin).trim();
  if (!o) return true;

  let originUrl;
  try {
    originUrl = new URL(o);
  } catch {
    return false;
  }

  const originLower = originUrl.origin.toLowerCase();
  const hostname = originUrl.hostname.toLowerCase();

  for (const ruleRaw of allowed || []) {
    const rule = String(ruleRaw || "").trim().toLowerCase();
    if (!rule) continue;
    if (rule === "*") return true;
    if (rule === originLower) return true;

    if (rule.startsWith("*.")) {
      const suffix = rule.slice(1); // ".vercel.app"
      if (hostname.endsWith(suffix)) return true;
    }
  }

  return false;
}

function createApp() {
  const app = express();
  app.set("trust proxy", env.trustProxy);

  // Security + core middleware
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => {
        const allowed = env.frontendOrigins?.length ? env.frontendOrigins : [String(env.frontendOrigin || "").toLowerCase()];
        const ok = isAllowedOrigin(origin, allowed);
        cb(ok ? null : new Error("Not allowed by CORS"), ok);
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ ok: true, env: env.nodeEnv });
  });

  // Auth
  app.use("/api/auth", authRoutes);

  // Links (protected)
  app.use("/api/links", authRequired, linksRoutes);

  // Account (protected)
  app.use("/api/account", authRequired, accountRoutes);

  // Admin (protected)
  app.use("/api/admin", authRequired, adminRequired, adminRoutes);

  // Public stats (no auth)
  app.use("/api/public", publicRoutes);

  // Redirect (public) - keep after /api routes
  app.use("/", redirectRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
