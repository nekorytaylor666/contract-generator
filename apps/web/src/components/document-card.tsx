import { Link } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials } from "@/lib/utils";

interface DocumentCardProps {
  id: string;
  title: string;
  templateTitle: string | null;
  templateId: string;
  currentVersion: number;
  authorName: string | null;
  updatedAt: Date | string;
}

// Placeholder text for contract fields not yet in the data model.
// TODO: заменить на реальные поля договора (сумма, дата завершения, статус,
// контрагент), когда они появятся в схеме документа.
const PLACEHOLDER = "—";

export function DocumentCard({
  id,
  title,
  templateTitle,
  templateId,
  authorName,
}: DocumentCardProps) {
  const counterparty = templateTitle ?? PLACEHOLDER;

  return (
    <Link
      className="group block"
      params={{ templateId }}
      search={{ documentId: id }}
      to="/templates/$templateId/builder"
    >
      <div className="flex h-full flex-col gap-3 rounded-2xl border border-[#e5e5e5] bg-card p-4 transition-all hover:border-foreground/20 hover:shadow-sm">
        {/* Counterparty + actions */}
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-muted-foreground text-xs">
            {counterparty}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Действия с документом"
              className="-mt-1 -mr-1 shrink-0 rounded-md p-1 text-muted-foreground outline-none hover:bg-muted hover:text-foreground"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>Скоро</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Title */}
        <h3 className="line-clamp-2 min-h-[2.75rem] font-semibold text-base text-foreground leading-snug">
          {title}
        </h3>

        {/* Meta */}
        <div className="mt-auto flex flex-col gap-1 pt-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Сумма</span>
            <span className="text-foreground">{PLACEHOLDER}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Завершение</span>
            <span className="text-foreground">{PLACEHOLDER}</span>
          </div>
        </div>

        {/* Author */}
        <div className="flex items-center justify-end pt-1">
          <Avatar className="size-7">
            <AvatarFallback className="bg-muted text-[10px]">
              {getInitials(authorName)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </Link>
  );
}
