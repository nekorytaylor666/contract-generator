import { memo } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { TemplateVariable } from "@/routes/templates";

interface FieldState {
  value: unknown;
  meta: {
    errors: unknown[];
  };
}

interface FieldInstance {
  name: string;
  state: FieldState;
  handleBlur: () => void;
  handleChange: (value: unknown) => void;
}

interface VariableFieldProps {
  variable: TemplateVariable;
  field: FieldInstance;
  /** Contract language — placeholders must match the localized labels. */
  locale?: string;
}

// Lead-in phrasing for auto-generated placeholders, keyed by contract
// language. Kazakh puts the label first (and keeps its case — it starts the
// phrase); unknown locales fall back to Russian, the authoring default.
const PLACEHOLDER_TEXTS: Record<
  string,
  { enter: (label: string) => string; choose: (label: string) => string }
> = {
  ru: {
    enter: (label) => `Введите ${label.toLowerCase()}`,
    choose: (label) => `Выберите ${label.toLowerCase()}`,
  },
  kk: {
    enter: (label) => `${label} енгізіңіз`,
    choose: (label) => `${label} таңдаңыз`,
  },
  en: {
    enter: (label) => `Enter ${label.toLowerCase()}`,
    choose: (label) => `Choose ${label.toLowerCase()}`,
  },
};

function placeholderTexts(locale: string | undefined) {
  return PLACEHOLDER_TEXTS[locale ?? "ru"] ?? PLACEHOLDER_TEXTS.ru;
}

// Option-count thresholds for how a select renders (per Figma):
// 2 → segmented toggle, 3 → radio cards, 4-5 → plain radios, 6+ → dropdown.
const SEGMENTED_MAX = 2;
const RADIO_CARDS_MAX = 3;
const PLAIN_RADIOS_MAX = 5;

// Text field styling per the Figma "Vertical Field": 36px tall, 8px radius,
// white background, 14px text, 12px horizontal padding (overrides the compact
// shared Input/Textarea defaults, which stay untouched for the rest of the app).
const FIELD_CLASS =
  "h-9 rounded-md bg-background px-3 py-1 text-sm md:text-sm dark:bg-background";
const TEXTAREA_CLASS =
  "min-h-20 rounded-md bg-background px-3 py-2 text-sm md:text-sm dark:bg-background";

function getErrorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function humanizeOption(option: string): string {
  const spaced = option.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Filled circle indicator as in the Figma radio cards / radio lists.
function RadioCircle({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border",
        selected ? "border-primary" : "border-muted-foreground/40"
      )}
    >
      {selected && <span className="size-2 rounded-full bg-primary" />}
    </span>
  );
}

// 2 options — segmented toggle ("Определённый срок" | "Бессрочно").
function SegmentedSelect({
  variable,
  field,
}: {
  variable: TemplateVariable;
  field: FieldInstance;
}) {
  const value = (field.state.value as string) ?? "";
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border">
      {variable.options?.map((option) => {
        const selected = value === option;
        return (
          <button
            className={cn(
              "h-9 px-2 text-center text-sm transition-colors",
              selected
                ? "bg-primary font-medium text-primary-foreground"
                : "bg-background text-foreground hover:bg-muted/60"
            )}
            key={option}
            onClick={() => field.handleChange(option)}
            type="button"
          >
            {humanizeOption(option)}
          </button>
        );
      })}
    </div>
  );
}

