import type { CounterpartyRecord } from "@/components/counterparties/counterparty-form-dialog";
import {
  type CounterpartyBinding,
  type CounterpartyColumn,
  isNativeTypst,
  parseNativeSections,
} from "@/lib/native-typst";
import type { TemplateVariable } from "@/routes/templates";

// Маппинг «поле шаблона → колонка контрагента». Нативные (snake_case) правила
// упорядочены по специфичности: first match wins, `_bank_name` раньше `_name`,
// `_authority_type` раньше `_type`.
const NATIVE_SUFFIX_RULES: readonly (readonly [string, CounterpartyColumn])[] =
  [
    ["_bank_name", "bank"],
    ["_representative_role", "position"],
    ["_representative", "signatory"],
    ["_position", "position"],
    ["_fio", "signatory"],
    ["_signatory", "signatory"],
    ["_iban", "iban"],
    ["_iik", "iban"],
    ["_bik", "bik"],
    ["_kbe", "kbe"],
    ["_knp", "knp"],
    ["_bin", "bin"],
    ["_iin", "bin"],
    ["_address", "address"],
    ["_phone", "phone"],
    ["_email", "email"],
    ["_authority_type", "basis"],
    ["_basis", "basis"],
    ["_bank", "bank"],
    ["_type", "type"],
    ["_name", "name"],
  ];

// Поля документов-оснований, оканчивающиеся на name/number, но не имеющие
// отношения к реквизитам контрагента: «Наименование иного документа»,
// «Орган, выдавший талон». Без явного исключения generic-правило "name"
// записало бы в них наименование контрагента.
const LEGACY_SKIP_SUFFIXES: readonly string[] = [
  "otherdocname",
  "talonorgname",
];

// Легаси-шаблоны ({{camelCase}}): суффикс сравнивается с остатком имени после
// префикса роли, в нижнем регистре (landlordBankName → "bankname").
const LEGACY_SUFFIX_RULES: readonly (readonly [string, CounterpartyColumn])[] =
  [
    ["bankname", "bank"],
    ["companyname", "name"],
    ["ipname", "name"],
    ["authdoctype", "basis"],
    ["representative", "signatory"],
    ["fio", "signatory"],
    ["position", "position"],
    ["iik", "iban"],
    ["iban", "iban"],
    ["bik", "bik"],
    ["kbe", "kbe"],
    ["knp", "knp"],
    ["bin", "bin"],
    ["iin", "bin"],
    ["address", "address"],
    ["phone", "phone"],
    ["email", "email"],
    ["type", "type"],
    ["name", "name"],
  ];

// Роли сторон в легаси-шаблонах: префикс имени переменной → подпись пикера.
const LEGACY_ROLES: readonly (readonly [string, string])[] = [
  ["supplier", "Поставщик"],
  ["buyer", "Покупатель"],
  ["landlord", "Арендодатель"],
  ["tenant", "Арендатор"],
  ["client", "Клиент"],
  ["contractor", "Подрядчик"],
  ["customer", "Заказчик"],
  ["employer", "Работодатель"],
  // «employee» намеренно нет: работник — всегда физлицо, его личные поля
  // (ФИО, ИИН) нельзя заполнять реквизитами организации из справочника.
  ["executor", "Исполнитель"],
  ["creditor", "Кредитор"],
  ["debtor", "Должник"],
  ["principal", "Доверитель"],
];

// Роль считается стороной договора, если у неё нашлось хотя бы два
// смапленных поля — одиночные совпадения вроде clientComment не в счёт.
const MIN_LEGACY_FIELDS = 2;

// Значения type-селектов в шаблонах (ru + kk) ↔ тип контрагента ТОО/ИП/АО.
const LEGAL_ENTITY_OPTIONS: readonly string[] = [
  "Юридическое лицо",
  "Заңды тұлға",
];
const SOLE_PROPRIETOR_OPTIONS: readonly string[] = [
  "Индивидуальный предприниматель",
  "Жеке кәсіпкер",
];
const PHYSICAL_PERSON_OPTIONS: readonly string[] = [
  "Физическое лицо",
  "Жеке тұлға",
];
const USTAV_STEM_REGEX = /устав/i;
const PROXY_STEM_REGEX = /доверенн/i;
const BIN_VALUE_REGEX = /^\d{12}$/;

/** Ключ хранения выбранного контрагента в variables документа. */
export function counterpartyStorageKey(
  binding: CounterpartyBinding
): string | null {
  const first = binding.allFields[0];
  return first ? `__counterparty__${first}` : null;
}

