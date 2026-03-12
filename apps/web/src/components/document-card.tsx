import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DocumentCardProps {
  id: string;
  title: string;
  templateTitle: string | null;
  templateId: string;
  currentVersion: number;
  authorName: string | null;
  updatedAt: Date | string;
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) {
    return "Сегодня";
  }
  if (diffDays === 1) {
    return "1 день назад";
  }
  if (diffDays < 5) {
    return `${diffDays} дня назад`;
  }
  return `${diffDays} дней назад`;
}

export function DocumentCard({
  id,
  title,
  templateTitle,
  templateId,
  currentVersion,
  authorName,
  updatedAt,
}: DocumentCardProps) {
  return (
    <Link
      className="group block"
      params={{ templateId }}
      search={{ documentId: id }}
      to="/templates/$templateId/builder"
    >
      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-border/80 hover:shadow-sm">
        {/* Document Preview */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted/30 p-3">
          <div className="flex h-full w-full flex-col rounded-sm border border-border/50 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center gap-1.5">
              <FileText className="size-3 text-muted-foreground/60" />
              <div className="h-2 w-1/2 rounded-sm bg-muted/60" />
            </div>
            <div className="mb-1.5 h-1.5 w-full rounded-sm bg-muted/40" />
            <div className="mb-1.5 h-1.5 w-full rounded-sm bg-muted/40" />
            <div className="mb-1.5 h-1.5 w-5/6 rounded-sm bg-muted/40" />
            <div className="mb-3 h-1.5 w-4/5 rounded-sm bg-muted/40" />
            <div className="mb-1.5 h-1.5 w-full rounded-sm bg-muted/40" />
            <div className="h-1.5 w-2/3 rounded-sm bg-muted/40" />
          </div>
        </div>

        {/* Card Content */}
        <div className="flex flex-col gap-1.5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {formatDate(updatedAt)}
            </span>
            <Badge className="text-[9px]" variant="outline">
              v{currentVersion}
            </Badge>
          </div>
          <h3 className="line-clamp-1 font-medium text-foreground text-sm">
            {title}
          </h3>
          {(templateTitle || authorName) && (
            <p className="line-clamp-1 text-muted-foreground text-xs">
              {[templateTitle, authorName].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
