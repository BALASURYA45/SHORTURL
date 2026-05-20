import { BarChart3, Check, ChevronDown, ChevronUp, Copy, Globe2, Link2, Lock, QrCode, Settings2, Sparkles, Upload, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createLink } from "../lib/api.js";
import { getToken } from "../lib/auth.js";
import ThemeToggle from "../components/ThemeToggle.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";

function Feature({ icon: Icon, title, desc }) {
  return (
    <Card className="bg-card/60">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-1">{desc}</CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

export default function LandingPage() {
  const authed = Boolean(getToken());
  const navigate = useNavigate();
  const toast = useToast();

  const [originalUrl, setOriginalUrl] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  const expiresAtIso = useMemo(() => {
    if (!expiresAtLocal) return undefined;
    const dt = new Date(expiresAtLocal);
    if (Number.isNaN(dt.getTime())) return "invalid";
    return dt.toISOString();
  }, [expiresAtLocal]);

  async function onShorten(e) {
    e.preventDefault();
    setCopied(false);
    setCreated(null);

    const url = originalUrl.trim();
    if (!url) {
      toast.push("Paste a URL first", { kind: "error" });
      return;
    }

    if (!authed) {
      toast.push("Log in to create short links", { kind: "error" });
      navigate("/login", { replace: false });
      return;
    }

    if (expiresAtIso === "invalid") {
      toast.push("Invalid expiry date/time", { kind: "error" });
      return;
    }

    try {
      setSubmitting(true);
      const data = await createLink({
        originalUrl: url,
        customSlug: customSlug.trim() || undefined,
        expiresAt: expiresAtIso === undefined ? undefined : expiresAtIso
      });
      const link = data?.link || null;
      if (!link) throw new Error("Unexpected response");
      setCreated(link);
      toast.push("Short link created");
    } catch (err) {
      toast.push(err?.message || "Failed to shorten link", { kind: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function onCopy() {
    const text = created?.shortUrl || created?.slug || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.push("Copy failed", { kind: "error" });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/70 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Link2 className="h-4 w-4" />
              <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-background text-primary shadow">
                <Sparkles className="h-3 w-3" />
              </span>
            </span>
            SHORTURO
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {authed ? (
              <Button asChild>
                <Link to="/dashboard">Go to dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link to="/login">Login</Link>
                </Button>
                <Button asChild>
                  <Link to="/signup">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-[-12rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute left-[18%] top-[7rem] h-[18rem] w-[18rem] rounded-full bg-sky-500/10 blur-3xl" />
            <div className="absolute right-[14%] top-[9rem] h-[18rem] w-[18rem] rounded-full bg-violet-500/10 blur-3xl" />
          </div>

          <div className="container py-16 md:py-24">
            <div className="mx-auto max-w-4xl text-center">
              <div className="flex items-center justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-5 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Open Source Developer Link Router
                </div>
              </div>

              <h1 className="mt-10 text-5xl font-semibold tracking-tight text-foreground md:text-7xl">
                Modern link shortening <span className="text-primary">for</span>
                <span className="mt-2 block text-primary">teams</span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
                Generate clean, secure redirect links and custom aliases. Monitor analytics dynamically through an index-optimized database cluster.
              </p>

              <Card className="mx-auto mt-12 max-w-4xl rounded-2xl border-border/60 bg-background/70 shadow-xl shadow-black/5 backdrop-blur">
                <CardContent className="p-6 md:p-8">
                  <form onSubmit={onShorten} className="grid gap-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <div className="relative flex-1">
                        <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={originalUrl}
                          onChange={(e) => setOriginalUrl(e.target.value)}
                          placeholder="Paste a long link destination here..."
                          className="h-12 rounded-xl border-border/60 bg-background pl-10 text-base shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
                          autoComplete="off"
                          inputMode="url"
                        />
                      </div>
                      <Button type="submit" className="h-12 rounded-xl px-8 text-base md:w-40" disabled={submitting}>
                        {submitting ? "Shortening..." : "Shorten"}
                      </Button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowConfig((v) => !v)}
                      className="mt-1 inline-flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-foreground"
                    >
                      <Settings2 className="h-4 w-4" />
                      More customization
                      {showConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {showConfig ? (
                      <div className="grid gap-4 rounded-xl border border-border/60 bg-background/60 p-4 text-left md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="landing-alias">Custom alias (optional)</Label>
                          <Input
                            id="landing-alias"
                            value={customSlug}
                            onChange={(e) => setCustomSlug(e.target.value)}
                            placeholder="my-campaign"
                            autoComplete="off"
                            className="rounded-xl border-border/60 bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="landing-expiry">Expiry (optional)</Label>
                          <Input
                            id="landing-expiry"
                            type="datetime-local"
                            value={expiresAtLocal}
                            onChange={(e) => setExpiresAtLocal(e.target.value)}
                            className="rounded-xl border-border/60 bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
                          />
                        </div>
                      </div>
                    ) : null}

                    {created ? (
                      <div className="flex flex-col items-stretch justify-between gap-3 rounded-xl border bg-background/60 p-4 text-left md:flex-row md:items-center">
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">Your short link</div>
                          <div className="mt-1 truncate font-medium">{created.shortUrl || created.slug}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" onClick={onCopy} className="gap-2">
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {copied ? "Copied" : "Copy"}
                          </Button>
                          <Button asChild type="button" variant="secondary">
                            <Link to="/dashboard">View in dashboard</Link>
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </form>
                </CardContent>
              </Card>

              <div className="mx-auto mt-8 grid max-w-3xl gap-3 text-left text-sm text-muted-foreground md:grid-cols-3">
                <div className="rounded-lg border bg-background/60 p-4">
                  <div className="font-semibold text-foreground">Fast</div>
                  <div className="mt-1">Instant redirects</div>
                </div>
                <div className="rounded-lg border bg-background/60 p-4">
                  <div className="font-semibold text-foreground">Secure</div>
                  <div className="mt-1">JWT auth + per-user data</div>
                </div>
                <div className="rounded-lg border bg-background/60 p-4">
                  <div className="font-semibold text-foreground">Insightful</div>
                  <div className="mt-1">Analytics, device, and geo</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container py-14 md:py-18">
          <div className="flex items-end justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Everything you need</h2>
              <p className="mt-2 text-sm text-muted-foreground">A premium toolset, designed for speed and clarity.</p>
            </div>
            <Badge variant="outline">Clean, modern UI</Badge>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Feature icon={Zap} title="Lightning fast" desc="Short links that redirect instantly." />
            <Feature icon={BarChart3} title="Analytics" desc="Clicks, trends, and per-link insights." />
            <Feature icon={Globe2} title="Geo analytics" desc="Top countries/cities via GeoLite2." />
            <Feature icon={QrCode} title="QR tools" desc="Generate QR codes and scan them." />
            <Feature icon={Upload} title="Bulk CSV" desc="Create up to 200 links per batch." />
            <Feature icon={Lock} title="Access control" desc="Your links are private to your account." />
          </div>
        </section>

        <section className="border-t bg-card/30">
          <div className="container py-14">
            <div className="grid gap-6 md:grid-cols-2 md:items-center">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight">Ready to ship premium links?</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start free. Upgrade later when you add custom domains, teams, and password-protected links.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 md:justify-end">
                <Button asChild size="lg">
                  <Link to={authed ? "/dashboard" : "/signup"}>{authed ? "Open dashboard" : "Create account"}</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/login">Login</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="container flex flex-col gap-2 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div>© {new Date().getFullYear()} SHORTURO</div>
          <div className="flex flex-wrap gap-4">
            <Link to="/login" className="hover:underline">
              Login
            </Link>
            <Link to="/signup" className="hover:underline">
              Signup
            </Link>
            <a className="hover:underline" href="http://localhost:4000/api/health" target="_blank" rel="noreferrer">
              API health
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