/** Ключ хранения для легаси-роли (секций нет — ключ по имени роли). */
export function legacyStorageKey(role: string): string {
  return `__counterparty__${role}`;
}

/** Колонка контрагента по суффиксной конвенции нативных имён. */
export function conventionColumn(fieldName: string): CounterpartyColumn | null {
  const lower = fieldName.toLowerCase();
  const rule = NATIVE_SUFFIX_RULES.find(([suffix]) => lower.endsWith(suffix));
  return rule ? rule[1] : null;
}

/** Итоговый маппинг привязанной секции: конвенция + явные оверрайды. */
export function resolveSectionMapping(
  binding: CounterpartyBinding
): Record<string, CounterpartyColumn> {
  const mapping: Record<string, CounterpartyColumn> = {};
  for (const field of binding.allFields) {
    const explicit = binding.fieldColumns[field];
    if (explicit === "none") {
      continue;
    }
    const column = explicit ?? conventionColumn(field);
    if (column) {
      mapping[field] = column;
    }
  }
  return mapping;
}

export interface LegacyParty {
  role: string;
  label: string;
  mapping: Record<string, CounterpartyColumn>;
}

// Колонка для поля роли: snake_case-имена (нативный шаблон без секций)
// маппим нативной суффиксной таблицей — легаси-суффиксы вроде "bankname"
// не совпадают с "_bank_name" и вели бы к ложному generic-совпадению "name".
function legacyColumnForRest(
  fullName: string,
  rest: string
): CounterpartyColumn | null {
  if (fullName.includes("_")) {
    return conventionColumn(fullName);
  }
  if (LEGACY_SKIP_SUFFIXES.some((suffix) => rest.endsWith(suffix))) {
    return null;
  }
  const rule = LEGACY_SUFFIX_RULES.find(([suffix]) => rest.endsWith(suffix));
  return rule ? rule[1] : null;
}

/** Стороны легаси-шаблона: роли по префиксам имён переменных. */
export function detectLegacyParties(
  variables: readonly TemplateVariable[]
): LegacyParty[] {
  const parties: LegacyParty[] = [];
  for (const [role, label] of LEGACY_ROLES) {
    const mapping: Record<string, CounterpartyColumn> = {};
    for (const variable of variables) {
      if (!variable.name.startsWith(role)) {
        continue;
      }
      const rest = variable.name.slice(role.length).toLowerCase();
      if (!rest) {
        continue;
      }
      const column = legacyColumnForRest(variable.name, rest);
      if (column) {
        mapping[variable.name] = column;
      }
    }
    if (Object.keys(mapping).length >= MIN_LEGACY_FIELDS) {
      parties.push({ role, label, mapping });
    }
  }
  return parties;
}

function translateTypeOption(
  cpType: string,
  options: readonly string[]
): string | undefined {
  // «Физическое лицо» никогда не выбирается автоматически.
  const synonyms =
    cpType === "ИП" ? SOLE_PROPRIETOR_OPTIONS : LEGAL_ENTITY_OPTIONS;
  return options.find((option) => synonyms.includes(option));
}

function translateBasisOption(
  basis: string,
  options: readonly string[]
): string | undefined {
  if (USTAV_STEM_REGEX.test(basis)) {
    return options.find((option) => USTAV_STEM_REGEX.test(option));
  }
  if (PROXY_STEM_REGEX.test(basis)) {
    return options.find((option) => PROXY_STEM_REGEX.test(option));
  }
  return undefined;
}

/**
 * Значение колонки контрагента для конкретной переменной шаблона.
 * `undefined` — поле пропускается (никогда не затираем ввод пустым и не
 * ставим селекту значение вне его options: `#if` сравнивает байт-в-байт).
 */
export function counterpartyFieldValue(
  variable: TemplateVariable | undefined,
  column: CounterpartyColumn,
  cp: CounterpartyRecord
): string | undefined {
  const raw = cp[column].trim();
  if (!raw) {
    return undefined;
  }
  if (!variable) {
    // Переменная скрытой ветки: текст писать безопасно, селекты без списка
    // опций (type/basis) — нет.
    return column === "type" || column === "basis" ? undefined : raw;
  }
  if (variable.type !== "select" || !variable.options) {
    return raw;
  }
  if (variable.options.includes(raw)) {
    return raw;
  }
  if (column === "type") {
    return translateTypeOption(raw, variable.options);
  }
  if (column === "basis") {
    return translateBasisOption(raw, variable.options);
  }
  return undefined;
}

