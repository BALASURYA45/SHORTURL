import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { loginWithGoogle, signup } from "../lib/api.js";
import { setToken } from "../lib/auth.js";
import { useToast } from "../components/ToastProvider.jsx";
import AuthLayout from "../components/AuthLayout.jsx";
import GoogleSignInButton from "../components/GoogleSignInButton.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";
import { CheckCircle2, Circle, Eye, EyeOff, Lock, Mail } from "lucide-react";

function passwordRules(value) {
  const v = String(value || "");
  return {
    len: v.length >= 8,
    lower: /[a-z]/.test(v),
    upper: /[A-Z]/.test(v),
    number: /[0-9]/.test(v),
    special: /[^A-Za-z0-9]/.test(v)
  };
}

const schema = z
  .object({
    email: z.string().trim().email("Enter a valid email").transform((value) => value.toLowerCase()),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(200, "Password is too long")
      .refine((v) => /[a-z]/.test(v), "Add at least 1 lowercase letter")
      .refine((v) => /[A-Z]/.test(v), "Add at least 1 uppercase letter")
      .refine((v) => /[0-9]/.test(v), "Add at least 1 number")
      .refine((v) => /[^A-Za-z0-9]/.test(v), "Add at least 1 special character"),
    confirmPassword: z.string().min(1, "Please confirm your password")
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

function Rule({ ok, label }) {
  const Icon = ok ? CheckCircle2 : Circle;
  return (
    <div className={ok ? "flex items-center gap-2 text-emerald-700" : "flex items-center gap-2 text-muted-foreground"}>
      <Icon className={ok ? "h-4 w-4" : "h-4 w-4 opacity-70"} />
      <span>{label}</span>
    </div>
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const rules = useMemo(() => passwordRules(password), [password]);

  const canSubmit = useMemo(
    () => email.trim() && password.length >= 8 && confirmPassword,
    [email, password, confirmPassword]
  );

  async function onGoogleCredential(credential) {
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const data = await loginWithGoogle({ credential });
      setToken(data?.token);
      toast.push("Logged in with Google");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setFormError(err?.message || "Google sign-in failed");
    } finally {
      setSubmitting(false);
    }
  }

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
      toast.push("Account created");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setFormError(err?.message || "Signup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Create account" subtitle="Start shortening links in seconds.">
      {formError ? (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {formError}
        </div>
      ) : null}

      <div className="grid gap-4">
        <GoogleSignInButton onCredential={onGoogleCredential} disabled={submitting} />
        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>or continue with email</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      </div>

      <form className="mt-4 grid gap-4" onSubmit={onSubmit}>
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
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

          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Password must include</div>
            <div className="mt-2 grid gap-1 text-sm">
              <Rule ok={rules.len} label="At least 8 characters" />
              <Rule ok={rules.lower} label="1 lowercase letter (a-z)" />
              <Rule ok={rules.upper} label="1 uppercase letter (A-Z)" />
              <Rule ok={rules.number} label="1 number (0-9)" />
              <Rule ok={rules.special} label="1 special character (!@#$…)" />
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="confirmPassword" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Confirm password
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              className="pl-9 pr-10"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setShowConfirmPassword((v) => !v)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {fieldErrors.confirmPassword ? (
            <div className="text-xs text-destructive">{fieldErrors.confirmPassword}</div>
          ) : null}
        </div>

        <Button type="submit" disabled={!canSubmit || submitting}>
          {submitting ? "Creating..." : "Create account"}
        </Button>

        <div className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="text-foreground underline-offset-4 hover:underline" to="/login">
            Login
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
