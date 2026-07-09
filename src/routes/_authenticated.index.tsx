import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { listQuotations } from "@/lib/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatINR, formatDate } from "@/lib/format";
import { PlusCircle, FileText, Clock, CheckCircle2, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotations", user?.uid],
    queryFn: () => listQuotations(user!.uid),
    enabled: !!user,
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const total = quotes.length;
  const pending = quotes.filter((q) => q.status === "Draft" || q.status === "Sent").length;
  const accepted = quotes.filter((q) => q.status === "Accepted").length;
  const monthValue = quotes
    .filter((q) => q.date >= monthStart)
    .reduce((s, q) => s + q.grandTotal, 0);

  const recent = quotes.slice(0, 8);

  const cards = [
    { label: "Total Quotations", value: String(total), icon: FileText, color: "text-info" },
    { label: "Pending", value: String(pending), icon: Clock, color: "text-warning" },
    { label: "Accepted", value: String(accepted), icon: CheckCircle2, color: "text-success" },
    { label: "This Month", value: formatINR(monthValue), icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your quotations</p>
        </div>
        <Button
          size="lg"
          className="h-12 gap-2 text-base"
          onClick={() => nav({ to: "/quotations/new" })}
        >
          <PlusCircle className="h-5 w-5" /> New Quotation
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className={`mb-2 ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Quotations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : recent.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No quotations yet.</p>
              <Button className="mt-4" onClick={() => nav({ to: "/quotations/new" })}>
                Create your first quotation
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {recent.map((q) => (
                <li key={q.id}>
                  <Link
                    to="/quotations/$id"
                    params={{ id: q.id }}
                    className="flex items-center gap-3 p-4 hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {q.clientSnapshot?.name || "—"}
                        </span>
                        <StatusBadge status={q.status} />
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {q.number} • {formatDate(q.date)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-semibold">{formatINR(q.grandTotal)}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
