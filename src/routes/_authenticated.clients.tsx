import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useState } from "react";
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
import { Plus, Search, Pencil, Trash2, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [open, setOpen] = useState(false);

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
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 pl-10"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {clients.length === 0 ? "No clients yet." : "No matches."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/clients/$id"
                    params={{ id: c.id }}
                    className="min-w-0 flex-1"
                  >
                    <div className="truncate text-lg font-semibold">{c.name}</div>
                    {c.org && (
                      <div className="truncate text-sm text-muted-foreground">
                        {c.org}
                      </div>
                    )}
                    <div className="mt-2 space-y-1 text-sm">
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" /> {c.phone}
                        </div>
                      )}
                      {(c.city || c.state) && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {[c.city, c.state].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
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
                      onClick={() => {
                        if (confirm(`Delete ${c.name}?`)) delMut.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
  const [form, setForm] = useState<Omit<Client, "id"> & { id?: string }>({
    name: "",
    org: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
  });

  // Reset on open
  useState(() => {
    if (initial) setForm(initial);
  });

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
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        onOpenAutoFocus={() => setForm(initial ?? { name: "", org: "", phone: "", email: "", address: "", city: "", state: "" })}
      >
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
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Full Address">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label="State">
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
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
