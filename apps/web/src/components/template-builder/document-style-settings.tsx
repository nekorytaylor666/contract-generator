import {
  TEMPLATE_LOCALE_LABELS,
  TEMPLATE_LOCALES,
  type TemplateLocale,
} from "@contract-builder/api/constants/template-options";
import { ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select";

export interface DocumentStyle {
  font: string;
  preset: string;
}

const FONTS = [
  { value: "New Computer Modern", label: "Computer Modern", category: "Serif" },
  { value: "Times New Roman", label: "Times New Roman", category: "Serif" },
  { value: "Georgia", label: "Georgia", category: "Serif" },
  { value: "Palatino", label: "Palatino", category: "Serif" },
  { value: "PT Serif", label: "PT Serif", category: "Serif" },
  { value: "Arial", label: "Arial", category: "Sans-Serif" },
  { value: "Helvetica Neue", label: "Helvetica Neue", category: "Sans-Serif" },
  { value: "Verdana", label: "Verdana", category: "Sans-Serif" },
  { value: "PT Sans", label: "PT Sans", category: "Sans-Serif" },
  { value: "Courier New", label: "Courier New", category: "Monospace" },
  { value: "PT Mono", label: "PT Mono", category: "Monospace" },
] as const;

const SERIF_FONTS = FONTS.filter((f) => f.category === "Serif");
const SANS_FONTS = FONTS.filter((f) => f.category === "Sans-Serif");
const MONO_FONTS = FONTS.filter((f) => f.category === "Monospace");

const PRESETS = [
  { value: "compact", label: "Компактный" },
  { value: "default", label: "По умолчанию" },
  { value: "comfortable", label: "Комфортный" },
  { value: "spacious", label: "Просторный" },
] as const;

// Figma "Legal/Actions": compact white pill with a static control label and a
// chevron-down — the current choice is shown by the checkmark in the open
// list, not in the trigger.
function PillTrigger({ label }: { label: string }) {
  return (
    <SelectPrimitive.Trigger className="flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#d4d4d4] bg-background py-1 pr-1.5 pl-2 font-medium text-foreground text-sm shadow-xs outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50">
      {label}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

interface DocumentStyleSettingsProps {
  style: DocumentStyle;
  onStyleChange: (style: DocumentStyle) => void;
  /** Contract language (kk/ru/en) — independent from the UI language. */
  locale: string;
  onLocaleChange: (locale: string) => void;
}

export function DocumentStyleSettings({
  style,
  onStyleChange,
  locale,
  onLocaleChange,
}: DocumentStyleSettingsProps) {
  return (
    <div className="flex items-center gap-2">
      <Select
        onValueChange={(font) => onStyleChange({ ...style, font })}
        value={style.font}
      >
        <PillTrigger label="Шрифт" />
        <SelectContent position="popper">
          <SelectGroup>
            <SelectLabel>С засечками</SelectLabel>
            {SERIF_FONTS.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                <span style={{ fontFamily: font.value }}>{font.label}</span>
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Без засечек</SelectLabel>
            {SANS_FONTS.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                <span style={{ fontFamily: font.value }}>{font.label}</span>
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Моноширинный</SelectLabel>
            {MONO_FONTS.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                <span style={{ fontFamily: font.value }}>{font.label}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select onValueChange={onLocaleChange} value={locale}>
        <PillTrigger label="Язык договора" />
        <SelectContent position="popper">
          {TEMPLATE_LOCALES.map((code: TemplateLocale) => (
            <SelectItem key={code} value={code}>
              {TEMPLATE_LOCALE_LABELS[code]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(preset) => onStyleChange({ ...style, preset })}
        value={style.preset}
      >
        <PillTrigger label="Отступы" />
        <SelectContent position="popper">
          {PRESETS.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
