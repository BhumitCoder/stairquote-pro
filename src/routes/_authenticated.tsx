import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Home, Users, PlusCircle, Settings, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "firebase/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

type NavItem = {
  to: "/" | "/clients" | "/quotations/new" | "/settings";
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: Home, exact: true },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/quotations/new", label: "New Quotation", icon: PlusCircle },
  { to: "/settings", label: "Settings", icon: Settings },
];

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-5">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <span className="text-xl font-bold">V</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
          <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
          <div className="h-2 w-2 animate-bounce rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  user,
  logout,
  nav,
  onClose,
}: {
  pathname: string;
  user: User;
  logout: () => Promise<void>;
  nav: ReturnType<typeof useNavigate>;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full flex-col" style={{ background: "var(--color-sidebar)", color: "var(--color-sidebar-foreground)" }}>
      {/* Logo */}
      <div
        className="flex h-20 shrink-0 items-center justify-between px-4"
        style={{ borderBottom: "1px solid var(--color-sidebar-border)" }}
      >
        <img src="/logo.png" alt="Vastu Stair Designer" className="h-10 w-auto object-contain" />
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1.5 transition-colors hover:bg-white/10"
            style={{ color: "var(--color-sidebar-foreground)", opacity: 0.6 }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p
          className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--color-sidebar-foreground)", opacity: 0.35 }}
        >
          Navigation
        </p>
        <ul className="space-y-0.5">
          {navItems.map((it) => {
            const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
            return (
              <li key={it.to}>
                <Link
                  to={it.to}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-white/10",
                  )}
                  style={
                    active
                      ? {}
                      : { color: "var(--color-sidebar-foreground)", opacity: 0.75 }
                  }
                >
                  <it.icon className="h-4 w-4 shrink-0" />
                  <span>{it.label}</span>
                  {active && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white/50" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User + logout */}
      <div className="shrink-0 px-3 pb-4" style={{ borderTop: "1px solid var(--color-sidebar-border)" }}>
        <div className="flex items-center gap-3 px-3 py-3">
          <div
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold uppercase"
            style={{
              background: "var(--color-sidebar-accent)",
              color: "var(--color-sidebar-foreground)",
            }}
          >
            {user.email?.[0] ?? "U"}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="truncate text-xs font-medium"
              style={{ color: "var(--color-sidebar-foreground)" }}
            >
              {user.email}
            </div>
            <div
              className="text-[11px]"
              style={{ color: "var(--color-sidebar-foreground)", opacity: 0.45 }}
            >
              Owner
            </div>
          </div>
        </div>
        <button
          onClick={async () => {
            await logout();
            nav({ to: "/auth" });
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 hover:bg-red-500/15 hover:text-red-400"
          style={{ color: "var(--color-sidebar-foreground)", opacity: 0.6 }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );
}

function AuthedLayout() {
  const { user, loading, configured, logout } = useAuth();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !configured)) {
      nav({ to: "/auth" });
    }
  }, [user, loading, configured, nav]);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return <PageLoader />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-muted/20">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border md:block" style={{ background: "var(--color-sidebar)" }}>
        <SidebarContent pathname={pathname} user={user} logout={logout} nav={nav} />
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 w-64 shadow-2xl md:hidden"
            style={{ background: "var(--color-sidebar)" }}
          >
            <SidebarContent
              pathname={pathname}
              user={user}
              logout={logout}
              nav={nav}
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </>
      )}

      {/* Main content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img src="/logo.png" alt="Vastu Stair Designer" className="h-8 w-auto object-contain" />
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
