import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Home, Users, PlusCircle, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

const navItems = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/quotations/new", label: "New", icon: PlusCircle, primary: true },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AuthedLayout() {
  const { user, loading, configured, logout } = useAuth();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && (!user || !configured)) {
      nav({ to: "/auth" });
    }
  }, [user, loading, configured, nav]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Desktop top bar */}
      <header className="sticky top-0 z-30 hidden border-b bg-background/95 backdrop-blur md:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">
              V
            </div>
            <span className="text-lg font-semibold">Vast Stair</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1">
            {navItems.map((it) => {
              const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent",
                  )}
                >
                  <it.icon className="h-4 w-4" />
                  {it.label === "New" ? "New Quotation" : it.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={() => { logout(); nav({ to: "/auth" }); }}>
              <LogOut className="mr-1 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 border-b bg-background md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              V
            </div>
            <span className="font-semibold">Vast Stair</span>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => { logout(); nav({ to: "/auth" }); }}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-8">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-4">
          {navItems.map((it) => {
            const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-xs",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {it.primary ? (
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
                    <it.icon className="h-5 w-5" />
                  </div>
                ) : (
                  <it.icon className="h-5 w-5" />
                )}
                <span className={cn(it.primary && "sr-only")}>{it.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
