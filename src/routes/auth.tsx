import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

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
      toast.error(msg.replace("Firebase: ", ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <div
            className="mx-auto mb-4 flex items-center justify-center rounded-2xl px-6 py-4"
            style={{ background: "#151520" }}
          >
            <img src="/logo.png" alt="Vast Stair" className="h-14 w-auto object-contain" />
          </div>
          <CardTitle className="text-2xl">Vast Stair Quotations</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </CardHeader>
        <CardContent>
          {!configured && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                Firebase is not configured yet. Add your{" "}
                <code className="font-mono">VITE_FIREBASE_*</code> keys to your <code>.env</code>{" "}
                file, then reload. See{" "}
                <Link to="/" className="underline">
                  README-DEPLOY.md
                </Link>
                .
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12"
              />
            </div>
            <Button type="submit" disabled={busy || !configured} className="h-12 w-full text-base">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
