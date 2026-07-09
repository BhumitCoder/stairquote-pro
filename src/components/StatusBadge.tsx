import { Badge } from "@/components/ui/badge";
import type { QuoteStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const map: Record<QuoteStatus, string> = {
  Draft: "bg-muted text-muted-foreground",
  Sent: "bg-info/15 text-info border-info/30",
  Accepted: "bg-success/15 text-success border-success/30",
  Rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

export function StatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", map[status])}>
      {status}
    </Badge>
  );
}
