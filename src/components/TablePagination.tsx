import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Standard table footer: "Showing X–Y of Z" + numbered pager with ellipses.
export function TablePagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - current) <= 1,
  );

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
      <span className="text-xs text-muted-foreground">
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={current <= 1}
          onClick={() => onChange(current - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i, arr) => (
          <span key={p} className="flex items-center">
            {i > 0 && arr[i - 1] !== p - 1 && (
              <span className="px-1 text-xs text-muted-foreground">…</span>
            )}
            <button
              onClick={() => onChange(p)}
              className={cn(
                "h-8 min-w-8 rounded-md px-2 text-sm font-medium transition-colors",
                p === current
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {p}
            </button>
          </span>
        ))}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={current >= totalPages}
          onClick={() => onChange(current + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
