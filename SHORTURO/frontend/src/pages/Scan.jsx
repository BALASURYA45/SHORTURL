import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider.jsx";

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
  const navigate = useNavigate();
  const toast = useToast();
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState(null);

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

  function openResult() {
    if (!result) return;
    if (!isLikelyUrl(result)) {
      toast.push("Scanned text is not a URL", { kind: "error" });
      return;
    }
    window.open(result, "_blank", "noreferrer");
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
            <h1 className="title">QR scanner</h1>
            <p className="muted">Point your camera at a QR code to open the link.</p>

            {error ? <div className="errorBox">{error}</div> : null}

            <div className="videoWrap">
              <video ref={videoRef} className="video" muted playsInline />
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <button className="buttonSmall" type="button" onClick={restart} disabled={running}>
                {running ? "Scanning..." : "Scan again"}
              </button>
              <Link className="buttonSmall" to="/dashboard">
                Dashboard
              </Link>
            </div>

            {result ? (
              <div className="resultBox">
                <div className="detailLabel">Scanned</div>
                <div className="resultText">{result}</div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="buttonSmall" type="button" onClick={openResult}>
                    Open
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}

