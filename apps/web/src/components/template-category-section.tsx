import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

interface TemplateCategorySectionProps {
  title: string;
  viewAllHref?: string;
  children: ReactNode;
}

export function TemplateCategorySection({
  title,
  viewAllHref,
  children,
}: TemplateCategorySectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-foreground text-sm">{title}</h2>
        {viewAllHref && (
          <Link
            className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
            to={viewAllHref}
          >
            Смотреть все
            <ChevronRight className="size-3" />
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {children}
      </div>
    </section>
  );
}
