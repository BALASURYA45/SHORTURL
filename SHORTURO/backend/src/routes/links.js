const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Link = require("../models/Link");
const Visit = require("../models/Visit");
const { env } = require("../config/env");
const { createLinkSchema, updateLinkSchema, bulkCreateLinksSchema } = require("../validation/schemas");
const qrcode = require("qrcode");

const router = express.Router();

function isDuplicateKeyError(err) {
  return Boolean(err && (err.code === 11000 || err.code === 11001));
}

function normalizeSlug(input) {
  if (!input) return null;
  return String(input).trim().toLowerCase();
}

function parseExpiresAt(expiresAt) {
  if (expiresAt === undefined) return undefined;
  if (expiresAt === null) return null;
  const dt = new Date(expiresAt);
  if (Number.isNaN(dt.getTime())) return "invalid";
  return dt;
}

function randomSlug(length = 7) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function createLinkWithUniqueSlug({ userId, originalUrl, customSlug, expiresAt }) {
  const expiresAtValue = parseExpiresAt(expiresAt);
  if (expiresAtValue === "invalid") {
    const err = new Error("Invalid expiresAt");
    err.statusCode = 400;
    throw err;
  }

  const desiredSlug = normalizeSlug(customSlug);
  if (desiredSlug) {
    return Link.create({ userId, originalUrl, slug: desiredSlug, expiresAt: expiresAtValue ?? null });
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const slug = randomSlug(7);
      // eslint-disable-next-line no-await-in-loop
      return await Link.create({ userId, originalUrl, slug, expiresAt: expiresAtValue ?? null });
    } catch (err) {
      if (isDuplicateKeyError(err)) continue;
      throw err;
    }
  }

  const err = new Error("Could not generate a unique short code. Try again.");
  err.statusCode = 503;
  throw err;
}

function toLinkResponse(link) {
  return {
    id: String(link._id),
    originalUrl: link.originalUrl,
    slug: link.slug,
    shortUrl: env.baseUrl ? `${env.baseUrl}/${link.slug}` : null,
    clicks: link.clicks,
    lastVisitedAt: link.lastVisitedAt,
    expiresAt: link.expiresAt,
    createdAt: link.createdAt
  };
}

function toVisitResponse(visit) {
  return {
    id: String(visit._id),
    visitedAt: visit.visitedAt,
    ip: visit.ip,
    userAgent: visit.userAgent
  };
}

// POST /api/links
router.post("/", async (req, res, next) => {
  try {
    const { originalUrl, customSlug, expiresAt } = createLinkSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const link = await createLinkWithUniqueSlug({ userId, originalUrl, customSlug, expiresAt });
    return res.status(201).json({ link: toLinkResponse(link) });
  } catch (err) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.errors?.[0]?.message || "Invalid input" });
    if (isDuplicateKeyError(err)) return res.status(409).json({ error: "Alias already in use" });
    return next(err);
  }
});

// POST /api/links/bulk
router.post("/bulk", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { items } = bulkCreateLinksSchema.parse(req.body);

    const results = [];
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      try {
        // eslint-disable-next-line no-await-in-loop
        const link = await createLinkWithUniqueSlug({
          userId,
          originalUrl: it.originalUrl,
          customSlug: it.customSlug,
          expiresAt: it.expiresAt
        });
        results.push({ index: i, ok: true, link: toLinkResponse(link) });
      } catch (err) {
        const message =
          err?.statusCode === 400
            ? err.message
            : isDuplicateKeyError(err)
              ? "Alias already in use"
              : "Failed to create link";
        results.push({ index: i, ok: false, error: message });
      }
    }

    return res.status(207).json({ results });
  } catch (err) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.errors?.[0]?.message || "Invalid input" });
    return next(err);
  }
});

