import { useEffect, useRef, useState } from "react";

const GOOGLE_CLIENT_ID =
  (typeof __GOOGLE_CLIENT_ID__ !== "undefined" && __GOOGLE_CLIENT_ID__) ||
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadGoogleScript() {
  const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
  if (existing) {
    if (window.google?.accounts?.id) return Promise.resolve();
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });
}

export default function GoogleSignInButton({ onCredential, disabled = false }) {
  const containerRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!GOOGLE_CLIENT_ID) {
        setError("Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID to frontend/.env and restart Vite.");
        return;
      }

      try {
        await loadGoogleScript();
        if (cancelled || !window.google?.accounts?.id || !containerRef.current) return;

        const gsiStateKey = "__shorturo_gsi_client_id__";
        const alreadyInitializedForClient = window[gsiStateKey] === GOOGLE_CLIENT_ID;
        if (!alreadyInitializedForClient) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response) => {
              const handler = onCredentialRef.current;
              if (response?.credential && typeof handler === "function") handler(response.credential);
            }
          });
          window[gsiStateKey] = GOOGLE_CLIENT_ID;
        }

        containerRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: containerRef.current.offsetWidth || 360
        });
        setReady(true);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to initialize Google sign-in");
      }
    }

    setup();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <div className="text-xs text-muted-foreground">{error}</div>;
  }

  return (
    <div className={disabled ? "pointer-events-none opacity-60" : ""}>
      <div ref={containerRef} className="min-h-[44px] w-full" />
      {!ready ? <div className="mt-2 text-xs text-muted-foreground">Loading Google sign-in...</div> : null}
    </div>
  );
}
