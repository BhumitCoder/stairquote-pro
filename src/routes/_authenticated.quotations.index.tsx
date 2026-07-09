import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { listQuotations } from "@/lib/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { formatINR, formatDate } from "@/lib/format";
import type { QuoteStatus } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, PlusCircle, FileText, ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  page: z.number().optional(),
});

export const Route = createFileRoute("/_authenticated/quotations/")({
  validateSearch: searchSchema,
  component: QuotationsPage,
});

const STATUS_OPTIONS: (QuoteStatus | "All")[] = ["All", "Draft", "Sent", "Accepted", "Rejected"];
const PAGE_SIZE = 9;

function QuotationsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { page: pageFromUrl } = Route.useSearch();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuoteStatus | "All">("All");
  const [page, setPage] = useState(pageFromUrl ?? 1);

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotations", user?.uid],
    queryFn: () => listQuotations(user!.uid),
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return quotes.filter((q) => {
      if (status !== "All" && q.status !== status) return false;
      if (!t) return true;
      return (
        q.number.toLowerCase().includes(t) ||
        (q.clientSnapshot?.name || "").toLowerCase().includes(t) ||
        (q.clientSnapshot?.org || "").toLowerCase().includes(t) ||
        (q.clientSnapshot?.phone || "").toLowerCase().includes(t)
      );
    });
  }, [quotes, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function goToPage(p: number) {
    const clamped = Math.max(1, Math.min(totalPages, p));
    setPage(clamped);
    nav({ to: "/quotations", search: { page: clamped }, replace: true });
  }

  const summary = useMemo(() => {
    const totalValue = filtered.reduce((s, q) => s + q.grandTotal, 0);
    return { count: filtered.length, totalValue };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Quotations</h1>
          <p className="text-sm text-muted-foreground">
            {summary.count} quotation{summary.count === 1 ? "" : "s"} ·{" "}
            {formatINR(summary.totalValue)} total
          </p>
        </div>
        <Button size="lg" className="h-12 gap-2" onClick={() => nav({ to: "/quotations/new" })}>
          <PlusCircle className="h-5 w-5" /> New Quotation
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by quote no., client, phone…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-11 pl-10"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as QuoteStatus | "All");
            setPage(1);
          }}
        >
          <SelectTrigger className="h-11 w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "All" ? "All statuses" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {quotes.length === 0 ? "No quotations yet." : "No quotations match your search."}
            </p>
            {quotes.length === 0 && (
              <Button onClick={() => nav({ to: "/quotations/new" })}>
                Create your first quotation
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paged.map((q) => (
              <Link key={q.id} to="/quotations/$id" params={{ id: q.id }}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold">{q.number}</span>
                      <StatusBadge status={q.status} />
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{q.clientSnapshot?.name || "—"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDate(q.date)}</div>
                    <div className="mt-auto flex items-end justify-between pt-2">
                      <span className="text-xs text-muted-foreground">
                        {q.totals.itemCount} item{q.totals.itemCount === 1 ? "" : "s"}
                      </span>
                      <span className="text-lg font-bold text-primary">
                        {formatINR(q.grandTotal)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((p, i, arr) => (
                      <span key={p} className="flex items-center">
                        {i > 0 && arr[i - 1] !== p - 1 && (
                          <span className="px-1 text-xs text-muted-foreground">…</span>
                        )}
                        <button
                          onClick={() => goToPage(p)}
                          className={cn(
                            "h-8 min-w-8 rounded-md px-2 text-sm font-medium transition-colors",
                            p === currentPage
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-accent",
                          )}
                        >
                          {p}
                        </button>
                      </span>
                    ))}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage >= totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
