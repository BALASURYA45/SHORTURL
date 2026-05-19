const express = require("express");
const jwt = require("jsonwebtoken");
const UAParser = require("ua-parser-js");
const Link = require("../models/Link");
const Visit = require("../models/Visit");
const { env } = require("../config/env");

const router = express.Router();

function tryGetUserIdFromAuthHeader(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    return payload?.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

// GET /:slug (public redirect)
router.get("/:slug", async (req, res, next) => {
  try {
    const slug = String(req.params.slug || "").trim();
    if (!slug) return res.status(404).json({ error: "Not found" });

    const link = await Link.findOne({ slug }).lean();
    if (!link) return res.status(404).json({ error: "Not found" });

    if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) {
      return res.status(404).json({ error: "Link expired" });
    }

    const visitedAt = new Date();
    const ip = req.ip || null;
    const userAgent = req.get("user-agent") || null;
    const userId = tryGetUserIdFromAuthHeader(req);

    const ua = new UAParser(userAgent || undefined).getResult();
    const browser = ua?.browser?.name || null;
    const os = ua?.os?.name || null;
    const device = ua?.device?.type || "desktop";

    // Fire-and-forget style updates; awaited to keep behavior deterministic for now.
    await Promise.all([
      Link.updateOne({ _id: link._id }, { $inc: { clicks: 1 }, $set: { lastVisitedAt: visitedAt } }),
      Visit.create({ linkId: link._id, userId, visitedAt, ip, userAgent, browser, os, device })
    ]);

    return res.redirect(302, link.originalUrl);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
