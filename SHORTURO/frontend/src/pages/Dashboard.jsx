import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { createLink, deleteLink, listLinks } from "../lib/api.js";
import { logout } from "../lib/auth.js";
import { useToast } from "../components/ToastProvider.jsx";

const createSchema = z.object({
  originalUrl: z.string().url("Enter a valid URL (include https://)").max(2048),
  customSlug: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[a-zA-Z0-9_-]{3,40}$/.test(v), "Alias must be 3-40 chars (letters/numbers/_/-)")
});

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

export default function DashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [originalUrl, setOriginalUrl] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState([]);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [deletingIds, setDeletingIds] = useState(() => new Set());

  function onLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const canCreate = useMemo(() => originalUrl.trim().length > 0, [originalUrl]);

  const refreshLinks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listLinks();
      setLinks(Array.isArray(data?.links) ? data.links : []);
    } catch (err) {
      setFormError(err?.message || "Failed to load links");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshLinks();
  }, [refreshLinks]);

  async function onCreate(e) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = createSchema.safeParse({ originalUrl, customSlug: customSlug.trim() || undefined });
    if (!parsed.success) {
      const next = {};
      for (const issue of parsed.error.issues) next[issue.path[0]] = issue.message;
      setFieldErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      const data = await createLink(parsed.data);
      const link = data?.link;
      if (link) setLinks((prev) => [link, ...prev]);
      setOriginalUrl("");
      setCustomSlug("");
      toast.push("Short link created");
    } catch (err) {
      setFormError(err?.message || "Failed to create link");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id) {
    const ok = window.confirm("Delete this link? This cannot be undone.");
    if (!ok) return;

    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await deleteLink(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
      toast.push("Link deleted");
    } catch (err) {
      toast.push(err?.message || "Delete failed", { kind: "error" });
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function onCopy(shortUrl) {
    if (!shortUrl) return;
    const ok = await copyText(shortUrl);
    toast.push(ok ? "Copied" : "Copy failed", { kind: ok ? "default" : "error" });
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">SHORTURO</div>
        <button className="buttonSmall" type="button" onClick={onLogout}>
          Logout
        </button>
      </header>

      <main className="content">
        <div className="stack">
          <section className="card">
            <h1 className="title">Dashboard</h1>
            <p className="muted">Create and manage your short links.</p>

            <form className="formGrid" onSubmit={onCreate}>
              <label className="label">
                Destination URL
                <input
                  className="input"
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  placeholder="https://example.com/very/long/url"
                />
                {fieldErrors.originalUrl ? <div className="error">{fieldErrors.originalUrl}</div> : null}
              </label>

              <label className="label">
                Custom alias (optional)
                <input
                  className="input"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value)}
                  placeholder="my-alias"
                />
                {fieldErrors.customSlug ? <div className="error">{fieldErrors.customSlug}</div> : null}
              </label>

              {formError ? <div className="errorBox">{formError}</div> : null}

              <button className="button" type="submit" disabled={!canCreate || submitting}>
                {submitting ? "Creating..." : "Create short link"}
              </button>
            </form>
          </section>

          <section className="card">
            <div className="row">
              <h2 className="subtitle">Your links</h2>
              <button className="buttonSmall" type="button" onClick={refreshLinks} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {loading ? <div className="muted">Loading...</div> : null}
            {!loading && links.length === 0 ? <div className="muted">No links yet. Create your first one.</div> : null}

            {!loading && links.length > 0 ? (
              <div className="table">
                {links.map((l) => (
                  <div key={l.id} className="tableRow">
                    <div className="cell">
                      <div className="cellTitle">{l.shortUrl || l.slug}</div>
                      <div className="cellSub">{l.originalUrl}</div>
                    </div>
                    <div className="cellMeta">
                      <div className="chip">{l.clicks ?? 0} clicks</div>
                      <div className="cellSub">Created: {formatDate(l.createdAt)}</div>
                    </div>
                    <div className="cellActions">
                      <Link className="buttonSmall" to={`/dashboard/links/${l.id}`}>
                        Analytics
                      </Link>
                      <button className="buttonSmall" type="button" onClick={() => onCopy(l.shortUrl)}>
                        Copy
                      </button>
                      <button
                        className="buttonDanger"
                        type="button"
                        onClick={() => onDelete(l.id)}
                        disabled={deletingIds.has(l.id)}
                      >
                        {deletingIds.has(l.id) ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
