import { Link } from "@tanstack/react-router";
import type { TemplateVariable } from "@/routes/templates/index";

interface TemplateCardProps {
  id: string;
  title: string;
  description?: string | null;
  createdAt?: Date | string;
  variables?: TemplateVariable[];
}

export function TemplateCard({
  id,
  title,
  description,
  createdAt,
}: TemplateCardProps) {
  const formatDate = (date?: Date | string) => {
    if (!date) {
      return "Недавно";
    }
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
  };

  return (
    <Link
      className="group block"
      params={{ templateId: id }}
      to="/templates/$templateId"
    >
      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-border/80 hover:shadow-sm">
        {/* Document Preview */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted/30 p-3">
          <div className="flex h-full w-full flex-col rounded-sm border border-border/50 bg-white p-3 shadow-sm">
            {/* Fake document lines */}
            <div className="mb-2 h-2 w-3/4 rounded-sm bg-muted/60" />
            <div className="mb-1.5 h-1.5 w-full rounded-sm bg-muted/40" />
            <div className="mb-1.5 h-1.5 w-full rounded-sm bg-muted/40" />
            <div className="mb-1.5 h-1.5 w-5/6 rounded-sm bg-muted/40" />
            <div className="mb-3 h-1.5 w-4/5 rounded-sm bg-muted/40" />
            <div className="mb-1.5 h-1.5 w-full rounded-sm bg-muted/40" />
            <div className="mb-1.5 h-1.5 w-full rounded-sm bg-muted/40" />
            <div className="h-1.5 w-2/3 rounded-sm bg-muted/40" />
          </div>
        </div>

        {/* Card Content */}
        <div className="flex flex-col gap-1.5 p-3">
          <span className="text-[10px] text-muted-foreground">
            Обновлено: {formatDate(createdAt)}
          </span>
          <h3 className="line-clamp-1 font-medium text-foreground text-sm">
            {title}
          </h3>
          {description && (
            <p className="line-clamp-2 text-muted-foreground text-xs">
              {description}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
