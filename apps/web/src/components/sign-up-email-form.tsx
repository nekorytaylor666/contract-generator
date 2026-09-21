import { useForm } from "@tanstack/react-form";
import type { TFunction } from "i18next";
import { ArrowLeftIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ZhebeMark } from "./zhebe-logo";

const MIN_NAME_LENGTH = 2;
const MIN_PASSWORD_LENGTH = 8;

const makeEmailSchema = (t: TFunction) =>
  z.object({
    name: z.string().min(MIN_NAME_LENGTH, t("auth.signUp.email.nameTooShort")),
    email: z.email(t("auth.signUp.common.invalidEmail")),
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, t("auth.signUp.email.passwordTooShort")),
  });

export function SignUpEmailForm({
  accountType,
  onBack,
}: {
  accountType: "individual" | "legal";
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const emailSchema = useMemo(() => makeEmailSchema(t), [t]);

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
              t("auth.signUp.email.success", {
                accountType: t(
                  `auth.signUp.email.accountTypeShort.${accountType}`
                ),
              })
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
        <ZhebeMark className="h-10 w-auto text-landing" />
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-medium text-3xl text-foreground">
            {t("auth.signUp.email.title")}
          </h1>
          <p className="max-w-[378px] text-base text-foreground/80">
            {t("auth.signUp.email.subtitle")}
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
                placeholder={t("auth.signUp.email.namePlaceholder")}
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
                placeholder={t("auth.signUp.email.emailPlaceholder")}
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
                  placeholder={t("auth.signUp.email.passwordPlaceholder")}
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
              {state.isSubmitting
                ? t("auth.signUp.email.loading")
                : t("auth.signUp.email.submit")}
            </Button>
          )}
        </form.Subscribe>

        <button
          className="inline-flex items-center justify-center gap-1 text-muted-foreground text-xs hover:text-foreground"
          onClick={onBack}
          type="button"
        >
          <ArrowLeftIcon className="size-3" />
          {t("auth.signUp.common.back")}
        </button>
      </form>
    </div>
  );
}
