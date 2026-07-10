import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { listQuotations } from "@/lib/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { TablePagination } from "@/components/TablePagination";
import { formatINR, formatDate } from "@/lib/format";
import type { QuoteStatus } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, PlusCircle, FileText } from "lucide-react";

const searchSchema = z.object({
  page: z.number().optional(),
});

export const Route = createFileRoute("/_authenticated/quotations/")({
  validateSearch: searchSchema,
  component: QuotationsPage,
});

const STATUS_OPTIONS: (QuoteStatus | "All")[] = ["All", "Draft", "Sent", "Accepted", "Rejected"];
const PAGE_SIZE = 10;

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
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg border bg-muted" />
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
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote No.</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Items</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((q) => (
                  <TableRow
                    key={q.id}
                    className="cursor-pointer"
                    onClick={() => nav({ to: "/quotations/$id", params: { id: q.id } })}
                  >
                    <TableCell className="font-medium text-primary">{q.number}</TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="truncate font-medium">{q.clientSnapshot?.name || "—"}</div>
                      {q.clientSnapshot?.org && (
                        <div className="truncate text-xs text-muted-foreground">
                          {q.clientSnapshot.org}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {q.clientSnapshot?.phone || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(q.date)}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {q.totals.itemCount}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatINR(q.grandTotal)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={q.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onChange={goToPage}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
