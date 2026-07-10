import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listInvoices } from "@/lib/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { TablePagination } from "@/components/TablePagination";
import { formatINR, formatDate } from "@/lib/format";
import type { InvoiceStatus } from "@/lib/types";
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
import { Search, PlusCircle, ReceiptText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bills/")({
  component: BillsPage,
});

const STATUS_OPTIONS: (InvoiceStatus | "All")[] = ["All", "Unpaid", "Partial", "Paid"];
const PAGE_SIZE = 10;

function BillsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "All">("All");
  const [page, setPage] = useState(1);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", user?.uid],
    queryFn: () => listInvoices(user!.uid),
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (status !== "All" && inv.status !== status) return false;
      if (!t) return true;
      return (
        inv.number.toLowerCase().includes(t) ||
        (inv.quotationNumber || "").toLowerCase().includes(t) ||
        (inv.clientSnapshot?.name || "").toLowerCase().includes(t) ||
        (inv.clientSnapshot?.phone || "").toLowerCase().includes(t)
      );
    });
  }, [invoices, search, status]);

  const summary = useMemo(() => {
    const billed = filtered.reduce((s, i) => s + i.grandTotal, 0);
    const received = filtered.reduce((s, i) => s + i.amountPaid, 0);
    const due = filtered.reduce((s, i) => s + i.balanceDue, 0);
    return { billed, received, due };
  }, [filtered]);

  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Bills</h1>
          <p className="text-sm text-muted-foreground">
            {formatINR(summary.billed)} billed ·{" "}
            <span className="text-success">{formatINR(summary.received)} received</span> ·{" "}
            <span className="font-medium text-primary">{formatINR(summary.due)} outstanding</span>
          </p>
        </div>
        <Button size="lg" className="h-12 gap-2" onClick={() => nav({ to: "/bills/new" })}>
          <PlusCircle className="h-5 w-5" /> New Bill
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by bill no., quote no., client, phone…"
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
            setStatus(v as InvoiceStatus | "All");
            setPage(1);
          }}
        >
          <SelectTrigger className="h-11 w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "All" ? "All statuses" : s === "Partial" ? "Partially Paid" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg border bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <ReceiptText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {invoices.length === 0
                ? "No bills yet. Open an accepted quotation and press “Create Bill”, or start one here."
                : "No bills match your search."}
            </p>
            {invoices.length === 0 && (
              <Button onClick={() => nav({ to: "/bills/new" })}>Create your first bill</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Bill No.</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead className="w-[150px] text-right">Amount</TableHead>
                  <TableHead className="w-[140px] text-right">Received</TableHead>
                  <TableHead className="w-[150px] text-right">Balance</TableHead>
                  <TableHead className="w-[150px] pl-8">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((inv) => (
                  <TableRow
                    key={inv.id}
                    className="cursor-pointer"
                    onClick={() => nav({ to: "/bills/$id", params: { id: inv.id } })}
                  >
                    <TableCell className="font-medium">{inv.number}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {inv.clientSnapshot?.name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(inv.date)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatINR(inv.grandTotal)}
                    </TableCell>
                    <TableCell className="text-right text-success">
                      {formatINR(inv.amountPaid)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {formatINR(inv.balanceDue)}
                    </TableCell>
                    <TableCell className="pl-8">
                      <StatusBadge status={inv.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onChange={setPage}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
