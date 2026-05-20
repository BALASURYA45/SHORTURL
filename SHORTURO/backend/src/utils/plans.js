const PLANS = {
  free: {
    id: "free",
    name: "Free",
    limits: {
      linksPerMonth: 50,
      bulkMaxItems: 200
    }
  },
  pro: {
    id: "pro",
    name: "Pro",
    limits: {
      linksPerMonth: 5000,
      bulkMaxItems: 200
    }
  }
};

function normalizePlanId(input) {
  const id = String(input || "free").trim().toLowerCase();
  return id === "pro" ? "pro" : "free";
}

function getPlan(planId) {
  return PLANS[normalizePlanId(planId)] || PLANS.free;
}

module.exports = { PLANS, getPlan, normalizePlanId };

