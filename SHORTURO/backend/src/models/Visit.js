const mongoose = require("mongoose");

const visitSchema = new mongoose.Schema(
  {
    linkId: { type: mongoose.Schema.Types.ObjectId, ref: "Link", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, index: true },
    visitedAt: { type: Date, required: true, default: Date.now, index: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null }
  },
  { timestamps: false }
);

module.exports = mongoose.model("Visit", visitSchema);

