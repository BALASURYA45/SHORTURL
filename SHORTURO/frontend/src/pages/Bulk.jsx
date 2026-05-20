import { useMemo, useState } from "react";
import { z } from "zod";
import { bulkCreateLinks } from "../lib/api.js";
import { useToast } from "../components/ToastProvider.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Label } from "../components/ui/label.jsx";
import { Textarea } from "../components/ui/textarea.jsx";

const rowSchema = z.object({
  originalUrl: z.string().url("Invalid URL (include https://)").max(2048),
  customSlug: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[a-zA-Z0-9_-]{3,40}$/.test(v), "Invalid alias (3-40 letters/numbers/_/-)"),
  expiresAt: z.union([z.string().datetime(), z.null()]).optional()
});

function parseCsv(text) {
  const rows = [];
  let i = 0;
  let field = "";
  let row = [];
  let inQuotes = false;

  function pushField() {
    row.push(field);
    field = "";
  }
  function pushRow() {
    if (row.length === 1 && row[0].trim() === "") return;
    rows.push(row);
    row = [];
  }

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      pushField();
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  pushField();
  pushRow();
  return rows;
}

function toIsoOrNull(dtLocal) {
  const trimmed = (dtLocal || "").trim();
  if (!trimmed) return undefined;
  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) return "invalid";
  return dt.toISOString();
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkPage() {
  const toast = useToast();
  const [input, setInput] = useState("originalUrl,customSlug,expiresAt\nhttps://example.com,,\n");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);

  const parsed = useMemo(() => {
    const rows = parseCsv(input);
    if (rows.length === 0) return { items: [], errors: ["CSV is empty"] };
    const [header, ...dataRows] = rows;
    const cols = header.map((h) => String(h || "").trim());
    const colIndex = {
      originalUrl: cols.findIndex((c) => c.toLowerCase() === "originalurl"),
      customSlug: cols.findIndex((c) => c.toLowerCase() === "customslug"),
      expiresAt: cols.findIndex((c) => c.toLowerCase() === "expiresat")
    };

    if (colIndex.originalUrl < 0) return { items: [], errors: ["Missing header column: originalUrl"] };

    const items = [];
    const rowErrors = [];
    for (let r = 0; r < dataRows.length; r += 1) {
      const row = dataRows[r];
      const originalUrl = String(row[colIndex.originalUrl] || "").trim();
      const customSlug = colIndex.customSlug >= 0 ? String(row[colIndex.customSlug] || "").trim() : "";
      const expiresAtRaw = colIndex.expiresAt >= 0 ? String(row[colIndex.expiresAt] || "").trim() : "";
      if (!originalUrl) continue;

      const expiresAtIso = expiresAtRaw ? toIsoOrNull(expiresAtRaw) : undefined;
      if (expiresAtIso === "invalid") {
        rowErrors.push(`Row ${r + 2}: invalid expiresAt`);
        continue;
      }

      const item = {
        originalUrl,
        ...(customSlug ? { customSlug } : null),
        ...(expiresAtIso !== undefined ? { expiresAt: expiresAtIso || null } : null)
      };

      const ok = rowSchema.safeParse(item);
      if (!ok.success) {
        rowErrors.push(`Row ${r + 2}: ${ok.error.issues?.[0]?.message || "Invalid row"}`);
        continue;
      }
      items.push(item);
    }

    if (items.length === 0 && rowErrors.length === 0) rowErrors.push("No data rows found");
    return { items, errors: rowErrors };
  }, [input]);

  async function onUploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setInput(text);
    setResults(null);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setResults(null);
    if (parsed.errors.length) {
      toast.push("Fix CSV errors first", { kind: "error" });
      return;
    }
    if (!parsed.items.length) {
      toast.push("No items to create", { kind: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const data = await bulkCreateLinks(parsed.items);
      setResults(data?.results || []);
      toast.push("Bulk create finished");
    } catch (err) {
      toast.push(err?.message || "Bulk create failed", { kind: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  function downloadResults() {
    if (!Array.isArray(results)) return;
    const header = ["index", "ok", "shortUrl", "slug", "originalUrl", "error"];
    const lines = [header.join(",")];
    for (const r of results) {
      const link = r.link || null;
      const row = [
        String(r.index),
        String(Boolean(r.ok)),
        link?.shortUrl ? JSON.stringify(link.shortUrl) : "",
        link?.slug ? JSON.stringify(link.slug) : "",
        link?.originalUrl ? JSON.stringify(link.originalUrl) : "",
        r.error ? JSON.stringify(r.error) : ""
      ];
      lines.push(row.join(","));
    }
    downloadText("shorturo_bulk_results.csv", lines.join("\n"));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bulk shorten</h1>
        <p className="text-sm text-muted-foreground">Upload or paste CSV to create many short links at once.</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>CSV input</CardTitle>
            <CardDescription>Columns: originalUrl, customSlug, expiresAt (optional).</CardDescription>
          </div>
          <label>
            <Button asChild variant="outline">
              <span>Upload CSV</span>
            </Button>
            <input type="file" accept=".csv,text/csv" onChange={onUploadFile} className="hidden" />
          </label>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label>CSV</Label>
              <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={10} className="font-mono text-xs" />
            </div>

            {parsed.errors.length ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                {parsed.errors.slice(0, 6).map((e) => (
                  <div key={e}>{e}</div>
                ))}
                {parsed.errors.length > 6 ? <div>…and {parsed.errors.length - 6} more</div> : null}
              </div>
            ) : (
              <div className="rounded-lg border bg-card/40 px-3 py-2 text-sm">
                Ready: <span className="font-semibold">{parsed.items.length}</span> item(s) (max 200).
              </div>
            )}

            <Button type="submit" disabled={submitting || parsed.errors.length > 0}>
              {submitting ? "Creating..." : "Create links"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {Array.isArray(results) ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Results</CardTitle>
              <CardDescription>{results.length} row(s)</CardDescription>
            </div>
            <Button variant="outline" onClick={downloadResults}>
              Download CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {results.slice(0, 50).map((r) => (
                <div key={`${r.index}_${r.ok}`} className="flex items-center justify-between gap-3 rounded-lg border bg-card/40 p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      #{r.index + 1} {r.ok ? "OK" : "ERROR"}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {r.ok ? r.link?.shortUrl || r.link?.slug : r.error}
                    </div>
                  </div>
                  <Badge variant={r.ok ? "secondary" : "destructive"}>{r.ok ? "created" : "failed"}</Badge>
                </div>
              ))}
            </div>
            {results.length > 50 ? <div className="mt-3 text-sm text-muted-foreground">Showing first 50…</div> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

