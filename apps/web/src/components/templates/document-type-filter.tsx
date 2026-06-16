import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_VALUES,
} from "@contract-builder/api/constants/template-options";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DocumentTypeFilterProps {
  selected: string[];
  onChange: (next: string[]) => void;
}

const keepOpen = (event: Event) => event.preventDefault();

/** "Вид документа" filter — all document types, multi-select. */
export function DocumentTypeFilter({
  selected,
  onChange,
}: DocumentTypeFilterProps) {
  const { t } = useTranslation();
  const selectedSet = new Set(selected);

  const toggle = (slug: string) => {
    const next = new Set(selectedSet);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }
    onChange([...next]);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-foreground text-sm outline-none hover:border-foreground/30 data-open:border-foreground/30",
          selected.length > 0 ? "border-foreground/40" : "border-[#ececec]"
        )}
      >
        {t("templates.documentType")}
        {selected.length > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 font-medium text-[11px] text-background">
            {selected.length}
          </span>
        )}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[230px]">
        {DOCUMENT_TYPE_VALUES.map((type) => (
          <DropdownMenuCheckboxItem
            checked={selectedSet.has(type)}
            key={type}
            onCheckedChange={() => toggle(type)}
            onSelect={keepOpen}
          >
            {DOCUMENT_TYPE_LABELS[type]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
