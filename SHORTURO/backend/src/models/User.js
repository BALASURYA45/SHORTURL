const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, default: null },
    googleSub: { type: String, default: null, unique: true, sparse: true, index: true },

    plan: { type: String, enum: ["free", "pro"], default: "free", index: true },
    planChangedAt: { type: Date, default: null },
    usage: {
      periodStart: { type: Date, default: null },
      linksCreated: { type: Number, default: 0 },
      redirects: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
