import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { login } from "../lib/api.js";
import { setToken } from "../lib/auth.js";
import { useToast } from "../components/ToastProvider.jsx";
import AuthLayout from "../components/AuthLayout.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required")
});

export default function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [sessionExpired, setSessionExpired] = useState(false);

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
      try {
        sessionStorage.removeItem("shorturo_session_expired");
      } catch {
        // ignore
      }
      toast.push("Logged in");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setFormError(err?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    try {
      setSessionExpired(sessionStorage.getItem("shorturo_session_expired") === "1");
    } catch {
      setSessionExpired(false);
    }
  }, []);

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to manage your short links.">
      {sessionExpired ? (
        <div className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm">
          Your session expired. Please log in again.
        </div>
      ) : null}

      {formError ? (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {formError}
        </div>
      ) : null}

      <form className="grid gap-4" onSubmit={onSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Email
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="pl-9"
              inputMode="email"
            />
          </div>
          {fieldErrors.email ? <div className="text-xs text-destructive">{fieldErrors.email}</div> : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Password
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="pl-9 pr-10"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {fieldErrors.password ? <div className="text-xs text-destructive">{fieldErrors.password}</div> : null}
        </div>

        <Button type="submit" disabled={!canSubmit || submitting}>
          {submitting ? "Logging in..." : "Login"}
        </Button>

        <div className="text-sm text-muted-foreground">
          New here?{" "}
          <Link className="text-foreground underline-offset-4 hover:underline" to="/signup">
            Create an account
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
