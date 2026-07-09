import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { getClient, listQuotationsByClient } from "@/lib/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatINR, formatDate } from "@/lib/format";
import { PlusCircle, Phone, Mail, MapPin, Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  component: ClientProfile,
});

function ClientProfile() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();

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

  if (!client) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/clients" className="text-sm text-muted-foreground hover:underline">
          ← Back to clients
        </Link>
      </div>

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
            </div>
            <Button
              size="lg"
              className="h-12 gap-2"
              onClick={() =>
                nav({ to: "/quotations/new", search: { client: client.id } })
              }
            >
              <PlusCircle className="h-5 w-5" /> New Quotation
            </Button>
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
                <li key={q.id}>
                  <Link
                    to="/quotations/$id"
                    params={{ id: q.id }}
                    className="flex items-center gap-3 p-4 hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{q.number}</span>
                        <StatusBadge status={q.status} />
                      </div>
                      <div className="text-xs text-muted-foreground">{formatDate(q.date)}</div>
                    </div>
                    <div className="text-right font-semibold">{formatINR(q.grandTotal)}</div>
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
