import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { CheckIcon, EyeIcon, EyeOffIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { cn } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";

import { Button } from "./ui/button";
import { Input } from "./ui/input";

const passwordSchema = z
  .object({
    password: z.string().min(8).regex(/[a-z]/).regex(/[A-Z]/).regex(/\d/),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Пароли не совпадают",
    path: ["confirm"],
  });

type Requirement = {
  label: string;
  test: (v: string) => boolean;
};

const REQUIREMENTS: Requirement[] = [
  { label: "Минимум 8 символов", test: (v) => v.length >= 8 },
  { label: "Минимум одна строчная буква", test: (v) => /[a-z]/.test(v) },
  { label: "Минимум одна цифра", test: (v) => /\d/.test(v) },
  { label: "Минимум одна заглавная буква", test: (v) => /[A-Z]/.test(v) },
];

export function SignUpPasswordForm({ onDone }: { onDone?: () => void } = {}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState(false);
  const trpc = useTRPC();
  const setPasswordMutation = useMutation(
    trpc.auth.setPassword.mutationOptions()
  );

  const form = useForm({
    defaultValues: { password: "", confirm: "" },
    onSubmit: async ({ value }) => {
      try {
        await setPasswordMutation.mutateAsync({ newPassword: value.password });
        toast.success("Пароль сохранён");
        if (onDone) {
          onDone();
        } else {
          window.location.href = "/continue-signup";
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Не удалось установить пароль"
        );
      }
    },
    validators: { onSubmit: passwordSchema },
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-6">
        <div className="font-bold text-3xl text-foreground">A</div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-medium text-3xl text-foreground">
            Придумайте пароль
          </h1>
          <p className="max-w-[378px] text-base text-foreground/80">
            Он понадобится для входа в аккаунт
          </p>
        </div>
      </div>

      <form
        className="relative flex w-[372px] max-w-full flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.Field name="password">
          {(field) => {
            const value = field.state.value;
            const passwordReqsMet = REQUIREMENTS.every((r) => r.test(value));
            const showError =
              field.state.meta.isTouched &&
              value.length > 0 &&
              !passwordReqsMet;
            return (
              <div className="space-y-1">
                <div className="relative">
                  <Input
                    autoComplete="new-password"
                    className={cn(
                      "h-10 rounded-lg border-border bg-background px-4 pr-12 text-sm",
                      showError && "border-destructive"
                    )}
                    name={field.name}
                    onBlur={() => {
                      field.handleBlur();
                      setFocused(false);
                    }}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onFocus={() => setFocused(true)}
                    placeholder="Пароль"
                    type={showPassword ? "text" : "password"}
                    value={value}
                  />
                  <button
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((s) => !s)}
                    type="button"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </button>
                </div>
                {showError && (
                  <p className="text-destructive text-sm">
                    Пароль не соответствует требованиям
                  </p>
                )}
                {focused && <PasswordRequirementsTooltip value={value} />}
              </div>
            );
          }}
        </form.Field>

        <form.Field name="confirm">
          {(field) => {
            const passwordValue = form.state.values.password;
            const mismatch =
              field.state.meta.isTouched &&
              field.state.value.length > 0 &&
              field.state.value !== passwordValue;
            return (
              <div className="space-y-1">
                <div className="relative">
                  <Input
                    autoComplete="new-password"
                    className={cn(
                      "h-10 rounded-lg border-border bg-background px-4 pr-12 text-sm",
                      mismatch && "border-destructive"
                    )}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Повторите пароль"
                    type={showConfirm ? "text" : "password"}
                    value={field.state.value}
                  />
                  <button
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirm((s) => !s)}
                    type="button"
                  >
                    {showConfirm ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </button>
                </div>
                {mismatch && (
                  <p className="text-destructive text-sm">
                    Пароли не совпадают
                  </p>
                )}
              </div>
            );
          }}
        </form.Field>

        <form.Subscribe>
          {(state) => (
            <Button
              className="h-10 w-full rounded-lg bg-foreground text-background text-sm hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
              disabled={!state.canSubmit || state.isSubmitting}
              type="submit"
            >
              {state.isSubmitting ? "Сохраняем..." : "Приступить к работе"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}

function PasswordRequirementsTooltip({ value }: { value: string }) {
  return (
    <div className="absolute top-0 left-full ml-3 hidden w-max rounded-lg bg-foreground px-2 py-1.5 text-background text-xs shadow-lg md:block">
      <ul className="flex flex-col gap-1">
        {REQUIREMENTS.map((r) => {
          const ok = r.test(value);
          return (
            <li
              className={cn(
                "flex items-center gap-1.5",
                ok ? "text-background" : "text-background/50"
              )}
              key={r.label}
            >
              {ok ? (
                <CheckIcon className="size-3" />
              ) : (
                <XIcon className="size-3" />
              )}
              {r.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
