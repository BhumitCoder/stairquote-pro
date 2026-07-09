import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getClient, listQuotationsByClient, saveClient, saveQuotation } from "@/lib/firestore";
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
import { formatINR, formatDate, isToday, isOverdue } from "@/lib/format";
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

  const { data: client } = useQuery({
    queryKey: ["client", user?.uid, id],
    queryFn: () => getClient(user!.uid, id),
    enabled: !!user,
  });
  const { data: quotes = [] } = useQuery({
    queryKey: ["client-quotes", user?.uid, id],
    queryFn: () => listQuotationsByClient(user!.uid, id),
    enabled: !!user,
  });

  const totalValue = quotes.reduce((s, q) => s + q.grandTotal, 0);

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
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold">{client.name}</h1>
              {client.org && (
                <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="h-4 w-4" /> {client.org}
                </p>
              )}
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                {client.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" /> {client.phone}
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" /> {client.email}
                  </div>
                )}
                {(client.address || client.city || client.state) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {[client.address, client.city, client.state].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => setCbOpen(true)}
                className={cn(
                  "mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
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

            <div className="flex flex-col gap-2 sm:items-end">
              <Button
                size="lg"
                className="h-12 gap-2"
                onClick={() =>
                  nav({ to: "/quotations/new", search: { client: client.id } })
                }
              >
                <PlusCircle className="h-5 w-5" /> New Quotation
              </Button>
              {client.phone && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`tel:${client.phone}`}>
                      <Phone className="mr-1.5 h-3.5 w-3.5" /> Call
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://wa.me/${client.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> WhatsApp
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{quotes.length}</div>
            <div className="text-xs text-muted-foreground">Total Quotations</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{formatINR(totalValue)}</div>
            <div className="text-xs text-muted-foreground">Total Business Value</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quotation History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {quotes.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No quotations yet for this client.</div>
          ) : (
            <ul className="divide-y">
              {quotes.map((q) => (
                <li key={q.id} className="flex items-center gap-3 p-4">
                  <Link
                    to="/quotations/$id"
                    params={{ id: q.id }}
                    className="min-w-0 flex-1 hover:underline"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{q.number}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDate(q.date)}</div>
                  </Link>
                  <div className="text-right font-semibold">{formatINR(q.grandTotal)}</div>
                  <Select
                    value={q.status}
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
                      {(["Draft", "Sent", "Accepted", "Rejected"] as QuoteStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
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
  onSave: (date: number | undefined, note: string) => void;
}) {
  const [date, setDate] = useState(callbackDate ? new Date(callbackDate).toISOString().slice(0, 10) : "");
  const [note, setNote] = useState(callbackNote || "");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setDate(callbackDate ? new Date(callbackDate).toISOString().slice(0, 10) : "");
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
            <Button variant="outline" onClick={() => onSave(undefined, "")}>
              Clear
            </Button>
          )}
          <Button onClick={() => onSave(date ? new Date(date).getTime() : undefined, note)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
