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
  X,
  PhoneCall,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  BadgePlus,
  MoreHorizontal,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "firebase/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InstallPrompt } from "@/components/InstallPrompt";

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

// Bottom nav visible tabs
const bottomNavItems: NavItem[] = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/quotations", label: "Quotes", icon: FileText },
  { to: "/bills", label: "Bills", icon: ReceiptText },
];

// "More" sheet items (shown in slide-up sheet on mobile)
const moreItems: NavItem[] = [
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/bills/new", label: "New Bill", icon: BadgePlus },
  { to: "/settings", label: "Settings", icon: Settings },
];

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

// ─── Desktop Sidebar ────────────────────────────────────────────────────────
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
      <div
        className={cn(
          "flex h-20 shrink-0 items-center",
          collapsed ? "justify-center px-2" : "justify-between px-4",
        )}
        style={{ borderBottom: "1px solid var(--color-sidebar-border)" }}
      >
        {!collapsed && (
          <div className="min-w-0">
            <img src="/logo.png" alt="Vastu Stairs Designer" className="h-9 w-auto object-contain" />
            <div
              className="mt-1 truncate text-[9px] italic tracking-wide"
              style={{ color: "var(--color-sidebar-foreground)", opacity: 0.5 }}
            >
              {BRAND_TAGLINE}
            </div>
          </div>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{ color: "var(--color-sidebar-foreground)", opacity: 0.6 }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Minimize sidebar"}
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{ color: "var(--color-sidebar-foreground)", opacity: 0.6 }}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
      </div>

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
                    active ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-black/5",
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

      <div
        className={cn("shrink-0 pb-4", collapsed ? "px-2" : "px-3")}
        style={{ borderTop: "1px solid var(--color-sidebar-border)" }}
      >
        <div className={cn("flex items-center py-3", collapsed ? "justify-center" : "gap-3 px-3")}>
          <div
            title={collapsed ? (user.email ?? undefined) : undefined}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold uppercase"
            style={{ background: "var(--color-sidebar-accent)", color: "var(--color-sidebar-foreground)" }}
          >
            {user.email?.[0] ?? "U"}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium" style={{ color: "var(--color-sidebar-foreground)" }}>
                {user.email}
              </div>
              <div className="text-[11px]" style={{ color: "var(--color-sidebar-foreground)", opacity: 0.45 }}>
                Owner
              </div>
            </div>
          )}
        </div>
        <button
          onClick={async () => { await logout(); nav({ to: "/auth" }); }}
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

