import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Share, Plus, Download } from "lucide-react";

// Detect if running in standalone (already installed) mode
function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

// Detect iOS Safari (no beforeinstallprompt support)
function isIosSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios/i.test(ua);
}

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "pwa-install-dismissed";
const DISMISSED_DAYS = 7; // re-show after 7 days

function wasDismissedRecently() {
  try {
    const ts = localStorage.getItem(DISMISSED_KEY);
    if (!ts) return false;
    return Date.now() - Number(ts) < DISMISSED_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // localStorage unavailable (private mode) — dismissal just won't persist
  }
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) return;

    if (isIosSafari()) {
      // Show iOS instructions after a short delay
      const t = setTimeout(() => {
        setShowIos(true);
        setVisible(true);
      }, 3000);
      return () => clearTimeout(t);
    }

    // Android / Chrome — listen for native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const t = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(t);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible) return null;

  function handleDismiss() {
    dismiss();
    setVisible(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") dismiss();
    setDeferredPrompt(null);
    setVisible(false);
  }

  // ── iOS instructions ──────────────────────────────────────────────────────
  if (showIos) {
    return (
      <div className="fixed bottom-[5.5rem] inset-x-3 z-50 md:hidden">
        <div className="rounded-2xl border bg-background p-4 shadow-2xl">
          <button
            onClick={handleDismiss}
            className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10">
              <img src="/logo.png" alt="Vastu" className="h-7 w-7 rounded-lg object-contain" />
            </div>
            <div>
              <p className="font-semibold text-sm">Install Vastu Stair Designer</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Add to your Home Screen for quick access — works like a native app.
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Tap</span>
                <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 font-medium">
                  <Share className="h-3 w-3" /> Share
                </span>
                <span>then</span>
                <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 font-medium">
                  <Plus className="h-3 w-3" /> Add to Home Screen
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* Tooltip arrow pointing down */}
        <div className="mx-auto w-4 overflow-hidden">
          <div className="h-3 w-4 rotate-45 translate-y-[-6px] bg-background border-r border-b border-border mx-auto" />
        </div>
      </div>
    );
  }

  // ── Android / Chrome prompt ───────────────────────────────────────────────
  return (
    <div className="fixed bottom-[5.5rem] inset-x-3 z-50 md:hidden">
      <div className="rounded-2xl border bg-background p-4 shadow-2xl">
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary shadow-md">
            <img src="/logo.png" alt="Vastu" className="h-9 w-9 rounded-xl object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">Install Vastu Stair Designer</p>
            <p className="text-xs text-muted-foreground">Add to Home Screen · Works offline</p>
          </div>
        </div>
        <Button onClick={handleInstall} className="mt-3 w-full gap-2">
          <Download className="h-4 w-4" /> Install App
        </Button>
      </div>
    </div>
  );
}
