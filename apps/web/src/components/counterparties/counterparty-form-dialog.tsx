import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTRPC } from "@/utils/trpc";

export interface CounterpartyRecord {
  id: string;
  name: string;
  type: string;
  bin: string;
  address: string;
  phone: string;
  email: string;
  bank: string;
  iban: string;
  bik: string;
  kbe: string;
  knp: string;
  signatory: string;
  position: string;
  basis: string;
}

type CounterpartyDraft = Omit<CounterpartyRecord, "id">;

const EMPTY_DRAFT: CounterpartyDraft = {
  name: "",
  type: "",
  bin: "",
  address: "",
  phone: "",
  email: "",
  bank: "",
  iban: "",
  bik: "",
  kbe: "",
  knp: "",
  signatory: "",
  position: "",
  basis: "",
};

const COUNTERPARTY_TYPES = ["ТОО", "ИП", "АО"] as const;

// Шаги мастера по макету: организация → контакты → банк → подписант.
const STEPS = ["about", "contact", "bank", "person"] as const;
type StepId = (typeof STEPS)[number];

const STEP_TITLES: Record<StepId, string> = {
  about: "Об организации",
  contact: "Контактные данные",
  bank: "Банковские реквизиты",
  person: "Подписант",
};

const STEP_FIELDS: Record<StepId, (keyof CounterpartyDraft)[]> = {
  about: ["name", "bin", "type"],
  contact: ["address", "phone", "email"],
  bank: ["bank", "iban", "bik", "kbe", "knp"],
  person: ["signatory", "position", "basis"],
};

const BIN_LENGTH = 12;
const KZ_PHONE_DIGITS = 10;
const MIN_NAME_LENGTH = 3;
const MIN_ADDRESS_LENGTH = 5;
const MIN_TEXT_LENGTH = 2;
const FIO_MIN_PARTS = 2;
const IBAN_GROUP_RE = /.{1,4}/g;
const IBAN_RE = /^KZ[A-Z0-9]{18}$/;
const BIK_RE = /^[A-Z0-9]{8}(?:[A-Z0-9]{3})?$/;
const KBE_RE = /^\d{2}$/;
const KNP_RE = /^\d{3}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NON_DIGIT_RE = /\D/g;
const SPACE_RE = /\s+/g;

// Цифры номера без кода страны: «+7» из маски отрезаем по префиксу строки,
// а ведущий 7/8 отбрасываем только у полного 11-значного номера — иначе
// первая набранная семёрка (700, 707, 747…) съедалась бы на каждом вводе.
function extractKzDigits(value: string): string {
  const withoutMask = value.startsWith("+7") ? value.slice(2) : value;
  let digits = withoutMask.replace(NON_DIGIT_RE, "");
  if (
    digits.length > KZ_PHONE_DIGITS &&
    (digits.startsWith("7") || digits.startsWith("8"))
  ) {
    digits = digits.slice(1);
  }
  return digits.slice(0, KZ_PHONE_DIGITS);
}

// «+7 (727) 312-44-90» — формат из макета, добивается по мере ввода.
function formatKzDigits(digits: string): string {
  if (digits.length === 0) {
    return "";
  }
  let out = `+7 (${digits.slice(0, 3)}`;
  if (digits.length >= 3) {
    out += ")";
  }
  if (digits.length > 3) {
    out += ` ${digits.slice(3, 6)}`;
  }
  if (digits.length > 6) {
    out += `-${digits.slice(6, 8)}`;
  }
  if (digits.length > 8) {
    out += `-${digits.slice(8, 10)}`;
  }
  return out;
}

// «KZ48 5600 0000 0041 7852» — группы по 4 символа для читаемости.
function formatIban(value: string): string {
  const raw = value.replace(SPACE_RE, "").toUpperCase().slice(0, 20);
  return raw.match(IBAN_GROUP_RE)?.join(" ") ?? "";
}

// Тексты ошибок — из макета, по одному валидатору на поле.
const VALIDATORS: Record<
  keyof CounterpartyDraft,
  (value: string) => string | null
