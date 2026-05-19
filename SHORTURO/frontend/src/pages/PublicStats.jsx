import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicStats } from "../lib/api.js";
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
    <div className="shell">
      <header className="topbar">
        <div className="brand">SHORTURO</div>
        <div className="topActions">
          <Link className="buttonSmall" to="/">
            Home
          </Link>
        </div>
      </header>

      <main className="content">
        <div className="stack">
          <section className="card">
            <div className="row">
              <div>
                <h1 className="title">Public stats</h1>
                <p className="muted">Shareable click stats (no login required).</p>
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
                  <div className="detailValue">{link.shortUrl || link.slug}</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Total clicks</div>
                  <div className="detailValue">{formatNumber(link.clicks ?? 0)}</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Last visited</div>
                  <div className="detailValue">{formatDate(link.lastVisitedAt)}</div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="card">
            <div className="row">
              <h2 className="subtitle">Daily clicks</h2>
              <div className="row">
                <button
                  className={`buttonSmall ${days === 7 ? "buttonSmallActive" : ""}`}
                  type="button"
                  onClick={() => setDays(7)}
                >
                  7d
                </button>
                <button
                  className={`buttonSmall ${days === 30 ? "buttonSmallActive" : ""}`}
                  type="button"
                  onClick={() => setDays(30)}
                >
                  30d
                </button>
              </div>
            </div>
            {!loading && !error ? <TrendChart series={series} /> : null}
          </section>
        </div>
      </main>
    </div>
  );
}

