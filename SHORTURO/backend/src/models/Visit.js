const mongoose = require("mongoose");

const visitSchema = new mongoose.Schema(
  {
    linkId: { type: mongoose.Schema.Types.ObjectId, ref: "Link", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, index: true },
    visitedAt: { type: Date, required: true, default: Date.now, index: true },
    kind: { type: String, enum: ["click", "conversion"], default: "click", index: true },
    visitorId: { type: String, default: null, index: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    browser: { type: String, default: null, index: true },
    os: { type: String, default: null, index: true },
    device: { type: String, default: null, index: true },
    referrer: { type: String, default: null },
    referrerHost: { type: String, default: null, index: true },
    utmSource: { type: String, default: null, index: true },
    utmMedium: { type: String, default: null, index: true },
    utmCampaign: { type: String, default: null, index: true },
    utmTerm: { type: String, default: null },
    utmContent: { type: String, default: null },
    conversionName: { type: String, default: null, index: true },
    country: { type: String, default: null, index: true },
    region: { type: String, default: null, index: true },
    city: { type: String, default: null, index: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null }
  },
  { timestamps: false }
);

module.exports = mongoose.model("Visit", visitSchema);
