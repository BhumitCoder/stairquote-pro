import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/lib/auth-context";
import { listQuotations, listInvoices, listClients } from "@/lib/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { formatINR, formatDate, isToday, isOverdue } from "@/lib/format";
import type { QuoteStatus } from "@/lib/types";
import {
  PlusCircle,
  FileText,
  Clock,
  CheckCircle2,
  TrendingUp,
  Wallet,
  IndianRupee,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

// Validated categorical palette (dataviz six checks, light surface):
const C_QUOTED = "#2563eb";
const C_BILLED = "#e8484d";
const C_RECEIVED = "#0d9488";

const STATUS_BAR: Record<QuoteStatus, string> = {
  Draft: "bg-zinc-400",
  Sent: "bg-info",
  Accepted: "bg-success",
  Rejected: "bg-destructive",
};

// ₹ axis ticks in Indian compact units (1.2L / 50k)
function inrCompact(v: number): string {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
  return `₹${v}`;
}

function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotations", user?.uid],
    queryFn: () => listQuotations(user!.uid),
    enabled: !!user,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", user?.uid],
    queryFn: () => listInvoices(user!.uid),
    enabled: !!user,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients", user?.uid],
    queryFn: () => listClients(user!.uid),
    enabled: !!user,
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const total = quotes.length;
  const pending = quotes.filter((q) => q.status === "Draft" || q.status === "Sent").length;
  const accepted = quotes.filter((q) => q.status === "Accepted").length;
  const monthValue = quotes
    .filter((q) => q.date >= monthStart && q.status !== "Rejected")
    .reduce((s, q) => s + q.grandTotal, 0);
  const outstanding = invoices.reduce((s, i) => s + i.balanceDue, 0);
  const totalReceived = invoices.reduce((s, i) => s + i.amountPaid, 0);

  // ── Monthly trend: last 6 months of quoted / billed / received value ───────
  const trend = useMemo(() => {
    const months: { key: string; label: string; start: number; end: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("en-IN", { month: "short" }),
        start: d.getTime(),
        end,
      });
    }
    return months.map((m) => {
      const quoted = quotes
        .filter((q) => q.date >= m.start && q.date < m.end && q.status !== "Rejected")
        .reduce((s, q) => s + q.grandTotal, 0);
      const billed = invoices
        .filter((i) => i.date >= m.start && i.date < m.end)
        .reduce((s, i) => s + i.grandTotal, 0);
      const received = invoices
        .flatMap((i) => i.payments)
        .filter((p) => p.date >= m.start && p.date < m.end)
        .reduce((s, p) => s + p.amount, 0);
      return { month: m.label, Quoted: quoted, Billed: billed, Received: received };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes, invoices]);

  const hasTrendData = trend.some((t) => t.Quoted > 0 || t.Billed > 0 || t.Received > 0);

  // ── Status breakdown ────────────────────────────────────────────────────────
  const statusCounts = (["Accepted", "Sent", "Draft", "Rejected"] as QuoteStatus[]).map((s) => ({
    status: s,
    count: quotes.filter((q) => q.status === s).length,
  }));
  const conversion = total > 0 ? Math.round((accepted / total) * 100) : 0;

  // ── Recent payments (across all bills) ─────────────────────────────────────
  const recentPayments = useMemo(
    () =>
      invoices
        .flatMap((i) =>
          i.payments.map((p) => ({
            ...p,
            invoiceId: i.id,
            invoiceNumber: i.number,
            clientName: i.clientSnapshot?.name ?? "—",
          })),
        )
        .sort((a, b) => b.date - a.date)
        .slice(0, 6),
    [invoices],
  );

  const recent = quotes.slice(0, 6);

  // ── Collection health: rate + outstanding aged by bill date ────────────────
  const totalBilled = invoices.reduce((s, i) => s + i.grandTotal, 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalReceived / totalBilled) * 100) : 0;
  const DAY = 24 * 60 * 60 * 1000;
  const aging = useMemo(() => {
    const buckets = [
      { label: "0–30 days", min: 0, max: 30, amount: 0 },
      { label: "31–60 days", min: 31, max: 60, amount: 0 },
      { label: "Over 60 days", min: 61, max: Infinity, amount: 0 },
    ];
    for (const i of invoices) {
      if (i.balanceDue <= 0) continue;
      const days = Math.floor((Date.now() - i.date) / DAY);
      const b = buckets.find((x) => days >= x.min && days <= x.max);
      if (b) b.amount += i.balanceDue;
    }
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices]);

  // ── Top clients by billed value (falls back to quoted value) ───────────────
  const topClients = useMemo(() => {
    const byClient = new Map<
      string,
      { name: string; billed: number; quoted: number; due: number }
    >();
    for (const q of quotes) {
      if (q.status === "Rejected") continue;
      const e = byClient.get(q.clientId) ?? {
        name: q.clientSnapshot?.name ?? "—",
        billed: 0,
        quoted: 0,
        due: 0,
      };
      e.quoted += q.grandTotal;
      byClient.set(q.clientId, e);
    }
    for (const i of invoices) {
      const e = byClient.get(i.clientId) ?? {
        name: i.clientSnapshot?.name ?? "—",
        billed: 0,
        quoted: 0,
        due: 0,
      };
      e.billed += i.grandTotal;
      e.due += i.balanceDue;
      byClient.set(i.clientId, e);
    }
    return [...byClient.entries()]
      .map(([id, e]) => ({ id, ...e, value: e.billed > 0 ? e.billed : e.quoted }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [quotes, invoices]);
  const topClientMax = topClients[0]?.value ?? 0;

  // ── Follow-ups: callbacks overdue / today / next 7 days ────────────────────
  const followUps = useMemo(() => {
    const weekAhead = Date.now() + 7 * DAY;
    return clients
      .filter((c) => c.callbackDate && c.callbackDate <= weekAhead)
      .sort((a, b) => (a.callbackDate ?? 0) - (b.callbackDate ?? 0))
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients]);

  const cards = [
    { label: "Total Quotations", value: String(total), icon: FileText, color: "text-info" },
    { label: "Pending", value: String(pending), icon: Clock, color: "text-warning" },
    { label: "Accepted", value: String(accepted), icon: CheckCircle2, color: "text-success" },
    {
      label: "Quoted This Month",
      value: formatINR(monthValue),
      icon: TrendingUp,
      color: "text-info",
    },
    {
      label: "Received",
      value: formatINR(totalReceived),
      icon: IndianRupee,
      color: "text-success",
    },
    { label: "Outstanding", value: formatINR(outstanding), icon: Wallet, color: "text-primary" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-36 animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-52 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-12 w-40 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="h-5 w-5 animate-pulse rounded bg-muted" />
              <div className="h-7 w-14 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-72 animate-pulse rounded-xl border bg-muted lg:col-span-2" />
          <div className="h-72 animate-pulse rounded-xl border bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Business overview at a glance</p>
        </div>
        <Button
          size="lg"
          className="h-12 gap-2 text-base"
          onClick={() => nav({ to: "/quotations/new" })}
        >
          <PlusCircle className="h-5 w-5" /> New Quotation
        </Button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-4 sm:p-5">
              <div
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted/60 ${c.color}`}
              >
                <c.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold sm:text-xl md:text-2xl">{c.value}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Business Trend — last 6 months</CardTitle>
            <p className="text-xs text-muted-foreground">
              Value quoted vs billed vs payments received, per month
            </p>
          </CardHeader>
          <CardContent>
            {hasTrendData ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} barGap={2} barCategoryGap="24%">
                    <CartesianGrid vertical={false} stroke="#e9e9ee" strokeWidth={1} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: "#71717a" }}
                    />
                    <YAxis
                      tickFormatter={inrCompact}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tick={{ fontSize: 11, fill: "#71717a" }}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(0,0,0,0.04)" }}
                      formatter={(v: number) => formatINR(v)}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #e4e4e7",
                        fontSize: 12,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    />
                    <Bar dataKey="Quoted" fill={C_QUOTED} radius={[3, 3, 0, 0]} maxBarSize={18} />
                    <Bar dataKey="Billed" fill={C_BILLED} radius={[3, 3, 0, 0]} maxBarSize={18} />
                    <Bar
                      dataKey="Received"
                      fill={C_RECEIVED}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                No activity yet — create quotations and bills to see the trend.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quotation Status</CardTitle>
            <p className="text-xs text-muted-foreground">
              {total} quotation{total === 1 ? "" : "s"} · {conversion}% accepted
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {total === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                No quotations yet.
              </div>
            ) : (
              <>
                {statusCounts.map(({ status, count }) => {
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={status}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_BAR[status]}`} />
                          {status}
                        </span>
                        <span className="font-semibold">
                          {count}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            ({Math.round(pct)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${STATUS_BAR[status]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total quoted value</span>
                    <span className="font-semibold">
                      {formatINR(quotes.reduce((s, q) => s + q.grandTotal, 0))}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-muted-foreground">Accepted value</span>
                    <span className="font-semibold text-success">
                      {formatINR(
                        quotes
                          .filter((q) => q.status === "Accepted")
                          .reduce((s, q) => s + q.grandTotal, 0),
                      )}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analysis row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Payment collection health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Collection</CardTitle>
            <p className="text-xs text-muted-foreground">
              {collectionRate}% of billed value collected
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Collected</span>
                <span className="font-semibold">{collectionRate}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success"
                  style={{ width: `${collectionRate}%` }}
                />
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total billed</span>
                <span className="font-semibold">{formatINR(totalBilled)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Received</span>
                <span className="font-semibold text-success">{formatINR(totalReceived)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Outstanding</span>
                <span className="font-semibold text-primary">{formatINR(outstanding)}</span>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Outstanding by age
              </div>
              <div className="space-y-1.5 text-sm">
                {aging.map((b) => (
                  <div key={b.label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{b.label}</span>
                    <span
                      className={
                        b.amount > 0 && b.min >= 31
                          ? "font-semibold text-destructive"
                          : "font-medium"
                      }
                    >
                      {formatINR(b.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top clients */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Clients</CardTitle>
            <p className="text-xs text-muted-foreground">By business value</p>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {topClients.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                No client activity yet.
              </div>
            ) : (
              topClients.map((c) => (
                <Link
                  key={c.id}
                  to="/clients/$id"
                  params={{ id: c.id }}
                  className="block rounded-lg p-1.5 transition-colors hover:bg-accent"
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="ml-2 shrink-0 font-semibold">{formatINR(c.value)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${topClientMax > 0 ? (c.value / topClientMax) * 100 : 0}%`,
                        background: C_QUOTED,
                      }}
                    />
                  </div>
                  {c.due > 0 && (
                    <div className="mt-0.5 text-xs text-primary">
                      {formatINR(c.due)} outstanding
                    </div>
                  )}
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Follow-ups */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Follow-ups</CardTitle>
            <p className="text-xs text-muted-foreground">Callbacks due — next 7 days</p>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            {followUps.length === 0 ? (
              <div className="flex h-48 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                No callbacks scheduled. Set callback dates on clients to see reminders here.
              </div>
            ) : (
              <ul className="divide-y">
                {followUps.map((c) => {
                  const today = c.callbackDate && isToday(c.callbackDate);
                  const overdue = c.callbackDate && isOverdue(c.callbackDate);
                  return (
                    <li key={c.id}>
                      <Link
                        to="/clients/$id"
                        params={{ id: c.id }}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-accent"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{c.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {c.callbackNote || c.phone || "—"}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                            today
                              ? "bg-primary/15 text-primary"
                              : overdue
                                ? "bg-destructive/15 text-destructive"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {today
                            ? "Today"
                            : overdue
                              ? `Overdue · ${formatDate(c.callbackDate!)}`
                              : formatDate(c.callbackDate!)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Recent Quotations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No quotations yet.</p>
                <Button className="mt-4" onClick={() => nav({ to: "/quotations/new" })}>
                  Create your first quotation
                </Button>
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <ul className="divide-y md:hidden">
                  {recent.map((q) => (
                    <li
                      key={q.id}
                      className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-accent active:bg-accent"
                      onClick={() => nav({ to: "/quotations/$id", params: { id: q.id } })}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-primary">{q.number}</span>
                          {q.revision && (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                              Rev
                            </span>
                          )}
                        </div>
                        <div className="truncate text-sm">{q.clientSnapshot?.name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(q.date)}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold">{formatINR(q.grandTotal)}</div>
                        <div className="mt-1"><StatusBadge status={q.status} /></div>
                      </div>
                    </li>
                  ))}
                </ul>
                {/* Desktop table */}
                <Table className="hidden md:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote No.</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((q) => (
                      <TableRow
                        key={q.id}
                        className="cursor-pointer"
                        onClick={() => nav({ to: "/quotations/$id", params: { id: q.id } })}
                      >
                        <TableCell className="font-medium">{q.number}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {q.clientSnapshot?.name || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(q.date)}</TableCell>
                        <TableCell>
                          <StatusBadge status={q.status} />
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatINR(q.grandTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentPayments.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No payments recorded yet — record them on bills.
              </div>
            ) : (
              <ul className="divide-y">
                {recentPayments.map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/bills/$id"
                      params={{ id: p.invoiceId }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p.clientName}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.invoiceNumber} · {formatDate(p.date)} · {p.mode}
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold text-success">
                        + {formatINR(p.amount)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
