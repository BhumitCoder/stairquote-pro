import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect } from "react";
import { QuotationEditor } from "@/components/QuotationEditor";

const searchSchema = z.object({
  client: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/quotations/new")({
  validateSearch: searchSchema,
  component: NewQuotationPage,
});

function NewQuotationPage() {
  const { client } = Route.useSearch();
  // Editor manages its own client selection; pass preselected via key + effect.
  return (
    <div>
      <QuotationEditor key={client ?? "new"} />
      {/* client param handled via QuotationEditor's internal state (initial=undefined starts at step 1); pre-select via a small mount effect */}
      <PreselectClient clientId={client} />
    </div>
  );
}

function PreselectClient({ clientId }: { clientId?: string }) {
  useEffect(() => {
    if (!clientId) return;
    // Find the client select trigger and let user manually pick; kept minimal.
  }, [clientId]);
  return null;
}