// 3 options — bordered radio cards (selected card gets the primary border).
function RadioCardsSelect({
  variable,
  field,
}: {
  variable: TemplateVariable;
  field: FieldInstance;
}) {
  const value = (field.state.value as string) ?? "";
  return (
    <div className="flex flex-col gap-2">
      {variable.options?.map((option) => {
        const selected = value === option;
        const description = variable.optionDescriptions?.[option];
        return (
          // `relative` positions the `sr-only` radio input against this label,
          // not the document — otherwise clicking it focuses an absolutely
          // positioned input and the browser scrolls the whole app off-screen.
          <label
            className={cn(
              "relative flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 transition-colors",
              selected
                ? "border-primary"
                : "border-border hover:border-muted-foreground/40"
            )}
            key={option}
          >
            <input
              checked={selected}
              className="sr-only"
              name={field.name}
              onChange={() => field.handleChange(option)}
              type="radio"
              value={option}
            />
            <RadioCircle selected={selected} />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-sm">
                {humanizeOption(option)}
              </span>
              {description && (
                <span className="text-muted-foreground text-xs leading-snug">
                  {description}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// 4-5 options — plain radio rows.
function RadioListSelect({
  variable,
  field,
}: {
  variable: TemplateVariable;
  field: FieldInstance;
}) {
  const value = (field.state.value as string) ?? "";
  return (
    <div className="flex flex-col gap-2.5">
      {variable.options?.map((option) => {
        const selected = value === option;
        return (
          // `relative` keeps the `sr-only` radio input positioned against this
          // label; without it the browser scrolls the app off-screen on focus.
          <label
            className="relative flex cursor-pointer items-center gap-2.5"
            key={option}
          >
            <input
              checked={selected}
              className="sr-only"
              name={field.name}
              onChange={() => field.handleChange(option)}
              type="radio"
              value={option}
            />
            <RadioCircle selected={selected} />
            <span className="text-sm">{humanizeOption(option)}</span>
          </label>
        );
      })}
    </div>
  );
}

function SelectField({
  variable,
  field,
  hasError,
  locale,
}: {
  variable: TemplateVariable;
  field: FieldInstance;
  hasError: boolean;
  locale?: string;
}) {
  const count = variable.options?.length ?? 0;
  // Options with `::` descriptions always render as rich radio cards (the Figma
  // "Rich Radio Group"), regardless of count within the radio range.
  const hasDescriptions =
    variable.optionDescriptions !== undefined &&
    Object.keys(variable.optionDescriptions).length > 0;
  if (hasDescriptions && count >= SEGMENTED_MAX && count <= PLAIN_RADIOS_MAX) {
    return <RadioCardsSelect field={field} variable={variable} />;
  }
  if (count === SEGMENTED_MAX) {
    return <SegmentedSelect field={field} variable={variable} />;
  }
  if (count === RADIO_CARDS_MAX) {
    return <RadioCardsSelect field={field} variable={variable} />;
  }
  if (count <= PLAIN_RADIOS_MAX) {
    return <RadioListSelect field={field} variable={variable} />;
  }
  return (
    <Select
      onValueChange={(value) => field.handleChange(value)}
      value={(field.state.value as string) ?? ""}
    >
      <SelectTrigger aria-invalid={hasError} className="w-full" id={field.name}>
        <SelectValue
          placeholder={placeholderTexts(locale).choose(variable.label)}
        />
      </SelectTrigger>
      <SelectContent>
        {variable.options?.map((option) => (
          <SelectItem key={option} value={option}>
            {humanizeOption(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Boolean — switch card on a tinted background, as in Figma.
function SwitchField({
  variable,
  field,
}: {
  variable: TemplateVariable;
  field: FieldInstance;
}) {
  const checked = (field.state.value as boolean) ?? false;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-primary/5 px-3.5 py-3">
      <Label className="font-medium text-sm" htmlFor={field.name}>
        {variable.label}
      </Label>
      <Switch
        checked={checked}
        id={field.name}
        name={field.name}
        onCheckedChange={(value) => field.handleChange(value === true)}
      />
    </div>
  );
}

export const VariableField = memo(function VariableField({
  variable,
  field,
  locale,
}: VariableFieldProps) {
  const errors = field.state.meta.errors
    .map(getErrorMessage)
    .filter((e): e is string => e !== null);
  const hasError = errors.length > 0;
  const texts = placeholderTexts(locale);

  const renderInput = () => {
    switch (variable.type) {
      case "text":
        return (
          <Input
            aria-invalid={hasError}
            className={FIELD_CLASS}
            id={field.name}
            name={field.name}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            placeholder={texts.enter(variable.label)}
            type="text"
            value={(field.state.value as string) ?? ""}
          />
        );

      case "textarea":
        return (
          <Textarea
            aria-invalid={hasError}
            className={TEXTAREA_CLASS}
            id={field.name}
            name={field.name}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            placeholder={texts.enter(variable.label)}
            rows={4}
            value={(field.state.value as string) ?? ""}
          />
        );

      case "number":
        return (
          <Input
            aria-invalid={hasError}
            className={FIELD_CLASS}
            id={field.name}
            name={field.name}
            onBlur={field.handleBlur}
            onChange={(e) => {
              const val = e.target.value;
              field.handleChange(val === "" ? "" : Number(val));
            }}
            placeholder={texts.enter(variable.label)}
            type="number"
            value={
              field.state.value !== undefined ? String(field.state.value) : ""
            }
          />
        );

      case "date":
        return (
          <DatePicker
            aria-invalid={hasError}
            className={FIELD_CLASS}
            id={field.name}
            name={field.name}
            onChange={(date) => field.handleChange(date)}
            placeholder={texts.choose(variable.label)}
            value={field.state.value as Date | undefined}
          />
        );

      case "boolean":
        return <SwitchField field={field} variable={variable} />;

      case "select":
        return (
          <SelectField
            field={field}
            hasError={hasError}
            locale={locale}
            variable={variable}
          />
        );

      default:
        return null;
    }
  };

  const hintNode = variable.hint ? (
    <p className="text-muted-foreground/80 text-xs leading-snug">
      {variable.hint}
    </p>
  ) : null;

  return (
    <div className="space-y-1.5">
      {/* Boolean renders its own label inside the switch card, so its hint sits
          below the card; every other type shows the label + hint on top. */}
      {variable.type !== "boolean" && (
        <div className="space-y-1">
          <Label
            className="font-medium text-foreground text-sm"
            htmlFor={field.name}
          >
            {variable.required && "*"}
            {variable.label}:
          </Label>
          {hintNode}
        </div>
      )}
      {renderInput()}
      {variable.type === "boolean" && hintNode}
      {hasError && (
        <p className="text-destructive text-xs">{errors.join(", ")}</p>
      )}
    </div>
  );
});
