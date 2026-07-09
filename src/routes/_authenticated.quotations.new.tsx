import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
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
  return <QuotationEditor key={client ?? "new"} preselectClientId={client} />;
}
