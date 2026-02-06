import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { useCommandSearch } from "./command-search-context";

const MOCK_CATEGORIES = [
  { value: "all", label: "Все категории" },
  { value: "contracts", label: "Договора и сделки" },
  { value: "employment", label: "Трудовые договора" },
  { value: "civil", label: "Гражданские договора" },
  { value: "nda", label: "NDA" },
];

const MOCK_JURISDICTIONS = [
  { value: "kz", label: "Казахстан" },
  { value: "ru", label: "Россия" },
  { value: "us", label: "США" },
  { value: "eu", label: "Европейский союз" },
];

const MOCK_LANGUAGES = [
  { value: "kz-ru", label: "Казахский, Русский" },
  { value: "ru", label: "Русский" },
  { value: "en", label: "Английский" },
  { value: "kz", label: "Казахский" },
];

const MOCK_CONTRACT_STAGES = [
  { value: "additional", label: "Дополнительное соглашение" },
  { value: "main", label: "Основной договор" },
  { value: "annex", label: "Приложение" },
];

const MOCK_CONTRACT_TYPES = [
  { value: "deals", label: "Договора и сделки" },
  { value: "services", label: "Услуги" },
  { value: "supply", label: "Поставка" },
];

const MOCK_PAYMENT_TYPES = [
  { value: "fixed", label: "Фиксированная сумма" },
  { value: "hourly", label: "Почасовая оплата" },
  { value: "milestone", label: "По этапам" },
];

const MOCK_CURRENCIES = [
  { value: "kzt", label: "KZT" },
  { value: "rub", label: "RUB" },
  { value: "usd", label: "USD" },
  { value: "eur", label: "EUR" },
];

const MOCK_TAX_OPTIONS = [
  { value: "vat-included", label: "НДС включен в стоимость" },
  { value: "vat-excluded", label: "НДС не включен" },
  { value: "no-vat", label: "Без НДС" },
];

const MOCK_KEY_TERMS = [
  { id: "penalties", label: "Штрафы и неустойки" },
  { id: "force-majeure", label: "Форс-мажоры" },
  { id: "nda", label: "NDA" },
  { id: "unilateral", label: "Односторонний отказ" },
  { id: "termination", label: "Порядок расторжения" },
  { id: "duration", label: "Срок действия договора" },
  { id: "sla", label: "SLA и уровни сервиса" },
  { id: "payment-terms", label: "Предоплата/Постоплата" },
  { id: "ip", label: "Интеллектуальная собственность" },
];

interface FilterState {
  category: string;
  jurisdiction: string;
  language1: string;
  stage1: string;
  stage2: string;
  language2: string;
  paymentType: string;
  currency: string;
  taxes: string;
  selectedTerms: string[];
  minPrice: string;
  maxPrice: string;
  priceCurrency: string;
}

const initialFilterState: FilterState = {
  category: "",
  jurisdiction: "",
  language1: "",
  stage1: "",
  stage2: "",
  language2: "",
  paymentType: "",
  currency: "",
  taxes: "",
  selectedTerms: [],
  minPrice: "",
  maxPrice: "",
  priceCurrency: "kzt",
};

