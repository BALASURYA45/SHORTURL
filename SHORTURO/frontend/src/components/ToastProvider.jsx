import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "../lib/utils.js";

const ToastContext = createContext(null);

function randomId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, { kind = "default", timeoutMs = 2200 } = {}) => {
    const id = randomId();
    setToasts((prev) => [...prev, { id, message, kind }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, timeoutMs);
  }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed bottom-4 left-1/2 z-50 grid w-full max-w-sm -translate-x-1/2 gap-2 px-3"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-md border bg-background/90 px-3 py-2 text-sm text-foreground shadow-lg backdrop-blur",
              t.kind === "error" ? "border-destructive/40 bg-destructive/10" : "border-border"
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
