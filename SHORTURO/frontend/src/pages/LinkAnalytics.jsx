import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getLinkAnalytics } from "../lib/api.js";
import { useToast } from "../components/ToastProvider.jsx";

function formatDate(input) {
  if (!input) return "—";
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
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

  const link = data?.link || null;
  const analytics = data?.analytics || null;

  const recentVisits = useMemo(() => {
    const visits = analytics?.recentVisits;
    return Array.isArray(visits) ? visits : [];
  }, [analytics]);

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
