import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Copy,
  ExternalLink,
  Globe2,
  Link2,
  LogOut,
  Mail,
  MessageCircle,
  MoreVertical,
  Pencil,
  QrCode,
  RotateCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCircle2
} from "lucide-react";
import { getTokenPayload, getTokenSubject, logout } from "../lib/auth.js";
import { adminListUsers, adminUpdateUserPlan, deleteLink, getLinkQr, getMe, listLinks, regenerateLinkSlug, updateLink } from "../lib/api.js";
import { useToast } from "../components/ToastProvider.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Input } from "../components/ui/input.jsx";
import { DropdownMenu, DropdownMenuContentResponsive, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu.jsx";
import { Link } from "react-router-dom";

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(String(text || ""));
    return true;
  } catch {
    return false;
  }
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

function formatDateTimeFromUnixSeconds(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n)) return "—";
  const dt = new Date(n * 1000);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

export default function ProfilePage() {
  const toast = useToast();
  const payload = useMemo(() => getTokenPayload(), []);
  const userId = useMemo(() => getTokenSubject(), []);

  const email = payload?.email ? String(payload.email) : "—";
  const issuedAt = payload?.iat ? formatDateTimeFromUnixSeconds(payload.iat) : "—";
  const expiresAt = payload?.exp ? formatDateTimeFromUnixSeconds(payload.exp) : "—";

  const [loggingOut, setLoggingOut] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [linksError, setLinksError] = useState(null);
  const [links, setLinks] = useState([]);
  const [query, setQuery] = useState("");

  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState(null);
  const [me, setMe] = useState(null);

  const [adminEnabled, setAdminEnabled] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminQuery, setAdminQuery] = useState("");

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
  const [qrLogoScale, setQrLogoScale] = useState(0.22);

  const [editingLink, setEditingLink] = useState(null);
  const [editOriginalUrl, setEditOriginalUrl] = useState("");
  const [editCustomSlug, setEditCustomSlug] = useState("");
  const [editExpiresAtLocal, setEditExpiresAtLocal] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [shareLink, setShareLink] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return links;
    return links.filter((l) => {
      const a = String(l.shortUrl || l.slug || "").toLowerCase();
      const b = String(l.originalUrl || "").toLowerCase();
      return a.includes(q) || b.includes(q);
    });
  }, [links, query]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingLinks(true);
      setLinksError(null);
      try {
        const data = await listLinks();
        const items = Array.isArray(data?.links) ? data.links : [];
        if (!cancelled) setLinks(items);
      } catch (err) {
        if (!cancelled) setLinksError(err?.message || "Failed to load links");
      } finally {
        if (!cancelled) setLoadingLinks(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      setMeLoading(true);
      setMeError(null);
      try {
        const data = await getMe();
        if (!cancelled) setMe(data);
      } catch (err) {
        if (!cancelled) setMeError(err?.message || "Failed to load account");
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    }
    loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadAdminUsers(q = "") {
    setAdminLoading(true);
    setAdminError(null);
    try {
      const data = await adminListUsers({ q });
      setAdminEnabled(true);
      setAdminUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (err) {
      // If not admin, keep it silent and just hide admin UI
      if (err?.status === 403) {
        setAdminEnabled(false);
        setAdminUsers([]);
      } else {
        setAdminEnabled(true);
        setAdminError(err?.message || "Failed to load users");
      }
    } finally {
      setAdminLoading(false);
    }
  }

  useEffect(() => {
    // best-effort: show admin panel only for admins
    loadAdminUsers("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCopy(value) {
    const ok = await copyText(value);
    toast.push(ok ? "Copied" : "Copy failed", { kind: ok ? "default" : "error" });
  }

  async function onDeleteLink(id) {
    const ok = window.confirm("Delete this link? This cannot be undone.");
    if (!ok) return;
    try {
      await deleteLink(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
      toast.push("Link deleted");
    } catch (err) {
      toast.push(err?.message || "Delete failed", { kind: "error" });
    }
  }

  async function onToggleActive(link) {
    const isActive = link.active !== false;
    try {
      const data = await updateLink(link.id, { active: !isActive });
      const updated = data?.link;
      if (updated) setLinks((prev) => prev.map((l) => (l.id === link.id ? updated : l)));
      toast.push(!isActive ? "Link enabled" : "Link disabled");
    } catch (err) {
      toast.push(err?.message || "Failed to update status", { kind: "error" });
    }
  }

  async function onRegenerate(link) {
    const ok = window.confirm("Regenerate short code? This will change the short URL and the old one will stop working.");
    if (!ok) return;
    try {
      const data = await regenerateLinkSlug(link.id);
      const updated = data?.link;
      if (updated) setLinks((prev) => prev.map((l) => (l.id === link.id ? updated : l)));
      toast.push("Short code regenerated");
    } catch (err) {
      toast.push(err?.message || "Failed to regenerate", { kind: "error" });
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
      setQrLink(null);
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

  function toDatetimeLocalValue(input) {
    if (!input) return "";
    const dt = new Date(input);
    if (Number.isNaN(dt.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  }

  function fromDatetimeLocalValue(input) {
    const trimmed = (input || "").trim();
    if (!trimmed) return null;
    const dt = new Date(trimmed);
    if (Number.isNaN(dt.getTime())) return "invalid";
    return dt.toISOString();
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

  async function onCopyPublicStats(link) {
    const url = `${window.location.origin}/stats/${link.slug}`;
    const ok = await copyText(url);
    toast.push(ok ? "Public stats link copied" : "Copy failed", { kind: ok ? "default" : "error" });
  }

  function onOpenShare(link) {
    setShareLink(link);
  }

  function closeShare() {
    setShareLink(null);
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

  async function onShareNative() {
    const url = shareLink?.shortUrl;
    if (!url) return;
    const ok = await tryNativeShare({ title: "SHORTURO link", text: "Here’s a short link:", url });
    if (!ok) toast.push("Sharing not supported on this device", { kind: "error" });
  }

  function onShareWhatsapp() {
    const url = shareLink?.shortUrl;
    if (!url) return;
    const text = `Here’s my SHORTURO link:\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function onShareEmail() {
    const url = shareLink?.shortUrl;
    if (!url) return;
    const subject = "SHORTURO link";
    const body = `Here’s my short link:\n\n${url}\n`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function onLogout() {
    setLoggingOut(true);
    logout();
    window.location.href = "/login";
  }

  async function onUpgrade() {
    toast.push("Upgrade flow not connected yet. Ask an admin to switch your plan to Pro.", { kind: "default" });
  }

  async function onAdminSetPlan(targetUserId, plan) {
    try {
      const data = await adminUpdateUserPlan(targetUserId, { plan });
      const updated = data?.user;
      if (updated?.id) {
        setAdminUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      }
      toast.push(`Plan updated to ${plan}`);
    } catch (err) {
      toast.push(err?.message || "Failed to update plan", { kind: "error" });
    }
  }

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-primary/20 blur-3xl"
        />

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <UserCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Profile</h1>
              <p className="mt-1 text-sm text-muted-foreground">Account details and security.</p>
            </div>
          </div>

          <Button
            variant="outline"
            className="gap-2 bg-background/60 backdrop-blur"
            onClick={onLogout}
            disabled={loggingOut}
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? "Logging out..." : "Logout"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-2xl border-muted/60 bg-card/60 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle2 className="h-5 w-5 text-primary" />
              Account
            </CardTitle>
            <CardDescription>Your identity and session info.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border bg-gradient-to-b from-background to-background/40 p-4 shadow-sm">
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <div className="min-w-0 truncate font-medium">{email}</div>
                  <Button variant="outline" size="icon" onClick={() => onCopy(email)} aria-label="Copy email">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border bg-gradient-to-b from-background to-background/40 p-4 shadow-sm">
                <div className="text-xs text-muted-foreground">User ID</div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <div className="min-w-0 truncate font-medium">{userId || "—"}</div>
                  <Button variant="outline" size="icon" onClick={() => onCopy(userId || "")} aria-label="Copy user id">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border bg-gradient-to-b from-background to-background/40 p-4 shadow-sm">
                <div className="text-xs text-muted-foreground">Issued</div>
                <div className="mt-1 font-medium">{issuedAt}</div>
              </div>

              <div className="rounded-2xl border bg-gradient-to-b from-background to-background/40 p-4 shadow-sm">
                <div className="text-xs text-muted-foreground">Expires</div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <div className="min-w-0 truncate font-medium">{expiresAt}</div>
                  {payload?.exp ? <Badge variant="outline">JWT</Badge> : <Badge variant="secondary">Unknown</Badge>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-card/60 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Security
            </CardTitle>
            <CardDescription>Session & best practices.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border bg-gradient-to-b from-background to-background/40 p-4 shadow-sm">
              <div className="font-medium text-foreground">JWT session</div>
              <div className="mt-1">
                You are signed in using a JWT stored in localStorage. Logging out clears it from this browser.
              </div>
            </div>
            <div className="rounded-2xl border bg-gradient-to-b from-background to-background/40 p-4 shadow-sm">
              <div className="font-medium text-foreground">Tip</div>
              <div className="mt-1">Use a password manager and avoid signing in on shared devices.</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-muted/60 bg-card/60 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            Plan & usage
          </CardTitle>
          <CardDescription>Free vs Pro limits and monthly metering.</CardDescription>
        </CardHeader>
        <CardContent>
          {meLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : meError ? (
            <div className="text-sm text-destructive">{meError}</div>
          ) : me ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border bg-card/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Current plan</div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="text-lg font-semibold">{me?.user?.planName || "Free"}</div>
                      {me?.user?.plan === "pro" ? <Badge className="bg-indigo-600 text-white hover:bg-indigo-600">Pro</Badge> : <Badge variant="outline">Free</Badge>}
                    </div>
                  </div>
                  <Button
                    variant={me?.user?.plan === "pro" ? "outline" : "default"}
                    className={me?.user?.plan === "pro" ? "" : "bg-indigo-600 text-white hover:bg-indigo-500"}
                    onClick={onUpgrade}
                  >
                    {me?.user?.plan === "pro" ? "Manage" : "Upgrade"}
                  </Button>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  Links/month:{" "}
                  <span className="font-medium text-foreground">
                    {me?.usage?.linksCreated || 0}/{me?.limits?.linksPerMonth || 0}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:col-span-2">
                <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-transparent p-4 dark:from-emerald-950/30">
                  <div className="text-xs text-muted-foreground">Clicks (month)</div>
                  <div className="mt-1 text-2xl font-semibold">{me?.usage?.redirects || 0}</div>
                </div>
                <div className="rounded-2xl border bg-gradient-to-br from-sky-50 to-transparent p-4 dark:from-sky-950/30">
                  <div className="text-xs text-muted-foreground">Links created</div>
                  <div className="mt-1 text-2xl font-semibold">{me?.usage?.linksCreated || 0}</div>
                </div>
                <div className="rounded-2xl border bg-gradient-to-br from-amber-50 to-transparent p-4 dark:from-amber-950/30">
                  <div className="text-xs text-muted-foreground">Conversions</div>
                  <div className="mt-1 text-2xl font-semibold">{me?.usage?.conversions || 0}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No account data.</div>
          )}
        </CardContent>
      </Card>

      {adminEnabled ? (
        <Card className="rounded-2xl border-muted/60 bg-card/60 backdrop-blur">
          <CardHeader>
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Globe2 className="h-5 w-5 text-primary" />
                  Admin
                </CardTitle>
                <CardDescription>Manage user plans & view usage.</CardDescription>
              </div>
              <div className="flex w-full gap-2 md:w-[420px]">
                <Input value={adminQuery} onChange={(e) => setAdminQuery(e.target.value)} placeholder="Search users by email..." />
                <Button variant="outline" onClick={() => loadAdminUsers(adminQuery)} disabled={adminLoading}>
                  {adminLoading ? "Loading..." : "Search"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {adminError ? <div className="mb-3 text-sm text-destructive">{adminError}</div> : null}
            <div className="overflow-auto rounded-xl border">
              <table className="w-full min-w-[840px] text-sm">
                <thead className="bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">Plan</th>
                    <th className="px-4 py-3 text-left font-medium">Links (month)</th>
                    <th className="px-4 py-3 text-left font-medium">Clicks (month)</th>
                    <th className="px-4 py-3 text-left font-medium">Conversions</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{u.email}</div>
                        <div className="text-xs text-muted-foreground">{u.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        {u.plan === "pro" ? <Badge className="bg-indigo-600 text-white hover:bg-indigo-600">Pro</Badge> : <Badge variant="outline">Free</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        {u.usage?.linksCreated || 0}/{u.limits?.linksPerMonth || 0}
                      </td>
                      <td className="px-4 py-3">{u.usage?.redirects || 0}</td>
                      <td className="px-4 py-3">{u.usage?.conversions || 0}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => onAdminSetPlan(u.id, "free")} disabled={adminLoading}>
                            Set Free
                          </Button>
                          <Button
                            size="sm"
                            className="bg-indigo-600 text-white hover:bg-indigo-500"
                            onClick={() => onAdminSetPlan(u.id, "pro")}
                            disabled={adminLoading}
                          >
                            Set Pro
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {adminUsers.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-muted-foreground" colSpan={6}>
                        No users found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl border-muted/60 bg-card/60 backdrop-blur">
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Your links</CardTitle>
              <CardDescription>All your short links live here. Search, open analytics, copy, or delete.</CardDescription>
            </div>
            <div className="w-full md:w-80">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by short or destination..." />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingLinks ? <div className="text-sm text-muted-foreground">Loading links...</div> : null}
          {linksError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{linksError}</div>
          ) : null}
          {!loadingLinks && !linksError && filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground">No links found.</div>
          ) : null}

          {!loadingLinks && !linksError && filtered.length ? (
            <div className="grid gap-3">
              {filtered.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-col gap-2 rounded-2xl border bg-gradient-to-b from-background to-background/40 p-4 shadow-sm transition-colors hover:bg-background/60 md:flex-row md:items-start md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        className="truncate font-semibold underline-offset-4 hover:underline"
                        href={l.shortUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        title={l.shortUrl || l.slug}
                      >
                        {l.shortUrl || l.slug}
                      </a>
                      {l.active === false ? <Badge variant="outline">Inactive</Badge> : null}
                      {l.expiresAt ? <Badge variant="outline">Expires</Badge> : null}
                      <Badge variant="secondary">{l.clicks ?? 0} clicks</Badge>
                    </div>
                    <div className="mt-1 truncate text-sm text-muted-foreground">{l.originalUrl}</div>
                  </div>

                  <div className="flex items-start justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 w-9 rounded-full p-0 shadow-sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContentResponsive>
                        <DropdownMenuItem asChild disabled={!l.shortUrl || l.active === false}>
                          <a href={l.shortUrl || "#"} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" />
                            Open
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/dashboard/links/${l.id}`}>
                            <BarChart3 className="h-4 w-4" />
                            Analytics
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            onShowQr(l);
                          }}
                        >
                          <QrCode className="h-4 w-4" />
                          QR
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            onToggleActive(l);
                          }}
                        >
                          {l.active === false ? <Link2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                          {l.active === false ? "Not live" : "Live"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            onRegenerate(l);
                          }}
                        >
                          <RotateCw className="h-4 w-4" />
                          New code
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            startEdit(l);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            onCopyPublicStats(l);
                          }}
                        >
                          <Globe2 className="h-4 w-4" />
                          Public stats
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            onCopy(l.shortUrl || l.slug || "");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                          Copy
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            onOpenShare(l);
                          }}
                        >
                          <Share2 className="h-4 w-4" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                          onSelect={(e) => {
                            e.preventDefault();
                            onDeleteLink(l.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContentResponsive>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {qrLink ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onMouseDown={closeQr}>
          <div
            className="w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain rounded-2xl border bg-card p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">QR code</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{qrLink.shortUrl || qrLink.slug}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!qrLink) return;
                    const name = `shorturo-${qrLink.slug || "qr"}`;
                    if (qrFormat === "svg") {
                      if (!qrSvg) return;
                      downloadTextAsFile({ filename: `${name}.svg`, text: qrSvg, mime: "image/svg+xml;charset=utf-8" });
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
                  }}
                  disabled={qrFormat === "svg" ? !qrSvg : !qrUrl}
                >
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
                      <input type="range" min="0" max="6" step="1" value={qrMargin} onChange={(e) => setQrMargin(Number(e.target.value))} />
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
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (!file) return;
                          const url = URL.createObjectURL(file);
                          if (qrLogoUrl) URL.revokeObjectURL(qrLogoUrl);
                          setQrLogoUrl(url);
                        }}
                      />
                      <label className="grid gap-1 text-xs text-muted-foreground">
                        Logo size
                        <input type="range" min="0.14" max="0.30" step="0.01" value={qrLogoScale} onChange={(e) => setQrLogoScale(Number(e.target.value))} />
                      </label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (qrLogoUrl) URL.revokeObjectURL(qrLogoUrl);
                            setQrLogoUrl(null);
                          }}
                        >
                          Remove logo
                        </Button>
                        <Button type="button" size="sm" onClick={() => onShowQr(qrLink)}>
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
                  <Button type="button" variant="outline" size="sm" onClick={() => onShowQr(qrLink)} disabled={!qrLink}>
                    Refresh
                  </Button>
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
                    <img src={qrUrl} alt="QR code" className="w-full max-w-[280px] rounded-xl bg-white p-3 sm:max-w-[360px]" />
                  ) : (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingLink ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onMouseDown={closeEdit}>
          <div
            className="w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain rounded-xl border bg-card p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Edit link</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{editingLink.shortUrl || editingLink.slug}</div>
              </div>
              <Button variant="outline" onClick={closeEdit}>
                Close
              </Button>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <div className="text-sm font-medium">Destination URL</div>
                <Input value={editOriginalUrl} onChange={(e) => setEditOriginalUrl(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <div className="text-sm font-medium">Alias</div>
                <Input value={editCustomSlug} onChange={(e) => setEditCustomSlug(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <div className="text-sm font-medium">Expiry (optional)</div>
                <Input type="datetime-local" value={editExpiresAtLocal} onChange={(e) => setEditExpiresAtLocal(e.target.value)} />
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={onSaveEdit} disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save changes"}
                </Button>
                <Button className="flex-1" variant="outline" onClick={closeEdit} disabled={savingEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {shareLink ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onMouseDown={closeShare}>
          <div
            className="w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain rounded-xl border bg-card p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Share link</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{shareLink.shortUrl || shareLink.slug}</div>
              </div>
              <Button variant="outline" onClick={closeShare}>
                Close
              </Button>
            </div>

            <div className="mt-4 grid gap-3">
              <Button
                variant="secondary"
                className="justify-start gap-2 bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => onCopy(shareLink.shortUrl || shareLink.slug || "")}
              >
                <Copy className="h-4 w-4" />
                Copy link
              </Button>
              <Button variant="outline" className="justify-start gap-2" onClick={onShareNative}>
                <Share2 className="h-4 w-4" />
                Share (device)
              </Button>
              <Button variant="outline" className="justify-start gap-2" onClick={onShareWhatsapp}>
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
              <Button variant="outline" className="justify-start gap-2" onClick={onShareEmail}>
                <Mail className="h-4 w-4" />
                Email
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

