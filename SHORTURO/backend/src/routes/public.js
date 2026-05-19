const express = require("express");
const Link = require("../models/Link");
const Visit = require("../models/Visit");
const { env } = require("../config/env");

const router = express.Router();

function toPublicLink(link) {
  return {
    slug: link.slug,
    shortUrl: env.baseUrl ? `${env.baseUrl}/${link.slug}` : null,
    clicks: link.clicks,
    lastVisitedAt: link.lastVisitedAt,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt
  };
}

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

    if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) {
      return res.status(404).json({ error: "Link expired" });
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const rows = await Visit.aggregate([
      { $match: { linkId: link._id, visitedAt: { $gte: start } } },
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

