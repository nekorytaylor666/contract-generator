import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { Briefcase, Building2, Hash, UserRound } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import z from "zod";

import { useTRPC } from "@/utils/trpc";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ZhebeMark } from "./zhebe-logo";

const BIN_RE = /^\d{12}$/;
const BIN_LENGTH = 12;
const ORG_STEP = { current: 2, total: 2 } as const;

const makeOrgSchema = (t: TFunction) =>
  z.object({
    orgName: z.string().min(1, t("auth.signUp.org.orgNameRequired")),
    bin: z.string().regex(BIN_RE, t("auth.signUp.org.binInvalid")),
    fullName: z.string().min(1, t("auth.signUp.org.fullNameRequired")),
    position: z.string().min(1, t("auth.signUp.org.positionRequired")),
  });

export function SignUpOrgForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const orgSchema = useMemo(() => makeOrgSchema(t), [t]);
  const trpc = useTRPC();
  const completeOrgStepMutation = useMutation(
    trpc.auth.completeOrgStep.mutationOptions()
  );

  const form = useForm({
    defaultValues: { orgName: "", bin: "", fullName: "", position: "" },
    onSubmit: async ({ value }) => {
      try {
        await completeOrgStepMutation.mutateAsync(value);
        onDone();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : t("auth.signUp.common.createAccountFailed")
        );
      }
    },
    validators: { onSubmit: orgSchema },
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-6">
        <ZhebeMark className="h-10 w-auto text-landing" />
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-medium text-3xl text-foreground">
            {t("auth.signUp.common.title")}
          </h1>
          <p className="text-base text-foreground/80">
            {t("auth.signUp.common.step", ORG_STEP)}
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
        <form.Field name="orgName">
          {(field) => (
            <FieldRow
              autoComplete="organization"
              error={field.state.meta.errors[0]?.message}
              icon={Building2}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(v) => field.handleChange(v)}
              placeholder={t("auth.signUp.org.orgNamePlaceholder")}
              value={field.state.value}
            />
          )}
        </form.Field>

        <form.Field name="bin">
          {(field) => (
            <FieldRow
              autoComplete="off"
              error={field.state.meta.errors[0]?.message}
              icon={Hash}
              inputMode="numeric"
              maxLength={BIN_LENGTH}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(v) => field.handleChange(v.replace(/\D/g, ""))}
              placeholder={t("auth.signUp.org.binPlaceholder")}
              value={field.state.value}
            />
          )}
        </form.Field>

        <form.Field name="fullName">
          {(field) => (
            <FieldRow
              autoComplete="name"
              error={field.state.meta.errors[0]?.message}
              icon={UserRound}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(v) => field.handleChange(v)}
              placeholder={t("auth.signUp.org.fullNamePlaceholder")}
              value={field.state.value}
            />
          )}
        </form.Field>

        <form.Field name="position">
          {(field) => (
            <FieldRow
              autoComplete="organization-title"
              error={field.state.meta.errors[0]?.message}
              icon={Briefcase}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(v) => field.handleChange(v)}
              placeholder={t("auth.signUp.org.positionPlaceholder")}
              value={field.state.value}
            />
          )}
        </form.Field>

        <form.Subscribe>
          {(state) => (
            <Button
              className="h-10 w-full rounded-lg bg-foreground text-background text-sm hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
              disabled={!state.canSubmit || state.isSubmitting}
              type="submit"
            >
              {state.isSubmitting
                ? t("auth.signUp.common.creating")
                : t("auth.signUp.common.createAccount")}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}

function FieldRow({
  autoComplete,
  error,
  icon: Icon,
  inputMode,
  maxLength,
  name,
  onBlur,
  onChange,
  placeholder,
  value,
}: {
  autoComplete: string;
  error: string | undefined;
  icon: typeof Building2;
  inputMode?: "numeric";
  maxLength?: number;
  name: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <div className="relative">
        <Icon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoComplete={autoComplete}
          className="h-10 rounded-lg border-border bg-background pr-4 pl-9 text-sm placeholder:text-muted-foreground"
          inputMode={inputMode}
          maxLength={maxLength}
          name={name}
          onBlur={onBlur}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          value={value}
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
}
