import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { createLink, deleteLink, getLinkQr, listLinks, regenerateLinkSlug, updateLink } from "../lib/api.js";
import { isSuspiciousUrl } from "../lib/urlSafety.js";
import { useToast } from "../components/ToastProvider.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";
import {
  BarChart3,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Globe2,
  Link2,
  Mail,
  MessageCircle,
  MoreVertical,
  Pencil,
  QrCode,
  RotateCw,
  Settings2,
  Share2,
  Sparkles,
  Trash2
} from "lucide-react";
import { DropdownMenu, DropdownMenuContentResponsive, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu.jsx";

const createSchema = z.object({
  originalUrl: z.string().url("Enter a valid URL (include https://)").max(2048),
  customSlug: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[a-zA-Z0-9_-]{3,40}$/.test(v), "Alias must be 3-40 chars (letters/numbers/_/-)"),
  expiresAtLocal: z.string().optional()
});

function formatDateUi(input) {
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

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function tryNativeShare({ title, text, url }) {
  if (!navigator.share) return false;
  try {
    await navigator.share({ title, text, url });
    return true;
  } catch {
    return false;
  }
}

// Back-compat helper (no longer used by the Share UI flow)
async function shareText({ title, text, url }) {
  return tryNativeShare({ title, text, url });
}

function LinkRow({
  link,
  deleting,
  toggling,
  regenerating,
  onDelete,
  onCopy,
  onQr,
  onEdit,
  onCopyPublic,
  onToggleActive,
  onRegenerate,
  onOpenShare
}) {
  const isActive = link.active !== false;

  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition hover:shadow-md">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute -left-24 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <a
              className="truncate text-base font-semibold tracking-tight text-foreground underline-offset-4 hover:underline"
              href={link.shortUrl || "#"}
              target="_blank"
              rel="noreferrer"
              title={link.shortUrl || link.slug}
              onClick={(e) => {
                if (!link.shortUrl || !isActive) e.preventDefault();
              }}
            >
              {link.shortUrl || link.slug}
            </a>
            {!isActive ? <Badge variant="outline">Inactive</Badge> : null}
            {link.expiresAt ? <Badge variant="outline">Expires {formatDateUi(link.expiresAt)}</Badge> : null}
          </div>

          <div className="mt-1 truncate text-sm text-muted-foreground">{link.originalUrl}</div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="bg-background/70">
              {link.clicks ?? 0} clicks
            </Badge>
            <span className="text-muted-foreground/80">Created {formatDateUi(link.createdAt)}</span>
            {link.lastVisitedAt ? <span className="text-muted-foreground/80">Last {formatDateUi(link.lastVisitedAt)}</span> : null}
          </div>
        </div>

        <div className="flex items-start justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 w-9 rounded-full p-0 shadow-sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContentResponsive>
              <DropdownMenuItem asChild disabled={!isActive}>
                <a
                  href={isActive ? link.shortUrl || "#" : "#"}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    if (!isActive) e.preventDefault();
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`/dashboard/links/${link.id}`}>
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  onQr(link);
                }}
              >
                <QrCode className="h-4 w-4" />
                QR
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={toggling}
                onSelect={(e) => {
                  e.preventDefault();
                  onToggleActive(link);
                }}
              >
                {isActive ? <Sparkles className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                {toggling ? "Saving..." : isActive ? "Live" : "Not live"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={regenerating}
                onSelect={(e) => {
                  e.preventDefault();
                  onRegenerate(link);
                }}
              >
                <RotateCw className="h-4 w-4" />
                {regenerating ? "..." : "New code"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  onEdit(link);
                }}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  onCopyPublic(link);
                }}
              >
                <Globe2 className="h-4 w-4" />
                Public stats
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  onCopy(link.shortUrl);
                }}
              >
                <Copy className="h-4 w-4" />
                Copy
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  onOpenShare(link);
                }}
              >
                <Share2 className="h-4 w-4" />
                Share
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                disabled={deleting}
                onSelect={(e) => {
                  e.preventDefault();
                  onDelete(link.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting..." : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContentResponsive>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const toast = useToast();

  const [originalUrl, setOriginalUrl] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState([]);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [deletingIds, setDeletingIds] = useState(() => new Set());
  const [togglingIds, setTogglingIds] = useState(() => new Set());
  const [regeneratingIds, setRegeneratingIds] = useState(() => new Set());

  const [editingLink, setEditingLink] = useState(null);
  const [editOriginalUrl, setEditOriginalUrl] = useState("");
  const [editCustomSlug, setEditCustomSlug] = useState("");
  const [editExpiresAtLocal, setEditExpiresAtLocal] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [qrLink, setQrLink] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [qrSvg, setQrSvg] = useState(null);
  const [qrFormat, setQrFormat] = useState("png");
  const [qrSize, setQrSize] = useState(320);
  const [qrMargin, setQrMargin] = useState(1);
  const [qrEcc, setQrEcc] = useState("M");
  const [qrDark, setQrDark] = useState("#111827");
  const [qrLight, setQrLight] = useState("#FFFFFF");
  const [qrLogoUrl, setQrLogoUrl] = useState(null);
  const [qrLogoFileName, setQrLogoFileName] = useState("");
  const [qrLogoScale, setQrLogoScale] = useState(0.22);
  const [shareLink, setShareLink] = useState(null);

  const canCreate = useMemo(() => originalUrl.trim().length > 0, [originalUrl]);

  const summary = useMemo(() => {
    const totalLinks = links.length;
    let totalClicks = 0;
    let activeLinks = 0;
    let expiringSoon = 0;
    const now = Date.now();
    const soonMs = 7 * 24 * 60 * 60 * 1000;
    for (const l of links) {
      totalClicks += Number(l.clicks) || 0;
      if (l.active !== false) activeLinks += 1;
      if (l.expiresAt) {
        const t = new Date(l.expiresAt).getTime();
        if (!Number.isNaN(t) && t > now && t - now <= soonMs) expiringSoon += 1;
      }
    }
    return { totalLinks, totalClicks, activeLinks, expiringSoon };
  }, [links]);

  function buildUrlWithUtm(rawUrl, { source, medium, campaign } = {}) {
    const trimmed = String(rawUrl || "").trim();
    if (!trimmed) return trimmed;
    if (!source && !medium && !campaign) return trimmed;
    try {
      const u = new URL(trimmed);
      if (source) u.searchParams.set("utm_source", source);
      if (medium) u.searchParams.set("utm_medium", medium);
      if (campaign) u.searchParams.set("utm_campaign", campaign);
      return u.toString();
    } catch {
      return trimmed;
    }
  }

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

  function resetQrDesign() {
    setQrFormat("png");
    setQrSize(320);
    setQrMargin(1);
    setQrEcc("M");
    setQrDark("#111827");
    setQrLight("#FFFFFF");
    setQrLogoScale(0.22);
    setQrLogoFileName("");

    if (qrLogoUrl) URL.revokeObjectURL(qrLogoUrl);
    setQrLogoUrl(null);

    if (qrLink) {
      // Best-effort: re-render with defaults
      onShowQr(qrLink);
    }
  }

  useEffect(() => {
    refreshLinks();
  }, [refreshLinks]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshLinks();
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, [refreshLinks]);

  async function onToggleActive(link) {
    const isActive = link.active !== false;
    setTogglingIds((prev) => new Set(prev).add(link.id));
    try {
      const data = await updateLink(link.id, { active: !isActive });
      const updated = data?.link;
      if (updated) setLinks((prev) => prev.map((l) => (l.id === link.id ? updated : l)));
      toast.push(!isActive ? "Link enabled" : "Link disabled");
    } catch (err) {
      toast.push(err?.message || "Failed to update status", { kind: "error" });
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(link.id);
        return next;
      });
    }
  }

  async function onRegenerate(link) {
    const ok = window.confirm(
      "Regenerate short code? This will change the short URL and the old one will stop working."
    );
    if (!ok) return;

    setRegeneratingIds((prev) => new Set(prev).add(link.id));
    try {
      const data = await regenerateLinkSlug(link.id);
      const updated = data?.link;
      if (updated) setLinks((prev) => prev.map((l) => (l.id === link.id ? updated : l)));
      toast.push("Short code regenerated");
    } catch (err) {
      toast.push(err?.message || "Failed to regenerate", { kind: "error" });
    } finally {
      setRegeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(link.id);
        return next;
      });
    }
  }

  async function onShare(link) {
    const url = link.shortUrl;
    if (!url) {
      toast.push("Short URL not available (check BASE_URL)", { kind: "error" });
      return;
    }

    const shared = await shareText({ title: "SHORTURO link", text: "Here’s a short link:", url });
    if (shared) return;

    const ok = await copyText(url);
    toast.push(ok ? "Copied link to clipboard" : "Failed to share", { kind: ok ? "success" : "error" });
  }

  function onOpenShare(link) {
    setShareLink(link);
  }

  function onShareWhatsapp() {
    const url = shareLink?.shortUrl;
    if (!url) return;
    const text = `Here\u2019s my SHORTURO link:\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function onShareEmail() {
    const url = shareLink?.shortUrl;
    if (!url) return;
    const subject = "SHORTURO link";
    const body = `Here\u2019s my short link:\n\n${url}\n`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function onShareNative() {
    const url = shareLink?.shortUrl;
    if (!url) return;
    const ok = await tryNativeShare({ title: "SHORTURO link", text: "Here\u2019s a short link:", url });
    if (!ok) toast.push("Sharing not supported on this device", { kind: "error" });
  }

  async function onShareCopy() {
    const url = shareLink?.shortUrl;
    if (!url) return;
    const ok = await copyText(url);
    toast.push(ok ? "Copied" : "Copy failed", { kind: ok ? "success" : "error" });
  }

  async function onCreate(e) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const composedUrl = buildUrlWithUtm(originalUrl, {
      source: showAdvanced ? utmSource.trim() : "",
      medium: showAdvanced ? utmMedium.trim() : "",
      campaign: showAdvanced ? utmCampaign.trim() : ""
    });

    const parsed = createSchema.safeParse({
      originalUrl: composedUrl,
      customSlug: showAdvanced ? customSlug.trim() || undefined : undefined,
      expiresAtLocal: showAdvanced ? expiresAtLocal || undefined : undefined
    });
    if (!parsed.success) {
      const next = {};
      for (const issue of parsed.error.issues) next[issue.path[0]] = issue.message;
      setFieldErrors(next);
      return;
    }
    if (isSuspiciousUrl(parsed.data.originalUrl)) {
      setFormError("URL looks suspicious.");
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
      setUtmSource("");
      setUtmMedium("");
      setUtmCampaign("");
      setShowAdvanced(false);
      toast.push("Short link created");
    } catch (err) {
      if (err?.status === 402) {
        setFormError((err?.message || "Monthly limit reached") + " (Go to Profile → Upgrade)");
      } else {
        setFormError(err?.message || "Failed to create link");
      }
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

  async function onCopyPublicStats(link) {
    const url = `${window.location.origin}/stats/${link.slug}`;
    const ok = await copyText(url);
    toast.push(ok ? "Public stats link copied" : "Copy failed", { kind: ok ? "default" : "error" });
  }

  function startEdit(link) {
    setEditingLink(link);
    setEditOriginalUrl(link.originalUrl || "");
    setEditCustomSlug(link.slug || "");
    setEditExpiresAtLocal(toDatetimeLocalValue(link.expiresAt));
  }

  function closeEdit() {
    setEditingLink(null);
    setSavingEdit(false);
  }

  async function onSaveEdit() {
    if (!editingLink) return;
    setSavingEdit(true);
    try {
      const expiresAt = fromDatetimeLocalValue(editExpiresAtLocal);
      if (expiresAt === "invalid") {
        toast.push("Invalid expiry date/time", { kind: "error" });
        return;
      }

      const data = await updateLink(editingLink.id, {
        originalUrl: editOriginalUrl.trim(),
        customSlug: editCustomSlug.trim(),
        expiresAt
      });
      const updated = data?.link;
      if (updated) setLinks((prev) => prev.map((l) => (l.id === editingLink.id ? updated : l)));
      toast.push("Link updated");
      setEditingLink(null);
    } catch (err) {
      toast.push(err?.message || "Update failed", { kind: "error" });
    } finally {
      setSavingEdit(false);
    }
  }

  async function onShowQr(link) {
    setQrLink(link);
    setQrUrl(null);
    setQrSvg(null);
    try {
      const blob = await getLinkQr(link.id, {
        format: qrFormat,
        size: qrSize,
        margin: qrMargin,
        ecc: qrEcc,
        dark: qrDark,
        light: qrLight
      });
      if (qrFormat === "svg") {
        const text = await blob.text();
        setQrSvg(text);
      } else {
        const url = URL.createObjectURL(blob);
        setQrUrl(url);
      }
    } catch (err) {
      toast.push(err?.message || "Failed to load QR", { kind: "error" });
    }
  }

  function closeQr() {
    setQrLink(null);
    if (qrUrl) URL.revokeObjectURL(qrUrl);
    setQrUrl(null);
    setQrSvg(null);
    if (qrLogoUrl) URL.revokeObjectURL(qrLogoUrl);
    setQrLogoUrl(null);
  }

  function closeShare() {
    setShareLink(null);
  }

  async function renderPngWithOptionalLogo({ qrImageUrl, logoUrl, size, logoScale }) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    }

    const qrImg = await loadImage(qrImageUrl);
    ctx.drawImage(qrImg, 0, 0, size, size);

    if (logoUrl) {
      const logo = await loadImage(logoUrl);
      const s = Math.max(0.12, Math.min(0.32, Number(logoScale) || 0.22));
      const logoSize = Math.floor(size * s);
      const x = Math.floor((size - logoSize) / 2);
      const y = Math.floor((size - logoSize) / 2);

      const pad = Math.floor(logoSize * 0.12);
      const rx = x - pad;
      const ry = y - pad;
      const rw = logoSize + pad * 2;
      const rh = logoSize + pad * 2;
      const r = Math.floor(Math.min(rw, rh) * 0.18);
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.98)";
      ctx.beginPath();
      ctx.moveTo(rx + r, ry);
      ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
      ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
      ctx.arcTo(rx, ry + rh, rx, ry, r);
      ctx.arcTo(rx, ry, rx + rw, ry, r);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + logoSize, y, x + logoSize, y + logoSize, r);
      ctx.arcTo(x + logoSize, y + logoSize, x, y + logoSize, r);
      ctx.arcTo(x, y + logoSize, x, y, r);
      ctx.arcTo(x, y, x + logoSize, y, r);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(logo, x, y, logoSize, logoSize);
      ctx.restore();
    }

    return canvas.toDataURL("image/png");
  }

  async function downloadQr() {
    if (!qrLink) return;
    const name = `shorturo-${qrLink.slug || "qr"}`;
    if (qrFormat === "svg") {
      if (!qrSvg) return;
      const blob = new Blob([qrSvg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.svg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      return;
    }
    if (!qrUrl) return;
    const dataUrl = await renderPngWithOptionalLogo({
      qrImageUrl: qrUrl,
      logoUrl: qrLogoUrl,
      size: qrSize,
      logoScale: qrLogoScale
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${name}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function refreshQrPreview() {
    if (!qrLink) return;
    await onShowQr(qrLink);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Create, manage, and analyze your short links.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <Badge variant="outline">{summary.totalLinks} links</Badge>
            <Badge variant="outline">{summary.totalClicks} clicks</Badge>
            <Badge variant="outline">{summary.activeLinks} active</Badge>
            {summary.expiringSoon ? <Badge className="bg-amber-500 text-black">⚠ {summary.expiringSoon} expiring soon</Badge> : null}
          </div>
          <Button variant="outline" onClick={refreshLinks} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-gradient-to-b from-background to-muted/30 shadow-sm">
                  <Link2 className="h-4 w-4 -rotate-[36deg] text-primary" />
                </span>
                Create short link
              </CardTitle>
              <CardDescription>Alias, expiry, and UTM builder with a live preview.</CardDescription>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <Badge variant="outline">UTM</Badge>
              <Badge variant="outline">Expiry</Badge>
              <Badge variant="outline">Analytics-ready</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {formError ? (
            <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              {formError}
            </div>
          ) : null}

          <form
            className="relative grid gap-4 overflow-hidden rounded-2xl border bg-gradient-to-b from-muted/10 to-muted/30 p-4 md:grid-cols-12 md:p-6"
            onSubmit={onCreate}
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
            </div>
            <div className="md:col-span-8">
              <Label htmlFor="originalUrl" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Destination URL
              </Label>
              <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="originalUrl"
                    className="h-12 rounded-xl border-border/60 bg-background pl-9 text-base shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
                    value={originalUrl}
                    onChange={(e) => setOriginalUrl(e.target.value)}
                    placeholder="Paste a long link destination here..."
                    inputMode="url"
                  />
                </div>
                <Button
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-base font-semibold text-white shadow-sm hover:from-emerald-600 hover:to-emerald-700 md:w-40"
                  type="submit"
                  disabled={!canCreate || submitting}
                >
                  {submitting ? "Shortening..." : "Shorten"}
                </Button>
              </div>
              {fieldErrors.originalUrl ? <div className="mt-2 text-xs text-destructive">{fieldErrors.originalUrl}</div> : null}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur hover:text-foreground"
                >
                  <Settings2 className="h-4 w-4" />
                  More customization
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                  Tip: add UTM for better attribution
                </Badge>
              </div>

              {showAdvanced ? (
                <div className="mt-4 grid gap-4 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm backdrop-blur md:grid-cols-12">
                  <div className="md:col-span-6">
                    <Label htmlFor="customSlug" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Custom alias (optional)
                    </Label>
                    <Input
                      id="customSlug"
                      className="mt-2 h-11 rounded-xl border-border/60 bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
                      value={customSlug}
                      onChange={(e) => setCustomSlug(e.target.value)}
                      placeholder="my-alias"
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                    {fieldErrors.customSlug ? <div className="mt-2 text-xs text-destructive">{fieldErrors.customSlug}</div> : null}
                  </div>

                  <div className="md:col-span-6">
                    <Label htmlFor="expiresAtLocal" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Expiry (optional)
                    </Label>
                    <div className="relative mt-2">
                      <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="expiresAtLocal"
                        className="h-11 rounded-xl border-border/60 bg-background pl-9 shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
                        type="datetime-local"
                        value={expiresAtLocal}
                        onChange={(e) => setExpiresAtLocal(e.target.value)}
                      />
                    </div>
                    {fieldErrors.expiresAtLocal ? <div className="mt-2 text-xs text-destructive">{fieldErrors.expiresAtLocal}</div> : null}
                  </div>

                  <div className="md:col-span-12">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Campaign parameters (UTM)</div>
                    <div className="mt-2 grid gap-3 md:grid-cols-3">
                      <div className="grid gap-2">
                        <Label htmlFor="utmSource" className="text-xs text-muted-foreground">
                          utm_source
                        </Label>
                        <Input
                          id="utmSource"
                          className="h-11 rounded-xl border-border/60 bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
                          value={utmSource}
                          onChange={(e) => setUtmSource(e.target.value)}
                          placeholder="google"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="utmMedium" className="text-xs text-muted-foreground">
                          utm_medium
                        </Label>
                        <Input
                          id="utmMedium"
                          className="h-11 rounded-xl border-border/60 bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
                          value={utmMedium}
                          onChange={(e) => setUtmMedium(e.target.value)}
                          placeholder="cpc"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="utmCampaign" className="text-xs text-muted-foreground">
                          utm_campaign
                        </Label>
                        <Input
                          id="utmCampaign"
                          className="h-11 rounded-xl border-border/60 bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
                          value={utmCampaign}
                          onChange={(e) => setUtmCampaign(e.target.value)}
                          placeholder="spring_launch"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="md:col-span-4">
              <div className="relative rounded-2xl border border-border/60 bg-background/70 p-4 shadow-xl shadow-black/5 backdrop-blur">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Preview</div>
                  <Badge className="bg-primary text-primary-foreground">Pro</Badge>
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="rounded-xl border border-border/60 bg-card/40 p-3">
                    <div className="text-xs text-muted-foreground">Destination (final)</div>
                    <div className="mt-1 truncate font-medium">
                      {buildUrlWithUtm(originalUrl, {
                        source: showAdvanced ? utmSource.trim() : "",
                        medium: showAdvanced ? utmMedium.trim() : "",
                        campaign: showAdvanced ? utmCampaign.trim() : ""
                      }) || "—"}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
                      <div className="text-xs text-muted-foreground">Alias</div>
                      <div className="mt-1 truncate font-medium">{showAdvanced && customSlug.trim() ? customSlug.trim() : "Auto"}</div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
                      <div className="text-xs text-muted-foreground">Expiry</div>
                      <div className="mt-1 truncate font-medium">{showAdvanced && expiresAtLocal ? "Set" : "None"}</div>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">Tracks referrers + UTM automatically on redirect.</div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>Recently created</CardTitle>
              <CardDescription>
                {loading ? "Loading..." : links.length ? "Shows your latest link. View all links in Profile." : "No links yet."}
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/profile">View all</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-muted-foreground">Loading links...</div> : null}
          {!loading && links.length === 0 ? <div className="text-sm text-muted-foreground">No links yet.</div> : null}

          {!loading && links.length ? (
            <div className="grid gap-3">
              <LinkRow
                key={links[0].id}
                link={links[0]}
                deleting={deletingIds.has(links[0].id)}
                toggling={togglingIds.has(links[0].id)}
                regenerating={regeneratingIds.has(links[0].id)}
                onDelete={onDelete}
                onCopy={onCopy}
                onQr={onShowQr}
                onEdit={startEdit}
                onCopyPublic={onCopyPublicStats}
                onToggleActive={onToggleActive}
                onRegenerate={onRegenerate}
                onOpenShare={onOpenShare}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {editingLink ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onMouseDown={closeEdit}>
          <div
            className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Edit link</div>
                <div className="mt-1 text-xs text-muted-foreground">{editingLink.shortUrl || editingLink.slug}</div>
              </div>
              <Button variant="outline" onClick={closeEdit}>
                Close
              </Button>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="editOriginalUrl">Destination URL</Label>
                <Input
                  id="editOriginalUrl"
                  value={editOriginalUrl}
                  onChange={(e) => setEditOriginalUrl(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editCustomSlug">Alias</Label>
                <Input id="editCustomSlug" value={editCustomSlug} onChange={(e) => setEditCustomSlug(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editExpiresAtLocal">Expiry (optional)</Label>
                <Input
                  id="editExpiresAtLocal"
                  type="datetime-local"
                  value={editExpiresAtLocal}
                  onChange={(e) => setEditExpiresAtLocal(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={closeEdit} disabled={savingEdit}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={onSaveEdit} disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

       {qrLink ? (
         <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onMouseDown={closeQr}>
            <div
              className="w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain rounded-2xl border bg-card p-5 shadow-xl"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold">QR code</div>
                  <div className="mt-1 text-xs text-muted-foreground">{qrLink.shortUrl || qrLink.slug}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={downloadQr} disabled={qrFormat === "svg" ? !qrSvg : !qrUrl}>
                    Download
                  </Button>
                  <Button variant="outline" onClick={closeQr}>
                    Close
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="order-2 rounded-2xl border bg-background/60 p-4 md:order-none">
                  <div className="text-sm font-semibold">Design</div>
                  <div className="mt-3 grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="grid gap-1 text-xs text-muted-foreground">
                        Format
                        <select
                          className="h-10 rounded-xl border bg-background px-3 text-sm"
                          value={qrFormat}
                          onChange={(e) => setQrFormat(e.target.value)}
                        >
                          <option value="png">PNG</option>
                          <option value="svg">SVG</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs text-muted-foreground">
                        Size
                        <select
                          className="h-10 rounded-xl border bg-background px-3 text-sm"
                          value={String(qrSize)}
                          onChange={(e) => setQrSize(Number(e.target.value))}
                        >
                          <option value="200">200</option>
                          <option value="320">320</option>
                          <option value="512">512</option>
                          <option value="768">768</option>
                        </select>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="grid gap-1 text-xs text-muted-foreground">
                        Dark
                        <input type="color" className="h-10 w-full rounded-xl border bg-background p-1" value={qrDark} onChange={(e) => setQrDark(e.target.value)} />
                      </label>
                      <label className="grid gap-1 text-xs text-muted-foreground">
                        Light
                        <input type="color" className="h-10 w-full rounded-xl border bg-background p-1" value={qrLight} onChange={(e) => setQrLight(e.target.value)} />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="grid gap-1 text-xs text-muted-foreground">
                        Margin
                        <input
                          type="range"
                          min="0"
                          max="6"
                          step="1"
                          value={qrMargin}
                          onChange={(e) => setQrMargin(Number(e.target.value))}
                        />
                      </label>
                      <label className="grid gap-1 text-xs text-muted-foreground">
                        Error correction
                        <select className="h-10 rounded-xl border bg-background px-3 text-sm" value={qrEcc} onChange={(e) => setQrEcc(e.target.value)}>
                          <option value="L">L</option>
                          <option value="M">M</option>
                          <option value="Q">Q</option>
                          <option value="H">H</option>
                        </select>
                      </label>
                    </div>

                    <div className="rounded-xl border bg-background/60 p-3">
                      <div className="text-xs font-medium text-foreground">Logo (PNG only)</div>
                      <div className="mt-2 grid gap-2">
                        <input
                          id="qrLogoFile"
                          className="sr-only"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            if (!file) return;
                            const url = URL.createObjectURL(file);
                            if (qrLogoUrl) URL.revokeObjectURL(qrLogoUrl);
                            setQrLogoUrl(url);
                            setQrLogoFileName(file.name || "logo");
                          }}
                        />
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-primary/30 bg-primary/5 hover:bg-primary/10"
                            asChild
                          >
                            <label htmlFor="qrLogoFile" className="cursor-pointer">
                              Choose file
                            </label>
                          </Button>
                          <div className="min-w-0 truncate text-xs text-muted-foreground">
                            {qrLogoFileName || "No file chosen"}
                          </div>
                        </div>
                        <label className="grid gap-1 text-xs text-muted-foreground">
                          Logo size
                          <input
                            type="range"
                            min="0.14"
                            max="0.30"
                            step="0.01"
                            value={qrLogoScale}
                            onChange={(e) => setQrLogoScale(Number(e.target.value))}
                          />
                        </label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (qrLogoUrl) URL.revokeObjectURL(qrLogoUrl);
                              setQrLogoUrl(null);
                              setQrLogoFileName("");
                            }}
                          >
                            Remove logo
                          </Button>
                          <Button type="button" size="sm" onClick={onShowQr.bind(null, qrLink)}>
                            Apply
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">Dynamic QR: it points to your short URL, so edits keep working.</div>
                  </div>
                </div>

                <div className="order-1 rounded-2xl border bg-background/60 p-4 md:order-none">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Preview</div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 rounded-full p-0"
                          aria-label="QR preview options"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContentResponsive>
                        <DropdownMenuItem
                          disabled={!qrLink}
                          onSelect={(e) => {
                            e.preventDefault();
                            refreshQrPreview();
                          }}
                        >
                          <RotateCw className="h-4 w-4" />
                          Refresh
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            resetQrDesign();
                          }}
                        >
                          <Settings2 className="h-4 w-4" />
                          Reset
                        </DropdownMenuItem>
                      </DropdownMenuContentResponsive>
                    </DropdownMenu>
                  </div>
                  <div className="mt-4 grid place-items-center">
                    {qrFormat === "svg" ? (
                      qrSvg ? (
                        <div
                          className="w-full max-w-[280px] rounded-xl bg-white p-3 sm:max-w-[360px]"
                          dangerouslySetInnerHTML={{ __html: qrSvg }}
                        />
                      ) : (
                        <div className="text-sm text-muted-foreground">Loading...</div>
                      )
                    ) : qrUrl ? (
                      <img className="w-full max-w-[280px] rounded-xl bg-white p-3 sm:max-w-[360px]" src={qrUrl} alt="QR code" />
                    ) : (
                      <div className="text-sm text-muted-foreground">Loading...</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
         ) : null}

        {shareLink ? (
          <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onMouseDown={closeShare}>
            <div
              className="w-full max-w-sm rounded-xl border bg-card p-5 shadow-xl"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-lg font-semibold">Share link</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{shareLink.shortUrl || shareLink.slug}</div>
                </div>
                <Button variant="outline" onClick={closeShare}>
                  Close
                </Button>
              </div>

              {!shareLink.shortUrl ? (
                <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                  Short URL not available (check <code>BASE_URL</code>).
                </div>
              ) : (
                <div className="mt-4 grid gap-2">
                  <Button variant="teal" className="justify-start" onClick={onShareWhatsapp}>
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>
                  <Button variant="info" className="justify-start" onClick={onShareEmail}>
                    <Mail className="h-4 w-4" />
                    Email
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={onShareNative}
                    disabled={typeof navigator !== "undefined" ? !navigator.share : true}
                  >
                    <Share2 className="h-4 w-4" />
                    More apps
                  </Button>
                  <Button variant="secondary" className="justify-start" onClick={onShareCopy}>
                    <Copy className="h-4 w-4" />
                    Copy link
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
}
