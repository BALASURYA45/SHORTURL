import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getLinkAnalytics, getLinkTrends } from "../lib/api.js";
import { useToast } from "../components/ToastProvider.jsx";

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
    <div className="chartWrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label="Daily clicks trend chart">
        <path d={`M ${padX} ${h - padY} H ${w - padX}`} className="chartAxis" />
        <path d={d} className="chartLine" />
      </svg>
      <div className="chartMeta">
        <span className="muted">Max/day: {formatNumber(maxClicks)}</span>
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

export default function LinkAnalyticsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [trendDays, setTrendDays] = useState(30);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState(null);
  const [trend, setTrend] = useState(null);

  const link = data?.link || null;
  const analytics = data?.analytics || null;

  const recentVisits = useMemo(() => {
    const visits = analytics?.recentVisits;
    return Array.isArray(visits) ? visits : [];
  }, [analytics]);

  const series = useMemo(() => {
    const s = trend?.series;
    return Array.isArray(s) ? s : [];
  }, [trend]);

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
        const next = await getLinkTrends(id, { days: trendDays });
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
  }, [id, trendDays]);

  async function onCopy() {
    const ok = await copyText(link?.shortUrl);
    toast.push(ok ? "Copied" : "Copy failed", { kind: ok ? "default" : "error" });
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">SHORTURO</div>
        <div className="topActions">
          <button className="buttonSmall" type="button" onClick={() => navigate("/dashboard")}>
            Back
          </button>
        </div>
      </header>

      <main className="content">
        <div className="stack">
          <section className="card">
            <div className="row">
              <div>
                <h1 className="title">Link analytics</h1>
                <p className="muted">Details for a single short link.</p>
              </div>
              {link?.shortUrl ? (
                <div className="row">
                  <a className="buttonSmall" href={link.shortUrl} target="_blank" rel="noreferrer">
                    Open
                  </a>
                  <button className="buttonSmall" type="button" onClick={onCopy}>
                    Copy
                  </button>
                </div>
              ) : null}
            </div>

            {loading ? <div className="muted">Loading...</div> : null}
            {error ? <div className="errorBox">{error}</div> : null}

            {!loading && !error && link ? (
              <div className="detailGrid">
                <div className="detailItem">
                  <div className="detailLabel">Short URL</div>
                  <div className="detailValue">
                    {link.shortUrl ? (
                      <a href={link.shortUrl} target="_blank" rel="noreferrer">
                        {link.shortUrl}
                      </a>
                    ) : (
                      link.slug
                    )}
                  </div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Destination</div>
                  <div className="detailValue">
                    <a href={link.originalUrl} target="_blank" rel="noreferrer">
                      {link.originalUrl}
                    </a>
                  </div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Total clicks</div>
                  <div className="detailValue">{analytics?.totalClicks ?? 0}</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Last visited</div>
                  <div className="detailValue">{formatDate(analytics?.lastVisitedAt)}</div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="card">
            <div className="row">
              <h2 className="subtitle">Daily clicks</h2>
              <div className="row">
                <button
                  className={`buttonSmall ${trendDays === 7 ? "buttonSmallActive" : ""}`}
                  type="button"
                  onClick={() => setTrendDays(7)}
                >
                  7d
                </button>
                <button
                  className={`buttonSmall ${trendDays === 30 ? "buttonSmallActive" : ""}`}
                  type="button"
                  onClick={() => setTrendDays(30)}
                >
                  30d
                </button>
              </div>
            </div>

            {trendLoading ? <div className="muted">Loading trend...</div> : null}
            {trendError ? <div className="errorBox">{trendError}</div> : null}
            {!trendLoading && !trendError ? <TrendChart series={series} /> : null}
          </section>

          <section className="card">
            <div className="row">
              <h2 className="subtitle">Recent visits</h2>
              <span className="muted">{recentVisits.length} shown</span>
            </div>

            {!loading && !error && recentVisits.length === 0 ? (
              <div className="muted">No visits yet.</div>
            ) : null}

            {recentVisits.length > 0 ? (
              <div className="table">
                {recentVisits.map((v) => (
                  <div className="tableRow tableRowTwo" key={v.id}>
                    <div className="cell">
                      <div className="cellTitle">{formatDate(v.visitedAt)}</div>
                      <div className="cellSub">{v.userAgent || "—"}</div>
                    </div>
                    <div className="cellMeta">
                      <div className="chip">{v.ip || "—"}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="footer">
              <Link to="/dashboard">← Back to dashboard</Link>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
