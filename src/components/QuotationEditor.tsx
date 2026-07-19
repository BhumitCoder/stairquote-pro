import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  listClients,
  getSettings,
  saveQuotation,
  nextQuoteNumber,
  nextRevisionNumber,
  listRevisions,
  getQuotation,
  deleteQuotation,
  listInvoices,
} from "@/lib/firestore";
import { uploadFile, deleteFile } from "@/lib/storage";
import { blankItem, nextItemCode, recomputeQuotation } from "@/lib/calc";
import { renderPreviewToPdf, downloadBlob } from "@/lib/pdf-capture";
import type { Client, Quotation, QuoteItem, QuoteStatus, RateMode, MeasureUnit } from "@/lib/types";
import { DEFAULT_SETTINGS, rateBasisLabel } from "@/lib/settings-defaults";
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
import { StatusBadge } from "@/components/StatusBadge";
import { QuotationPreview } from "@/components/QuotationPreview";
import { ClientDialog } from "@/routes/_authenticated.clients.index";
import { formatINR, formatNum, toDateInputValue, fromDateInputValue } from "@/lib/format";
import {
  Plus,
  Trash2,
  Copy,
  Download,
  Save,
  ImagePlus,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  Loader2,
  ReceiptText,
  GitBranch,
} from "lucide-react";
import { toast } from "sonner";