// ─── Callback reminder modal ─────────────────────────────────────────────────
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
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setDismissed(true); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" /> Callback reminders for today
          </DialogTitle>
        </DialogHeader>
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {dueToday.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="min-w-0">
                <div className="font-medium">{c.name}</div>
                {c.callbackNote && <div className="truncate text-xs text-muted-foreground">{c.callbackNote}</div>}
                {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
              </div>
              <div className="flex shrink-0 gap-2">
                {c.phone && <Button size="sm" asChild><a href={`tel:${c.phone}`}>Call</a></Button>}
                <Button size="sm" variant="outline" asChild>
                  <Link to="/clients/$id" params={{ id: c.id }} onClick={() => setOpen(false)}>View</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mobile "More" bottom sheet ──────────────────────────────────────────────
function MoreSheet({
  open,
  onClose,
  user,
  logout,
  nav,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  user: User;
  logout: () => Promise<void>;
  nav: ReturnType<typeof useNavigate>;
  pathname: string;
}) {
  const active = activeNavTo(pathname);

  if (!open) return null;
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-background shadow-2xl md:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
        </div>

        {/* User profile */}
        <div className="flex items-center gap-3 border-b px-5 py-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold uppercase text-primary">
            {user.email?.[0] ?? "U"}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{user.email}</div>
            <div className="text-xs text-muted-foreground">Owner</div>
          </div>
        </div>

        {/* Nav items */}
        <ul className="px-3 py-2 space-y-0.5">
          {moreItems.map((it) => {
            const isActive = it.to === active;
            return (
              <li key={it.to}>
                <Link
                  to={it.to}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-4 rounded-2xl px-4 py-3.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-accent",
                  )}
                >
                  <it.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                  {it.label}
                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/50" />
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Sign out */}
        <div className="border-t px-3 pb-3 pt-2">
          <button
            onClick={async () => { await logout(); nav({ to: "/auth" }); onClose(); }}
            className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Mobile Bottom Navigation ────────────────────────────────────────────────
function BottomNav({
  pathname,
  onMoreClick,
  moreOpen,
}: {
  pathname: string;
  onMoreClick: () => void;
  moreOpen: boolean;
}) {
  const active = activeNavTo(pathname);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
    >
      <div className="flex h-16 items-center justify-around px-2">
        {/* Home */}
        {bottomNavItems.slice(0, 1).map((it) => {
          const isActive = it.to === active;
          return (
            <Link key={it.to} to={it.to} className="flex flex-1 flex-col items-center gap-0.5 py-1">
              <div className={cn(
                "flex h-8 w-12 items-center justify-center rounded-2xl transition-all",
                isActive ? "bg-primary/15" : "",
              )}>
                <it.icon className={cn("h-5 w-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground")} />
              </div>
              <span className={cn("text-[10px] font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
                {it.label}
              </span>
            </Link>
          );
        })}

        {/* Quotes */}
        {bottomNavItems.slice(1, 2).map((it) => {
          const isActive = it.to === active || active === "/quotations/new";
          const isActiveStrict = it.to === active;
          return (
            <Link key={it.to} to={it.to} className="flex flex-1 flex-col items-center gap-0.5 py-1">
              <div className={cn(
                "flex h-8 w-12 items-center justify-center rounded-2xl transition-all",
                isActiveStrict ? "bg-primary/15" : "",
              )}>
                <it.icon className={cn("h-5 w-5 transition-colors", isActiveStrict ? "text-primary" : "text-muted-foreground")} />
              </div>
              <span className={cn("text-[10px] font-medium", isActiveStrict ? "text-primary" : "text-muted-foreground")}>
                {it.label}
              </span>
            </Link>
          );
        })}

        {/* Centre FAB — New Quotation */}
        <Link
          to="/quotations/new"
          className="relative flex flex-col items-center gap-0.5 -mt-5"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/40 ring-4 ring-background transition-transform active:scale-95">
            <PlusCircle className="h-7 w-7 text-primary-foreground" />
          </div>
          <span className="mt-0.5 text-[10px] font-medium text-primary">New</span>
        </Link>

        {/* Bills */}
        {bottomNavItems.slice(2, 3).map((it) => {
          const isActive = it.to === active || active === "/bills/new";
          const isActiveStrict = it.to === active;
          return (
            <Link key={it.to} to={it.to} className="flex flex-1 flex-col items-center gap-0.5 py-1">
              <div className={cn(
                "flex h-8 w-12 items-center justify-center rounded-2xl transition-all",
                isActiveStrict ? "bg-primary/15" : "",
              )}>
                <it.icon className={cn("h-5 w-5 transition-colors", isActiveStrict ? "text-primary" : "text-muted-foreground")} />
              </div>
              <span className={cn("text-[10px] font-medium", isActiveStrict ? "text-primary" : "text-muted-foreground")}>
                {it.label}
              </span>
            </Link>
          );
        })}

        {/* More */}
        <button
          onClick={onMoreClick}
          className="flex flex-1 flex-col items-center gap-0.5 py-1"
        >
          <div className={cn(
            "flex h-8 w-12 items-center justify-center rounded-2xl transition-all",
            moreOpen ? "bg-primary/15" : "",
          )}>
            <MoreHorizontal className={cn("h-5 w-5 transition-colors", moreOpen ? "text-primary" : "text-muted-foreground")} />
          </div>
          <span className={cn("text-[10px] font-medium", moreOpen ? "text-primary" : "text-muted-foreground")}>
            More
          </span>
        </button>
      </div>
    </nav>
  );
}

// ─── Main authenticated layout ───────────────────────────────────────────────
function AuthedLayout() {
  const { user, loading, logout } = useAuth();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("sidebar-collapsed") === "1",
  );
  const [moreOpen, setMoreOpen] = useState(false);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [user, loading, nav]);

  // Close More sheet on route change
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  if (loading || !user) return <PageLoader />;

  return (
    <div
      className="flex h-screen overflow-hidden bg-muted/20"
      style={{ "--sidebar-w": collapsed ? "4rem" : "15rem" } as React.CSSProperties}
    >
      {/* ── Desktop sidebar ── */}
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

      <CallbackReminderModal user={user} />

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar — fixed to the viewport so it can never scroll away,
            regardless of how the surrounding layout handles overflow. */}
        <header
          className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 pb-3 backdrop-blur md:hidden"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        >
          <img src="/logo.png" alt="Vastu Stair Designer" className="h-8 w-auto object-contain" />
          <Link
            to="/settings"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </header>

        {/* Scrollable content — top padding on mobile clears the fixed header,
            extra bottom padding clears the bottom nav. */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto pt-[calc(env(safe-area-inset-top,0px)_+_60px)] md:pt-0">
          <div className="px-4 py-5 pb-24 md:px-8 md:py-8 md:pb-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <BottomNav pathname={pathname} onMoreClick={() => setMoreOpen((v) => !v)} moreOpen={moreOpen} />

      {/* ── Mobile "More" sheet ── */}
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        user={user}
        logout={logout}
        nav={nav}
        pathname={pathname}
      />

      {/* ── PWA Install prompt ── */}
      <InstallPrompt />
    </div>
  );
}
