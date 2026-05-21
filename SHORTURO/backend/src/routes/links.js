const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Link = require("../models/Link");
const Visit = require("../models/Visit");
const User = require("../models/User");
const { env } = require("../config/env");
const { createLinkSchema, updateLinkSchema, bulkCreateLinksSchema } = require("../validation/schemas");
const qrcode = require("qrcode");
const { ensureUsagePeriod } = require("../utils/usage");
const { getPlan } = require("../utils/plans");
const { checkUrlSafety } = require("../utils/urlSafety");

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

function sha256SlugFromInput(input, length = 10) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const digest = crypto.createHash("sha256").update(String(input)).digest();
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[digest[i] % alphabet.length];
  return out;
}

function parseSlugNonce(slugSalt) {
  const n = Number.parseInt(String(slugSalt ?? "0"), 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return n;
}

function slugForUrlAndNonce({ userId, originalUrl, nonce, length = 10 }) {
  // Deterministic for (userId, originalUrl, nonce). Nonce allows collision handling and regeneration.
  // Include a secret so slugs aren't trivially computed offline.
  const secret = env.slugSecret || env.jwtSecret || "";
  const url = String(originalUrl || "").trim();
  const uid = String(userId || "").trim();
  const n = Number.isFinite(nonce) && nonce >= 0 ? nonce : 0;
  return sha256SlugFromInput(`${secret}:${uid}:${url}:${n}`, length);
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
    return Link.create({ userId, originalUrl, slug: desiredSlug, slugType: "custom", slugSalt: null, expiresAt: expiresAtValue ?? null });
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const _id = new mongoose.Types.ObjectId();
      const nonce = attempt;
      const slug = slugForUrlAndNonce({ userId, originalUrl, nonce, length: 10 });
      // eslint-disable-next-line no-await-in-loop
      return await Link.create({
        _id,
        userId,
        originalUrl,
        slug,
        slugType: "generated",
        slugSalt: String(nonce),
        expiresAt: expiresAtValue ?? null
      });
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
    active: link.active !== false,
    slugType: link.slugType || "generated",
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

function csvCell(value) {
  if (value === undefined || value === null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toIsoOrEmpty(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString();
}

// POST /api/links
router.post("/", async (req, res, next) => {
  try {
    const { originalUrl, customSlug, expiresAt } = createLinkSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const safety = await checkUrlSafety(originalUrl, {
      mode: env.urlSafetyMode,
      safeBrowsingApiKey: env.safeBrowsingApiKey,
      openaiApiKey: env.openaiApiKey,
      openaiModel: env.openaiModel
    });
    if (!safety.ok) {
      if (safety.verdict === "unsafe") {
        return res.status(400).json({ error: "URL looks suspicious.", code: "suspicious_url" });
      }
      return res.status(400).json({
        error: "URL not matching with global URL lists.",
        code: "url_unverified"
      });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    ensureUsagePeriod(user);
    const plan = getPlan(user.plan);
    if ((user.usage?.linksCreated || 0) >= plan.limits.linksPerMonth) {
      return res.status(402).json({
        error: "Monthly link limit reached. Upgrade to Pro to create more links.",
        code: "quota_links_per_month",
        plan: plan.id,
        limit: plan.limits.linksPerMonth
      });
    }

    const link = await createLinkWithUniqueSlug({ userId, originalUrl, customSlug, expiresAt });

    user.usage.linksCreated = (user.usage.linksCreated || 0) + 1;
    await user.save();
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

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { items } = bulkCreateLinksSchema.parse(req.body);

    ensureUsagePeriod(user);
    const plan = getPlan(user.plan);
    if (items.length > plan.limits.bulkMaxItems) {
      return res.status(400).json({
        error: `Too many items. Max per bulk request is ${plan.limits.bulkMaxItems}.`,
        code: "bulk_max_items",
        limit: plan.limits.bulkMaxItems
      });
    }

    const remaining = Math.max(0, plan.limits.linksPerMonth - (user.usage?.linksCreated || 0));
    if (items.length > remaining) {
      return res.status(402).json({
        error: "Monthly link limit reached. Upgrade to Pro to create more links.",
        code: "quota_links_per_month",
        plan: plan.id,
        limit: plan.limits.linksPerMonth,
        remaining
      });
    }

    const results = [];
    let createdCount = 0;
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      try {
        // eslint-disable-next-line no-await-in-loop
        const safety = await checkUrlSafety(it.originalUrl, {
          mode: env.urlSafetyMode,
          safeBrowsingApiKey: env.safeBrowsingApiKey,
          openaiApiKey: env.openaiApiKey,
          openaiModel: env.openaiModel
        });
        if (!safety.ok) {
          const message =
            safety.verdict === "unsafe"
              ? "URL looks suspicious."
              : "URL not matching with global URL lists.";
          results.push({ index: i, ok: false, error: message });
          continue;
        }

        // eslint-disable-next-line no-await-in-loop
        const link = await createLinkWithUniqueSlug({
          userId,
          originalUrl: it.originalUrl,
          customSlug: it.customSlug,
          expiresAt: it.expiresAt
        });
        results.push({ index: i, ok: true, link: toLinkResponse(link) });
        createdCount += 1;
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

    if (createdCount > 0) {
      user.usage.linksCreated = (user.usage.linksCreated || 0) + createdCount;
      await user.save();
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

    const { originalUrl, customSlug, expiresAt, active } = updateLinkSchema.parse(req.body);

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
    if (active !== undefined) update.active = Boolean(active);

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

    const link = await Link.findOne({ _id: id, userId }).lean();
    if (!link) return res.status(404).json({ error: "Link not found" });

    const inferredBaseUrl = `${req.protocol}://${req.get("host")}`;
    const baseUrl = env.baseUrl || inferredBaseUrl;
    const shortUrl = `${baseUrl}/${link.slug}`;

    const fmtRaw = String(req.query.format || "png").toLowerCase();
    const format = fmtRaw === "svg" ? "svg" : "png";

    const sizeRaw = Number.parseInt(String(req.query.size || "320"), 10);
    const size = Number.isFinite(sizeRaw) ? Math.min(2048, Math.max(128, sizeRaw)) : 320;

    const marginRaw = Number.parseInt(String(req.query.margin ?? "1"), 10);
    const margin = Number.isFinite(marginRaw) ? Math.min(8, Math.max(0, marginRaw)) : 1;

    const eccRaw = String(req.query.ecc || "M").toUpperCase();
    const errorCorrectionLevel = ["L", "M", "Q", "H"].includes(eccRaw) ? eccRaw : "M";

    const dark = typeof req.query.dark === "string" ? String(req.query.dark).trim() : null;
    const light = typeof req.query.light === "string" ? String(req.query.light).trim() : null;
    const isHex = (v) => Boolean(v && /^#?[0-9a-fA-F]{6}$/.test(v));
    const normalizeHex = (v) => (v && v.startsWith("#") ? v : `#${v}`);
    const color = {
      dark: isHex(dark) ? normalizeHex(dark) : "#111827",
      light: isHex(light) ? normalizeHex(light) : "#FFFFFF"
    };

    if (format === "svg") {
      const svg = await qrcode.toString(shortUrl, {
        type: "svg",
        width: size,
        margin,
        errorCorrectionLevel,
        color
      });
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Disposition", `inline; filename="shorturo-${link.slug}.svg"`);
      return res.status(200).send(svg);
    }

    const png = await qrcode.toBuffer(shortUrl, {
      type: "png",
      width: size,
      margin,
      errorCorrectionLevel,
      color
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `inline; filename="shorturo-${link.slug}.png"`);
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

    const visits = await Visit.find({ linkId: link._id, kind: "click" })
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

// GET /api/links/:id/export.csv?kind=click|conversion&days=30
router.get("/:id/export.csv", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid link id" });

    const kindRaw = String(req.query.kind || "click").trim().toLowerCase();
    const kind = kindRaw === "conversion" ? "conversion" : "click";

    const daysRaw = req.query.days;
    const days = Math.min(365, Math.max(1, Number.parseInt(String(daysRaw || "30"), 10)));
    if (!Number.isFinite(days)) return res.status(400).json({ error: "Invalid days" });

    const link = await Link.findOne({ _id: id, userId }).lean();
    if (!link) return res.status(404).json({ error: "Link not found" });

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const rows = await Visit.find({ linkId: link._id, kind, visitedAt: { $gte: start } })
      .sort({ visitedAt: -1 })
      .limit(50_000)
      .lean();

    const header = [
      "visitedAt",
      "kind",
      "conversionName",
      "visitorId",
      "referrerHost",
      "utmSource",
      "utmMedium",
      "utmCampaign",
      "utmTerm",
      "utmContent",
      "device",
      "os",
      "browser",
      "country",
      "region",
      "city"
    ];

    const lines = [header.join(",")];
    for (const v of rows) {
      const line = [
        toIsoOrEmpty(v.visitedAt),
        v.kind || kind,
        v.conversionName || "",
        v.visitorId || "",
        v.referrerHost || "",
        v.utmSource || "",
        v.utmMedium || "",
        v.utmCampaign || "",
        v.utmTerm || "",
        v.utmContent || "",
        v.device || "",
        v.os || "",
        v.browser || "",
        v.country || "",
        v.region || "",
        v.city || ""
      ]
        .map(csvCell)
        .join(",");
      lines.push(line);
    }

    const csv = lines.join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `attachment; filename="shorturo-${link.slug}-${kind}-${days}d.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    return next(err);
  }
});

// GET /api/links/:id/advanced?days=30
router.get("/:id/advanced", async (req, res, next) => {
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

    const matchClicks = { linkId: link._id, kind: "click", visitedAt: { $gte: start } };
    const matchConversions = { linkId: link._id, kind: "conversion", visitedAt: { $gte: start } };

    const [totalClicks, totalConversions, uniqueVisitorIds, uniqueConverterIds] = await Promise.all([
      Visit.countDocuments(matchClicks),
      Visit.countDocuments(matchConversions),
      Visit.distinct("visitorId", { ...matchClicks, visitorId: { $ne: null } }),
      Visit.distinct("visitorId", { ...matchConversions, visitorId: { $ne: null } })
    ]);

    const [clickRows, uniqueRows, conversionRows, newVisitorRows, referrerRows, utmSourceRows, utmMediumRows, utmCampaignRows, cohortRows] =
      await Promise.all([
        Visit.aggregate([
          { $match: matchClicks },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$visitedAt" } },
              clicks: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]),
        Visit.aggregate([
          { $match: { ...matchClicks, visitorId: { $ne: null } } },
          {
            $group: {
              _id: {
                date: { $dateToString: { format: "%Y-%m-%d", date: "$visitedAt" } },
                visitorId: "$visitorId"
              }
            }
          },
          { $group: { _id: "$_id.date", uniques: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ]),
        Visit.aggregate([
          { $match: matchConversions },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$visitedAt" } },
              conversions: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]),
        Visit.aggregate([
          { $match: { linkId: link._id, kind: "click", visitorId: { $ne: null } } },
          { $group: { _id: "$visitorId", firstVisitedAt: { $min: "$visitedAt" } } },
          { $match: { firstVisitedAt: { $gte: start } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$firstVisitedAt" } }, newVisitors: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ]),
        Visit.aggregate([
          { $match: matchClicks },
          { $group: { _id: { $ifNull: ["$referrerHost", "Direct"] }, clicks: { $sum: 1 } } },
          { $sort: { clicks: -1, _id: 1 } },
          { $limit: 10 }
        ]),
        Visit.aggregate([
          { $match: matchClicks },
          { $group: { _id: { $ifNull: ["$utmSource", "(none)"] }, clicks: { $sum: 1 } } },
          { $sort: { clicks: -1, _id: 1 } },
          { $limit: 10 }
        ]),
        Visit.aggregate([
          { $match: matchClicks },
          { $group: { _id: { $ifNull: ["$utmMedium", "(none)"] }, clicks: { $sum: 1 } } },
          { $sort: { clicks: -1, _id: 1 } },
          { $limit: 10 }
        ]),
        Visit.aggregate([
          { $match: matchClicks },
          { $group: { _id: { $ifNull: ["$utmCampaign", "(none)"] }, clicks: { $sum: 1 } } },
          { $sort: { clicks: -1, _id: 1 } },
          { $limit: 10 }
        ])
        ,
        (async () => {
          // Cohorts: visitors first seen within window; retention flags for D+1 and D+7.
          const firsts = await Visit.aggregate([
            { $match: { linkId: link._id, kind: "click", visitorId: { $ne: null } } },
            { $group: { _id: "$visitorId", firstVisitedAt: { $min: "$visitedAt" } } },
            { $match: { firstVisitedAt: { $gte: start } } }
          ]);

          const visitorToFirst = new Map(firsts.map((r) => [String(r._id), new Date(r.firstVisitedAt)]));
          const visitorIds = Array.from(visitorToFirst.keys());
          if (visitorIds.length === 0) return [];

          const end = new Date();
          end.setHours(23, 59, 59, 999);

          const visits = await Visit.find({
            linkId: link._id,
            kind: "click",
            visitorId: { $in: visitorIds },
            visitedAt: { $gte: start, $lte: end }
          })
            .select({ visitorId: 1, visitedAt: 1 })
            .lean();

          const returnedD1 = new Set();
          const returnedD7 = new Set();
          for (const v of visits) {
            const vid = String(v.visitorId || "");
            const first = visitorToFirst.get(vid);
            if (!first) continue;
            const dt = new Date(v.visitedAt);
            if (Number.isNaN(dt.getTime())) continue;
            const diffDays = Math.floor((dt.getTime() - first.getTime()) / (24 * 60 * 60 * 1000));
            if (diffDays === 1) returnedD1.add(vid);
            if (diffDays === 7) returnedD7.add(vid);
          }

          const cohorts = new Map();
          for (const [vid, first] of visitorToFirst.entries()) {
            const dayKey = first.toISOString().slice(0, 10);
            const row = cohorts.get(dayKey) || { date: dayKey, size: 0, d1: 0, d7: 0 };
            row.size += 1;
            if (returnedD1.has(vid)) row.d1 += 1;
            if (returnedD7.has(vid)) row.d7 += 1;
            cohorts.set(dayKey, row);
          }

          return Array.from(cohorts.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
        })()
      ]);

    const clicksByDate = new Map(clickRows.map((r) => [r._id, r.clicks]));
    const uniquesByDate = new Map(uniqueRows.map((r) => [r._id, r.uniques]));
    const conversionsByDate = new Map(conversionRows.map((r) => [r._id, r.conversions]));
    const newVisitorsByDate = new Map(newVisitorRows.map((r) => [r._id, r.newVisitors]));

    const series = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const clicks = clicksByDate.get(key) || 0;
      const uniques = uniquesByDate.get(key) || 0;
      const conversions = conversionsByDate.get(key) || 0;
      const newVisitors = newVisitorsByDate.get(key) || 0;
      series.push({ date: key, clicks, uniques, newVisitors, conversions });
    }

    function mapNameClicks(rows) {
      return rows.map((r) => ({ name: r._id, clicks: r.clicks }));
    }

    return res.json({
      link: toLinkResponse(link),
      days,
      totals: {
        totalClicks,
        uniqueVisitors: uniqueVisitorIds.length,
        newVisitors: series.reduce((sum, s) => sum + (s.newVisitors || 0), 0),
        totalConversions,
        uniqueConverters: uniqueConverterIds.length
      },
      series,
      cohorts: cohortRows,
      referrers: mapNameClicks(referrerRows),
      utm: {
        source: mapNameClicks(utmSourceRows),
        medium: mapNameClicks(utmMediumRows),
        campaign: mapNameClicks(utmCampaignRows)
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
        { $match: { linkId: link._id, kind: "click", visitedAt: { $gte: start } } },
        { $group: { _id: { $ifNull: ["$browser", "Unknown"] }, clicks: { $sum: 1 } } },
        { $sort: { clicks: -1, _id: 1 } },
        { $limit: 12 }
      ]),
      Visit.aggregate([
        { $match: { linkId: link._id, kind: "click", visitedAt: { $gte: start } } },
        { $group: { _id: { $ifNull: ["$os", "Unknown"] }, clicks: { $sum: 1 } } },
        { $sort: { clicks: -1, _id: 1 } },
        { $limit: 12 }
      ]),
      Visit.aggregate([
        { $match: { linkId: link._id, kind: "click", visitedAt: { $gte: start } } },
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

// GET /api/links/:id/geo?days=30
router.get("/:id/geo", async (req, res, next) => {
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

    const [countries, cities] = await Promise.all([
      Visit.aggregate([
        { $match: { linkId: link._id, kind: "click", visitedAt: { $gte: start } } },
        { $group: { _id: { $ifNull: ["$country", "Unknown"] }, clicks: { $sum: 1 } } },
        { $sort: { clicks: -1, _id: 1 } },
        { $limit: 20 }
      ]),
      Visit.aggregate([
        { $match: { linkId: link._id, kind: "click", visitedAt: { $gte: start } } },
        {
          $group: {
            _id: {
              $concat: [
                { $ifNull: ["$city", "Unknown"] },
                " · ",
                { $ifNull: ["$country", "Unknown"] }
              ]
            },
            clicks: { $sum: 1 }
          }
        },
        { $sort: { clicks: -1, _id: 1 } },
        { $limit: 20 }
      ])
    ]);

    function mapRows(rows) {
      return rows.map((r) => ({ name: r._id, clicks: r.clicks }));
    }

    return res.json({
      link: toLinkResponse(link),
      days,
      geo: {
        countries: mapRows(countries),
        cities: mapRows(cities)
      }
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/links/:id/regenerate-slug
router.post("/:id/regenerate-slug", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid link id" });

    const link = await Link.findOne({ _id: id, userId }).lean();
    if (!link) return res.status(404).json({ error: "Link not found" });

    // Always allow regeneration (even for custom slugs) since the user explicitly asked.
    // This will change the short URL and the previous short URL will stop working.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const currentNonce = parseSlugNonce(link.slugSalt);
        const nonce = currentNonce + 1 + attempt;
        const slug = slugForUrlAndNonce({ userId, originalUrl: link.originalUrl, nonce, length: 10 });
        // eslint-disable-next-line no-await-in-loop
        const updated = await Link.findOneAndUpdate(
          { _id: id, userId },
          { $set: { slug, slugSalt: String(nonce), slugType: "generated" } },
          { new: true }
        ).lean();
        return res.json({ link: toLinkResponse(updated) });
      } catch (err) {
        if (isDuplicateKeyError(err)) continue;
        throw err;
      }
    }

    return res.status(503).json({ error: "Could not generate a unique short code. Try again." });
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

