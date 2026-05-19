import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { login } from "../lib/api.js";
import { setToken } from "../lib/auth.js";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required")
});

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const canSubmit = useMemo(() => email.trim() && password, [email, password]);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const next = {};
      for (const issue of parsed.error.issues) next[issue.path[0]] = issue.message;
      setFieldErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      const data = await login(parsed.data);
      setToken(data?.token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setFormError(err?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <form className="card" onSubmit={onSubmit}>
        <h1 className="title">Welcome back</h1>
        <p className="muted">Log in to manage your short links.</p>

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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />
          {fieldErrors.password ? <div className="error">{fieldErrors.password}</div> : null}
        </label>

        {formError ? <div className="errorBox">{formError}</div> : null}

        <button className="button" type="submit" disabled={!canSubmit || submitting}>
          {submitting ? "Logging in..." : "Login"}
        </button>

        <div className="footer">
          <span className="muted">New here?</span> <Link to="/signup">Create an account</Link>
        </div>
      </form>
    </div>
  );
}

