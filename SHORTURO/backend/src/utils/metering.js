const User = require("../models/User");
const { monthStartUtc } = require("./usage");

function toInt(n) {
  const v = Number.parseInt(String(n || "0"), 10);
  return Number.isFinite(v) ? v : 0;
}

async function incrementUsage(userId, inc, now = new Date()) {
  const periodStart = monthStartUtc(now);
  const linksCreated = toInt(inc?.linksCreated);
  const redirects = toInt(inc?.redirects);
  const conversions = toInt(inc?.conversions);

  const incObj = {};
  if (linksCreated) incObj["usage.linksCreated"] = linksCreated;
  if (redirects) incObj["usage.redirects"] = redirects;
  if (conversions) incObj["usage.conversions"] = conversions;
  if (Object.keys(incObj).length === 0) return;

  // Fast path: same month -> $inc only
  const r1 = await User.updateOne({ _id: userId, "usage.periodStart": periodStart }, { $inc: incObj });
  if (r1.matchedCount > 0) return;

  // Slow path: new month (or missing usage) -> reset then inc
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        "usage.periodStart": periodStart,
        "usage.linksCreated": 0,
        "usage.redirects": 0,
        "usage.conversions": 0
      },
      $inc: incObj
    }
  );
}

module.exports = { incrementUsage };

