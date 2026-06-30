import { useForm } from "@tanstack/react-form";
import { ArrowLeftIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

import Loader from "./loader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Method = "email" | "phone";

const phoneSchema = z.object({
  phone: z
    .string()
    .regex(
      /^\+7 \d{3} \d{3} \d{2} \d{2}$/,
      "Введите корректный номер телефона"
    ),
});
const otpSchema = z.object({
  code: z
    .string()
    .length(6, "Код должен состоять из 6 цифр")
    .regex(/^\d{6}$/, "Только цифры"),
});

// Formats raw input into "+7 XXX XXX XX XX" as the user types.
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

function GoogleMark() {
  return (
    <svg className="size-5" viewBox="0 0 24 24">
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

export default function SignInForm({
  onSwitchToSignUp,
}: {
  onSwitchToSignUp: () => void;
}) {
  const { isPending } = authClient.useSession();
  const [method, setMethod] = useState<Method>("email");
  const [phoneStep, setPhoneStep] = useState<"phone" | "otp">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const onSignedIn = () => {
    toast.success("Вход выполнен успешно");
    window.location.href = "/dashboard";
  };

  const emailForm = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        { email: value.email, password: value.password },
        {
          onSuccess: onSignedIn,
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        }
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Некорректный адрес электронной почты"),
        password: z.string().min(8, "Пароль должен быть не менее 8 символов"),
      }),
    },
  });

  const phoneForm = useForm({
    defaultValues: { phone: "" },
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
      setPhoneStep("otp");
      toast.success("Код отправлен — проверьте SMS");
    },
    validators: { onSubmit: phoneSchema },
  });

  const otpForm = useForm({
    // Dev-stub: код по умолчанию 111111. Убрать когда подключим реальный SMS.
    defaultValues: { code: "111111" },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.phoneNumber.verify({
        phoneNumber,
        code: value.code,
      });
      if (error) {
        toast.error(error.message ?? "Неверный код");
        return;
      }
      onSignedIn();
    },
    validators: { onSubmit: otpSchema },
  });

  if (isPending) {
    return <Loader />;
  }

  const googleSignIn = () =>
    authClient.signIn.social(
      {
        provider: "google",
        callbackURL: `${window.location.origin}/dashboard`,
      },
      {
        onError: (ctx) => {
          toast.error(ctx.error.message || "Не удалось войти через Google");
        },
      }
    );

  const selectMethod = (next: Method) => {
    if (next === "phone") {
      setPhoneStep("phone");
    }
    setMethod(next);
  };

  // The active method button is outlined so it's clear which fields show below.
  const selectorClass = (active: boolean) =>
    cn(
      "h-12 w-full rounded-lg bg-muted text-foreground text-sm hover:bg-muted/80",
      active && "ring-2 ring-primary ring-offset-1"
    );

  const emailFields = (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        emailForm.handleSubmit();
      }}
    >
      <emailForm.Field name="email">
        {(field) => (
          <div className="space-y-1">
            <Input
              className="h-12 rounded-lg border-border bg-background px-4 text-sm"
              id={field.name}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Введите электронную почту"
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
      </emailForm.Field>

      <emailForm.Field name="password">
        {(field) => (
          <div className="space-y-1">
            <div className="relative">
              <Input
                className="h-12 rounded-lg border-border bg-background px-4 pr-12 text-sm"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Введите ваш пароль"
                type={showPassword ? "text" : "password"}
                value={field.state.value}
              />
              <button
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                type="button"
              >
                {showPassword ? (
                  <EyeOffIcon className="size-5" />
                ) : (
                  <EyeIcon className="size-5" />
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
      </emailForm.Field>

      <emailForm.Subscribe>
        {(state) => (
          <Button
            className="h-12 w-full rounded-lg text-sm"
            disabled={!state.canSubmit || state.isSubmitting}
            type="submit"
          >
            {state.isSubmitting ? "Загрузка..." : "Войти"}
          </Button>
        )}
      </emailForm.Subscribe>
    </form>
  );

  const phoneNumberFields = (
    <form
      className="space-y-4"
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
              className="h-12 rounded-lg border-border bg-background px-4 text-sm"
              id={field.name}
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

      <phoneForm.Subscribe>
        {(state) => (
          <Button
            className="h-12 w-full rounded-lg text-sm"
            disabled={!state.canSubmit || state.isSubmitting}
            type="submit"
          >
            {state.isSubmitting ? "Отправляем..." : "Получить код"}
          </Button>
        )}
      </phoneForm.Subscribe>
    </form>
  );

  const otpFields = (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        otpForm.handleSubmit();
      }}
    >
      <p className="text-center text-muted-foreground text-sm">
        Мы отправили 6-значный код на {phoneNumber}
      </p>
      <otpForm.Field name="code">
        {(field) => (
          <div className="space-y-1">
            <Input
              autoComplete="one-time-code"
              className="h-12 rounded-lg border-border bg-background px-4 text-sm"
              inputMode="numeric"
              maxLength={6}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(e) =>
                field.handleChange(e.target.value.replace(/\D/g, ""))
              }
              placeholder="Введите код"
              value={field.state.value}
            />
            {field.state.meta.errors.map((error) => (
              <p className="text-red-500 text-sm" key={error?.message}>
                {error?.message}
              </p>
            ))}
          </div>
        )}
      </otpForm.Field>

      <otpForm.Subscribe>
        {(state) => (
          <Button
            className="h-12 w-full rounded-lg text-sm"
            disabled={!state.canSubmit || state.isSubmitting}
            type="submit"
          >
            {state.isSubmitting ? "Проверяем..." : "Войти"}
          </Button>
        )}
      </otpForm.Subscribe>

      <button
        className="mx-auto flex items-center justify-center gap-1 text-muted-foreground text-xs hover:text-foreground"
        onClick={() => setPhoneStep("phone")}
        type="button"
      >
        <ArrowLeftIcon className="size-3" />
        Изменить номер
      </button>
    </form>
  );

  let fields: ReactNode = emailFields;
  if (method === "phone") {
    fields = phoneStep === "phone" ? phoneNumberFields : otpFields;
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mb-4 font-bold text-3xl text-primary">A</div>
        <h1 className="font-bold text-3xl">Добро пожаловать!</h1>
      </div>

      {/* Always-visible method buttons; the fields below change with the choice */}
      <div className="flex flex-col gap-2">
        <Button
          className="h-12 w-full gap-2 rounded-lg bg-foreground text-background text-sm hover:bg-foreground/90"
          onClick={googleSignIn}
          type="button"
        >
          <GoogleMark />
          Продолжить через Google
        </Button>
        <Button
          className={selectorClass(method === "phone")}
          onClick={() => selectMethod("phone")}
          type="button"
        >
          Продолжить с номером телефона
        </Button>
        <Button
          className={selectorClass(method === "email")}
          onClick={() => selectMethod("email")}
          type="button"
        >
          Продолжить с почтой
        </Button>
      </div>

      {/* Changing fields */}
      {fields}

      <div className="text-center">
        <span className="text-muted-foreground text-sm">
          Еще нет аккаунта?{" "}
        </span>
        <button
          className="text-primary text-sm hover:underline"
          onClick={onSwitchToSignUp}
          type="button"
        >
          Зарегистрироваться.
        </button>
      </div>

      <p className="text-center text-muted-foreground text-xs">
        Используя Zhebe, вы соглашаетесь с Условиями использования и Соглашением
        об обработке данных.
      </p>
    </div>
  );
}
