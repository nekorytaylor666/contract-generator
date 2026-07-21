import {
  CATEGORY_TREE,
  type CategoryGroup,
  type CategorySub,
  selfAndDescendants,
} from "@contract-builder/api/constants/template-options";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface CategoryFilterProps {
  /** Selected category slugs at any level (group/subcategory/leaf). */
  selected: string[];
  onChange: (next: string[]) => void;
}

// Keep the cascading submenu open while toggling checkboxes for multi-select.
const keepOpen = (event: Event) => event.preventDefault();

/**
 * Cascading multi-select for the catalogue category taxonomy. Top-level groups
 * open subcategories, which open leaf documents — mirroring the Figma design.
 * Selection is controlled and may sit at any level; the parent decides how to
 * match it (via `expandCategorySelection`).
 */
export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
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

  // How many selected slugs fall within a branch — drives the count badges.
  const branchCount = (slug: string) => {
    const within = new Set(selfAndDescendants(slug));
    let count = 0;
    for (const s of selectedSet) {
      if (within.has(s)) {
        count += 1;
      }
    }
    return count;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-foreground text-sm outline-none hover:border-foreground/30 data-open:border-foreground/30",
          selected.length > 0 ? "border-foreground/40" : "border-[#ececec]"
        )}
      >
        {t("templates.category")}
        {selected.length > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 font-medium text-[11px] text-background">
            {selected.length}
          </span>
        )}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[230px]">
        {CATEGORY_TREE.map((group) => renderGroup(group))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  function renderGroup(group: CategoryGroup) {
    if (!group.enabled) {
      return (
        <DropdownMenuItem className="justify-between" disabled key={group.slug}>
          <span>{group.label}</span>
          <span className="text-muted-foreground text-xs">
            {t("common.soon")}
          </span>
        </DropdownMenuItem>
      );
    }

    // Enabled groups always have subcategories in the current taxonomy.
    const count = branchCount(group.slug);
    return (
      <DropdownMenuSub key={group.slug}>
        <DropdownMenuSubTrigger>
          <span className="flex-1">{group.label}</span>
          {count > 0 && <CountBadge value={count} />}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-[230px]" sideOffset={16}>
          {group.subs.map((sub) => renderSub(sub))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  function renderSub(sub: CategorySub) {
    // Третий уровень (листовые документы) из фильтра убран — подкатегория
    // выбирается целиком, совпадение раскрывается по потомкам на страницах.
    return (
      <DropdownMenuCheckboxItem
        checked={selectedSet.has(sub.slug)}
        key={sub.slug}
        onCheckedChange={() => toggle(sub.slug)}
        onSelect={keepOpen}
      >
        {sub.label}
      </DropdownMenuCheckboxItem>
    );
  }
}

function CountBadge({ value }: { value: number }) {
  return (
    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 font-medium text-[11px] text-background">
      {value}
    </span>
  );
}
