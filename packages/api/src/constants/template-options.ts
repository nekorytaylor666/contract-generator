// Shared option lists for the template taxonomy. The DB stores these as
// free-form `text[]` / `integer` — the only thing keeping values consistent is
// the UI (filter dropdowns + admin form) reading them from here. If you add a
// new value to a list, both surfaces pick it up automatically.

export const CATEGORY_VALUES = [
  "services",
  "sale",
  "rental",
  "employment",
  "finance",
  "ip",
  "nda",
  "family",
] as const;

export type TemplateCategory = (typeof CATEGORY_VALUES)[number];

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  services: "Услуги и подряд",
  sale: "Купля и продажа",
  rental: "Аренда и найм",
  employment: "Трудовые отношения",
  finance: "Займы и финансы",
  ip: "Интеллектуальная собственность",
  nda: "Конфиденциальность (NDA)",
  family: "Семейные и личные",
};

// TODO: fill in once the user provides the dictionaries.
export const INDUSTRY_VALUES: readonly string[] = [];
export const INDUSTRY_LABELS: Record<string, string> = {};

export const CONTRACT_TYPE_VALUES: readonly string[] = [];
export const CONTRACT_TYPE_LABELS: Record<string, string> = {};

export const PAYMENT_TERMS_VALUES: readonly string[] = [];
export const PAYMENT_TERMS_LABELS: Record<string, string> = {};

export const PARTICIPANT_VALUES: readonly string[] = [];
export const PARTICIPANT_LABELS: Record<string, string> = {};

// Predefined validity buckets for the filter UI. Each bucket maps to a max
// seconds value; NULL handled separately ("indefinite").
const DAY = 86_400;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export interface ValidityBucket {
  id: string;
  label: string;
  maxSeconds: number | null; // null = "more than the largest bucket"
  minSeconds?: number;
  indefinite?: boolean;
}

export const VALIDITY_BUCKETS: ValidityBucket[] = [
  { id: "1m", label: "До 1 месяца", maxSeconds: MONTH },
  { id: "6m", label: "До 6 месяцев", maxSeconds: 6 * MONTH },
  { id: "1y", label: "До 1 года", maxSeconds: YEAR },
  { id: "more", label: "Больше года", maxSeconds: null, minSeconds: YEAR },
  { id: "indefinite", label: "Бессрочный", maxSeconds: null, indefinite: true },
];
