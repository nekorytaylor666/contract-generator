import { useForm } from "@tanstack/react-form";
import { ArrowLeftIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";

const schema = z.object({
  email: z.email("Некорректный адрес электронной почты"),
  password: z
    .string()
    .min(8, "Минимум 8 символов")
    .regex(/[a-z]/, "Минимум одна строчная буква")
    .regex(/[A-Z]/, "Минимум одна заглавная буква")
    .regex(/\d/, "Минимум одна цифра"),
});

export function SignUpCreateAccountForm({
  accountType,
  onBack,
  onDone,
}: {
  accountType: "individual" | "legal";
  onBack: () => void;
  onDone: (email: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.signUp.email({
        email: value.email,
        password: value.password,
        // Имя докинем на следующем шаге (org-info), но better-auth требует поле.
        name: value.email.split("@")[0] ?? value.email,
        accountType,
      });
      if (error) {
        toast.error(error.message ?? "Не удалось создать аккаунт");
        return;
      }
      onDone(value.email);
    },
    validators: { onSubmit: schema },
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-6">
        <div className="font-bold text-3xl text-foreground">A</div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-medium text-3xl text-foreground">
            Создание аккаунта
          </h1>
          <p className="max-w-[378px] text-base text-foreground/80">
            Введите вашу электронную почту и придумайте пароль для входа
          </p>
        </div>
      </div>

      <form
        className="flex w-[372px] max-w-full flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.Field name="email">
          {(field) => (
            <div className="space-y-1">
              <Input
                autoComplete="email"
                className="h-10 rounded-lg border-border bg-background px-4 text-sm placeholder:text-muted-foreground"
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Электронная почта"
                type="email"
                value={field.state.value}
              />
              {field.state.meta.errors.map((error) => (
                <p className="text-red-500 text-sm" key={error?.message}>
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <div className="space-y-1">
              <div className="relative">
                <Input
                  autoComplete="new-password"
                  className="h-10 rounded-lg border-border bg-background px-4 pr-12 text-sm placeholder:text-muted-foreground"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Придумайте пароль"
                  type={showPassword ? "text" : "password"}
                  value={field.state.value}
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
              {field.state.meta.errors.map((error) => (
                <p className="text-red-500 text-sm" key={error?.message}>
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <div className="flex items-start gap-3 text-foreground/80 text-sm">
          <Checkbox
            checked={acceptTerms}
            className="mt-0.5 size-4 rounded-sm border-border data-checked:border-foreground data-checked:bg-foreground data-checked:text-background"
            id="ca-accept-terms"
            onCheckedChange={(checked) => setAcceptTerms(checked === true)}
          />
          <label className="flex-1 cursor-pointer" htmlFor="ca-accept-terms">
            Принимаю{" "}
            <a className="underline" href="/terms">
              условия использования
            </a>{" "}
            и{" "}
            <a className="underline" href="/privacy">
              политику конфиденциальности
            </a>
            .
          </label>
        </div>

        <form.Subscribe>
          {(state) => (
            <Button
              className="h-10 w-full rounded-lg bg-foreground text-background text-sm hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
              disabled={!state.canSubmit || state.isSubmitting || !acceptTerms}
              type="submit"
            >
              {state.isSubmitting ? "Создаём..." : "Создать аккаунт"}
            </Button>
          )}
        </form.Subscribe>

        <Button
          className="h-10 w-full rounded-lg bg-muted text-foreground text-sm hover:bg-muted/80"
          onClick={onBack}
          type="button"
        >
          <ArrowLeftIcon className="size-4" />
          Назад
        </Button>
      </form>
    </div>
  );
}
