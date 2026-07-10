import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { getQuotation } from "@/lib/firestore";
import { InvoiceEditor } from "@/components/InvoiceEditor";

const searchSchema = z.object({
  quote: z.string().optional(),
  client: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/bills/new")({
  validateSearch: searchSchema,
  component: NewBillPage,
});

function NewBillPage() {
  const { quote, client } = Route.useSearch();
  const { user } = useAuth();

  const { data: quotation, isLoading } = useQuery({
    queryKey: ["quotation", user?.uid, quote],
    queryFn: () => getQuotation(user!.uid, quote!),
    enabled: !!user && !!quote,
  });

  if (quote && isLoading) return <p className="text-muted-foreground">Loading quotation…</p>;
  return (
    <InvoiceEditor
      key={`${quote ?? ""}-${client ?? "new"}`}
      fromQuotation={quotation ?? undefined}
      preselectClientId={client}
    />
  );
}
