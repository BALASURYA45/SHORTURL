import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { exportLinkCsv, getLinkAdvancedAnalytics, getLinkAnalytics, getLinkBreakdown, getLinkGeo, getLinkTrends } from "../lib/api.js";
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

function MultiMetricChart({ series, enabled }) {
  const w = 640;
  const h = 180;
  const padX = 10;
  const padY = 14;

  const points = Array.isArray(series) ? series : [];
  const metrics = [
    { key: "clicks", label: "Clicks", stroke: "hsl(var(--primary))" },
    { key: "uniques", label: "Unique", stroke: "rgb(124 58 237)" }, // violet-600
    { key: "newVisitors", label: "New", stroke: "rgb(5 150 105)" }, // emerald-600
    { key: "conversions", label: "Conversions", stroke: "rgb(234 179 8)" } // amber-500
  ];

  const enabledKeys = new Set(Array.isArray(enabled) ? enabled : []);
  const active = metrics.filter((m) => enabledKeys.has(m.key));
  const allValues = active.flatMap((m) => points.map((p) => Number(p?.[m.key]) || 0));
  const maxY = Math.max(1, maxOf(allValues));
  const stepX = points.length > 1 ? (w - padX * 2) / (points.length - 1) : 0;

  const peaks = active.map((m) => {
    const vals = points.map((p) => Number(p?.[m.key]) || 0);
    return { ...m, peak: Math.max(0, maxOf(vals)) };
  });

  function pathForKey(key) {
    return points
      .map((p, i) => {
        const x = padX + i * stepX;
        const v = Number(p?.[key]) || 0;
        const y = padY + (h - padY * 2) * (1 - v / maxY);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full rounded-lg border bg-card/40" role="img" aria-label="Metrics chart">
        <path d={`M ${padX} ${h - padY} H ${w - padX}`} stroke="hsl(var(--border))" strokeWidth="2" fill="none" />
        {active.map((m) => (
          <path key={m.key} d={pathForKey(m.key)} stroke={m.stroke} strokeWidth="3" fill="none" />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div>Scale max/day: {formatNumber(maxY)}</div>
        {peaks.map((p) => (
          <div key={p.key} className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.stroke }} />
            <span>
              {p.label} peak: {formatNumber(p.peak)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
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

function MiniBars({ series, days = 14 }) {
  const w = 640;
  const h = 84;
  const padX = 10;
  const padY = 10;

  const points = Array.isArray(series) ? series : [];
  const slice = points.slice(-Math.max(2, Number(days) || 14));
  const values = slice.map((p) => Number(p?.clicks) || 0);
  const maxY = Math.max(1, maxOf(values));

  const barW = slice.length ? (w - padX * 2) / slice.length : 0;
  const gap = Math.min(6, Math.max(2, Math.floor(barW * 0.18)));
  const innerW = Math.max(2, barW - gap);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full rounded-lg border bg-card/40"
      role="img"
      aria-label={`Clicks bars (${slice.length}d)`}
    >
      {slice.map((p, i) => {
        const v = Number(p?.clicks) || 0;
        const x = padX + i * barW + gap / 2;
        const bh = (h - padY * 2) * (v / maxY);
        const y = h - padY - bh;
        const r = Math.min(10, Math.floor(innerW / 2));
        return (
          <rect
            key={p?.date || p?.day || i}
            x={x}
            y={y}
            width={innerW}
            height={Math.max(2, bh)}
            rx={r}
            fill="hsl(var(--primary))"
            opacity={v === 0 ? 0.18 : 0.85}
          />
        );
      })}
    </svg>
  );
}

function DonutChart({ items, top = 5 }) {
  const w = 240;
  const h = 240;
  const cx = w / 2;
  const cy = h / 2;
  const rOuter = 92;
  const rInner = 58;

  const palette = [
    "hsl(var(--primary))",
    "rgb(59 130 246)", // blue-500
    "rgb(168 85 247)", // purple-500
    "rgb(245 158 11)", // amber-500
    "rgb(236 72 153)", // pink-500
    "rgb(20 184 166)" // teal-500
  ];

  const list = Array.isArray(items) ? items : [];
  const cleaned = list
    .map((it) => ({ name: String(it?.name || "Unknown"), value: Number(it?.clicks) || 0 }))
    .filter((it) => it.value > 0);

  const total = cleaned.reduce((a, b) => a + b.value, 0);
  if (!total) return null;

  const sorted = [...cleaned].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, Math.max(1, Number(top) || 5));
  const rest = sorted.slice(head.length);
  const other = rest.reduce((a, b) => a + b.value, 0);
  const data = other ? [...head, { name: "Other", value: other }] : head;

  function polarToCartesian(r, a) {
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function arcPath(a0, a1) {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p0o = polarToCartesian(rOuter, a0);
    const p1o = polarToCartesian(rOuter, a1);
    const p0i = polarToCartesian(rInner, a1);
    const p1i = polarToCartesian(rInner, a0);
    return [
      `M ${p0o.x.toFixed(2)} ${p0o.y.toFixed(2)}`,
      `A ${rOuter} ${rOuter} 0 ${large} 1 ${p1o.x.toFixed(2)} ${p1o.y.toFixed(2)}`,
      `L ${p0i.x.toFixed(2)} ${p0i.y.toFixed(2)}`,
      `A ${rInner} ${rInner} 0 ${large} 0 ${p1i.x.toFixed(2)} ${p1i.y.toFixed(2)}`,
      "Z"
    ].join(" ");
  }

  let a = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const da = (d.value / total) * Math.PI * 2;
    const a0 = a;
    const a1 = a + da;
    a = a1;
    return {
      ...d,
      color: palette[i % palette.length],
      path: arcPath(a0, a1),
      pct: (d.value / total) * 100
    };
  });

  return (
    <div className="grid gap-4 sm:grid-cols-[240px_1fr] sm:items-center">
      <svg viewBox={`0 0 ${w} ${h}`} className="mx-auto w-full max-w-[240px]" role="img" aria-label="Traffic share pie chart">
        {slices.map((s) => (
          <path key={s.name} d={s.path} fill={s.color} opacity={0.95} />
        ))}
        <circle cx={cx} cy={cy} r={rInner - 8} fill="hsl(var(--card))" opacity={0.9} />
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-foreground" style={{ fontSize: 18, fontWeight: 700 }}>
          {formatNumber(total)}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>
          clicks
        </text>
      </svg>

      <div className="grid gap-2">
        {slices.map((s) => (
          <div key={s.name} className="flex items-center justify-between gap-3 rounded-lg border bg-card/30 px-3 py-2 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate font-medium">{s.name}</span>
            </div>
            <div className="shrink-0 text-xs text-muted-foreground">
              {formatNumber(s.value)} • {s.pct.toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
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

function downloadTextAsFile({ filename, text, mime = "text/plain;charset=utf-8" }) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function BreakdownList({ items, itemClassName = "", badgeClassName = "" }) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return <div className="text-sm text-muted-foreground">No data yet.</div>;
  return (
    <div className="mt-3 grid gap-2">
      {list.map((it) => (
        <div
          key={it.name}
          className={`flex items-center justify-between gap-3 rounded-md border bg-card/40 px-3 py-2 ${itemClassName}`}
        >
          <div className="truncate text-sm font-medium">{it.name}</div>
          <Badge className={badgeClassName}>{formatNumber(Number(it.clicks) || 0)}</Badge>
        </div>
      ))}
    </div>
  );
}

export default function LinkAnalyticsPage() {
  const { id } = useParams();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const [days, setDays] = useState(30);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState(null);
  const [trend, setTrend] = useState(null);

  const [advLoading, setAdvLoading] = useState(true);
  const [advError, setAdvError] = useState(null);
  const [advanced, setAdvanced] = useState(null);
  const [enabledMetrics, setEnabledMetrics] = useState(() => ["clicks", "uniques", "newVisitors", "conversions"]);

  const [breakdownLoading, setBreakdownLoading] = useState(true);
  const [breakdownError, setBreakdownError] = useState(null);
  const [breakdown, setBreakdown] = useState(null);

  const [geoLoading, setGeoLoading] = useState(true);
  const [geoError, setGeoError] = useState(null);
  const [geo, setGeo] = useState(null);
  const [showUnknownGeo, setShowUnknownGeo] = useState(false);

  const link = data?.link || null;
  const analytics = data?.analytics || null;

  const series = useMemo(() => (Array.isArray(trend?.series) ? trend.series : []), [trend]);
  const advSeries = useMemo(() => (Array.isArray(advanced?.series) ? advanced.series : []), [advanced]);
  const advTotals = advanced?.totals || null;
  const cohorts = useMemo(() => (Array.isArray(advanced?.cohorts) ? advanced.cohorts : []), [advanced]);
  const breakdownData = breakdown?.breakdown || null;
  const geoData = geo?.geo || null;

  const clicksSummary = useMemo(() => {
    const pts = Array.isArray(series) ? series : [];
    const values = pts.map((p) => Number(p?.clicks) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    const avg = pts.length ? total / pts.length : 0;
    let best = { clicks: 0, label: "—" };
    for (const p of pts) {
      const c = Number(p?.clicks) || 0;
      if (c >= best.clicks) {
        const raw = p?.date || p?.day || "";
        const dt = raw ? new Date(raw) : null;
        const label = dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleDateString() : raw || "—";
        best = { clicks: c, label };
      }
    }
    const last7 = values.slice(-7).reduce((a, b) => a + b, 0);
    return { total, avg, best, last7, max: Math.max(1, maxOf(values)) };
  }, [series]);
  const recentVisits = useMemo(
    () => (Array.isArray(analytics?.recentVisits) ? analytics.recentVisits : []),
    [analytics]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const next = await getLinkAnalytics(id);
        if (!cancelled) setData(next);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (id) load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function loadTrend() {
      setTrendLoading(true);
      setTrendError(null);
      try {
        const next = await getLinkTrends(id, { days });
        if (!cancelled) setTrend(next);
      } catch (err) {
        if (!cancelled) setTrendError(err?.message || "Failed to load trend");
      } finally {
        if (!cancelled) setTrendLoading(false);
      }
    }
    if (id) loadTrend();
    return () => {
      cancelled = true;
    };
  }, [id, days]);

  useEffect(() => {
    let cancelled = false;
    async function loadAdvanced() {
      setAdvLoading(true);
      setAdvError(null);
      try {
        const next = await getLinkAdvancedAnalytics(id, { days });
        if (!cancelled) setAdvanced(next);
      } catch (err) {
        if (!cancelled) setAdvError(err?.message || "Failed to load advanced analytics");
      } finally {
        if (!cancelled) setAdvLoading(false);
      }
    }
    if (id) loadAdvanced();
    return () => {
      cancelled = true;
    };
  }, [id, days]);

  useEffect(() => {
    let cancelled = false;
    async function loadGeo() {
      setGeoLoading(true);
      setGeoError(null);
      try {
        const next = await getLinkGeo(id, { days });
        if (!cancelled) setGeo(next);
      } catch (err) {
        if (!cancelled) setGeoError(err?.message || "Failed to load geo");
      } finally {
        if (!cancelled) setGeoLoading(false);
      }
    }
    if (id) loadGeo();
    return () => {
      cancelled = true;
    };
  }, [id, days]);

  useEffect(() => {
    let cancelled = false;
    async function loadBreakdown() {
      setBreakdownLoading(true);
      setBreakdownError(null);
      try {
        const next = await getLinkBreakdown(id, { days });
        if (!cancelled) setBreakdown(next);
      } catch (err) {
        if (!cancelled) setBreakdownError(err?.message || "Failed to load breakdown");
      } finally {
        if (!cancelled) setBreakdownLoading(false);
      }
    }
    if (id) loadBreakdown();
    return () => {
      cancelled = true;
    };
  }, [id, days]);

  async function onCopy() {
    const ok = await copyText(link?.shortUrl);
    toast.push(ok ? "Copied" : "Copy failed", { kind: ok ? "default" : "error" });
  }

  function toggleMetric(key) {
    setEnabledMetrics((prev) => {
      const set = new Set(prev);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      if (set.size === 0) set.add("clicks");
      return Array.from(set);
    });
  }

  async function onExport(kind) {
    try {
      const csv = await exportLinkCsv(id, { kind, days });
      downloadTextAsFile({ filename: `shorturo-${kind}-${days}d.csv`, text: csv, mime: "text/csv;charset=utf-8" });
      toast.push("CSV downloaded");
    } catch (err) {
      toast.push(err?.message || "Export failed", { kind: "error" });
    }
  }

  async function onCopyCohortsTable() {
    if (!cohorts.length) {
      toast.push("No cohort data yet", { kind: "error" });
      return;
    }
    const header = ["Cohort date", "Cohort size", "D+1 return", "D+7 return"].join("\t");
    const rows = cohorts.map((r) => {
      const size = Number(r.size) || 0;
      const d1 = Number(r.d1) || 0;
      const d7 = Number(r.d7) || 0;
      const p1 = size ? `${((d1 / size) * 100).toFixed(1)}%` : "0.0%";
      const p7 = size ? `${((d7 / size) * 100).toFixed(1)}%` : "0.0%";
      return [r.date, String(size), `${d1} (${p1})`, `${d7} (${p7})`].join("\t");
    });
    const ok = await copyText([header, ...rows].join("\n"));
    toast.push(ok ? "Copied cohort table" : "Copy failed", { kind: ok ? "default" : "error" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Link analytics</h1>
          <p className="text-sm text-muted-foreground">Premium insights for a single short link.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/dashboard">Back</Link>
          </Button>
          {link?.shortUrl ? (
            <>
              <Button asChild variant="outline">
                <a href={link.shortUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
              </Button>
              <Button variant="outline" onClick={onCopy}>
                Copy
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {loading ? <div className="text-sm text-muted-foreground">Loading...</div> : null}
      {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{error}</div> : null}

      {!loading && !error && link ? (
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>{link.shortUrl || link.slug}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-card/40 p-4">
              <div className="text-xs text-muted-foreground">Destination</div>
              <div className="mt-1 truncate text-sm font-medium">
                <a className="underline-offset-4 hover:underline" href={link.originalUrl} target="_blank" rel="noreferrer">
                  {link.originalUrl}
                </a>
              </div>
            </div>
            <div className="rounded-lg border bg-card/40 p-4">
              <div className="text-xs text-muted-foreground">Total clicks</div>
              <div className="mt-1 text-2xl font-semibold">{formatNumber(analytics?.totalClicks ?? 0)}</div>
              <div className="mt-1 text-xs text-muted-foreground">Last visited {formatDate(analytics?.lastVisitedAt)}</div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="grid gap-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Daily clicks</CardTitle>
                <CardDescription>{days} days</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant={days === 7 ? "default" : "outline"} size="sm" onClick={() => setDays(7)}>
                  7d
                </Button>
                <Button variant={days === 30 ? "default" : "outline"} size="sm" onClick={() => setDays(30)}>
                  30d
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {trendLoading ? <div className="text-sm text-muted-foreground">Loading trend...</div> : null}
              {trendError ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{trendError}</div>
              ) : null}
              {!trendLoading && !trendError ? (
                <div className="space-y-5">
                  <TrendChart series={series} />

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border bg-card/40 p-3">
                      <div className="text-xs text-muted-foreground">Total ({days}d)</div>
                      <div className="mt-1 text-xl font-semibold">{formatNumber(clicksSummary.total)}</div>
                    </div>
                    <div className="rounded-xl border bg-card/40 p-3">
                      <div className="text-xs text-muted-foreground">Avg/day</div>
                      <div className="mt-1 text-xl font-semibold">{formatNumber(Math.round(clicksSummary.avg * 10) / 10)}</div>
                    </div>
                    <div className="rounded-xl border bg-card/40 p-3">
                      <div className="text-xs text-muted-foreground">Best day</div>
                      <div className="mt-1 flex items-baseline justify-between gap-2">
                        <div className="truncate text-sm font-medium">{clicksSummary.best.label}</div>
                        <Badge variant="secondary">{formatNumber(clicksSummary.best.clicks)}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>Last 14 days</span>
                      <span>
                        Last 7d: <span className="font-medium text-foreground">{formatNumber(clicksSummary.last7)}</span>
                      </span>
                    </div>
                    <MiniBars series={series} days={14} />
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Traffic share</CardTitle>
              <CardDescription>Clicks by top referrers.</CardDescription>
            </CardHeader>
            <CardContent>
              {advLoading ? <div className="text-sm text-muted-foreground">Loading advanced analytics...</div> : null}
              {advError ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{advError}</div>
              ) : null}
              {!advLoading && !advError ? (
                advanced?.referrers && Array.isArray(advanced.referrers) && advanced.referrers.length ? (
                  <DonutChart items={advanced.referrers} />
                ) : (
                  <div className="text-sm text-muted-foreground">No referrer data yet.</div>
                )
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Advanced analytics</CardTitle>
            <CardDescription>UTM capture, referrers, unique visitors, and conversions.</CardDescription>
          </CardHeader>
          <CardContent>
            {advLoading ? <div className="text-sm text-muted-foreground">Loading advanced analytics...</div> : null}
            {advError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{advError}</div>
            ) : null}
            {!advLoading && !advError ? (
              <div className="space-y-5">
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
                  <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/25 dark:text-sky-50">
                    <div className="text-xs leading-snug text-sky-700 dark:text-sky-200/80 whitespace-normal break-words">Clicks ({days}d)</div>
                    <div className="mt-1 text-xl font-semibold">{formatNumber(Number(advTotals?.totalClicks) || 0)}</div>
                  </div>
                  <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3 text-violet-950 dark:border-violet-900/40 dark:bg-violet-950/25 dark:text-violet-50">
                    <div className="text-xs leading-snug text-violet-700 dark:text-violet-200/80 whitespace-normal break-words">Unique visitors</div>
                    <div className="mt-1 text-xl font-semibold">{formatNumber(Number(advTotals?.uniqueVisitors) || 0)}</div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-50">
                    <div className="text-xs leading-snug text-emerald-700 dark:text-emerald-200/80 whitespace-normal break-words">New visitors</div>
                    <div className="mt-1 text-xl font-semibold">{formatNumber(Number(advTotals?.newVisitors) || 0)}</div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-50">
                    <div className="text-xs leading-snug text-amber-700 dark:text-amber-200/80 whitespace-normal break-words">Conversions</div>
                    <div className="mt-1 text-xl font-semibold">{formatNumber(Number(advTotals?.totalConversions) || 0)}</div>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-rose-950 dark:border-rose-900/40 dark:bg-rose-950/25 dark:text-rose-50">
                    <div className="text-xs leading-snug text-rose-700 dark:text-rose-200/80 whitespace-normal break-words">Unique converters</div>
                    <div className="mt-1 text-xl font-semibold">{formatNumber(Number(advTotals?.uniqueConverters) || 0)}</div>
                  </div>
                </div>

              <div className="rounded-lg border bg-card/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Multi-metric chart</div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={enabledMetrics.includes("clicks") ? "default" : "outline"}
                      onClick={() => toggleMetric("clicks")}
                    >
                      Clicks
                    </Button>
                    <Button
                      size="sm"
                      variant={enabledMetrics.includes("uniques") ? "default" : "outline"}
                      onClick={() => toggleMetric("uniques")}
                    >
                      Unique
                    </Button>
                    <Button
                      size="sm"
                      variant={enabledMetrics.includes("newVisitors") ? "default" : "outline"}
                      onClick={() => toggleMetric("newVisitors")}
                    >
                      New
                    </Button>
                    <Button
                      size="sm"
                      variant={enabledMetrics.includes("conversions") ? "default" : "outline"}
                      onClick={() => toggleMetric("conversions")}
                    >
                      Conversions
                    </Button>
                  </div>
                </div>
                <MultiMetricChart series={advSeries} enabled={enabledMetrics} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => onExport("click")}>
                    Download clicks CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onExport("conversion")}>
                    Download conversions CSV
                  </Button>
                  <Button size="sm" variant="secondary" onClick={onCopyCohortsTable}>
                    Copy cohort table
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold">Top referrers</div>
                  <BreakdownList items={advanced?.referrers} />
                </div>
                <div>
                  <div className="text-sm font-semibold">UTM sources</div>
                  <BreakdownList items={advanced?.utm?.source} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold">UTM medium</div>
                  <BreakdownList items={advanced?.utm?.medium} />
                </div>
                <div>
                  <div className="text-sm font-semibold">UTM campaign</div>
                  <BreakdownList items={advanced?.utm?.campaign} />
                </div>
              </div>

              <div className="rounded-lg border bg-card/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">Cohort retention</div>
                    <div className="text-xs text-muted-foreground">First-seen cohorts with D+1 and D+7 returns.</div>
                  </div>
                  <Badge variant="outline">{days}d</Badge>
                </div>
                {cohorts.length === 0 ? (
                  <div className="mt-3 text-sm text-muted-foreground">No cohort data yet.</div>
                ) : (
                  <div className="mt-3 overflow-auto">
                    <table className="w-full min-w-[560px] border-separate border-spacing-0">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="sticky left-0 bg-background/60 px-3 py-2 backdrop-blur">Cohort</th>
                          <th className="px-3 py-2">Size</th>
                          <th className="px-3 py-2">D+1</th>
                          <th className="px-3 py-2">D+7</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cohorts.slice(-14).map((r) => {
                          const size = Number(r.size) || 0;
                          const d1 = Number(r.d1) || 0;
                          const d7 = Number(r.d7) || 0;
                          const p1 = size ? d1 / size : 0;
                          const p7 = size ? d7 / size : 0;
                          const heat = (p) =>
                            p >= 0.4
                              ? "bg-emerald-600/20"
                              : p >= 0.2
                                ? "bg-emerald-500/15"
                                : p >= 0.1
                                  ? "bg-amber-500/15"
                                  : p > 0
                                    ? "bg-rose-500/15"
                                    : "bg-muted/30";
                          return (
                            <tr key={r.date} className="border-t text-sm">
                              <td className="sticky left-0 border-t bg-background/60 px-3 py-2 font-medium backdrop-blur">{r.date}</td>
                              <td className="border-t px-3 py-2">{formatNumber(size)}</td>
                              <td className={`border-t px-3 py-2 ${heat(p1)}`}>
                                <div className="flex items-center justify-between gap-3">
                                  <span>{formatNumber(d1)}</span>
                                  <span className="text-xs text-muted-foreground">{(p1 * 100).toFixed(1)}%</span>
                                </div>
                              </td>
                              <td className={`border-t px-3 py-2 ${heat(p7)}`}>
                                <div className="flex items-center justify-between gap-3">
                                  <span>{formatNumber(d7)}</span>
                                  <span className="text-xs text-muted-foreground">{(p7 * 100).toFixed(1)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
      </CardContent>
      </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Breakdowns</CardTitle>
          <CardDescription>Browser, OS, and device distribution.</CardDescription>
        </CardHeader>
        <CardContent>
          {breakdownLoading ? <div className="text-sm text-muted-foreground">Loading breakdowns...</div> : null}
          {breakdownError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              {breakdownError}
            </div>
          ) : null}
          {!breakdownLoading && !breakdownError ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-sm font-semibold">Browser</div>
                <BreakdownList items={breakdownData?.browser} />
              </div>
              <div>
                <div className="text-sm font-semibold">OS</div>
                <BreakdownList items={breakdownData?.os} />
              </div>
              <div>
                <div className="text-sm font-semibold">Device</div>
                <BreakdownList items={breakdownData?.device} />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Geo analytics</CardTitle>
          <CardDescription>Top countries and cities (requires GeoLite2).</CardDescription>
        </CardHeader>
        <CardContent>
          {geoLoading ? <div className="text-sm text-muted-foreground">Loading geo...</div> : null}
          {geoError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{geoError}</div>
          ) : null}
          {!geoLoading && !geoError ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  “Unknown” usually means older visits (before GeoLite2 was configured) or private IPs (localhost).
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUnknownGeo((v) => !v)}
                >
                  {showUnknownGeo ? "Hide Unknown" : "Show Unknown"}
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold">Countries</div>
                  <BreakdownList
                    items={(geoData?.countries || []).filter((x) =>
                      showUnknownGeo ? true : String(x?.name || "").toLowerCase() !== "unknown"
                    )}
                    itemClassName="bg-gradient-to-r from-sky-500/10 via-card/40 to-emerald-500/10 hover:via-card/60 transition-colors border-border/60"
                    badgeClassName="bg-primary/10 text-primary border border-primary/30"
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold">Cities</div>
                  <BreakdownList
                    items={(geoData?.cities || []).filter((x) =>
                      showUnknownGeo ? true : String(x?.name || "").toLowerCase().startsWith("unknown") === false
                    )}
                    itemClassName="bg-gradient-to-r from-violet-500/10 via-card/40 to-pink-500/10 hover:via-card/60 transition-colors border-border/60"
                    badgeClassName="bg-violet-500/10 text-violet-700 dark:text-violet-200 border border-violet-500/25"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent visits</CardTitle>
            <CardDescription>{recentVisits.length} shown</CardDescription>
          </div>
          <Badge variant="outline">{days}d view</Badge>
        </CardHeader>
        <CardContent>
          {recentVisits.length === 0 ? <div className="text-sm text-muted-foreground">No visits yet.</div> : null}
          <div className="grid gap-2">
            {recentVisits.map((v) => (
              <div key={v.id} className="rounded-lg border bg-card/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{formatDate(v.visitedAt)}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{v.userAgent || "—"}</div>
                  </div>
                  <Badge variant="outline">{v.ip || "—"}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