export function QuotationEditor({
  initial,
  preselectClientId,
}: {
  initial?: Quotation;
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

  const [step, setStep] = useState<1 | 2 | 3 | 4>(initial ? 4 : 1);
  const [clientId, setClientId] = useState<string>(initial?.clientId ?? preselectClientId ?? "");
  const [items, setItems] = useState<QuoteItem[]>(initial?.items ?? [blankItem()]);
  const [discount, setDiscount] = useState(
    initial?.discount ?? { mode: "percent" as const, value: 0 },
  );
  const [gstPct, setGstPct] = useState(initial?.gstPercent ?? settings.gstPercent);
  const [status, setStatus] = useState<QuoteStatus>(initial?.status ?? "Draft");
  const [date, setDate] = useState<number>(initial?.date ?? Date.now());
  const [openClientDlg, setOpenClientDlg] = useState(false);
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");

  useEffect(() => {
    if (!initial) setGstPct(settings.gstPercent);
  }, [settings.gstPercent, initial]);

  // Bills already raised from this quotation — shown so nobody double-bills.
  const { data: allInvoices = [] } = useQuery({
    queryKey: ["invoices", user?.uid],
    queryFn: () => listInvoices(user!.uid),
    enabled: !!user && !!initial,
  });
  const linkedBills = initial ? allInvoices.filter((i) => i.quotationId === initial.id) : [];

  // Revision history — if this is an original, load its revisions.
  // If this is a revision, load its parent (original) quotation.
  const isRevision = !!initial?.parentId;
  const isOriginal = !!initial && !initial.parentId;

  const { data: revisions = [] } = useQuery({
    queryKey: ["revisions", user?.uid, initial?.id],
    queryFn: () => listRevisions(user!.uid, initial!.id),
    enabled: !!user && isOriginal,
  });
  const { data: parentQuote } = useQuery({
    queryKey: ["quotation", user?.uid, initial?.parentId],
    queryFn: () => getQuotation(user!.uid, initial!.parentId!),
    enabled: !!user && isRevision,
  });

  const client = clients.find((c) => c.id === clientId);

  const computed = useMemo(() => {
    if (!client) return null;
    return recomputeQuotation({
      id: initial?.id ?? "",
      number: initial?.number ?? "PREVIEW",
      date,
      status,
      clientId,
      clientSnapshot: client,
      items,
      discount,
      gstPercent: gstPct,
      notes,
    });
  }, [client, items, discount, gstPct, status, date, clientId, initial, notes]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!client || !computed) throw new Error("Pick a client");
      let number = initial?.number;
      if (!number) number = await nextQuoteNumber(user!.uid, settings.quotePrefix);
      const q: Omit<Quotation, "id"> & { id?: string } = { ...computed, id: initial?.id, number };
      const id = await saveQuotation(user!.uid, q);
      return { ...q, id } as Quotation;
    },
    onSuccess: (q) => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["quotations", user?.uid] });
      qc.invalidateQueries({ queryKey: ["client-quotes", user?.uid, q.clientId] });
      if (!initial) nav({ to: "/quotations/$id", params: { id: q.id } });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: async () => {
      // Clean up uploaded item photos so they don't pile up in Storage forever.
      const paths = (initial!.items ?? [])
        .map((it) => it.imagePath)
        .filter((p): p is string => !!p);
      await Promise.all(paths.map((p) => deleteFile(p)));
      await deleteQuotation(user!.uid, initial!.id);
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["quotations", user?.uid] });
      nav({ to: "/" });
    },
  });

  // Create a revision of the current quotation — copies all content, assigns
  // the next /N sub-number off the original, does NOT consume the main counter.
  const revMut = useMutation({
    mutationFn: async () => {
      if (!computed) throw new Error("Nothing to revise");
      // Always link back to the true original, even if we're revising a revision.
      const trueParentId = initial!.parentId ?? initial!.id;
      const baseNumber = initial!.number.split("/")[0];
      const { number, revision } = await nextRevisionNumber(
        user!.uid,
        trueParentId,
        baseNumber,
      );
      const q: Omit<Quotation, "id"> = {
        ...computed,
        number,
        parentId: trueParentId,
        revision,
        status: "Draft",
        date: Date.now(),
        pdfUrl: undefined,
      };
      const id = await saveQuotation(user!.uid, q);
      return { ...q, id } as Quotation;
    },
    onSuccess: (q) => {
      toast.success(`Revision ${q.number} created`);
      qc.invalidateQueries({ queryKey: ["quotations", user?.uid] });
      nav({ to: "/quotations/$id", params: { id: q.id } });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // One shared "busy" flag: while any save/delete/PDF action runs, every action
  // button is disabled — a double-click on a new quotation must never create two.
  const [pdfBusy, setPdfBusy] = useState(false);
  const actionBusy = saveMut.isPending || delMut.isPending || revMut.isPending || pdfBusy;

  async function handleDownloadPdf() {
    if (!computed) return toast.error("Pick a client first");
    if (actionBusy) return;
    setPdfBusy(true);
    try {
      let q = computed;
      if (!initial) {
        const saved = await saveMut.mutateAsync();
        q = saved;
      } else {
        await saveMut.mutateAsync();
      }
      const blob = await renderPreviewToPdf(<QuotationPreview quote={q} settings={settings} />);
      downloadBlob(blob, `${q.number}.pdf`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPdfBusy(false);
    }
  }

  // ============ STEP UI ============
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => nav({ to: "/" })}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          {initial?.revision && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              Revision {initial.revision} of {initial.number.split("/")[0]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {initial && <StatusBadge status={status} />}
          {initial && (
            <Select value={status} onValueChange={(v) => setStatus(v as QuoteStatus)}>
              <SelectTrigger className="h-9 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["Draft", "Sent", "Accepted", "Rejected"] as QuoteStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <Stepper step={step} onChange={setStep} hasClient={!!client} hasItems={items.length > 0} />

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1 — Select Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-12">
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
            <Button variant="outline" onClick={() => setOpenClientDlg(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add New Client
            </Button>
            <ClientDialog
              open={openClientDlg}
              onOpenChange={setOpenClientDlg}
              initial={null}
              onSaved={(c: Client) => {
                setOpenClientDlg(false);
                qc.invalidateQueries({ queryKey: ["clients", user?.uid] });
                setClientId(c.id);
              }}
            />
            <div className="flex justify-end pt-2">
              <Button size="lg" className="h-12" disabled={!clientId} onClick={() => setStep(2)}>
                Next: Add Items
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {items.map((it, idx) => (
            <ItemEditor
              key={idx}
              index={idx}
              item={it}
              settings={settings}
              onChange={(u) => setItems(items.map((x, i) => (i === idx ? u : x)))}
              onDuplicate={() => {
                const cp = { ...it, code: nextItemCode(items) };
                setItems([...items, cp]);
              }}
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
            className="w-full h-12"
            onClick={() => setItems([...items, blankItem(nextItemCode(items))])}
          >
            <Plus className="mr-1 h-4 w-4" /> Add Another Item
          </Button>
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              ← Back
            </Button>
            <Button size="lg" className="h-12" onClick={() => setStep(3)}>
              Next: Totals
            </Button>
          </div>
        </div>
      )}

      {step === 3 && computed && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3 — Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    <SelectTrigger className="w-28">
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
              <div className="space-y-1.5">
                <Label>Quote Date</Label>
                <Input
                  type="date"
                  value={toDateInputValue(date)}
                  onChange={(e) => {
                    if (e.target.value) setDate(fromDateInputValue(e.target.value));
                  }}
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/40 p-4">
              <TotalsRow label="Sub Total" value={formatINR(computed.subTotal)} />
              <TotalsRow label={`Discount`} value={`- ${formatINR(computed.discountAmt)}`} />
              <TotalsRow label={`GST @ ${gstPct}%`} value={formatINR(computed.gstAmt)} />
              <div className="mt-2 border-t pt-2">
                <TotalsRow label="Grand Total" value={formatINR(computed.grandTotal)} highlight />
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {computed.totals.itemCount} items • {formatNum(computed.totals.area, 2)} area •{" "}
                {formatNum(computed.totals.weight, 2)} Kg
              </div>
            </div>

            <div>
              <Label>Notes (internal)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                ← Back
              </Button>
              <Button size="lg" className="h-12" onClick={() => setStep(4)}>
                Review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && computed && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4 — Review &amp; Send</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-muted-foreground">Client</div>
                <div className="font-semibold">{client?.name}</div>
                {client?.org && <div className="text-sm">{client.org}</div>}
                <div className="text-xs text-muted-foreground">
                  {[client?.phone, client?.email].filter(Boolean).join(" • ")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Grand Total</div>
                <div className="text-2xl font-bold text-primary">
                  {formatINR(computed.grandTotal)}
                </div>
              </div>
            </div>

            {/* Revision history — shown on both originals and revisions */}
            {isRevision && parentQuote && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-50/60 px-4 py-2.5 text-sm dark:bg-amber-900/20">
                <GitBranch className="h-4 w-4 shrink-0 text-amber-600" />
                <span className="text-amber-800 dark:text-amber-300">
                  This is Revision {initial.revision} of
                </span>
                <Link
                  to="/quotations/$id"
                  params={{ id: parentQuote.id }}
                  className="font-semibold text-amber-700 hover:underline dark:text-amber-400"
                >
                  {parentQuote.number}
                </Link>
                <span className="text-muted-foreground">
                  (original — {parentQuote.status})
                </span>
              </div>
            )}

            {isOriginal && revisions.length > 0 && (
              <div className="rounded-lg border border-amber-300/50 bg-amber-50/60 px-4 py-3 dark:bg-amber-900/20">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                  <GitBranch className="h-4 w-4" />
                  {revisions.length} Revision{revisions.length > 1 ? "s" : ""} of this quotation
                </div>
                <div className="flex flex-wrap gap-2">
                  {revisions.map((r) => (
                    <Link
                      key={r.id}
                      to="/quotations/$id"
                      params={{ id: r.id }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1 text-sm font-semibold text-amber-700 hover:bg-amber-50 dark:bg-transparent dark:text-amber-400"
                    >
                      {r.number}
                      <span className="text-xs font-normal text-muted-foreground">
                        · {r.status}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {linkedBills.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-2.5 text-sm">
                <ReceiptText className="h-4 w-4 shrink-0 text-success" />
                <span>
                  {linkedBills.length === 1 ? "A bill has" : `${linkedBills.length} bills have`}{" "}
                  already been created from this quotation:
                </span>
                {linkedBills.map((b) => (
                  <Link
                    key={b.id}
                    to="/bills/$id"
                    params={{ id: b.id }}
                    className="font-semibold text-success hover:underline"
                  >
                    {b.number}
                  </Link>
                ))}
              </div>
            )}

            <div>
              <div className="mb-2 text-sm font-medium text-muted-foreground">
                Quotation Preview
              </div>
              <div className="overflow-hidden rounded-lg border">
                <QuotationPreview quote={computed} settings={settings} />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {initial && (
                <Button
                  variant="outline"
                  className="border-amber-400/60 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-400"
                  disabled={actionBusy}
                  onClick={() => revMut.mutate()}
                  title="Create a revised copy of this quotation (e.g. Q-00001/1)"
                >
                  {revMut.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <GitBranch className="mr-1 h-4 w-4" />
                  )}
                  {revMut.isPending ? "Creating…" : "Create Revision"}
                </Button>
              )}
              {initial && (
                <Button
                  variant="outline"
                  disabled={actionBusy}
                  onClick={() => {
                    if (confirm("Delete this quotation?")) delMut.mutate();
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
              {initial && (
                <Button
                  variant="outline"
                  className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                  onClick={() => {
                    if (
                      linkedBills.length > 0 &&
                      !confirm(
                        `${linkedBills.map((b) => b.number).join(", ")} already exists for this quotation. Create another bill?`,
                      )
                    )
                      return;
                    nav({ to: "/bills/new", search: { quote: initial.id } });
                  }}
                >
                  <ReceiptText className="mr-1 h-4 w-4" />
                  {linkedBills.length > 0 ? "Create Another Bill" : "Create Bill"}
                </Button>
              )}
              <Button variant="outline" onClick={() => saveMut.mutate()} disabled={actionBusy}>
                {saveMut.isPending && !pdfBusy ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1 h-4 w-4" />
                )}
                {saveMut.isPending && !pdfBusy ? "Saving…" : "Save Draft"}
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
    </div>
  );
}

function Stepper({
  step,
  onChange,
  hasClient,
  hasItems,
}: {
  step: number;
  onChange: (s: 1 | 2 | 3 | 4) => void;
  hasClient: boolean;
  hasItems: boolean;
}) {
  const steps = [
    { n: 1, label: "Client", ok: hasClient },
    { n: 2, label: "Items", ok: hasItems },
    { n: 3, label: "Totals", ok: true },
    { n: 4, label: "Review", ok: true },
  ];
  return (
    <div className="grid grid-cols-4 gap-1">
      {steps.map((s) => (
        <button
          key={s.n}
          onClick={() => onChange(s.n as 1 | 2 | 3 | 4)}
          className={`rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
            step === s.n
              ? "bg-primary text-primary-foreground"
              : s.ok
                ? "bg-accent text-accent-foreground"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {s.n}. {s.label}
        </button>
      ))}
    </div>
  );
}

function TotalsRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1 ${highlight ? "text-lg font-bold text-primary" : ""}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function ItemEditor({
  index,
  item,
  settings,
  onChange,
  onDuplicate,
  onDelete,
  onMove,
  uid,
}: {
  index: number;
  item: QuoteItem;
  settings: typeof DEFAULT_SETTINGS;
  onChange: (u: QuoteItem) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (dir: 1 | -1) => void;
  uid: string;
}) {
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof QuoteItem>(k: K, v: QuoteItem[K]) => onChange({ ...item, [k]: v });

  async function uploadImage(file: File) {
    setBusy(true);
    try {
      const oldPath = item.imagePath;
      const path = `users/${uid}/items/${Date.now()}-${file.name}`;
      const { url } = await uploadFile(path, file);
      onChange({ ...item, imageUrl: url, imagePath: path });
      if (oldPath) void deleteFile(oldPath);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const lineAmount =
    item.rateMode === "lumpsum"
      ? item.qty * item.rate
      : item.rateMode === "step"
        ? item.qty * (item.steps ?? 0) * item.rate
        : item.qty * item.measureValue * item.rate;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-primary">
            Item #{index + 1} — {item.code}
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => onMove(-1)}>
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onMove(1)}>
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDuplicate}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        <div className="flex gap-3">
          <label className="grid h-24 w-24 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border bg-muted">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadImage(f);
              }}
            />
            {item.imageUrl ? (
              <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center text-xs text-muted-foreground">
                <ImagePlus className="h-6 w-6" />
                <span className="mt-1">{busy ? "…" : "Photo"}</span>
              </div>
            )}
          </label>
          <div className="grid flex-1 gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={item.name} onValueChange={(v) => set("name", v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {settings.dropdowns.stairTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Or custom name</Label>
                <Input value={item.name} onChange={(e) => set("name", e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Location on site</Label>
              <Input
                value={item.location || ""}
                onChange={(e) => set("location", e.target.value)}
                placeholder="e.g. Ground floor to 1st floor"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Material</Label>
            <Select value={item.material || ""} onValueChange={(v) => set("material", v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {settings.dropdowns.materials.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Finish / Color</Label>
            <Input value={item.finish || ""} onChange={(e) => set("finish", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Weight (Kg / unit)</Label>
            <Input
              type="number"
              value={item.weight ?? ""}
              onChange={(e) => set("weight", Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-xs">Width (mm)</Label>
            <Input
              type="number"
              value={item.width ?? ""}
              onChange={(e) => set("width", Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-xs">Height (mm)</Label>
            <Input
              type="number"
              value={item.height ?? ""}
              onChange={(e) => set("height", Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-xs">Steps</Label>
            <Input
              type="number"
              value={item.steps ?? ""}
              onChange={(e) => set("steps", Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Extra Specifications</Label>
          <div className="space-y-1.5">
            {item.specs.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={s}
                  placeholder='e.g. "Glass: 12mm Toughened"'
                  onChange={(e) => {
                    const arr = [...item.specs];
                    arr[i] = e.target.value;
                    set("specs", arr);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    set(
                      "specs",
                      item.specs.filter((_, x) => x !== i),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => set("specs", [...item.specs, ""])}>
              <Plus className="mr-1 h-4 w-4" /> Add spec
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <Label className="text-xs">Qty</Label>
            <Input
              type="number"
              value={item.qty}
              onChange={(e) => set("qty", Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-xs">Rate Basis</Label>
            <Select value={item.rateMode} onValueChange={(v) => set("rateMode", v as RateMode)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(settings.dropdowns.rateBasis?.length
                  ? settings.dropdowns.rateBasis
                  : ["sqft", "rft", "step", "lumpsum"]
                ).map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {rateBasisLabel(mode)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {item.rateMode === "lumpsum" ? null : item.rateMode === "step" ? (
            <div className="flex items-end pb-2 text-xs text-muted-foreground">
              Uses the "Steps" count entered above
            </div>
          ) : (
            <div>
              <Label className="text-xs">
                {item.rateMode === "sqft"
                  ? "Sqft / unit"
                  : item.rateMode === "rft"
                    ? "Rft / unit"
                    : `${item.rateMode} / unit`}
              </Label>
              <Input
                type="number"
                value={item.measureValue || ""}
                onChange={(e) =>
                  onChange({
                    ...item,
                    measureValue: Number(e.target.value) || 0,
                    measureUnit: (item.rateMode === "rft" ? "rft" : "sqft") as MeasureUnit,
                  })
                }
              />
            </div>
          )}
          <div>
            <Label className="text-xs">Rate (₹)</Label>
            <Input
              type="number"
              value={item.rate || ""}
              onChange={(e) => set("rate", Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
          <span className="text-sm font-medium">Amount</span>
          <span className="text-lg font-bold text-primary">{formatINR(lineAmount)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
