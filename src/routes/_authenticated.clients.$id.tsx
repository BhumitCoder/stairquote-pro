import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getClient,
  listQuotationsByClient,
  listInvoicesByClient,
  saveClient,
  saveQuotation,
} from "@/lib/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatINR,
  formatDate,
  isToday,
  isOverdue,
  toDateInputValue,
  fromDateInputValue,
} from "@/lib/format";
import type { QuoteStatus } from "@/lib/types";
import {
  PlusCircle,
  Phone,
  Mail,
  MapPin,
  Building2,
  CalendarClock,
  PhoneCall,
  MessageCircle,
  Search,
  ReceiptText,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  component: ClientProfile,
});

function ClientProfile() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [cbOpen, setCbOpen] = useState(false);
  const [quoteSearch, setQuoteSearch] = useState("");

  const { data: client } = useQuery({
    queryKey: ["client", user?.uid, id],
    queryFn: () => getClient(user!.uid, id),
    enabled: !!user,
  });
  const { data: quotes = [], error: quotesError } = useQuery({
    queryKey: ["client-quotes", user?.uid, id],
    queryFn: () => listQuotationsByClient(user!.uid, id),
    enabled: !!user,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["client-invoices", user?.uid, id],
    queryFn: () => listInvoicesByClient(user!.uid, id),
    enabled: !!user,
  });

  const totalValue = quotes.reduce((s, q) => s + q.grandTotal, 0);
  const totalBilled = invoices.reduce((s, i) => s + i.grandTotal, 0);
  const totalOutstanding = invoices.reduce((s, i) => s + i.balanceDue, 0);

  const filteredQuotes = quotes.filter((q) => {
    const t = quoteSearch.trim().toLowerCase();
    if (!t) return true;
    return (
      q.number.toLowerCase().includes(t) ||
      q.status.toLowerCase().includes(t) ||
      formatDate(q.date).toLowerCase().includes(t) ||
      String(q.grandTotal).includes(t)
    );
  });

  const filteredInvoices = invoices.filter((inv) => {
    const t = quoteSearch.trim().toLowerCase();
    if (!t) return true;
    return (
      inv.number.toLowerCase().includes(t) ||
      inv.status.toLowerCase().includes(t) ||
      (inv.quotationNumber || "").toLowerCase().includes(t) ||
      formatDate(inv.date).toLowerCase().includes(t) ||
      String(inv.grandTotal).includes(t)
    );
  });

  const statusMut = useMutation({
    mutationFn: ({ quoteId, status }: { quoteId: string; status: QuoteStatus }) => {
      const q = quotes.find((x) => x.id === quoteId);
      if (!q) throw new Error("Quotation not found");
      return saveQuotation(user!.uid, { ...q, status });
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["client-quotes", user?.uid, id] });
      qc.invalidateQueries({ queryKey: ["quotations", user?.uid] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!client) return <p className="text-muted-foreground">Loading…</p>;

  const cbToday = client.callbackDate && isToday(client.callbackDate);
  const cbOverdue = client.callbackDate && isOverdue(client.callbackDate);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/clients" className="text-sm text-muted-foreground hover:underline">
          ← Back to clients
        </Link>
      </div>

      {cbToday && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
          <PhoneCall className="h-5 w-5 shrink-0 text-primary" />
          <div className="flex-1">
            <div className="font-semibold text-primary">Callback due today</div>
            {client.callbackNote && (
              <div className="text-sm text-muted-foreground">{client.callbackNote}</div>
            )}
          </div>
          {client.phone && (
            <Button asChild size="sm">
              <a href={`tel:${client.phone}`}>Call now</a>
            </Button>
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-5 sm:p-6">
          {/* Top row: identity left, actions right */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-xl font-bold uppercase text-primary">
                {client.name[0] ?? "C"}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold">{client.name}</h1>
                {client.org && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" /> {client.org}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {client.phone && (
                <>
                  <Button variant="outline" className="h-10" asChild>
                    <a href={`tel:${client.phone}`}>
                      <Phone className="mr-1.5 h-4 w-4" /> Call
                    </a>
                  </Button>
                  <Button variant="outline" className="h-10" asChild>
                    <a
                      href={`https://wa.me/${client.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                    </a>
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                className="h-10 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                onClick={() => nav({ to: "/bills/new", search: { client: client.id } })}
              >
                <ReceiptText className="mr-1.5 h-4 w-4" /> New Bill
              </Button>
              <Button
                className="h-10"
                onClick={() => nav({ to: "/quotations/new", search: { client: client.id } })}
              >
                <PlusCircle className="mr-1.5 h-4 w-4" /> New Quotation
              </Button>
            </div>
          </div>

          {/* Bottom strip: contact details + callback chip */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-4 text-sm text-muted-foreground">
            {client.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> {client.phone}
              </span>
            )}
            {client.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {client.email}
              </span>
            )}
            {(client.address || client.city || client.state) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {[client.address, client.city, client.state].filter(Boolean).join(", ")}
              </span>
            )}
            <button
              onClick={() => setCbOpen(true)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                cbToday
                  ? "bg-primary/15 text-primary hover:bg-primary/25"
                  : cbOverdue
                    ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
                    : client.callbackDate
                      ? "bg-muted text-muted-foreground hover:bg-accent"
                      : "border border-dashed text-muted-foreground hover:bg-accent",
              )}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {client.callbackDate
                ? `Callback: ${formatDate(client.callbackDate)}${cbOverdue ? " (overdue)" : ""}`
                : "Set callback date"}
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="truncate text-lg font-bold sm:text-xl md:text-2xl">{quotes.length}</div>
            <div className="text-xs text-muted-foreground">Total Quotations</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="truncate text-lg font-bold sm:text-xl md:text-2xl">
              {formatINR(totalValue)}
            </div>
            <div className="text-xs text-muted-foreground">Quoted Value</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="truncate text-lg font-bold text-success sm:text-xl md:text-2xl">
              {formatINR(totalBilled)}
            </div>
            <div className="text-xs text-muted-foreground">Billed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="truncate text-lg font-bold text-primary sm:text-xl md:text-2xl">
              {formatINR(totalOutstanding)}
            </div>
            <div className="text-xs text-muted-foreground">Outstanding</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <Tabs defaultValue="quotations">
          <CardHeader className="pb-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList className="h-auto bg-muted/60 p-1">
                <TabsTrigger value="quotations" className="gap-1.5 px-4 py-2">
                  <FileText className="h-3.5 w-3.5" /> Quotations
                  <span className="ml-1 rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
                    {quotes.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="bills" className="gap-1.5 px-4 py-2">
                  <ReceiptText className="h-3.5 w-3.5" /> Bills
                  <span className="ml-1 rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
                    {invoices.length}
                  </span>
                </TabsTrigger>
              </TabsList>
              <div className="relative sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search no., status, date…"
                  value={quoteSearch}
                  onChange={(e) => setQuoteSearch(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
            </div>
          </CardHeader>

          <TabsContent value="quotations" className="mt-3">
            <CardContent className="p-0">
              {quotesError ? (
                <div className="p-6 text-sm text-destructive">
                  Could not load quotations: {(quotesError as Error).message}
                </div>
              ) : quotes.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No quotations yet for this client.
                </div>
              ) : filteredQuotes.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No quotations match your search.
                </div>
              ) : (
                <>
                  {/* ── Mobile card list ── */}
                  <div className="space-y-2 p-4 md:hidden">
                    {filteredQuotes.map((q) => (
                      <Card key={q.id} className="p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <Link
                              to="/quotations/$id"
                              params={{ id: q.id }}
                              className="font-medium text-primary hover:underline"
                            >
                              {q.number}
                            </Link>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {formatDate(q.date)} · {q.totals.itemCount} items
                            </div>
                          </div>
                          <div className="shrink-0 font-semibold">{formatINR(q.grandTotal)}</div>
                        </div>
                        <Select
                          value={q.status}
                          disabled={statusMut.isPending}
                          onValueChange={(v) =>
                            statusMut.mutate({ quoteId: q.id, status: v as QuoteStatus })
                          }
                        >
                          <SelectTrigger className="mt-3 h-8 w-full">
                            <SelectValue>
                              <StatusBadge status={q.status} />
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(["Draft", "Sent", "Accepted", "Rejected"] as QuoteStatus[]).map(
                              (s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </Card>
                    ))}
                  </div>

                  {/* ── Desktop table ── */}
                  <div className="hidden md:block">
                    <Table className="table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[18%]">Quote No.</TableHead>
                          <TableHead className="w-[24%]">Date</TableHead>
                          <TableHead className="w-[14%] text-center">Items</TableHead>
                          <TableHead className="w-[24%] text-right">Amount</TableHead>
                          <TableHead className="w-[20%] pl-8">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredQuotes.map((q) => (
                          <TableRow key={q.id}>
                            <TableCell>
                              <Link
                                to="/quotations/$id"
                                params={{ id: q.id }}
                                className="font-medium text-primary hover:underline"
                              >
                                {q.number}
                              </Link>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(q.date)}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {q.totals.itemCount}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatINR(q.grandTotal)}
                            </TableCell>
                            <TableCell className="pl-8">
                              <Select
                                value={q.status}
                                disabled={statusMut.isPending}
                                onValueChange={(v) =>
                                  statusMut.mutate({ quoteId: q.id, status: v as QuoteStatus })
                                }
                              >
                                <SelectTrigger className="h-8 w-[110px] shrink-0">
                                  <SelectValue>
                                    <StatusBadge status={q.status} />
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {(["Draft", "Sent", "Accepted", "Rejected"] as QuoteStatus[]).map(
                                    (s) => (
                                      <SelectItem key={s} value={s}>
                                        {s}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </TabsContent>

          <TabsContent value="bills" className="mt-3">
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No bills yet for this client. Open an accepted quotation and press "Create Bill",
                  or use the "New Bill" button above.
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No bills match your search.
                </div>
              ) : (
                <>
                  {/* ── Mobile card list ── */}
                  <div className="space-y-2 p-4 md:hidden">
                    {filteredInvoices.map((inv) => (
                      <Card key={inv.id} className="p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <Link
                              to="/bills/$id"
                              params={{ id: inv.id }}
                              className="font-medium text-primary hover:underline"
                            >
                              {inv.number}
                            </Link>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {formatDate(inv.date)}
                            </div>
                          </div>
                          <div className="shrink-0">
                            <StatusBadge status={inv.status} />
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <div className="text-muted-foreground">Amount</div>
                            <div className="font-medium">{formatINR(inv.grandTotal)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Received</div>
                            <div className="font-medium text-success">
                              {formatINR(inv.amountPaid)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Balance</div>
                            <div className="font-semibold text-primary">
                              {formatINR(inv.balanceDue)}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* ── Desktop table ── */}
                  <div className="hidden md:block">
                    <Table className="table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[15%]">Bill No.</TableHead>
                          <TableHead className="w-[16%]">Date</TableHead>
                          <TableHead className="w-[18%] text-right">Amount</TableHead>
                          <TableHead className="w-[16%] text-right">Received</TableHead>
                          <TableHead className="w-[18%] text-right">Balance</TableHead>
                          <TableHead className="w-[17%] pl-8">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInvoices.map((inv) => (
                          <TableRow key={inv.id}>
                            <TableCell>
                              <Link
                                to="/bills/$id"
                                params={{ id: inv.id }}
                                className="font-medium text-primary hover:underline"
                              >
                                {inv.number}
                              </Link>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(inv.date)}
                            </TableCell>
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
                  </div>
                </>
              )}
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>

      <CallbackDialog
        open={cbOpen}
        onOpenChange={setCbOpen}
        callbackDate={client.callbackDate}
        callbackNote={client.callbackNote}
        onSave={async (callbackDate, callbackNote) => {
          try {
            await saveClient(user!.uid, { ...client, callbackDate, callbackNote });
            toast.success("Callback updated");
            qc.invalidateQueries({ queryKey: ["client", user?.uid, id] });
            qc.invalidateQueries({ queryKey: ["clients", user?.uid] });
            setCbOpen(false);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </div>
  );
}

function CallbackDialog({
  open,
  onOpenChange,
  callbackDate,
  callbackNote,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  callbackDate?: number;
  callbackNote?: string;
  onSave: (date: number | undefined, note: string) => void | Promise<void>;
}) {
  const [date, setDate] = useState(callbackDate ? toDateInputValue(callbackDate) : "");
  const [note, setNote] = useState(callbackNote || "");
  const [saving, setSaving] = useState(false);

  async function submit(d: number | undefined, n: string) {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(d, n);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setDate(callbackDate ? toDateInputValue(callbackDate) : "");
          setNote(callbackNote || "");
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Callback Reminder</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Callback Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Input
              placeholder="e.g. Follow up on discount request"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          {callbackDate && (
            <Button variant="outline" disabled={saving} onClick={() => submit(undefined, "")}>
              Clear
            </Button>
          )}
          <Button
            disabled={saving}
            onClick={() => submit(date ? fromDateInputValue(date) : undefined, note)}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
