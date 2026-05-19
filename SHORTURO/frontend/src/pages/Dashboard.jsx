import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { createLink, deleteLink, getLinkQrPng, listLinks, updateLink } from "../lib/api.js";
import { logout } from "../lib/auth.js";
import { useToast } from "../components/ToastProvider.jsx";

const createSchema = z.object({
  originalUrl: z.string().url("Enter a valid URL (include https://)").max(2048),
  customSlug: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[a-zA-Z0-9_-]{3,40}$/.test(v), "Alias must be 3-40 chars (letters/numbers/_/-)"),
  expiresAtLocal: z.string().optional()
});

function formatDate(input) {
  if (!input) return "—";
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

function toDatetimeLocalValue(input) {
  if (!input) return "";
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(
    dt.getMinutes()
  )}`;
}

function fromDatetimeLocalValue(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return null;
  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) return "invalid";
  return dt.toISOString();
}

function formatDateSafe(input) {
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
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState([]);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [deletingIds, setDeletingIds] = useState(() => new Set());
  const [editingId, setEditingId] = useState(null);
  const [editOriginalUrl, setEditOriginalUrl] = useState("");
  const [editCustomSlug, setEditCustomSlug] = useState("");
  const [editExpiresAtLocal, setEditExpiresAtLocal] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [qrLink, setQrLink] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);

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

    const parsed = createSchema.safeParse({
      originalUrl,
      customSlug: customSlug.trim() || undefined,
      expiresAtLocal: expiresAtLocal || undefined
    });
    if (!parsed.success) {
      const next = {};
      for (const issue of parsed.error.issues) next[issue.path[0]] = issue.message;
      setFieldErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      const expiresAt = fromDatetimeLocalValue(parsed.data.expiresAtLocal);
      if (expiresAt === "invalid") {
        setFieldErrors({ expiresAtLocal: "Invalid date/time" });
        return;
      }

      const data = await createLink({
        originalUrl: parsed.data.originalUrl,
        customSlug: parsed.data.customSlug,
        expiresAt
      });
      const link = data?.link;
      if (link) setLinks((prev) => [link, ...prev]);
      setOriginalUrl("");
      setCustomSlug("");
      setExpiresAtLocal("");
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

  function startEdit(link) {
    setEditingId(link.id);
    setEditOriginalUrl(link.originalUrl || "");
    setEditCustomSlug(link.slug || "");
    setEditExpiresAtLocal(toDatetimeLocalValue(link.expiresAt));
  }

  function cancelEdit() {
    setEditingId(null);
    setSavingEdit(false);
  }

  async function onSaveEdit(link) {
    setSavingEdit(true);
    try {
      const expiresAt = fromDatetimeLocalValue(editExpiresAtLocal);
      if (expiresAt === "invalid") {
        toast.push("Invalid expiry date/time", { kind: "error" });
        return;
      }

      const data = await updateLink(link.id, {
        originalUrl: editOriginalUrl.trim(),
        customSlug: editCustomSlug.trim(),
        expiresAt
      });
      const updated = data?.link;
      if (updated) setLinks((prev) => prev.map((l) => (l.id === link.id ? updated : l)));
      toast.push("Link updated");
      setEditingId(null);
    } catch (err) {
      toast.push(err?.message || "Update failed", { kind: "error" });
    } finally {
      setSavingEdit(false);
    }
  }

  async function onShowQr(link) {
    setQrLink(link);
    setQrUrl(null);
    try {
      const blob = await getLinkQrPng(link.id);
      const url = URL.createObjectURL(blob);
      setQrUrl(url);
    } catch (err) {
      toast.push(err?.message || "Failed to load QR", { kind: "error" });
    }
  }

  function closeQr() {
    setQrLink(null);
    if (qrUrl) URL.revokeObjectURL(qrUrl);
    setQrUrl(null);
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">SHORTURO</div>
        <div className="topActions">
          <Link className="buttonSmall" to="/scan">
            Scan QR
          </Link>
          <button className="buttonSmall" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
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

              <label className="label">
                Expiry (optional)
                <input
                  className="input"
                  type="datetime-local"
                  value={expiresAtLocal}
                  onChange={(e) => setExpiresAtLocal(e.target.value)}
                />
                {fieldErrors.expiresAtLocal ? <div className="error">{fieldErrors.expiresAtLocal}</div> : null}
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
                  <div key={l.id}>
                    <div className="tableRow">
                      <div className="cell">
                        <div className="cellTitle">{l.shortUrl || l.slug}</div>
                        <div className="cellSub">{l.originalUrl}</div>
                        {l.expiresAt ? <div className="cellSub">Expires: {formatDateSafe(l.expiresAt)}</div> : null}
                      </div>
                      <div className="cellMeta">
                        <div className="chip">{l.clicks ?? 0} clicks</div>
                        <div className="cellSub">Created: {formatDateSafe(l.createdAt)}</div>
                      </div>
                      <div className="cellActions">
                        <Link className="buttonSmall" to={`/dashboard/links/${l.id}`}>
                          Analytics
                        </Link>
                        <button className="buttonSmall" type="button" onClick={() => onShowQr(l)}>
                          QR
                        </button>
                        <button className="buttonSmall" type="button" onClick={() => startEdit(l)}>
                          Edit
                        </button>
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

                    {editingId === l.id ? (
                      <div className="editBox">
                        <div className="row">
                          <div className="subtitle">Edit link</div>
                          <div className="row">
                            <button className="buttonSmall" type="button" onClick={cancelEdit} disabled={savingEdit}>
                              Cancel
                            </button>
                            <button
                              className="buttonSmall"
                              type="button"
                              onClick={() => onSaveEdit(l)}
                              disabled={savingEdit}
                            >
                              {savingEdit ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>

                        <label className="label">
                          Destination URL
                          <input
                            className="input"
                            value={editOriginalUrl}
                            onChange={(e) => setEditOriginalUrl(e.target.value)}
                          />
                        </label>
                        <label className="label">
                          Alias
                          <input className="input" value={editCustomSlug} onChange={(e) => setEditCustomSlug(e.target.value)} />
                        </label>
                        <label className="label">
                          Expiry (optional)
                          <input
                            className="input"
                            type="datetime-local"
                            value={editExpiresAtLocal}
                            onChange={(e) => setEditExpiresAtLocal(e.target.value)}
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {qrLink ? (
            <div className="modal" role="dialog" aria-modal="true" onMouseDown={closeQr}>
              <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
                <div className="row">
                  <div>
                    <div className="subtitle">QR code</div>
                    <div className="cellSub">{qrLink.shortUrl || qrLink.slug}</div>
                  </div>
                  <button className="buttonSmall" type="button" onClick={closeQr}>
                    Close
                  </button>
                </div>
                {qrUrl ? <img className="qrImg" src={qrUrl} alt="QR code" /> : <div className="muted">Loading...</div>}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
