import { Search } from "lucide-react";
import { type KeyboardEvent, useId, useMemo, useRef, useState } from "react";

import { fuzzySearch } from "@/lib/fuzzy-search";
import { cn } from "@/lib/utils";

export interface SearchSuggestion {
  id: string;
  /** Primary text shown in the suggestion row. */
  label: string;
  /** Optional secondary text (e.g. category or author). */
  sublabel?: string;
}

interface SearchWithSuggestionsProps {
  value: string;
  onValueChange: (value: string) => void;
  /**
   * Full candidate list. The component fuzzy-filters it by `value`, so callers
   * can pass everything searchable without pre-filtering.
   */
  suggestions: SearchSuggestion[];
  /** Fired when a suggestion is chosen (click or Enter). */
  onSelectSuggestion: (suggestion: SearchSuggestion) => void;
  placeholder?: string;
  /** Max suggestions to render. Defaults to 6. */
  maxSuggestions?: number;
  /** Overrides the default input classes. */
  inputClassName?: string;
  /** Overrides the default search-icon classes. */
  iconClassName?: string;
  ariaLabel?: string;
}

const CYRILLIC_YO_REGEX = /ё/g;

function foldForHighlight(value: string): string {
  // Length-preserving fold so highlight offsets map back onto the original.
  return value.toLowerCase().replace(CYRILLIC_YO_REGEX, "е");
}

/** Splits `label` so the part matching `query` (case/ё-insensitive) is bold. */
function renderHighlighted(label: string, query: string) {
  const needle = foldForHighlight(query.trim());
  if (!needle) {
    return label;
  }
  const index = foldForHighlight(label).indexOf(needle);
  if (index === -1) {
    return label;
  }
  const before = label.slice(0, index);
  const match = label.slice(index, index + needle.length);
  const after = label.slice(index + needle.length);
  return (
    <>
      {before}
      <mark className="bg-transparent font-semibold text-foreground">
        {match}
      </mark>
      {after}
    </>
  );
}

const DEFAULT_MAX_SUGGESTIONS = 6;

export function SearchWithSuggestions({
  value,
  onValueChange,
  suggestions,
  onSelectSuggestion,
  placeholder,
  maxSuggestions = DEFAULT_MAX_SUGGESTIONS,
  inputClassName,
  iconClassName,
  ariaLabel,
}: SearchWithSuggestionsProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const matches = useMemo(() => {
    if (!value.trim()) {
      return [];
    }
    return fuzzySearch(
      value,
      suggestions,
      (item) => [item.label, item.sublabel],
      {
        limit: maxSuggestions,
      }
    ).map((result) => result.item);
  }, [value, suggestions, maxSuggestions]);

  const isOpen = isFocused && matches.length > 0;

  const handleSelect = (suggestion: SearchSuggestion) => {
    onSelectSuggestion(suggestion);
    setActiveIndex(-1);
    setIsFocused(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? matches.length - 1 : prev - 1));
    } else if (event.key === "Enter") {
      const target = activeIndex >= 0 ? matches[activeIndex] : matches[0];
      if (target) {
        event.preventDefault();
        handleSelect(target);
      }
    } else if (event.key === "Escape") {
      setActiveIndex(-1);
      setIsFocused(false);
    }
  };

  const activeOptionId =
    activeIndex >= 0 && matches[activeIndex]
      ? `${listId}-${matches[activeIndex].id}`
      : undefined;

  return (
    <div className="relative">
      <Search
        className={cn(
          "absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground",
          iconClassName
        )}
      />
      <input
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        aria-controls={isOpen ? listId : undefined}
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        autoComplete="off"
        className={cn(
          "h-12 w-full rounded-full border border-[#e5e5e5] bg-background pr-4 pl-11 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground/30",
          inputClassName
        )}
        onBlur={() => setIsFocused(false)}
        onChange={(event) => {
          onValueChange(event.target.value);
          setActiveIndex(-1);
        }}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        ref={inputRef}
        role="combobox"
        value={value}
      />

      {isOpen && (
        // Keep focus on the input so onBlur doesn't fire before the click lands.
        <div
          className="absolute top-[calc(100%+6px)] right-0 left-0 z-50 max-h-72 overflow-y-auto rounded-2xl border border-[#e5e5e5] bg-popover p-1 shadow-md ring-1 ring-foreground/5"
          id={listId}
          onMouseDown={(event) => event.preventDefault()}
          role="listbox"
        >
          {matches.map((suggestion, index) => (
            // Keyboard selection is handled on the combobox input above
            // (ArrowUp/Down + Enter) per the ARIA combobox pattern; these rows
            // are pointer affordances kept in sync via aria-activedescendant.
            // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled on the combobox input
            <div
              aria-selected={index === activeIndex}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm",
                index === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground hover:bg-accent/60"
              )}
              id={`${listId}-${suggestion.id}`}
              key={suggestion.id}
              onClick={() => handleSelect(suggestion)}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
              tabIndex={-1}
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {renderHighlighted(suggestion.label, value)}
                </span>
              </span>
              {suggestion.sublabel && (
                <span className="shrink-0 text-muted-foreground text-xs">
                  {suggestion.sublabel}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
