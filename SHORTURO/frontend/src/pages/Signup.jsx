import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { signup } from "../lib/api.js";
import { setToken } from "../lib/auth.js";

const schema = z
  .object({
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password")
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const canSubmit = useMemo(
    () => email.trim() && password.length >= 8 && confirmPassword,
    [email, password, confirmPassword]
  );

  async function onSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = schema.safeParse({ email, password, confirmPassword });
    if (!parsed.success) {
      const next = {};
      for (const issue of parsed.error.issues) next[issue.path[0]] = issue.message;
      setFieldErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      const data = await signup({ email: parsed.data.email, password: parsed.data.password });
      setToken(data?.token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setFormError(err?.message || "Signup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <form className="card" onSubmit={onSubmit}>
        <h1 className="title">Create account</h1>
        <p className="muted">Start shortening links in seconds.</p>

        <label className="label">
          Email
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          {fieldErrors.email ? <div className="error">{fieldErrors.email}</div> : null}
        </label>

        <label className="label">
          Password
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
          {fieldErrors.password ? <div className="error">{fieldErrors.password}</div> : null}
        </label>

        <label className="label">
          Confirm password
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat password"
          />
          {fieldErrors.confirmPassword ? <div className="error">{fieldErrors.confirmPassword}</div> : null}
        </label>

        {formError ? <div className="errorBox">{formError}</div> : null}

        <button className="button" type="submit" disabled={!canSubmit || submitting}>
          {submitting ? "Creating..." : "Create account"}
        </button>

        <div className="footer">
          <span className="muted">Already have an account?</span> <Link to="/login">Login</Link>
        </div>
      </form>
    </div>
  );
}

