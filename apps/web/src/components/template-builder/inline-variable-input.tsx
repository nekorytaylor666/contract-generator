import { useEffect, useRef, useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TemplateVariable } from "@/routes/templates";

interface InlineVariableInputProps {
  variable: TemplateVariable;
  value: unknown;
  displayValue: string | null;
  onChange: (name: string, value: unknown) => void;
  isHighlighted?: boolean;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

function TextInput({
  value,
  label,
  onChange,
  onClose,
  multiline,
}: {
  value: string;
  label: string;
  onChange: (v: string) => void;
  onClose: () => void;
  multiline?: boolean;
}) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    if (ref.current instanceof HTMLInputElement) {
      ref.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      onClose();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (multiline) {
    return (
      <textarea
        className="w-full rounded border border-input bg-background px-2 py-1.5 font-sans text-sm outline-none focus:border-primary"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={label}
        ref={ref as React.RefObject<HTMLTextAreaElement>}
        rows={3}
        value={value}
      />
    );
  }

  return (
    <input
      className="w-full rounded border border-input bg-background px-2 py-1.5 font-sans text-sm outline-none focus:border-primary"
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={label}
      ref={ref as React.RefObject<HTMLInputElement>}
      type="text"
      value={value}
    />
  );
}

function NumberInput({
  value,
  label,
  onChange,
  onClose,
}: {
  value: string;
  label: string;
  onChange: (v: number | string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      className="w-full rounded border border-input bg-background px-2 py-1.5 font-sans text-sm outline-none focus:border-primary"
      onChange={(e) => {
        const val = e.target.value;
        onChange(val === "" ? "" : Number(val));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") {
          onClose();
        }
      }}
      placeholder={label}
      ref={ref}
      type="number"
      value={value}
    />
  );
}

export function InlineVariableInput({
  variable,
  value,
  displayValue,
  onChange,
  isHighlighted,
  scrollContainerRef,
}: InlineVariableInputProps) {
  const [open, setOpen] = useState(false);
  const highlightRef = useRef<HTMLButtonElement>(null);
  const isEmpty = displayValue === null || displayValue === "";

  useEffect(() => {
    if (isHighlighted && highlightRef.current && scrollContainerRef?.current) {
      const el = highlightRef.current;
      const container = scrollContainerRef.current;
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const offsetTop = elRect.top - containerRect.top + container.scrollTop;
      const targetScroll =
        offsetTop - container.clientHeight / 2 + elRect.height / 2;
      container.scrollTo({ top: targetScroll, behavior: "smooth" });
    }
  }, [isHighlighted, scrollContainerRef]);

  // Don't render inline inputs for booleans — they control conditionals, not display text
  if (variable.type === "boolean") {
    return (
      <span className="text-muted-foreground/60 italic">{variable.label}</span>
    );
  }

  const triggerContent = isEmpty ? (
    <span className="inline-flex min-w-16 border-muted-foreground/40 border-b border-dashed px-0.5 text-muted-foreground/50 italic">
      {variable.label}
    </span>
  ) : (
    <span className="inline-flex border-primary/30 border-b border-dashed px-0.5 decoration-primary/30 transition-colors hover:bg-primary/10">
      {displayValue}
    </span>
  );

  const renderEditor = () => {
    switch (variable.type) {
      case "text":
        return (
          <TextInput
            label={variable.label}
            onChange={(v) => onChange(variable.name, v)}
            onClose={() => setOpen(false)}
            value={String(value ?? "")}
          />
        );

      case "textarea":
        return (
          <TextInput
            label={variable.label}
            multiline
            onChange={(v) => onChange(variable.name, v)}
            onClose={() => setOpen(false)}
            value={String(value ?? "")}
          />
        );

      case "number":
        return (
          <NumberInput
            label={variable.label}
            onChange={(v) => onChange(variable.name, v)}
            onClose={() => setOpen(false)}
            value={value !== undefined && value !== "" ? String(value) : ""}
          />
        );

      case "date":
        return (
          <DatePicker
            onChange={(date) => {
              onChange(variable.name, date);
              setOpen(false);
            }}
            placeholder={variable.label}
            value={value instanceof Date ? value : undefined}
          />
        );

      case "select":
        return (
          <Select
            onValueChange={(v) => {
              onChange(variable.name, v);
              setOpen(false);
            }}
            value={String(value ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={variable.label} />
            </SelectTrigger>
            <SelectContent>
              {variable.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      default:
        return null;
    }
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          className={`inline cursor-pointer rounded-sm font-inherit text-inherit outline-none focus:ring-1 focus:ring-primary/50 ${isHighlighted ? "animate-highlight-fade" : ""}`}
          ref={highlightRef}
          type="button"
        >
          {triggerContent}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3" side="bottom">
        <div className="space-y-2">
          <p className="font-medium font-sans text-muted-foreground text-xs">
            {variable.label}
            {variable.required && (
              <span className="ml-0.5 text-destructive">*</span>
            )}
          </p>
          {renderEditor()}
        </div>
      </PopoverContent>
    </Popover>
  );
}
