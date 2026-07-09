import { useForm } from "@tanstack/react-form";
import { ArrowLeftIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

import Loader from "./loader";
import { SignUpCreateAccountForm } from "./sign-up-create-account-form";
import { SignUpEmailConfirmForm } from "./sign-up-email-confirm-form";
import { SignUpEmailForm } from "./sign-up-email-form";
import { SignUpOrgForm } from "./sign-up-org-form";
import { SignUpOtpForm } from "./sign-up-otp-form";
import { SignUpPasswordForm } from "./sign-up-password-form";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";

type AccountType = "individual" | "legal";
type Step =
  | "account-type"
  | "method"
  | "phone"
  | "otp"
  | "create-account"
  | "email-confirm"
  | "org-info"
  | "password"
  | "email";

const phoneSchema = z.object({
  phone: z
    .string()
    .regex(
      /^\+7 \d{3} \d{3} \d{2} \d{2}$/,
      "Введите корректный номер телефона"
    ),
});

function formatKzPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  let rest = digits;
  if (rest.startsWith("7") || rest.startsWith("8")) {
    rest = rest.slice(1);
  }
  rest = rest.slice(0, 10);

  let formatted = "+7";
  if (rest.length > 0) {
    formatted += ` ${rest.slice(0, 3)}`;
  }
  if (rest.length > 3) {
    formatted += ` ${rest.slice(3, 6)}`;
  }
  if (rest.length > 6) {
    formatted += ` ${rest.slice(6, 8)}`;
  }
  if (rest.length > 8) {
    formatted += ` ${rest.slice(8, 10)}`;
  }
  return formatted;
}

