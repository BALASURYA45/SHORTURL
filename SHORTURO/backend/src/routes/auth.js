const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { env } = require("../config/env");
const { signupSchema, loginSchema, googleAuthSchema } = require("../validation/schemas");

const router = express.Router();

function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function issueToken(user) {
  return jwt.sign({ email: user.email }, env.jwtSecret, { subject: String(user._id), expiresIn: "7d" });
}

async function verifyGoogleCredential(credential) {
  if (!env.googleClientId) {
    const err = new Error("Google sign-in is not configured");
    err.statusCode = 503;
    throw err;
  }

  const endpoint = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
  const res = await fetch(endpoint);
  if (!res.ok) {
    return null;
  }

  const data = await res.json().catch(() => null);
  if (!data) return null;

  const issuer = String(data.iss || "");
  const audience = String(data.aud || "");
  const email = String(data.email || "").trim().toLowerCase();
  const googleSub = String(data.sub || "").trim();
  const emailVerified = String(data.email_verified || "").toLowerCase() === "true";

  if (!googleSub || !email) return null;
  if (audience !== env.googleClientId) return null;
  if (issuer !== "accounts.google.com" && issuer !== "https://accounts.google.com") return null;
  if (!emailVerified) return null;

  return { email, googleSub };
}

router.post("/signup", async (req, res, next) => {
  try {
    const { email, password } = signupSchema.parse(req.body);
    const existing = await User.findOne({ email: new RegExp(`^${escapeRegex(email)}$`, "i") }).lean();
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
    const user = await User.findOne({ email: new RegExp(`^${escapeRegex(email)}$`, "i") });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (!user.passwordHash) return res.status(401).json({ error: "Continue with Google for this account" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = issueToken(user);
    res.json({ token, user: { id: String(user._id), email: user.email } });
  } catch (err) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.errors?.[0]?.message || "Invalid input" });
    return next(err);
  }
});

router.post("/google", async (req, res, next) => {
  try {
    const { credential } = googleAuthSchema.parse(req.body);
    const googleUser = await verifyGoogleCredential(credential);
    if (!googleUser) return res.status(401).json({ error: "Google sign-in failed" });

    let user = await User.findOne({ googleSub: googleUser.googleSub });
    if (!user) {
      user = await User.findOne({ email: new RegExp(`^${escapeRegex(googleUser.email)}$`, "i") });
    }

    if (!user) {
      user = await User.create({ email: googleUser.email, passwordHash: null, googleSub: googleUser.googleSub });
    } else {
      let changed = false;
      if (!user.googleSub) {
        user.googleSub = googleUser.googleSub;
        changed = true;
      }
      if (String(user.email || "").toLowerCase() !== googleUser.email) {
        user.email = googleUser.email;
        changed = true;
      }
      if (changed) await user.save();
    }

    const token = issueToken(user);
    return res.json({ token, user: { id: String(user._id), email: user.email } });
  } catch (err) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.errors?.[0]?.message || "Invalid input" });
    if (err?.statusCode) return res.status(err.statusCode).json({ error: err.message });
    return next(err);
  }
});

module.exports = router;
