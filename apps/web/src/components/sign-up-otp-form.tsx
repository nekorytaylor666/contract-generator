import { useForm } from "@tanstack/react-form";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import { Button } from "./ui/button";
import { Input } from "./ui/input";

const otpSchema = z.object({
  code: z
    .string()
    .length(6, "Код должен состоять из 6 цифр")
    .regex(/^\d{6}$/, "Только цифры"),
});

export function SignUpOtpForm({
  accountType,
  onBack,
  onVerified,
  phone,
}: {
  accountType: "individual" | "legal";
  onBack: () => void;
  onVerified: () => void;
  phone: string;
}) {
  const form = useForm({
    defaultValues: { code: "" },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.phoneNumber.verify({
        phoneNumber: phone,
        code: value.code,
      });
      if (error) {
        toast.error(error.message ?? "Неверный код");
        return;
      }
      // Сохраняем тип аккаунта на пользователе после подтверждения номера.
      await authClient.updateUser({ accountType });
      onVerified();
    },
    validators: { onSubmit: otpSchema },
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-6">
        <div className="font-bold text-3xl text-foreground">A</div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-medium text-3xl text-foreground">
            Введите код из SMS
          </h1>
          <p className="max-w-[378px] text-base text-foreground/80">
            Мы отправили 6-значный код на указанный номер, введите его, чтобы
            завершить регистрацию
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
        <form.Field name="code">
          {(field) => (
            <div className="space-y-1">
              <Input
                autoComplete="one-time-code"
                className="h-10 rounded-lg border-border bg-background px-4 text-sm placeholder:text-muted-foreground"
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
        </form.Field>

        <form.Subscribe>
          {(state) => (
            <Button
              className="h-10 w-full rounded-lg bg-foreground text-background text-sm hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
              disabled={!state.canSubmit || state.isSubmitting}
              type="submit"
            >
              {state.isSubmitting ? "Проверяем..." : "Подтвердить код"}
            </Button>
          )}
        </form.Subscribe>

        <button
          className="inline-flex items-center justify-center gap-1 text-muted-foreground text-xs hover:text-foreground"
          onClick={onBack}
          type="button"
        >
          <ArrowLeftIcon className="size-3" />
          Изменить номер
        </button>
      </form>
    </div>
  );
}