/** Батч значений для префилла секции выбранным контрагентом. */
export function buildPrefillValues(
  mapping: Record<string, CounterpartyColumn>,
  variablesByName: ReadonlyMap<string, TemplateVariable>,
  cp: CounterpartyRecord
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [field, column] of Object.entries(mapping)) {
    const value = counterpartyFieldValue(
      variablesByName.get(field),
      column,
      cp
    );
    if (value !== undefined) {
      values[field] = value;
    }
  }
  return values;
}

export interface CounterpartyDraft {
  name: string;
  type?: "ТОО" | "ИП" | "АО";
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

// Обратный перевод значения type-селекта шаблона в тип контрагента;
// "skip" — физлицо, в справочник не сохраняем.
function reverseType(
  value: string | undefined
): "ТОО" | "ИП" | "АО" | "skip" | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "ТОО" || value === "ИП" || value === "АО") {
    return value;
  }
  if (SOLE_PROPRIETOR_OPTIONS.includes(value)) {
    return "ИП";
  }
  if (LEGAL_ENTITY_OPTIONS.includes(value)) {
    return "ТОО";
  }
  if (PHYSICAL_PERSON_OPTIONS.includes(value)) {
    return "skip";
  }
  return undefined;
}

export interface PartyBinding {
  storageKey: string;
  label: string;
  mapping: Record<string, CounterpartyColumn>;
}

/**
 * Все стороны шаблона одним списком — тем же правилом, по которому форма
 * показывает пикеры: у нативного шаблона с секциями — только секции с
 * `// @counterparty`; без секций (легаси и нативные без маркеров) — роли по
 * префиксам имён переменных.
 */
export function collectPartyBindings(
  typstContent: string,
  variables: readonly TemplateVariable[]
): PartyBinding[] {
  const sections = isNativeTypst(typstContent)
    ? parseNativeSections(typstContent)
    : [];
  if (sections.length > 0) {
    const bound: PartyBinding[] = [];
    for (const section of sections) {
      const binding = section.counterparty;
      if (!binding) {
        continue;
      }
      const storageKey = counterpartyStorageKey(binding);
      if (!storageKey) {
        continue;
      }
      const mapping = resolveSectionMapping(binding);
      if (Object.keys(mapping).length > 0) {
        bound.push({ storageKey, label: section.title, mapping });
      }
    }
    return bound;
  }
  return detectLegacyParties(variables).map((party) => ({
    storageKey: legacyStorageKey(party.role),
    label: party.label,
    mapping: party.mapping,
  }));
}

// Первое заполненное поле каждой колонки побеждает (колонка может быть
// смаплена на несколько полей, напр. `_req_iik` и `_req_iban`).
function collectColumnValues(
  mapping: Record<string, CounterpartyColumn>,
  values: Record<string, unknown>
): Partial<Record<CounterpartyColumn, string>> {
  const byColumn: Partial<Record<CounterpartyColumn, string>> = {};
  for (const [field, column] of Object.entries(mapping)) {
    const raw = values[field];
    if (typeof raw !== "string") {
      continue;
    }
    const trimmed = raw.trim();
    if (trimmed) {
      byColumn[column] ??= trimmed;
    }
  }
  return byColumn;
}

/**
 * Собирает черновик контрагента из заполненных значений формы для
 * автосохранения в справочник. `null` — данных недостаточно (нет названия или
 * валидного БИН) либо сторона — физлицо.
 */
export function extractCounterpartyDraft(
  mapping: Record<string, CounterpartyColumn>,
  values: Record<string, unknown>
): CounterpartyDraft | null {
  const byColumn = collectColumnValues(mapping, values);
  const name = byColumn.name ?? "";
  const bin = byColumn.bin ?? "";
  if (!(name && BIN_VALUE_REGEX.test(bin))) {
    return null;
  }
  const type = reverseType(byColumn.type);
  if (type === "skip") {
    return null;
  }
  // «Устава» — дефолт ветки юрлица; для ИП это значение из скрытой ветки,
  // в справочник его не тащим.
  let basis = byColumn.basis ?? "";
  if (type === "ИП" && USTAV_STEM_REGEX.test(basis)) {
    basis = "";
  }
  return {
    name,
    bin,
    ...(type ? { type } : {}),
    address: byColumn.address ?? "",
    phone: byColumn.phone ?? "",
    email: byColumn.email ?? "",
    bank: byColumn.bank ?? "",
    iban: byColumn.iban ?? "",
    bik: byColumn.bik ?? "",
    kbe: byColumn.kbe ?? "",
    knp: byColumn.knp ?? "",
    signatory: byColumn.signatory ?? "",
    position: byColumn.position ?? "",
    basis,
  };
}
