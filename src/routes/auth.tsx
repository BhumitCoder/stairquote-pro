import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const { user, loading, configured, signIn } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);

  useEffect(() => {
    if (!loading && user) nav({ to: "/" });
  }, [user, loading, nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      toast.success("Welcome back!");
      nav({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      toast.error(msg.replace("Firebase: ", "").replace(/\(auth\/.*?\)\.?/, "").trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex min-h-screen"
      style={{ background: "#0d0d17" }}
    >
      {/* ── LEFT BRAND PANEL ── */}
      <div
        className="relative hidden flex-col items-center justify-center overflow-hidden lg:flex lg:w-1/2"
        style={{ background: "linear-gradient(145deg, #0d0d17 0%, #141426 60%, #1a1030 100%)" }}
      >
        {/* Decorative stair-step shapes */}
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.04]"
          viewBox="0 0 600 700"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Large stair steps bottom-left */}
          <rect x="0" y="560" width="600" height="30" fill="#E8484D" />
          <rect x="0" y="490" width="480" height="30" fill="#E8484D" />
          <rect x="0" y="420" width="360" height="30" fill="#E8484D" />
          <rect x="0" y="350" width="240" height="30" fill="#E8484D" />
          <rect x="0" y="280" width="120" height="30" fill="#E8484D" />
          {/* Top-right stairs */}
          <rect x="480" y="0" width="120" height="30" fill="#E8484D" />
          <rect x="360" y="70" width="240" height="30" fill="#E8484D" />
          <rect x="240" y="140" width="360" height="30" fill="#E8484D" />
        </svg>

        {/* Glow orb */}
        <div
          className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-3xl"
          style={{ background: "#E8484D" }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center px-12 text-center">
          <img
            src="/logo.png"
            alt="Vastu Stair Designer"
            className="mb-10 w-64 object-contain drop-shadow-2xl"
          />

          <div className="mb-3 h-px w-24 rounded-full" style={{ background: "#E8484D", opacity: 0.6 }} />

          <h1 className="mb-3 text-3xl font-bold tracking-tight text-white">
            Quotation Software
          </h1>
          <p className="max-w-xs text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
            Create professional stair quotations, manage clients, and generate polished PDFs — all in one place.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-6 text-center">
            {[
              { label: "Clients", icon: "👥" },
              { label: "Quotations", icon: "📄" },
              { label: "PDF Export", icon: "⬇️" },
            ].map((f) => (
              <div key={f.label} className="flex flex-col items-center gap-2">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-xl"
                  style={{ background: "rgba(232,72,77,0.12)", border: "1px solid rgba(232,72,77,0.2)" }}
                >
                  {f.icon}
                </div>
                <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {f.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom border accent */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ background: "linear-gradient(90deg, transparent, #E8484D, transparent)" }}
        />
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div
        className="flex flex-1 flex-col items-center justify-center px-6 py-12"
        style={{ background: "#111119" }}
      >
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          <img src="/logo.png" alt="Vastu Stair Designer" className="h-12 w-auto object-contain" />
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">Welcome back</h2>
            <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              Sign in to your workspace
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: focusedField === "email" ? "#E8484D" : "rgba(255,255,255,0.25)" }}
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl py-3 pl-10 pr-4 text-sm text-white outline-none transition-all duration-200 placeholder:text-white/20"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: focusedField === "email"
                      ? "1px solid #E8484D"
                      : "1px solid rgba(255,255,255,0.1)",
                    boxShadow: focusedField === "email" ? "0 0 0 3px rgba(232,72,77,0.12)" : "none",
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: focusedField === "password" ? "#E8484D" : "rgba(255,255,255,0.25)" }}
                />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••••••"
                  className="w-full rounded-xl py-3 pl-10 pr-4 text-sm text-white outline-none transition-all duration-200 placeholder:text-white/20"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: focusedField === "password"
                      ? "1px solid #E8484D"
                      : "1px solid rgba(255,255,255,0.1)",
                    boxShadow: focusedField === "password" ? "0 0 0 3px rgba(232,72,77,0.12)" : "none",
                  }}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={busy || !configured}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: busy ? "rgba(232,72,77,0.7)" : "linear-gradient(135deg, #E8484D, #c9373c)",
                boxShadow: busy ? "none" : "0 4px 20px rgba(232,72,77,0.35)",
              }}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <p className="mt-8 text-center text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            Access restricted to authorised users only.
          </p>
        </div>
      </div>
    </div>
  );
}
