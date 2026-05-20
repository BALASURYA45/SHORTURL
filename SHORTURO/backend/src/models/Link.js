const mongoose = require("mongoose");

const linkSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    originalUrl: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    slugSalt: { type: String, default: null },
    slugType: { type: String, enum: ["generated", "custom"], default: "generated" },
    active: { type: Boolean, default: true, index: true },
    clicks: { type: Number, default: 0 },
    lastVisitedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Link", linkSchema);
