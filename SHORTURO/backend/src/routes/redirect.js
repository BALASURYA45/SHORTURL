const express = require("express");
const jwt = require("jsonwebtoken");
const UAParser = require("ua-parser-js");
const Link = require("../models/Link");
const Visit = require("../models/Visit");
const { env } = require("../config/env");
const { lookupGeo } = require("../geo");
const { getOrSetVisitorId, getReferrerHost, mergeQueryIntoDestination, safeString } = require("../utils/tracking");
const { incrementUsage } = require("../utils/metering");

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

    if (link.active === false) {
      return res.status(404).json({ error: "Link disabled" });
    }

    if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) {
      return res.status(404).json({ error: "Link expired" });
    }

    const visitedAt = new Date();
    const ip = req.ip || null;
    const userAgent = req.get("user-agent") || null;
    const userId = tryGetUserIdFromAuthHeader(req);
    const visitorId = getOrSetVisitorId(req, res, { secure: env.nodeEnv === "production" });

    const referrer = safeString(req.get("referer") || req.get("referrer"), { max: 1024 });
    const referrerHost = getReferrerHost(referrer);

    const utmSource = safeString(req.query.utm_source, { max: 128 });
    const utmMedium = safeString(req.query.utm_medium, { max: 128 });
    const utmCampaign = safeString(req.query.utm_campaign, { max: 128 });
    const utmTerm = safeString(req.query.utm_term, { max: 128 });
    const utmContent = safeString(req.query.utm_content, { max: 128 });

    const ua = new UAParser(userAgent || undefined).getResult();
    const browser = ua?.browser?.name || null;
    const os = ua?.os?.name || null;
    const device = ua?.device?.type || "desktop";

    const geo = await lookupGeo({ mmdbPath: env.geoLite2CityMmdbPath, ip });

    // Fire-and-forget style updates; awaited to keep behavior deterministic for now.
    await Promise.all([
      Link.updateOne({ _id: link._id }, { $inc: { clicks: 1 }, $set: { lastVisitedAt: visitedAt } }),
      incrementUsage(link.userId, { redirects: 1 }),
      Visit.create({
        linkId: link._id,
        userId,
        visitedAt,
        kind: "click",
        visitorId,
        ip,
        userAgent,
        browser,
        os,
        device,
        referrer,
        referrerHost,
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
        country: geo?.country || null,
        region: geo?.region || null,
        city: geo?.city || null,
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null
      })
    ]);

    const destination = mergeQueryIntoDestination(link.originalUrl, req.query);
    return res.redirect(302, destination);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
