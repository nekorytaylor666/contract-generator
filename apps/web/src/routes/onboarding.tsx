import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import { requireSession } from "@/lib/auth-guard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingComponent,
  beforeLoad: async () => {
    const { session } = await requireSession();

    if (!session) {
      throw redirect({ to: "/login" });
    }

    const { data } = await authClient.organization.list();
    const organizations = data ?? [];

    if (organizations.length > 0) {
      throw redirect({ to: "/dashboard" });
    }

    return { session };
  },
});

const TOTAL_STEPS = 4;

const INDUSTRIES = [
  "IT и технологии",
  "Финансы и банкинг",
  "Недвижимость",
  "Строительство",
  "Торговля",
  "Образование",
  "Медицина",
  "Юриспруденция",
  "Транспорт и логистика",
  "Другое",
];

const CONTRACT_TYPES = [
  "Аренда жилья",
  "Оказание услуг",
  "NDA",
  "Логистика",
  "Семейные",
  "Инвестиционные",
  "Здравоохранительные",
  "Купля-продажа земли",
];

function ProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            i < currentStep ? "bg-primary" : "bg-muted"
          )}
          key={i}
        />
      ))}
    </div>
  );
}

function StepIndustry({
  industry,
  onIndustryChange,
  onNext,
}: {
  industry: string;
  onIndustryChange: (value: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-6">
        <div className="text-center">
          <h1 className="font-bold text-3xl">
            Помогите нам узнать
            <br />
            вас получше!
          </h1>
          <p className="mt-4 text-muted-foreground">
            Отвечая на данные вопросы, вы поможете нам
            <br />
            лучше разрабатывать новые виды договоров.
          </p>
        </div>

        <div className="mx-auto max-w-sm space-y-2">
          <label className="font-medium text-sm" htmlFor="industry-select">
            Из какой вы индустрии?
          </label>
          <Select onValueChange={onIndustryChange} value={industry}>
            <SelectTrigger
              className="h-12 w-full rounded-lg text-sm"
              id="industry-select"
            >
              <SelectValue placeholder="Выберите индустрию" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mx-auto w-full max-w-sm pt-8">
        <Button
          className="h-12 w-full rounded-lg text-sm"
          disabled={!industry}
          onClick={onNext}
        >
          Продолжить
        </Button>
      </div>
    </div>
  );
}

function StepContractTypes({
  selectedTypes,
  onToggleType,
  onNext,
  onBack,
}: {
  selectedTypes: string[];
  onToggleType: (type: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-6">
        <div className="text-center">
          <h1 className="font-bold text-3xl">Подберем договоры</h1>
          <p className="mt-4 text-muted-foreground">
            В Shart представлено более 1000+ договоров,
            <br />
            помогите нам подобрать подходящие для вас!
          </p>
        </div>

        <div className="space-y-3 text-center">
          <p className="font-medium text-sm">Как виды договоров вы ищете?</p>
          <div className="flex flex-wrap justify-center gap-2">
            {CONTRACT_TYPES.map((type) => {
              const isSelected = selectedTypes.includes(type);
              return (
                <button
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  )}
                  key={type}
                  onClick={() => onToggleType(type)}
                  type="button"
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-sm gap-3 pt-8">
        <Button
          className="h-12 flex-1 rounded-lg text-sm"
          onClick={onBack}
          variant="outline"
        >
          Вернуться
        </Button>
        <Button
          className="h-12 flex-1 rounded-lg text-sm"
          disabled={selectedTypes.length === 0}
          onClick={onNext}
        >
          Продолжить
        </Button>
      </div>
    </div>
  );
}

function StepDisclaimer({
  accepted,
  onAcceptedChange,
  onNext,
  onBack,
  isSubmitting,
}: {
  accepted: boolean;
  onAcceptedChange: (value: boolean) => void;
  onNext: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-6">
        <div className="text-center">
          <h1 className="font-bold text-3xl">
            Мы не несем
            <br />
            ответственность
          </h1>
          <p className="mt-4 text-muted-foreground">
            Shart упрощает сбор договора и экономит ваше
            <br />
            время. Помните: проверка и юридическая
            <br />
            ответственность за документ всегда за вами.
          </p>
        </div>

        <div className="mx-auto max-w-sm">
          <label
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
              accepted ? "border-primary bg-primary/5" : "border-border"
            )}
          >
            <Checkbox
              checked={accepted}
              onCheckedChange={(checked) => onAcceptedChange(Boolean(checked))}
            />
            <span className="text-sm">
              Я ознакомился и принимаю правила платформы.
            </span>
          </label>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-sm gap-3 pt-8">
        <Button
          className="h-12 flex-1 rounded-lg text-sm"
          onClick={onBack}
          variant="outline"
        >
          Вернуться
        </Button>
        <Button
          className="h-12 flex-1 rounded-lg text-sm"
          disabled={!accepted || isSubmitting}
          onClick={onNext}
        >
          {isSubmitting ? "Загрузка..." : "Продолжить"}
        </Button>
      </div>
    </div>
  );
}

function OnboardingComponent() {
  const navigate = useNavigate();
  const { session } = Route.useRouteContext();
  const [step, setStep] = useState(1);
  const [industry, setIndustry] = useState("");
  const [selectedContractTypes, setSelectedContractTypes] = useState<string[]>(
    []
  );
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleContractType = (type: string) => {
    setSelectedContractTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    const slug = (session?.user.name || "org")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const result = await authClient.organization.create({
      name: session?.user.name || "My Organization",
      slug: `${slug}-${Date.now()}`,
    });

    if (result.error) {
      toast.error(result.error.message || "Не удалось создать организацию");
      setIsSubmitting(false);
      return;
    }

    toast.success("Добро пожаловать в Shart!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen flex-col px-6 py-12">
      <div className="mx-auto w-full max-w-lg">
        <ProgressBar currentStep={step} />
      </div>

      <div className="mx-auto mt-8 flex w-full max-w-lg flex-1 flex-col">
        {step === 1 && (
          <StepIndustry
            industry={industry}
            onIndustryChange={setIndustry}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepContractTypes
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            onToggleType={toggleContractType}
            selectedTypes={selectedContractTypes}
          />
        )}
        {step === 3 && (
          <StepDisclaimer
            accepted={disclaimerAccepted}
            isSubmitting={isSubmitting}
            onAcceptedChange={setDisclaimerAccepted}
            onBack={() => setStep(2)}
            onNext={handleComplete}
          />
        )}
      </div>
    </div>
  );
}
