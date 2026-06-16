import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

/** Compact prev / "X из Y" / next pager. Renders nothing for a single page. */
export function PaginationControls({
  page,
  pageCount,
  onPageChange,
}: PaginationControlsProps) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <Button
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        size="sm"
        variant="outline"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="text-muted-foreground text-sm">
        {page} из {pageCount}
      </span>
      <Button
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        size="sm"
        variant="outline"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
