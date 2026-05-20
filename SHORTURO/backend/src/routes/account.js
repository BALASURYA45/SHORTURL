const express = require("express");
const User = require("../models/User");
const { ensureUsagePeriod } = require("../utils/usage");
const { getPlan } = require("../utils/plans");

const router = express.Router();

function toMeResponse(userDoc) {
  const plan = getPlan(userDoc.plan);
  return {
    user: {
      id: String(userDoc._id),
      email: userDoc.email,
      plan: plan.id,
      planName: plan.name,
      planChangedAt: userDoc.planChangedAt
    },
    usage: {
      periodStart: userDoc.usage?.periodStart || null,
      linksCreated: userDoc.usage?.linksCreated || 0,
      redirects: userDoc.usage?.redirects || 0,
      conversions: userDoc.usage?.conversions || 0
    },
    limits: plan.limits
  };
}

// GET /api/account/me
router.get("/me", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const changed = ensureUsagePeriod(user);
    if (changed) await user.save();
    return res.json(toMeResponse(user));
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

