import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { listClients, saveClient, deleteClient } from "@/lib/firestore";
import type { Client } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Phone,
  MapPin,
  Eye,
  PhoneCall,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { isToday, isOverdue, formatDate, toDateInputValue, fromDateInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TablePagination } from "@/components/TablePagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/clients/")({
  component: ClientsPage,
});

const PAGE_SIZE = 10;

function ClientsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", user?.uid],
    queryFn: () => listClients(user!.uid),
    enabled: !!user,
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteClient(user!.uid, id),
    onSuccess: () => {
      toast.success("Client deleted");
      qc.invalidateQueries({ queryKey: ["clients", user?.uid] });
    },
  });

  const filtered = clients.filter((c) => {
    const t = search.toLowerCase();
    if (!t) return true;
    return (
      c.name.toLowerCase().includes(t) ||
      (c.org || "").toLowerCase().includes(t) ||
      (c.phone || "").toLowerCase().includes(t) ||
      (c.city || "").toLowerCase().includes(t)
    );
  });

  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Clients</h1>
        <Button
          size="lg"
          className="h-12 gap-2"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-5 w-5" /> Add Client
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, city…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-11 pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg border bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {clients.length === 0 ? "No clients yet." : "No matches."}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden sm:table-cell">Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Location</TableHead>
                  <TableHead>Callback</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((c) => {
                  const cbToday = c.callbackDate && isToday(c.callbackDate);
                  const cbOverdue = c.callbackDate && isOverdue(c.callbackDate);
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => nav({ to: "/clients/$id", params: { id: c.id } })}
                    >
                      <TableCell className="max-w-[240px]">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-bold uppercase text-primary">
                            {c.name[0] ?? "C"}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{c.name}</div>
                            {c.org && (
                              <div className="truncate text-xs text-muted-foreground">{c.org}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {c.phone || "—"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell>
                        {c.callbackDate ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                              cbToday
                                ? "bg-primary/15 text-primary"
                                : cbOverdue
                                  ? "bg-destructive/15 text-destructive"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {cbToday ? (
                              <PhoneCall className="h-3 w-3" />
                            ) : (
                              <CalendarClock className="h-3 w-3" />
                            )}
                            {cbToday
                              ? "Call today"
                              : cbOverdue
                                ? `Overdue: ${formatDate(c.callbackDate)}`
                                : formatDate(c.callbackDate)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <Link to="/clients/$id" params={{ id: c.id }}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditing(c);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={delMut.isPending}
                            onClick={() => {
                              if (
                                confirm(
                                  `Delete ${c.name}? Existing quotations for this client will be kept.`,
                                )
                              )
                                delMut.mutate(c.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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

      <ClientDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSaved={() => {
          setOpen(false);
          qc.invalidateQueries({ queryKey: ["clients", user?.uid] });
        }}
      />
    </div>
  );
}

export function ClientDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
  trigger,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Client | null;
  onSaved: (client: Client) => void;
  trigger?: React.ReactNode;
}) {
  const { user } = useAuth();
  const blank = {
    name: "",
    org: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    callbackDate: undefined as number | undefined,
    callbackNote: "",
  };
  const [form, setForm] = useState<Omit<Client, "id"> & { id?: string }>(blank);

  useEffect(() => {
    if (open) {
      setForm(initial ?? blank);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const id = await saveClient(user!.uid, form);
      return { ...form, id } as Client;
    },
    onSuccess: (c) => {
      toast.success("Client saved");
      onSaved(c);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Client" : "Add Client"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Client Name *">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Organisation">
            <Input value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone *">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Full Address">
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </Field>
            <Field label="State">
              <Input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
            <Field label="Callback / Follow-up Date">
              <Input
                type="date"
                value={form.callbackDate ? toDateInputValue(form.callbackDate) : ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    callbackDate: e.target.value ? fromDateInputValue(e.target.value) : undefined,
                  })
                }
              />
            </Field>
            <Field label="Callback Note">
              <Input
                placeholder="e.g. Discuss revised quote"
                value={form.callbackNote || ""}
                onChange={(e) => setForm({ ...form, callbackNote: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!form.name || !form.phone || saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
