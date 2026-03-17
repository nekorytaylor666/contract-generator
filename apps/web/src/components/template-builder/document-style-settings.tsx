import { Columns3, Type } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
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

interface DocumentStyleSettingsProps {
  style: DocumentStyle;
  onStyleChange: (style: DocumentStyle) => void;
}

export function DocumentStyleSettings({
  style,
  onStyleChange,
}: DocumentStyleSettingsProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <Type className="size-3.5 text-muted-foreground" />
        <Select
          onValueChange={(font) => onStyleChange({ ...style, font })}
          value={style.font}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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
      </div>

      <div className="flex items-center gap-1.5">
        <Columns3 className="size-3.5 text-muted-foreground" />
        <Select
          onValueChange={(preset) => onStyleChange({ ...style, preset })}
          value={style.preset}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
