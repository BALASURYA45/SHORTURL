function monthStartUtc(d = new Date()) {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1, 0, 0, 0, 0));
}

function isSameMonthUtc(a, b) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return da.getUTCFullYear() === db.getUTCFullYear() && da.getUTCMonth() === db.getUTCMonth();
}

function ensureUsagePeriod(userDoc, now = new Date()) {
  if (!userDoc.usage) userDoc.usage = {};
  const start = userDoc.usage.periodStart;
  if (!start || !isSameMonthUtc(start, now)) {
    userDoc.usage.periodStart = monthStartUtc(now);
    userDoc.usage.linksCreated = 0;
    userDoc.usage.redirects = 0;
    userDoc.usage.conversions = 0;
    return true;
  }
  return false;
}

module.exports = { monthStartUtc, ensureUsagePeriod, isSameMonthUtc };
