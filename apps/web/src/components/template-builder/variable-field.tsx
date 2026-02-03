import { Checkbox } from "@/components/ui/checkbox";
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
}

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

export function VariableField({ variable, field }: VariableFieldProps) {
  const errors = field.state.meta.errors
    .map(getErrorMessage)
    .filter((e): e is string => e !== null);
  const hasError = errors.length > 0;

  const renderInput = () => {
    switch (variable.type) {
      case "text":
        return (
          <Input
            aria-invalid={hasError}
            id={field.name}
            name={field.name}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            placeholder={`Enter ${variable.label.toLowerCase()}`}
            type="text"
            value={(field.state.value as string) ?? ""}
          />
        );

      case "number":
        return (
          <Input
            aria-invalid={hasError}
            id={field.name}
            name={field.name}
            onBlur={field.handleBlur}
            onChange={(e) => {
              const val = e.target.value;
              field.handleChange(val === "" ? "" : Number(val));
            }}
            placeholder={`Enter ${variable.label.toLowerCase()}`}
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
            id={field.name}
            name={field.name}
            onChange={(date) => field.handleChange(date)}
            placeholder={`Select ${variable.label.toLowerCase()}`}
            value={field.state.value as Date | undefined}
          />
        );

      case "boolean":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              aria-invalid={hasError}
              checked={(field.state.value as boolean) ?? false}
              id={field.name}
              name={field.name}
              onCheckedChange={(checked) =>
                field.handleChange(checked === true)
              }
            />
            <Label className="font-normal text-sm" htmlFor={field.name}>
              {variable.label}
            </Label>
          </div>
        );

      case "select":
        return (
          <Select
            onValueChange={(value) => field.handleChange(value)}
            value={(field.state.value as string) ?? ""}
          >
            <SelectTrigger
              aria-invalid={hasError}
              className="w-full"
              id={field.name}
            >
              <SelectValue
                placeholder={`Select ${variable.label.toLowerCase()}`}
              />
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
    <div className="space-y-1.5">
      {variable.type !== "boolean" && (
        <Label htmlFor={field.name}>
          {variable.label}
          {variable.required && (
            <span className="ml-0.5 text-destructive">*</span>
          )}
        </Label>
      )}
      {renderInput()}
      {hasError && (
        <p className="text-destructive text-xs">{errors.join(", ")}</p>
      )}
    </div>
  );
}
