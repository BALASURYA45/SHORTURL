import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { useToast } from "../components/ToastProvider.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";

function isLikelyUrl(text) {
  try {
    // eslint-disable-next-line no-new
    new URL(text);
    return true;
  } catch {
    return false;
  }
}

export default function ScanPage() {
  const toast = useToast();
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    let stopped = false;

    async function start() {
      setError(null);
      setRunning(true);
      try {
        await reader.decodeFromVideoDevice(undefined, videoRef.current, (res) => {
          if (!res || stopped) return;
          const text = res.getText();
          setResult(text);
          toast.push("QR detected");
          reader.reset();
          setRunning(false);
        });
      } catch (err) {
        if (!stopped) setError(err?.message || "Camera error");
        setRunning(false);
      }
    }

    start();
    return () => {
      stopped = true;
      try {
        reader.reset();
      } catch {
        // ignore
      }
      readerRef.current = null;
    };
  }, [toast]);

  async function restart() {
    setResult("");
    setError(null);
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    setRunning(true);
    try {
      await reader.decodeFromVideoDevice(undefined, videoRef.current, (res) => {
        if (!res) return;
        const text = res.getText();
        setResult(text);
        toast.push("QR detected");
        reader.reset();
        setRunning(false);
      });
    } catch (err) {
      setError(err?.message || "Camera error");
      setRunning(false);
    }
  }

  function openText(text) {
    const t = (text || "").trim();
    if (!t) return;
    if (!isLikelyUrl(t)) {
      toast.push("Not a valid URL", { kind: "error" });
      return;
    }
    window.open(t, "_blank", "noreferrer");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">QR scanner</h1>
        <p className="text-sm text-muted-foreground">Scan a QR code to open a short link instantly.</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Camera</CardTitle>
            <CardDescription>Allow camera permissions when prompted.</CardDescription>
          </div>
          <Button variant="outline" onClick={restart} disabled={running}>
            {running ? "Scanning..." : "Scan again"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{error}</div> : null}

          <div className="overflow-hidden rounded-lg border bg-card/40">
            <video ref={videoRef} className="h-[45vh] min-h-[240px] w-full max-h-[420px] object-cover" muted playsInline />
          </div>

          {result ? (
            <div className="rounded-lg border bg-card/40 p-3">
              <div className="text-xs text-muted-foreground">Scanned</div>
              <div className="mt-1 break-words text-sm font-medium">{result}</div>
              <div className="mt-3">
                <Button onClick={() => openText(result)}>Open</Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manual</CardTitle>
          <CardDescription>Paste a URL to open it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="manual">URL</Label>
            <Input id="manual" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="https://..." />
          </div>
          <Button variant="outline" onClick={() => openText(manual)}>
            Open
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