// GET /api/links
router.get("/", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const links = await Link.find({ userId }).sort({ createdAt: -1 }).lean();
    res.json({ links: links.map((l) => toLinkResponse(l)) });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/links/:id
router.patch("/:id", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid link id" });

    const { originalUrl, customSlug, expiresAt } = updateLinkSchema.parse(req.body);

    const update = {};
    if (originalUrl !== undefined) update.originalUrl = originalUrl;
    if (customSlug !== undefined) update.slug = normalizeSlug(customSlug);
    if (expiresAt !== undefined) {
      if (expiresAt === null) update.expiresAt = null;
      else {
        const dt = new Date(expiresAt);
        if (Number.isNaN(dt.getTime())) return res.status(400).json({ error: "Invalid expiresAt" });
        update.expiresAt = dt;
      }
    }

    const link = await Link.findOneAndUpdate({ _id: id, userId }, { $set: update }, { new: true }).lean();
    if (!link) return res.status(404).json({ error: "Link not found" });

    return res.json({ link: toLinkResponse(link) });
  } catch (err) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.errors?.[0]?.message || "Invalid input" });
    if (isDuplicateKeyError(err)) return res.status(409).json({ error: "Alias already in use" });
    return next(err);
  }
});

// GET /api/links/:id/qr
router.get("/:id/qr", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid link id" });

    if (!env.baseUrl) return res.status(400).json({ error: "BASE_URL is not configured" });

    const link = await Link.findOne({ _id: id, userId }).lean();
    if (!link) return res.status(404).json({ error: "Link not found" });

    const shortUrl = `${env.baseUrl}/${link.slug}`;
    const png = await qrcode.toBuffer(shortUrl, { type: "png", width: 320, margin: 1, errorCorrectionLevel: "M" });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(png);
  } catch (err) {
    return next(err);
  }
});

// GET /api/links/:id/analytics
router.get("/:id/analytics", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid link id" });

    const link = await Link.findOne({ _id: id, userId }).lean();
    if (!link) return res.status(404).json({ error: "Link not found" });

    const visits = await Visit.find({ linkId: link._id })
      .sort({ visitedAt: -1 })
      .limit(20)
      .lean();

    return res.json({
      link: toLinkResponse(link),
      analytics: {
        totalClicks: link.clicks,
        lastVisitedAt: link.lastVisitedAt,
        recentVisits: visits.map((v) => toVisitResponse(v))
      }
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/links/:id/trends?days=30
router.get("/:id/trends", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid link id" });

    const daysRaw = req.query.days;
    const days = Math.min(365, Math.max(1, Number.parseInt(String(daysRaw || "30"), 10)));
    if (!Number.isFinite(days)) return res.status(400).json({ error: "Invalid days" });

    const link = await Link.findOne({ _id: id, userId }).lean();
    if (!link) return res.status(404).json({ error: "Link not found" });

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
      link: toLinkResponse(link),
      days,
      series
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/links/:id/breakdown?days=30
router.get("/:id/breakdown", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid link id" });

    const daysRaw = req.query.days;
    const days = Math.min(365, Math.max(1, Number.parseInt(String(daysRaw || "30"), 10)));
    if (!Number.isFinite(days)) return res.status(400).json({ error: "Invalid days" });

    const link = await Link.findOne({ _id: id, userId }).lean();
    if (!link) return res.status(404).json({ error: "Link not found" });

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const [byBrowser, byOs, byDevice] = await Promise.all([
      Visit.aggregate([
        { $match: { linkId: link._id, visitedAt: { $gte: start } } },
        { $group: { _id: { $ifNull: ["$browser", "Unknown"] }, clicks: { $sum: 1 } } },
        { $sort: { clicks: -1, _id: 1 } },
        { $limit: 12 }
      ]),
      Visit.aggregate([
        { $match: { linkId: link._id, visitedAt: { $gte: start } } },
        { $group: { _id: { $ifNull: ["$os", "Unknown"] }, clicks: { $sum: 1 } } },
        { $sort: { clicks: -1, _id: 1 } },
        { $limit: 12 }
      ]),
      Visit.aggregate([
        { $match: { linkId: link._id, visitedAt: { $gte: start } } },
        { $group: { _id: { $ifNull: ["$device", "Unknown"] }, clicks: { $sum: 1 } } },
        { $sort: { clicks: -1, _id: 1 } },
        { $limit: 12 }
      ])
    ]);

    function mapRows(rows) {
      return rows.map((r) => ({ name: r._id, clicks: r.clicks }));
    }

    return res.json({
      link: toLinkResponse(link),
      days,
      breakdown: {
        browser: mapRows(byBrowser),
        os: mapRows(byOs),
        device: mapRows(byDevice)
      }
    });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/links/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid link id" });

    const result = await Link.deleteOne({ _id: id, userId });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Link not found" });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
