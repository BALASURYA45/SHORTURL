const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { env } = require("../config/env");
const { signupSchema, loginSchema } = require("../validation/schemas");

const router = express.Router();

function issueToken(user) {
  return jwt.sign({ email: user.email }, env.jwtSecret, { subject: String(user._id), expiresIn: "7d" });
}

router.post("/signup", async (req, res, next) => {
  try {
    const { email, password } = signupSchema.parse(req.body);
    const existing = await User.findOne({ email }).lean();
    if (existing) return res.status(409).json({ error: "Email already in use" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash });

    const token = issueToken(user);
    res.status(201).json({ token, user: { id: String(user._id), email: user.email } });
  } catch (err) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.errors?.[0]?.message || "Invalid input" });
    return next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = issueToken(user);
    res.json({ token, user: { id: String(user._id), email: user.email } });
  } catch (err) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.errors?.[0]?.message || "Invalid input" });
    return next(err);
  }
});

module.exports = router;