export default function SignUpForm() {
  const { isPending } = authClient.useSession();
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [step, setStep] = useState<Step>("account-type");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailForConfirm, setEmailForConfirm] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const phoneForm = useForm({
    defaultValues: {
      phone: "",
    },
    onSubmit: async ({ value }) => {
      const phoneE164 = `+${value.phone.replace(/\D/g, "")}`;
      const { error } = await authClient.phoneNumber.sendOtp({
        phoneNumber: phoneE164,
      });
      if (error) {
        toast.error(error.message ?? "Не удалось отправить код");
        return;
      }
      setPhoneNumber(phoneE164);
      setStep("otp");
      toast.success("Код отправлен — проверьте SMS");
    },
    validators: {
      onSubmit: phoneSchema,
    },
  });

  if (isPending) {
    return <Loader />;
  }

  if (step === "otp" && accountType) {
    return (
      <SignUpOtpForm
        accountType={accountType}
        onBack={() => setStep("phone")}
        onVerified={() =>
          setStep(accountType === "legal" ? "org-info" : "password")
        }
        phone={phoneNumber}
      />
    );
  }

  if (step === "create-account" && accountType) {
    return (
      <SignUpCreateAccountForm
        accountType={accountType}
        onBack={() => setStep("account-type")}
        onDone={(email) => {
          setEmailForConfirm(email);
          // Юр.лицо: сначала подтверждение почты, потом данные о компании.
          // Физ.лицо: только пароль (email уже верифицирован магиклинком/паролем).
          setStep(accountType === "legal" ? "email-confirm" : "password");
        }}
      />
    );
  }

  if (step === "email-confirm") {
    return (
      <SignUpEmailConfirmForm
        email={emailForConfirm}
        onChangeEmail={() => setStep("create-account")}
        onVerified={() => setStep("org-info")}
      />
    );
  }

  if (step === "org-info") {
    // Юр.лицо уже задал пароль на шаге create-account, остаётся только онбординг.
    return (
      <SignUpOrgForm
        onDone={() => {
          window.location.href = "/continue-signup";
        }}
      />
    );
  }

  if (step === "password") {
    return <SignUpPasswordForm />;
  }

  if (step === "email" && accountType) {
    return (
      <SignUpEmailForm
        accountType={accountType}
        onBack={() => setStep("method")}
      />
    );
  }

  if (step === "account-type") {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-6">
          <div className="font-bold text-3xl text-foreground">A</div>
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="font-medium text-3xl text-foreground">
              Регистрация
            </h1>
            <p className="max-w-[378px] text-base text-foreground/80">
              1000+ юридически проверенных договоров для Казахстана и СНГ.
            </p>
          </div>
        </div>

        <div className="flex w-[372px] max-w-full flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-foreground text-sm">Выберите тип аккаунта</p>
            <fieldset className="flex gap-3 border-0 p-0">
              <legend className="sr-only">Тип аккаунта</legend>
              <AccountTypeOption
                checked={accountType === "individual"}
                label="Физическое лицо"
                onSelect={() => setAccountType("individual")}
                value="individual"
              />
              <AccountTypeOption
                checked={accountType === "legal"}
                label="Юридическое лицо"
                onSelect={() => setAccountType("legal")}
                value="legal"
              />
            </fieldset>
          </div>

          <Button
            className="h-10 w-full rounded-lg bg-foreground text-background text-sm hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
            disabled={!accountType}
            onClick={() => {
              // Юр.лицо — сразу email+пароль, без method-выбора и без телефона.
              setStep(accountType === "legal" ? "create-account" : "method");
            }}
            type="button"
          >
            Продолжить
          </Button>
        </div>
      </div>
    );
  }

  if (step === "method") {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-6">
          <div className="font-bold text-3xl text-foreground">A</div>
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="font-medium text-3xl text-foreground">
              Регистрация
            </h1>
            <p className="max-w-[378px] text-base text-foreground/80">
              Зарегистрируйтесь за минуту — и получите доступ к 1000+ юридически
              проверенных договоров для Казахстана и СНГ.
            </p>
          </div>
        </div>

        <div className="flex w-[372px] max-w-full flex-col gap-2">
          <Button
            className="h-10 w-full rounded-lg bg-foreground text-background text-sm hover:bg-foreground/90"
            onClick={() => setStep("phone")}
            type="button"
          >
            Продолжить с номером телефона
          </Button>
          <Button
            className="h-10 w-full rounded-lg bg-muted text-foreground text-sm hover:bg-muted/80"
            onClick={() => setStep("email")}
            type="button"
          >
            Продолжить с почтой
          </Button>
          <Button
            className="h-10 w-full gap-2 rounded-lg bg-foreground text-background text-sm hover:bg-foreground/90"
            onClick={() =>
              authClient.signIn.social(
                {
                  provider: "google",
                  callbackURL: `${window.location.origin}/dashboard`,
                },
                {
                  onError: (ctx) => {
                    toast.error(
                      ctx.error.message || "Не удалось войти через Google"
                    );
                  },
                }
              )
            }
            type="button"
          >
            <GoogleIcon className="size-4" />
            Продолжить через Google
          </Button>

          <button
            className="mt-1 inline-flex items-center justify-center gap-1 text-muted-foreground text-xs hover:text-foreground"
            onClick={() => setStep("account-type")}
            type="button"
          >
            <ArrowLeftIcon className="size-3" />
            Назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-6">
        <div className="font-bold text-3xl text-foreground">A</div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-medium text-3xl text-foreground">
            Введите номер телефона
          </h1>
          <p className="max-w-[378px] text-base text-foreground/80">
            Введите номер — отправим код подтверждения
          </p>
        </div>
      </div>

      <form
        className="flex w-[372px] max-w-full flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          phoneForm.handleSubmit();
        }}
      >
        <phoneForm.Field name="phone">
          {(field) => (
            <div className="space-y-1">
              <Input
                autoComplete="tel"
                className="h-10 rounded-lg border-border bg-background px-4 text-sm placeholder:text-muted-foreground"
                inputMode="tel"
                maxLength={16}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) =>
                  field.handleChange(formatKzPhone(e.target.value))
                }
                onFocus={() => {
                  if (!field.state.value) {
                    field.handleChange("+7 ");
                  }
                }}
                placeholder="+7 775 386 40 10"
                type="tel"
                value={field.state.value}
              />
              {field.state.meta.errors.map((error) => (
                <p className="text-red-500 text-sm" key={error?.message}>
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </phoneForm.Field>

        <div className="flex items-start gap-3 text-foreground/80 text-sm">
          <Checkbox
            checked={acceptTerms}
            className="mt-0.5 size-4 rounded-sm border-border data-checked:border-foreground data-checked:bg-foreground data-checked:text-background"
            id="accept-terms"
            onCheckedChange={(checked) => setAcceptTerms(checked === true)}
          />
          <label className="flex-1 cursor-pointer" htmlFor="accept-terms">
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

        <phoneForm.Subscribe>
          {(state) => (
            <Button
              className="h-10 w-full rounded-lg bg-foreground text-background text-sm hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
              disabled={!state.canSubmit || state.isSubmitting || !acceptTerms}
              type="submit"
            >
              {state.isSubmitting ? "Отправляем..." : "Отправить код"}
            </Button>
          )}
        </phoneForm.Subscribe>

        <button
          className="inline-flex items-center justify-center gap-1 text-muted-foreground text-xs hover:text-foreground"
          onClick={() => setStep("method")}
          type="button"
        >
          <ArrowLeftIcon className="size-3" />
          Назад
        </button>
      </form>
    </div>
  );
}

function AccountTypeOption({
  checked,
  label,
  onSelect,
  value,
}: {
  checked: boolean;
  label: string;
  onSelect: () => void;
  value: string;
}) {
  return (
    <label
      className={cn(
        // `relative` anchors the `sr-only` radio input here so focusing it on
        // click can't scroll the page (see variable-field radio cards).
        "relative flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        checked
          ? "border-foreground bg-foreground/5 text-foreground"
          : "border-border text-foreground/70 hover:border-foreground/40"
      )}
    >
      <input
        checked={checked}
        className="sr-only"
        name="account-type"
        onChange={onSelect}
        type="radio"
        value={value}
      />
      <span
        aria-hidden="true"
        className={cn(
          "flex size-4 items-center justify-center rounded-full border",
          checked ? "border-foreground" : "border-border"
        )}
      >
        {checked && <span className="size-2 rounded-full bg-foreground" />}
      </span>
      {label}
    </label>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <title>Google</title>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
