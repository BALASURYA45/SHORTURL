const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Link = require("../models/Link");
const { env } = require("../config/env");
const { createLinkSchema } = require("../validation/schemas");

const router = express.Router();

function isDuplicateKeyError(err) {
  return Boolean(err && (err.code === 11000 || err.code === 11001));
}

function normalizeSlug(input) {
  if (!input) return null;
  return String(input).trim().toLowerCase();
}

function randomSlug(length = 7) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function toLinkResponse(link) {
  return {
    id: String(link._id),
    originalUrl: link.originalUrl,
    slug: link.slug,
    shortUrl: env.baseUrl ? `${env.baseUrl}/${link.slug}` : null,
    clicks: link.clicks,
    lastVisitedAt: link.lastVisitedAt,
    createdAt: link.createdAt
  };
}

// POST /api/links
router.post("/", async (req, res, next) => {
  try {
    const { originalUrl, customSlug } = createLinkSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const desiredSlug = normalizeSlug(customSlug);
    if (desiredSlug) {
      const link = await Link.create({ userId, originalUrl, slug: desiredSlug });
      return res.status(201).json({ link: toLinkResponse(link) });
    }

    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const slug = randomSlug(7);
        const link = await Link.create({ userId, originalUrl, slug });
        return res.status(201).json({ link: toLinkResponse(link) });
      } catch (err) {
        if (isDuplicateKeyError(err)) continue;
        throw err;
      }
    }

    return res.status(503).json({ error: "Could not generate a unique short code. Try again." });
  } catch (err) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.errors?.[0]?.message || "Invalid input" });
    if (isDuplicateKeyError(err)) return res.status(409).json({ error: "Alias already in use" });
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

