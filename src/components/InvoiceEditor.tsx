import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  listClients,
  getSettings,
  saveInvoice,
  saveQuotation,
  nextInvoiceNumber,
  deleteInvoice,
} from "@/lib/firestore";
import { blankItem, nextItemCode, recomputeInvoice } from "@/lib/calc";
import { generateQuotationPdf, downloadBlob } from "@/lib/pdf";
import type { Invoice, Payment, PaymentMode, Quotation, QuoteItem } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { QuotationPreview } from "@/components/QuotationPreview";
import { ItemEditor } from "@/components/QuotationEditor";
import { formatINR, formatDate, toDateInputValue, fromDateInputValue } from "@/lib/format";
import {
  Plus,
  Trash2,
  Download,
  Save,
  ArrowLeft,
  Loader2,
  IndianRupee,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

const PAYMENT_MODES: PaymentMode[] = ["Cash", "UPI", "Bank Transfer", "Cheque"];


export function InvoiceEditor({
  initial,
  fromQuotation,
  preselectClientId,
}: {
  initial?: Invoice;
  fromQuotation?: Quotation;
  preselectClientId?: string;
}) {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", user?.uid],
    queryFn: () => listClients(user!.uid),
    enabled: !!user,
  });
  const { data: settings = DEFAULT_SETTINGS } = useQuery({
    queryKey: ["settings", user?.uid],
    queryFn: () => getSettings(user!.uid),
    enabled: !!user,
  });

  const [clientId, setClientId] = useState<string>(
    initial?.clientId ?? fromQuotation?.clientId ?? preselectClientId ?? "",
  );
  const [items, setItems] = useState<QuoteItem[]>(
    initial?.items ?? fromQuotation?.items.map((it) => ({ ...it })) ?? [blankItem()],
  );
  const [discount, setDiscount] = useState(
    initial?.discount ?? fromQuotation?.discount ?? { mode: "percent" as const, value: 0 },
  );
  const [gstPct, setGstPct] = useState(
    initial?.gstPercent ?? fromQuotation?.gstPercent ?? settings.gstPercent,
  );
  const [date, setDate] = useState<number>(initial?.date ?? Date.now());
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");
  const [payments, setPayments] = useState<Payment[]>(initial?.payments ?? []);
  const [payOpen, setPayOpen] = useState(false);

  const client = clients.find((c) => c.id === clientId);
  const clientSnapshot = client ?? initial?.clientSnapshot ?? fromQuotation?.clientSnapshot;

  // Build the invoice from current state; payments can be overridden so that
  // "Record Payment" can save immediately without waiting for a state re-render.
  const buildInvoice = (pays: Payment[]) => {
    if (!clientSnapshot) return null;
    return recomputeInvoice({
      id: initial?.id ?? "",
      number: initial?.number ?? "PREVIEW",
      date,
      clientId: clientId || clientSnapshot.id,
      clientSnapshot,
      quotationId: initial?.quotationId ?? fromQuotation?.id,
      quotationNumber: initial?.quotationNumber ?? fromQuotation?.number,
      items,
      discount,
      gstPercent: gstPct,
      payments: pays,
      notes,
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const computed = useMemo(
    () => buildInvoice(payments),
    [
      clientSnapshot,
      items,
      discount,
      gstPct,
      date,
      clientId,
      initial,
      fromQuotation,
      notes,
      payments,
    ],
  );

  const saveMut = useMutation({
    mutationFn: async (overridePayments?: Payment[]) => {
      const inv0 = buildInvoice(overridePayments ?? payments);
      if (!inv0) throw new Error("Pick a client");
      let number = initial?.number;
      if (!number) number = await nextInvoiceNumber(user!.uid, settings.invoicePrefix);
      const inv: Omit<Invoice, "id"> & { id?: string } = { ...inv0, id: initial?.id, number };
      const id = await saveInvoice(user!.uid, inv);
      // First save from a quotation: mark that quotation as Accepted —
      // a billed quote is an accepted quote.
      if (!initial && fromQuotation && fromQuotation.status !== "Accepted") {
        try {
          await saveQuotation(user!.uid, { ...fromQuotation, status: "Accepted" });
          qc.invalidateQueries({ queryKey: ["quotations", user?.uid] });
          qc.invalidateQueries({ queryKey: ["quotation", user?.uid, fromQuotation.id] });
          qc.invalidateQueries({ queryKey: ["client-quotes", user?.uid, fromQuotation.clientId] });
        } catch {
          // non-fatal — the bill itself saved fine
        }
      }
      return { ...inv, id } as Invoice;
    },
    onSuccess: (inv) => {
      toast.success("Bill saved");
      qc.invalidateQueries({ queryKey: ["invoices", user?.uid] });
      qc.invalidateQueries({ queryKey: ["invoice", user?.uid, inv.id] });
      qc.invalidateQueries({ queryKey: ["client-invoices", user?.uid, inv.clientId] });
      if (!initial) nav({ to: "/bills/$id", params: { id: inv.id } });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: () => deleteInvoice(user!.uid, initial!.id),
    onSuccess: () => {
      toast.success("Bill deleted");
      qc.invalidateQueries({ queryKey: ["invoices", user?.uid] });
      nav({ to: "/bills" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [pdfBusy, setPdfBusy] = useState(false);
  const actionBusy = saveMut.isPending || delMut.isPending || pdfBusy;

  async function handleDownloadPdf() {
    if (!computed) return toast.error("Pick a client first");
    if (actionBusy) return;
    setPdfBusy(true);
    try {
      let inv = computed;
      if (!initial) inv = await saveMut.mutateAsync(undefined);
      else await saveMut.mutateAsync(undefined);
      const blob = await generateQuotationPdf(inv, settings);
      downloadBlob(blob, `${inv.number}.pdf`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/bills" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Bills
        </Button>
        <div className="flex items-center gap-2">
          {computed && <StatusBadge status={computed.status} />}
          {initial && <span className="text-sm font-semibold">{initial.number}</span>}
        </div>
      </div>

      {computed?.quotationNumber && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-4 py-2.5 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span>
            Based on quotation <span className="font-semibold">{computed.quotationNumber}</span> —
            adjust quantities to actual site measurement before billing.
          </span>
          {computed.quotationId && (
            <Link
              to="/quotations/$id"
              params={{ id: computed.quotationId }}
              className="ml-auto shrink-0 text-primary hover:underline"
            >
              View quote
            </Link>
          )}
        </div>
      )}

      {/* Client + date */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bill Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Choose a client…" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.org ? ` — ${c.org}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Bill Date</Label>
            <Input
              type="date"
              className="h-11"
              value={toDateInputValue(date)}
              onChange={(e) => {
                if (e.target.value) setDate(fromDateInputValue(e.target.value));
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <div className="space-y-3">
        {items.map((it, idx) => (
          <ItemEditor
            key={idx}
            index={idx}
            item={it}
            settings={settings}
            onChange={(u) => setItems(items.map((x, i) => (i === idx ? u : x)))}
            onDuplicate={() => setItems([...items, { ...it, code: nextItemCode(items) }])}
            onDelete={() => setItems(items.filter((_, i) => i !== idx))}
            onMove={(dir) => {
              const j = idx + dir;
              if (j < 0 || j >= items.length) return;
              const arr = [...items];
              [arr[idx], arr[j]] = [arr[j], arr[idx]];
              setItems(arr);
            }}
            uid={user!.uid}
          />
        ))}
        <Button
          variant="outline"
          className="h-11 w-full"
          onClick={() => setItems([...items, blankItem(nextItemCode(items))])}
        >
          <Plus className="mr-1 h-4 w-4" /> Add Item
        </Button>
      </div>

      {/* Totals + payments */}
      {computed && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Discount</Label>
                  <div className="flex gap-2">
                    <Select
                      value={discount.mode}
                      onValueChange={(v) =>
                        setDiscount({ ...discount, mode: v as "percent" | "amount" })
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="amount">₹</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={discount.value || ""}
                      onChange={(e) =>
                        setDiscount({ ...discount, value: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>GST %</Label>
                  <Input
                    type="number"
                    value={gstPct}
                    onChange={(e) => setGstPct(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                <Row label="Sub Total" value={formatINR(computed.subTotal)} />
                <Row label="Discount" value={`- ${formatINR(computed.discountAmt)}`} />
                <Row label={`GST @ ${computed.gstPercent}%`} value={formatINR(computed.gstAmt)} />
                <div className="mt-2 border-t pt-2">
                  <Row label="Grand Total" value={formatINR(computed.grandTotal)} bold />
                  <Row
                    label="Received"
                    value={`- ${formatINR(computed.amountPaid)}`}
                    className="text-success"
                  />
                  <Row
                    label="Balance Due"
                    value={formatINR(computed.balanceDue)}
                    bold
                    className="text-primary"
                  />
                </div>
              </div>
              <div>
                <Label>Notes (internal)</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Payments Received</CardTitle>
                <Button size="sm" onClick={() => setPayOpen(true)}>
                  <IndianRupee className="mr-1 h-4 w-4" /> Record Payment
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  No payments recorded yet. Use "Record Payment" for advances and installments — the
                  bill status updates automatically.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.date)}</TableCell>
                        <TableCell>{p.mode}</TableCell>
                        <TableCell className="max-w-[160px] truncate text-muted-foreground">
                          {p.note || "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatINR(p.amount)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              if (confirm("Remove this payment entry?")) {
                                const next = payments.filter((x) => x.id !== p.id);
                                setPayments(next);
                                if (initial) saveMut.mutate(next);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {payments.length > 0 && (
                <div className="border-t px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Received </span>
                  <span className="font-semibold text-success">
                    {formatINR(computed.amountPaid)}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    of {formatINR(computed.grandTotal)} —{" "}
                  </span>
                  <span className="font-semibold text-primary">
                    {formatINR(computed.balanceDue)} due
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preview + actions */}
      {computed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-lg border">
              <QuotationPreview quote={computed} settings={settings} />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {initial && (
                <Button
                  variant="outline"
                  disabled={actionBusy}
                  onClick={() => {
                    if (confirm("Delete this bill? Recorded payments will be lost."))
                      delMut.mutate();
                  }}
                >
                  {delMut.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1 h-4 w-4" />
                  )}
                  {delMut.isPending ? "Deleting…" : "Delete"}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => saveMut.mutate(undefined)}
                disabled={actionBusy}
              >
                {saveMut.isPending && !pdfBusy ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1 h-4 w-4" />
                )}
                {saveMut.isPending && !pdfBusy ? "Saving…" : "Save Bill"}
              </Button>
              <Button onClick={handleDownloadPdf} disabled={actionBusy}>
                {pdfBusy ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1 h-4 w-4" />
                )}
                {pdfBusy ? "Preparing…" : "Download PDF"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        suggestedAmount={computed?.balanceDue ?? 0}
        onAdd={(p) => {
          const next = [...payments, p];
          setPayments(next);
          setPayOpen(false);
          // Saved bills persist the payment immediately — nothing to forget.
          if (initial) saveMut.mutate(next);
          else toast.success("Payment added — it will be stored when you save the bill");
        }}
      />
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  className,
}: {
  label: string;
  value: string;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between py-0.5 ${bold ? "text-base font-bold" : ""} ${className ?? ""}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
  suggestedAmount,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  suggestedAmount: number;
  onAdd: (p: Payment) => void;
}) {
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(toDateInputValue(Date.now()));
  const [mode, setMode] = useState<PaymentMode>("UPI");
  const [note, setNote] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setAmount(suggestedAmount > 0 ? suggestedAmount : 0);
          setDate(toDateInputValue(Date.now()));
          setMode("UPI");
          setNote("");
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Amount (₹)</Label>
            <Input
              type="number"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Input
              placeholder="e.g. 35% advance"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={amount <= 0}
            onClick={() =>
              onAdd({
                id: crypto.randomUUID(),
                amount,
                date: date ? fromDateInputValue(date) : Date.now(),
                mode,
                note: note.trim() || undefined,
              })
            }
          >
            Add Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
