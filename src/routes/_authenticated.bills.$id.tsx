import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { getInvoice } from "@/lib/firestore";
import { InvoiceEditor } from "@/components/InvoiceEditor";

export const Route = createFileRoute("/_authenticated/bills/$id")({
  component: BillPage,
});

function BillPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["invoice", user?.uid, id],
    queryFn: () => getInvoice(user!.uid, id),
    enabled: !!user,
  });

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!data) return <p className="text-muted-foreground">Bill not found.</p>;
  return <InvoiceEditor key={data.id} initial={data} />;
}
