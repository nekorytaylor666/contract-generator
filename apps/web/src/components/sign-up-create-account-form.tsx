import { useForm } from "@tanstack/react-form";
import type { TFunction } from "i18next";
import { ArrowLeftIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { ZhebeMark } from "./zhebe-logo";

const LOWERCASE_RE = /[a-z]/;
const UPPERCASE_RE = /[A-Z]/;
const DIGIT_RE = /\d/;
const MIN_PASSWORD_LENGTH = 8;

// Тексты требований к паролю общие с подсказкой — security.passwordRules.*.
const makeSchema = (t: TFunction) =>
  z.object({
    email: z.email(t("auth.signUp.common.invalidEmail")),
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, t("security.passwordRules.minLength"))
      .regex(LOWERCASE_RE, t("security.passwordRules.lowercase"))
      .regex(UPPERCASE_RE, t("security.passwordRules.uppercase"))
      .regex(DIGIT_RE, t("security.passwordRules.digit")),
  });

function LegalLink({ children, href }: { children?: ReactNode; href: string }) {
  return (
    <a className="underline" href={href}>
      {children}
    </a>
  );
}

// Текст согласия с условиями — общий для шагов с телефоном и с почтой.
// Содержимое ссылок подставляет <Trans> из перевода.
export function AcceptTermsText() {
  return (
    <Trans
      components={{
        terms: <LegalLink href="/terms" />,
        privacy: <LegalLink href="/privacy" />,
      }}
      i18nKey="auth.signUp.common.acceptTerms"
    />
  );
}

export function SignUpCreateAccountForm({
  accountType,
  onBack,
  onDone,
}: {
  accountType: "individual" | "legal";
  onBack: () => void;
  onDone: (email: string) => void;
}) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const schema = useMemo(() => makeSchema(t), [t]);

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
        toast.error(
          error.message ?? t("auth.signUp.common.createAccountFailed")
        );
        return;
      }
      onDone(value.email);
    },
    validators: { onSubmit: schema },
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-6">
        <ZhebeMark className="h-10 w-auto text-landing" />
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-medium text-3xl text-foreground">
            {t("auth.signUp.createAccount.title")}
          </h1>
          <p className="max-w-[378px] text-base text-foreground/80">
            {t("auth.signUp.createAccount.subtitle")}
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
                placeholder={t("auth.signUp.createAccount.emailPlaceholder")}
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
                  placeholder={t(
                    "auth.signUp.createAccount.passwordPlaceholder"
                  )}
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
            <AcceptTermsText />
          </label>
        </div>

        <form.Subscribe>
          {(state) => (
            <Button
              className="h-10 w-full rounded-lg bg-foreground text-background text-sm hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
              disabled={!state.canSubmit || state.isSubmitting || !acceptTerms}
              type="submit"
            >
              {state.isSubmitting
                ? t("auth.signUp.common.creating")
                : t("auth.signUp.common.createAccount")}
            </Button>
          )}
        </form.Subscribe>

        <Button
          className="h-10 w-full rounded-lg bg-muted text-foreground text-sm hover:bg-muted/80"
          onClick={onBack}
          type="button"
        >
          <ArrowLeftIcon className="size-4" />
          {t("auth.signUp.common.back")}
        </Button>
      </form>
    </div>
  );
}
