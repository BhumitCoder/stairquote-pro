import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { listClients } from "@/lib/firestore";
import { BRAND_TAGLINE } from "@/lib/settings-defaults";
import { isToday } from "@/lib/format";
import {
  Home,
  Users,
  FileText,
  PlusCircle,
  Settings,
  LogOut,
  Menu,
  X,
  PhoneCall,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  BadgePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "firebase/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

type NavItem = {
  to: "/" | "/clients" | "/quotations" | "/quotations/new" | "/bills" | "/bills/new" | "/settings";
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: Home, exact: true },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/quotations", label: "Quotations", icon: FileText },
  { to: "/quotations/new", label: "New Quotation", icon: PlusCircle },
  { to: "/bills", label: "Bills", icon: ReceiptText },
  { to: "/bills/new", label: "New Bill", icon: BadgePlus },
  { to: "/settings", label: "Settings", icon: Settings },
];

// Only the most specific nav item is active — "/quotations/new" must not
// also highlight "/quotations".
function activeNavTo(pathname: string): NavItem["to"] | undefined {
  return navItems
    .filter((it) =>
      it.exact ? pathname === it.to : pathname === it.to || pathname.startsWith(`${it.to}/`),
    )
    .reduce<NavItem | undefined>(
      (best, it) => (best && best.to.length >= it.to.length ? best : it),
      undefined,
    )?.to;
}

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
  collapsed = false,
  onToggleCollapse,
}: {
  pathname: string;
  user: User;
  logout: () => Promise<void>;
  nav: ReturnType<typeof useNavigate>;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <div
      className="flex h-full flex-col"
      style={{ background: "var(--color-sidebar)", color: "var(--color-sidebar-foreground)" }}
    >
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          "flex h-20 shrink-0 items-center",
          collapsed ? "justify-center px-2" : "justify-between px-4",
        )}
        style={{ borderBottom: "1px solid var(--color-sidebar-border)" }}
      >
        {!collapsed && (
          <div className="min-w-0">
            <img
              src="/logo.png"
              alt="Vastu Stairs Designer"
              className="h-9 w-auto object-contain"
            />
            <div
              className="mt-1 truncate text-[9px] italic tracking-wide"
              style={{ color: "var(--color-sidebar-foreground)", opacity: 0.4 }}
            >
              {BRAND_TAGLINE}
            </div>
          </div>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1.5 transition-colors hover:bg-white/10"
            style={{ color: "var(--color-sidebar-foreground)", opacity: 0.6 }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Minimize sidebar"}
            className="rounded-md p-1.5 transition-colors hover:bg-white/10"
            style={{ color: "var(--color-sidebar-foreground)", opacity: 0.6 }}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
        {!collapsed && (
          <p
            className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--color-sidebar-foreground)", opacity: 0.35 }}
          >
            Navigation
          </p>
        )}
        <ul className="space-y-0.5">
          {navItems.map((it) => {
            const active = it.to === activeNavTo(pathname);
            return (
              <li key={it.to}>
                <Link
                  to={it.to}
                  onClick={onClose}
                  title={collapsed ? it.label : undefined}
                  className={cn(
                    "flex items-center rounded-lg text-sm font-medium transition-all duration-150",
                    collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                    active ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-white/10",
                  )}
                  style={active ? {} : { color: "var(--color-sidebar-foreground)", opacity: 0.75 }}
                >
                  <it.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{it.label}</span>}
                  {!collapsed && active && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white/50" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User + logout */}
      <div
        className={cn("shrink-0 pb-4", collapsed ? "px-2" : "px-3")}
        style={{ borderTop: "1px solid var(--color-sidebar-border)" }}
      >
        <div className={cn("flex items-center py-3", collapsed ? "justify-center" : "gap-3 px-3")}>
          <div
            title={collapsed ? (user.email ?? undefined) : undefined}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold uppercase"
            style={{
              background: "var(--color-sidebar-accent)",
              color: "var(--color-sidebar-foreground)",
            }}
          >
            {user.email?.[0] ?? "U"}
          </div>
          {!collapsed && (
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
          )}
        </div>
        <button
          onClick={async () => {
            await logout();
            nav({ to: "/auth" });
          }}
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "flex w-full items-center rounded-lg py-2 text-sm font-medium transition-all duration-150 hover:bg-red-500/15 hover:text-red-400",
            collapsed ? "justify-center px-2" : "gap-3 px-3",
          )}
          style={{ color: "var(--color-sidebar-foreground)", opacity: 0.6 }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </div>
  );
}

function CallbackReminderModal({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", user.uid],
    queryFn: () => listClients(user.uid),
    enabled: !!user,
  });

  const dueToday = clients.filter((c) => c.callbackDate && isToday(c.callbackDate));

  useEffect(() => {
    if (dueToday.length > 0 && !dismissed) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueToday.length]);

  if (dueToday.length === 0) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setDismissed(true);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" />
            Callback reminders for today
          </DialogTitle>
        </DialogHeader>
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {dueToday.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3"
            >
              <div className="min-w-0">
                <div className="font-medium">{c.name}</div>
                {c.callbackNote && (
                  <div className="truncate text-xs text-muted-foreground">{c.callbackNote}</div>
                )}
                {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
              </div>
              <div className="flex shrink-0 gap-2">
                {c.phone && (
                  <Button size="sm" asChild>
                    <a href={`tel:${c.phone}`}>Call</a>
                  </Button>
                )}
                <Button size="sm" variant="outline" asChild>
                  <Link to="/clients/$id" params={{ id: c.id }} onClick={() => setOpen(false)}>
                    View
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function AuthedLayout() {
  const { user, loading, logout } = useAuth();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("sidebar-collapsed") === "1",
  );

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });

  useEffect(() => {
    if (!loading && !user) {
      nav({ to: "/auth" });
    }
  }, [user, loading, nav]);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return <PageLoader />;
  }

  return (
    <div
      className="flex h-screen overflow-hidden bg-muted/20"
      style={{ "--sidebar-w": collapsed ? "4rem" : "15rem" } as React.CSSProperties}
    >
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border transition-all duration-200 md:block",
          collapsed ? "w-16" : "w-60",
        )}
        style={{ background: "var(--color-sidebar)" }}
      >
        <SidebarContent
          pathname={pathname}
          user={user}
          logout={logout}
          nav={nav}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
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

      <CallbackReminderModal user={user} />

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
          <div className="px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
