const express = require("express");
const Link = require("../models/Link");
const Visit = require("../models/Visit");
const { env } = require("../config/env");
const { getOrSetVisitorId, getReferrerHost, safeString } = require("../utils/tracking");
const { incrementUsage } = require("../utils/metering");

const router = express.Router();

function toPublicLink(link) {
  return {
    slug: link.slug,
    shortUrl: env.baseUrl ? `${env.baseUrl}/${link.slug}` : null,
    active: link.active !== false,
    clicks: link.clicks,
    lastVisitedAt: link.lastVisitedAt,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt
  };
}

// POST /api/public/conversion
// Body: { slug, name }
router.post("/conversion", async (req, res, next) => {
  try {
    const slug = String(req.body?.slug || "").trim();
    const name = safeString(req.body?.name, { max: 80 }) || "conversion";
    if (!slug) return res.status(400).json({ error: "slug is required" });

    const link = await Link.findOne({ slug }).lean();
    if (!link) return res.status(404).json({ error: "Not found" });
    if (link.active === false) return res.status(404).json({ error: "Not found" });
    if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) return res.status(404).json({ error: "Link expired" });

    const visitedAt = new Date();
    const visitorId = getOrSetVisitorId(req, res, { secure: env.nodeEnv === "production" });
    const userAgent = safeString(req.get("user-agent"), { max: 512 });
    const ip = req.ip || null;
    const referrer = safeString(req.get("referer") || req.get("referrer"), { max: 1024 });
    const referrerHost = getReferrerHost(referrer);

    const utmSource = safeString(req.query.utm_source, { max: 128 });
    const utmMedium = safeString(req.query.utm_medium, { max: 128 });
    const utmCampaign = safeString(req.query.utm_campaign, { max: 128 });
    const utmTerm = safeString(req.query.utm_term, { max: 128 });
    const utmContent = safeString(req.query.utm_content, { max: 128 });

    await Visit.create({
      linkId: link._id,
      userId: link.userId,
      visitedAt,
      kind: "conversion",
      conversionName: name,
      visitorId,
      ip,
      userAgent,
      referrer,
      referrerHost,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent
    });

    await incrementUsage(link.userId, { conversions: 1 });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// GET /api/public/:slug?days=30
router.get("/:slug", async (req, res, next) => {
  try {
    const slug = String(req.params.slug || "").trim();
    if (!slug) return res.status(404).json({ error: "Not found" });

    const daysRaw = req.query.days;
    const days = Math.min(365, Math.max(1, Number.parseInt(String(daysRaw || "30"), 10)));
    if (!Number.isFinite(days)) return res.status(400).json({ error: "Invalid days" });

    const link = await Link.findOne({ slug }).lean();
    if (!link) return res.status(404).json({ error: "Not found" });

    if (link.active === false) {
      return res.status(404).json({ error: "Not found" });
    }

    if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) {
      return res.status(404).json({ error: "Link expired" });
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const rows = await Visit.aggregate([
      { $match: { linkId: link._id, kind: "click", visitedAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$visitedAt" } },
          clicks: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const byDate = new Map(rows.map((r) => [r._id, r.clicks]));
    const series = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, clicks: byDate.get(key) || 0 });
    }

    return res.json({
      link: toPublicLink(link),
      days,
      series
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