export function CommandSearchDialog() {
  const { isOpen, close } = useCommandSearch();
  const [filters, setFilters] = useState<FilterState>(initialFilterState);

  const handleTermToggle = (termId: string) => {
    setFilters((prev) => ({
      ...prev,
      selectedTerms: prev.selectedTerms.includes(termId)
        ? prev.selectedTerms.filter((id) => id !== termId)
        : [...prev.selectedTerms, termId],
    }));
  };

  const handleClearFilters = () => {
    setFilters(initialFilterState);
  };

  const handleApplyFilters = () => {
    close();
  };

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resultCount = 158;

  return (
    <Dialog onOpenChange={(open) => !open && close()} open={isOpen}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-w-2xl"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="font-semibold text-xl">
            Продвинутый фильтр
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          {/* About Contract Section */}
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="font-medium text-sm">О договоре</h3>
              <p className="text-muted-foreground text-xs">
                Выберите основные характеристики договора: категорию, стороны и
                язык документа.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FilterSelect
                label="Категория договора"
                onChange={(value) => updateFilter("category", value)}
                options={MOCK_CATEGORIES}
                placeholder="Все категории"
                value={filters.category}
              />
              <FilterSelect
                label="Юрисдикция договора"
                onChange={(value) => updateFilter("jurisdiction", value)}
                options={MOCK_JURISDICTIONS}
                placeholder="Выберите"
                value={filters.jurisdiction}
              />
              <FilterSelect
                label="Язык договора"
                onChange={(value) => updateFilter("language1", value)}
                options={MOCK_LANGUAGES}
                placeholder="Выберите"
                value={filters.language1}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FilterSelect
                label="Стадия договора"
                onChange={(value) => updateFilter("stage1", value)}
                options={MOCK_CONTRACT_STAGES}
                placeholder="Выберите"
                value={filters.stage1}
              />
              <FilterSelect
                label="Стадия договора"
                onChange={(value) => updateFilter("stage2", value)}
                options={MOCK_CONTRACT_TYPES}
                placeholder="Выберите"
                value={filters.stage2}
              />
              <FilterSelect
                label="Язык договора"
                onChange={(value) => updateFilter("language2", value)}
                options={MOCK_LANGUAGES}
                placeholder="Выберите"
                value={filters.language2}
              />
            </div>
          </section>

          {/* Commercial Terms Section */}
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="font-medium text-sm">Коммерческие условия</h3>
              <p className="text-muted-foreground text-xs">
                Задайте финансовые параметры договора, чтобы отфильтровать
                документы по сумме.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FilterSelect
                label="Тип оплаты"
                onChange={(value) => updateFilter("paymentType", value)}
                options={MOCK_PAYMENT_TYPES}
                placeholder="Выберите"
                value={filters.paymentType}
              />
              <FilterSelect
                label="Валюта договора"
                onChange={(value) => updateFilter("currency", value)}
                options={MOCK_CURRENCIES}
                placeholder="Выберите"
                value={filters.currency}
              />
              <FilterSelect
                label="Налоги"
                onChange={(value) => updateFilter("taxes", value)}
                options={MOCK_TAX_OPTIONS}
                placeholder="Выберите"
                value={filters.taxes}
              />
            </div>
          </section>

          {/* Key Contract Terms Section */}
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="font-medium text-sm">Ключевые условия договора</h3>
              <p className="text-muted-foreground text-xs">
                Отметьте условия, которые должны быть включены в договор.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {MOCK_KEY_TERMS.map((term) => {
                const isSelected = filters.selectedTerms.includes(term.id);
                return (
                  <Badge
                    className="h-7 cursor-pointer px-3 text-xs"
                    key={term.id}
                    onClick={() => handleTermToggle(term.id)}
                    variant={isSelected ? "default" : "outline"}
                  >
                    {term.label}
                  </Badge>
                );
              })}
            </div>
          </section>

          {/* Contract Cost Section */}
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="font-medium text-sm">Стоимость договора</h3>
              <p className="text-muted-foreground text-xs">
                Укажите минимальную и максимальную стоимость шаблона договора.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-muted-foreground text-xs">
                  Минимальная цена
                </Label>
                <div className="flex gap-2">
                  <Select
                    onValueChange={(value) =>
                      updateFilter("priceCurrency", value)
                    }
                    value={filters.priceCurrency}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_CURRENCIES.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-xs">
                      ₸
                    </span>
                    <Input
                      className="pl-6 text-right"
                      onChange={(e) => updateFilter("minPrice", e.target.value)}
                      placeholder="5 000"
                      type="text"
                      value={filters.minPrice}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-muted-foreground text-xs">
                  Максимальная цена
                </Label>
                <div className="flex gap-2">
                  <Select
                    onValueChange={(value) =>
                      updateFilter("priceCurrency", value)
                    }
                    value={filters.priceCurrency}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_CURRENCIES.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-xs">
                      ₸
                    </span>
                    <Input
                      className="pl-6 text-right"
                      onChange={(e) => updateFilter("maxPrice", e.target.value)}
                      placeholder="15 000"
                      type="text"
                      value={filters.maxPrice}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="mt-4 flex flex-row items-center justify-between sm:justify-between">
          <Button onClick={handleClearFilters} variant="outline">
            Очистить фильтры
          </Button>
          <Button onClick={handleApplyFilters}>
            Показать {resultCount} договоров
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      <Select onValueChange={onChange} value={value}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