> = {
  name: (value) =>
    value.length < MIN_NAME_LENGTH
      ? "Введите полное наименование организации"
      : null,
  bin: (value) =>
    value.length === BIN_LENGTH ? null : "БИН должен содержать ровно 12 цифр",
  type: (value) => (value ? null : "Выберите тип организации"),
  address: (value) =>
    value.length < MIN_ADDRESS_LENGTH
      ? "Введите юридический адрес организации"
      : null,
  phone: (value) =>
    value.replace(NON_DIGIT_RE, "").length === KZ_PHONE_DIGITS + 1
      ? null
      : "Введите номер в формате +7 (___) ___-__-__",
  email: (value) =>
    EMAIL_RE.test(value) ? null : "Введите корректный адрес электронной почты",
  bank: (value) =>
    value.length < MIN_NAME_LENGTH ? "Введите полное наименование банка" : null,
  iban: (value) =>
    IBAN_RE.test(value.replace(SPACE_RE, ""))
      ? null
      : "IBAN должен начинаться с KZ и содержать 20 символов",
  bik: (value) =>
    BIK_RE.test(value) ? null : "БИК должен содержать 8 или 11 символов",
  kbe: (value) => (KBE_RE.test(value) ? null : "КБе должен содержать 2 цифры"),
  knp: (value) => (KNP_RE.test(value) ? null : "КНП должен содержать 3 цифры"),
  signatory: (value) =>
    value.split(SPACE_RE).length < FIO_MIN_PARTS
      ? "Введите полное ФИО — фамилию, имя и отчество"
      : null,
  position: (value) =>
    value.length < MIN_TEXT_LENGTH ? "Введите должность подписанта" : null,
  basis: (value) =>
    value.length < MIN_TEXT_LENGTH
      ? "Укажите основание — Устав или номер доверенности"
      : null,
};

function validateField(
  key: keyof CounterpartyDraft,
  draft: CounterpartyDraft
): string | null {
  return VALIDATORS[key](draft[key].trim());
}

function toDraft(record: CounterpartyRecord): CounterpartyDraft {
  const { id: _id, ...fields } = record;
  // В БД IBAN хранится слитно — в форме показываем группами по 4.
  return { ...fields, iban: formatIban(fields.iban) };
}

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <p className="flex items-center gap-1.5 text-destructive text-xs" id={id}>
      <CircleAlert className="size-3.5 shrink-0" />
      {message}
    </p>
  );
}

function SuccessContent() {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100">
        <Check className="size-6 text-emerald-600" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-base text-foreground">
          Контрагент добавлен!
        </p>
        <p className="max-w-[260px] text-muted-foreground text-sm">
          Реквизиты сохранены и доступны при заполнении договоров.
        </p>
      </div>
    </div>
  );
}

interface StepProps {
  draft: CounterpartyDraft;
  errorFor: (key: keyof CounterpartyDraft) => string | null;
  setField: (key: keyof CounterpartyDraft, value: string) => void;
  touch: (key: keyof CounterpartyDraft) => void;
}

