import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicStats } from "../lib/api.js";
import { useToast } from "../components/ToastProvider.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.jsx";

function formatDate(input) {
  if (!input) return "—";
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat().format(n);
}

function maxOf(arr) {
  let m = 0;
  for (const v of arr) m = Math.max(m, v);
  return m;
}

function TrendChart({ series }) {
  const w = 640;
  const h = 160;
  const padX = 10;
  const padY = 12;

  const points = Array.isArray(series) ? series : [];
  const clicks = points.map((p) => Number(p.clicks) || 0);
  const maxClicks = Math.max(1, maxOf(clicks));

  const stepX = points.length > 1 ? (w - padX * 2) / (points.length - 1) : 0;
  const d = points
    .map((p, i) => {
      const x = padX + i * stepX;
      const y = padY + (h - padY * 2) * (1 - (Number(p.clicks) || 0) / maxClicks);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full rounded-lg border bg-card/40" role="img" aria-label="Daily clicks">
        <path d={`M ${padX} ${h - padY} H ${w - padX}`} stroke="hsl(var(--border))" strokeWidth="2" fill="none" />
        <path d={d} stroke="hsl(var(--primary))" strokeWidth="3" fill="none" />
      </svg>
      <div className="mt-2 text-xs text-muted-foreground">Max/day: {formatNumber(maxClicks)}</div>
    </div>
  );
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function PublicStatsPage() {
  const toast = useToast();
  const { slug } = useParams();
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const link = data?.link || null;
  const series = useMemo(() => (Array.isArray(data?.series) ? data.series : []), [data]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const next = await getPublicStats(slug, { days });
        if (!cancelled) setData(next);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load public stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (slug) load();
    return () => {
      cancelled = true;
    };
  }, [slug, days]);

  async function onCopy() {
    const ok = await copyText(link?.shortUrl);
    toast.push(ok ? "Copied" : "Copy failed", { kind: ok ? "default" : "error" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Public stats</h1>
            <p className="text-sm text-muted-foreground">Shareable click stats (no login required).</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              variant="outline"
              className="border-zinc-200 bg-zinc-50 text-zinc-900 hover:bg-zinc-100"
            >
              <Link to="/">Home</Link>
            </Button>
            {link?.shortUrl ? (
              <>
                <Button asChild variant="teal">
                  <a href={link.shortUrl} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </Button>
                <Button variant="secondary" className="bg-slate-900 text-white hover:bg-slate-800" onClick={onCopy}>
                  Copy
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {loading ? <div className="text-sm text-muted-foreground">Loading...</div> : null}
          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{error}</div>
          ) : null}

          {!loading && !error && link ? (
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
                <CardDescription>{link.shortUrl || link.slug}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border bg-card/40 p-4">
                  <div className="text-xs text-muted-foreground">Total clicks</div>
                  <div className="mt-1 text-2xl font-semibold">{formatNumber(link.clicks ?? 0)}</div>
                </div>
                <div className="rounded-lg border bg-card/40 p-4">
                  <div className="text-xs text-muted-foreground">Last visited</div>
                  <div className="mt-1 text-sm font-medium">{formatDate(link.lastVisitedAt)}</div>
                </div>
                <div className="rounded-lg border bg-card/40 p-4">
                  <div className="text-xs text-muted-foreground">Created</div>
                  <div className="mt-1 text-sm font-medium">{formatDate(link.createdAt)}</div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Daily clicks</CardTitle>
                <CardDescription>{days} days</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant={days === 7 ? "default" : "outline"} size="sm" onClick={() => setDays(7)}>
                  7d
                </Button>
                <Button variant={days === 30 ? "default" : "outline"} size="sm" onClick={() => setDays(30)}>
                  30d
                </Button>
              </div>
            </CardHeader>
            <CardContent>{!loading && !error ? <TrendChart series={series} /> : null}</CardContent>
          </Card>

          <div className="text-xs text-muted-foreground">
            <Badge variant="outline">Privacy</Badge> This page does not show IP or user-agent details.
          </div>
        </div>
      </div>
    </div>
  );
}
