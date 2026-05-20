const { env } = require("../config/env");

function adminRequired(req, res, next) {
  const email = String(req.user?.email || "").trim().toLowerCase();
  const allowList = env.adminEmails || [];
  if (!email) return res.status(401).json({ error: "Unauthorized" });
  if (allowList.length === 0) return res.status(403).json({ error: "Admin access is not configured" });
  if (!allowList.includes(email)) return res.status(403).json({ error: "Forbidden" });
  return next();
}

module.exports = { adminRequired };

