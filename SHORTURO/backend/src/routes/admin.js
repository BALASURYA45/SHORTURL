const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const { ensureUsagePeriod } = require("../utils/usage");
const { getPlan, normalizePlanId } = require("../utils/plans");

const router = express.Router();

function toUserRow(userDoc) {
  const plan = getPlan(userDoc.plan);
  return {
    id: String(userDoc._id),
    email: userDoc.email,
    plan: plan.id,
    planName: plan.name,
    planChangedAt: userDoc.planChangedAt,
    usage: {
      periodStart: userDoc.usage?.periodStart || null,
      linksCreated: userDoc.usage?.linksCreated || 0,
      redirects: userDoc.usage?.redirects || 0,
      conversions: userDoc.usage?.conversions || 0
    },
    limits: plan.limits,
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt
  };
}

// GET /api/admin/users?q=email
router.get("/users", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const filter = q ? { email: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } } : {};

    const users = await User.find(filter).sort({ createdAt: -1 }).limit(200);
    // Ensure usage periods are consistent for display (best-effort)
    await Promise.all(
      users.map(async (u) => {
        const changed = ensureUsagePeriod(u);
        if (changed) await u.save();
      })
    );

    return res.json({ users: users.map((u) => toUserRow(u)) });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/admin/users/:id
// Body: { plan: "free" | "pro" }
router.patch("/users/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid user id" });

    const planId = normalizePlanId(req.body?.plan);
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.plan !== planId) {
      user.plan = planId;
      user.planChangedAt = new Date();
      await user.save();
    }

    ensureUsagePeriod(user);
    return res.json({ user: toUserRow(user) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

