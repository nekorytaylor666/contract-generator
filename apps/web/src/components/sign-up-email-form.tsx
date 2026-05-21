import { useForm } from "@tanstack/react-form";
import { ArrowLeftIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import { Button } from "./ui/button";
import { Input } from "./ui/input";

const emailSchema = z.object({
  name: z.string().min(2, "Имя должно быть не менее 2 символов"),
  email: z.email("Некорректный адрес электронной почты"),
  password: z.string().min(8, "Пароль должен быть не менее 8 символов"),
});

export function SignUpEmailForm({
  accountType,
  onBack,
}: {
  accountType: "individual" | "legal";
  onBack: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm({
    defaultValues: { name: "", email: "", password: "" },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
          accountType,
        },
        {
          onSuccess: () => {
            toast.success(
              `Регистрация успешна (${
                accountType === "individual" ? "Физ. лицо" : "Юр. лицо"
              })`
            );
            window.location.href = "/continue-signup";
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        }
      );
    },
    validators: { onSubmit: emailSchema },
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-6">
        <div className="font-bold text-3xl text-foreground">A</div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-medium text-3xl text-foreground">
            Регистрация по почте
          </h1>
          <p className="max-w-[378px] text-base text-foreground/80">
            Создайте аккаунт с электронной почтой и паролем.
          </p>
        </div>
      </div>

      <form
        className="flex w-[372px] max-w-full flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.Field name="name">
          {(field) => (
            <div className="space-y-1">
              <Input
                autoComplete="name"
                className="h-10 rounded-lg border-border bg-background px-4 text-sm"
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Ваше имя"
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

        <form.Field name="email">
          {(field) => (
            <div className="space-y-1">
              <Input
                autoComplete="email"
                className="h-10 rounded-lg border-border bg-background px-4 text-sm"
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Ваша электронная почта"
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
                  className="h-10 rounded-lg border-border bg-background px-4 pr-12 text-sm"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Пароль"
                  type={showPassword ? "text" : "password"}
                  value={field.state.value}
                />
                <button
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
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

        <form.Subscribe>
          {(state) => (
            <Button
              className="h-10 w-full rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90"
              disabled={!state.canSubmit || state.isSubmitting}
              type="submit"
            >
              {state.isSubmitting ? "Загрузка..." : "Зарегистрироваться"}
            </Button>
          )}
        </form.Subscribe>

        <button
          className="inline-flex items-center justify-center gap-1 text-muted-foreground text-xs hover:text-foreground"
          onClick={onBack}
          type="button"
        >
          <ArrowLeftIcon className="size-3" />
          Назад
        </button>
      </form>
    </div>
  );
}