function AboutStep({ draft, errorFor, setField, touch }: StepProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-name">Наименование</Label>
        <Input
          aria-describedby={errorFor("name") ? "cp-name-error" : undefined}
          aria-invalid={Boolean(errorFor("name"))}
          className="h-9 text-sm"
          id="cp-name"
          onBlur={() => touch("name")}
          onChange={(e) => setField("name", e.target.value)}
          placeholder="ТОО «Название компании»"
          value={draft.name}
        />
        <FieldError id="cp-name-error" message={errorFor("name")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-bin">БИН</Label>
        <Input
          aria-describedby={errorFor("bin") ? "cp-bin-error" : undefined}
          aria-invalid={Boolean(errorFor("bin"))}
          className="h-9 text-sm"
          id="cp-bin"
          inputMode="numeric"
          onBlur={() => touch("bin")}
          onChange={(e) =>
            setField(
              "bin",
              e.target.value.replace(NON_DIGIT_RE, "").slice(0, BIN_LENGTH)
            )
          }
          placeholder="000000000000"
          value={draft.bin}
        />
        <FieldError id="cp-bin-error" message={errorFor("bin")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-type">Тип</Label>
        <Select
          onValueChange={(value) => {
            setField("type", value);
            touch("type");
          }}
          value={draft.type || undefined}
        >
          <SelectTrigger
            aria-describedby={errorFor("type") ? "cp-type-error" : undefined}
            aria-invalid={Boolean(errorFor("type"))}
            className="h-9 w-full text-sm"
            id="cp-type"
            onBlur={() => touch("type")}
          >
            <SelectValue placeholder="Выберите тип" />
          </SelectTrigger>
          <SelectContent>
            {COUNTERPARTY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id="cp-type-error" message={errorFor("type")} />
      </div>
    </>
  );
}

function ContactStep({
  draft,
  errorFor,
  onPhoneChange,
  setField,
  touch,
}: StepProps & { onPhoneChange: (raw: string) => void }) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-address">Юридический адрес</Label>
        <Input
          aria-describedby={
            errorFor("address") ? "cp-address-error" : undefined
          }
          aria-invalid={Boolean(errorFor("address"))}
          className="h-9 text-sm"
          id="cp-address"
          onBlur={() => touch("address")}
          onChange={(e) => setField("address", e.target.value)}
          placeholder="Город, Улица, Дом/Офис, Квартира/Номер"
          value={draft.address}
        />
        <FieldError id="cp-address-error" message={errorFor("address")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-phone">Номер телефона</Label>
        <Input
          aria-describedby={errorFor("phone") ? "cp-phone-error" : undefined}
          aria-invalid={Boolean(errorFor("phone"))}
          className="h-9 text-sm"
          id="cp-phone"
          inputMode="tel"
          onBlur={() => touch("phone")}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="+7 (___) ___-__-__"
          value={draft.phone}
        />
        <FieldError id="cp-phone-error" message={errorFor("phone")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-email">Электронная почта</Label>
        <Input
          aria-describedby={errorFor("email") ? "cp-email-error" : undefined}
          aria-invalid={Boolean(errorFor("email"))}
          className="h-9 text-sm"
          id="cp-email"
          inputMode="email"
          onBlur={() => touch("email")}
          onChange={(e) => setField("email", e.target.value)}
          placeholder="info@company.kz"
          value={draft.email}
        />
        <FieldError id="cp-email-error" message={errorFor("email")} />
      </div>
    </>
  );
}

function BankStep({ draft, errorFor, setField, touch }: StepProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-bank">Банк</Label>
        <Input
          aria-describedby={errorFor("bank") ? "cp-bank-error" : undefined}
          aria-invalid={Boolean(errorFor("bank"))}
          className="h-9 text-sm"
          id="cp-bank"
          onBlur={() => touch("bank")}
          onChange={(e) => setField("bank", e.target.value)}
          placeholder="Наименование банка"
          value={draft.bank}
        />
        <FieldError id="cp-bank-error" message={errorFor("bank")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-iban">IBAN</Label>
        <Input
          aria-describedby={errorFor("iban") ? "cp-iban-error" : undefined}
          aria-invalid={Boolean(errorFor("iban"))}
          className="h-9 text-sm"
          id="cp-iban"
          onBlur={() => touch("iban")}
          onChange={(e) => setField("iban", formatIban(e.target.value))}
          placeholder="KZ00 0000 0000 0000 0000"
          value={draft.iban}
        />
        <FieldError id="cp-iban-error" message={errorFor("iban")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-bik">БИК</Label>
        <Input
          aria-describedby={errorFor("bik") ? "cp-bik-error" : undefined}
          aria-invalid={Boolean(errorFor("bik"))}
          className="h-9 text-sm"
          id="cp-bik"
          onBlur={() => touch("bik")}
          onChange={(e) =>
            setField("bik", e.target.value.toUpperCase().slice(0, 11))
          }
          placeholder="XXXXXXXXX"
          value={draft.bik}
        />
        <FieldError id="cp-bik-error" message={errorFor("bik")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cp-kbe">КБе</Label>
          <Input
            aria-describedby={errorFor("kbe") ? "cp-kbe-error" : undefined}
            aria-invalid={Boolean(errorFor("kbe"))}
            className="h-9 text-sm"
            id="cp-kbe"
            inputMode="numeric"
            onBlur={() => touch("kbe")}
            onChange={(e) =>
              setField(
                "kbe",
                e.target.value.replace(NON_DIGIT_RE, "").slice(0, 2)
              )
            }
            placeholder="00"
            value={draft.kbe}
          />
          <FieldError id="cp-kbe-error" message={errorFor("kbe")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cp-knp">КНП</Label>
          <Input
            aria-describedby={errorFor("knp") ? "cp-knp-error" : undefined}
            aria-invalid={Boolean(errorFor("knp"))}
            className="h-9 text-sm"
            id="cp-knp"
            inputMode="numeric"
            onBlur={() => touch("knp")}
            onChange={(e) =>
              setField(
                "knp",
                e.target.value.replace(NON_DIGIT_RE, "").slice(0, 3)
              )
            }
            placeholder="000"
            value={draft.knp}
          />
          <FieldError id="cp-knp-error" message={errorFor("knp")} />
        </div>
      </div>
    </>
  );
}

function PersonStep({ draft, errorFor, setField, touch }: StepProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-signatory">ФИО</Label>
        <Input
          aria-describedby={
            errorFor("signatory") ? "cp-signatory-error" : undefined
          }
          aria-invalid={Boolean(errorFor("signatory"))}
          className="h-9 text-sm"
          id="cp-signatory"
          onBlur={() => touch("signatory")}
          onChange={(e) => setField("signatory", e.target.value)}
          placeholder="Фамилия Имя Отчество"
          value={draft.signatory}
        />
        <FieldError id="cp-signatory-error" message={errorFor("signatory")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-position">Должность</Label>
        <Input
          aria-describedby={
            errorFor("position") ? "cp-position-error" : undefined
          }
          aria-invalid={Boolean(errorFor("position"))}
          className="h-9 text-sm"
          id="cp-position"
          onBlur={() => touch("position")}
          onChange={(e) => setField("position", e.target.value)}
          placeholder="Генеральный директор"
          value={draft.position}
        />
        <FieldError id="cp-position-error" message={errorFor("position")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-basis">Действует на основании</Label>
        <Input
          aria-describedby={errorFor("basis") ? "cp-basis-error" : undefined}
          aria-invalid={Boolean(errorFor("basis"))}
          className="h-9 text-sm"
          id="cp-basis"
          onBlur={() => touch("basis")}
          onChange={(e) => setField("basis", e.target.value)}
          placeholder="Устава / Доверенности №_ от"
          value={draft.basis}
        />
        <FieldError id="cp-basis-error" message={errorFor("basis")} />
      </div>
    </>
  );
}

interface CounterpartyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // null — создание нового, иначе редактирование с префиллом.
  counterparty: CounterpartyRecord | null;
}

export function CounterpartyFormDialog({
  open,
  onOpenChange,
  counterparty,
}: CounterpartyFormDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<StepId>("about");
  const [showSuccess, setShowSuccess] = useState(false);
  const [draft, setDraft] = useState<CounterpartyDraft>(EMPTY_DRAFT);
  const [touched, setTouched] = useState<Set<keyof CounterpartyDraft>>(
    new Set()
  );

  useEffect(() => {
    if (open) {
      setStep("about");
      setShowSuccess(false);
      setDraft(counterparty ? toDraft(counterparty) : EMPTY_DRAFT);
      setTouched(new Set());
    }
  }, [open, counterparty]);

  const invalidate = () =>
    queryClient.invalidateQueries(trpc.counterparties.list.queryFilter());

  const createMut = useMutation(
    trpc.counterparties.create.mutationOptions({
      onSuccess: () => {
        invalidate();
        setShowSuccess(true);
      },
      onError: (err) => toast.error(err.message),
    })
  );
  const updateMut = useMutation(
    trpc.counterparties.update.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Изменения сохранены");
        onOpenChange(false);
      },
      onError: (err) => toast.error(err.message),
    })
  );
  const pending = createMut.isPending || updateMut.isPending;

  const setField = (key: keyof CounterpartyDraft, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));
  const touch = (key: keyof CounterpartyDraft) =>
    setTouched((prev) => new Set(prev).add(key));
  const errorFor = (key: keyof CounterpartyDraft) =>
    touched.has(key) ? validateField(key, draft) : null;

  const handlePhoneChange = (raw: string) => {
    let digits = extractKzDigits(raw);
    // Backspace стёр только символ маски («)», «-», пробел): форматтер вернул
    // бы ту же строку и удаление «не работало» — убираем и последнюю цифру.
    if (
      raw.length < draft.phone.length &&
      formatKzDigits(digits) === draft.phone
    ) {
      digits = digits.slice(0, -1);
    }
    setField("phone", formatKzDigits(digits));
  };

  const stepIndex = STEPS.indexOf(step);
  const stepValid = STEP_FIELDS[step].every(
    (key) => validateField(key, draft) === null
  );

  const goBack = () => setStep(STEPS[stepIndex - 1]);
  const goNext = () => {
    if (!stepValid) {
      return;
    }
    if (stepIndex < STEPS.length - 1) {
      setStep(STEPS[stepIndex + 1]);
      return;
    }
    save();
  };

  const save = () => {
    const payload = {
      name: draft.name.trim(),
      type: draft.type as (typeof COUNTERPARTY_TYPES)[number],
      bin: draft.bin.trim(),
      address: draft.address.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      bank: draft.bank.trim(),
      iban: draft.iban.replace(SPACE_RE, "").toUpperCase(),
      bik: draft.bik.trim().toUpperCase(),
      kbe: draft.kbe.trim(),
      knp: draft.knp.trim(),
      signatory: draft.signatory.trim(),
      position: draft.position.trim(),
      basis: draft.basis.trim(),
    };
    if (counterparty) {
      updateMut.mutate({ id: counterparty.id, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const isLastStep = stepIndex === STEPS.length - 1;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>
            {showSuccess ? "Добавление контрагента" : STEP_TITLES[step]}
          </DialogTitle>
        </DialogHeader>

        {showSuccess && <SuccessContent />}

        {!showSuccess && (
          <>
            <div className="flex flex-col gap-3">
              {step === "about" && (
                <AboutStep
                  draft={draft}
                  errorFor={errorFor}
                  setField={setField}
                  touch={touch}
                />
              )}

              {step === "contact" && (
                <ContactStep
                  draft={draft}
                  errorFor={errorFor}
                  onPhoneChange={handlePhoneChange}
                  setField={setField}
                  touch={touch}
                />
              )}

              {step === "bank" && (
                <BankStep
                  draft={draft}
                  errorFor={errorFor}
                  setField={setField}
                  touch={touch}
                />
              )}

              {step === "person" && (
                <PersonStep
                  draft={draft}
                  errorFor={errorFor}
                  setField={setField}
                  touch={touch}
                />
              )}
            </div>

            <DialogFooter>
              {stepIndex === 0 ? (
                <Button
                  className="h-9 px-4 text-sm"
                  onClick={() => onOpenChange(false)}
                  type="button"
                  variant="outline"
                >
                  Отменить
                </Button>
              ) : (
                <Button
                  className="h-9 px-4 text-sm"
                  disabled={pending}
                  onClick={goBack}
                  type="button"
                  variant="outline"
                >
                  Назад
                </Button>
              )}
              <Button
                className="h-9 px-4 text-sm"
                disabled={!stepValid || pending}
                onClick={goNext}
                type="button"
              >
                {isLastStep && pending && (
                  <>
                    Сохраняем
                    <LoaderCircle className="size-4 animate-spin" />
                  </>
                )}
                {isLastStep && !pending && "Сохранить"}
                {!isLastStep && "Продолжить"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
