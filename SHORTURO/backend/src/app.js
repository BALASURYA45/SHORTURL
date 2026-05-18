const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { env } = require("./config/env");
const { notFound, errorHandler } = require("./middleware/errors");
const authRoutes = require("./routes/auth");

function createApp() {
  const app = express();

  // Security + core middleware
  app.use(helmet());
  app.use(
    cors({
      origin: env.frontendOrigin,
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

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
