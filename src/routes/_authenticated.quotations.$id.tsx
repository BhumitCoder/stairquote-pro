import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { getQuotation } from "@/lib/firestore";
import { QuotationEditor } from "@/components/QuotationEditor";

export const Route = createFileRoute("/_authenticated/quotations/$id")({
  component: QuotationPage,
});

function QuotationPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["quotation", user?.uid, id],
    queryFn: () => getQuotation(user!.uid, id),
    enabled: !!user,
  });

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!data) return <p className="text-muted-foreground">Quotation not found.</p>;
  return <QuotationEditor initial={data} />;
}
