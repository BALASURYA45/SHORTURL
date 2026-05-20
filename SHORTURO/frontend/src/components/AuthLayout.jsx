import { Link2, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="container grid min-h-screen items-center gap-10 py-10 md:grid-cols-2 md:py-16">
        <div className="hidden md:block">
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border bg-card shadow-sm">
              <Link2 className="h-5 w-5 -rotate-[36deg]" />
            </span>
            <span className="text-lg font-semibold tracking-tight">SHORTURO</span>
          </Link>

          <h1 className="mt-8 text-4xl font-semibold tracking-tight">
            Short links that look clean,
            <span className="block text-muted-foreground">track better, and share faster.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            A premium URL shortener with analytics, QR tools, and link controls — built for speed and simplicity.
          </p>

          <div className="mt-8 grid gap-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg border bg-card">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-medium">Analytics that feel instant</div>
                <div className="text-sm text-muted-foreground">Clicks, devices, trends, and geo in one place.</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg border bg-card">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-medium">Premium sharing tools</div>
                <div className="text-sm text-muted-foreground">Generate QR codes and share public stats links.</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg border bg-card">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-medium">Safe by design</div>
                <div className="text-sm text-muted-foreground">JWT auth, per-user access control, and link status.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
              {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            <div className="mt-6">{children}</div>
          </div>
          <div className="mt-6 text-center text-xs text-muted-foreground">
            By continuing, you agree to use SHORTURO responsibly.
          </div>
        </div>
      </div>
    </div>
  );
}
