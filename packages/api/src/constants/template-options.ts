// Shared taxonomy for the template catalogue. The DB stores category slugs as a
// free-form `text[]` (the full ancestor path: group → subcategory → leaf) and a
// single `document_type` text. Consistency is kept by the UI (catalogue filters
// + admin form) reading the lists from here. Labels are Russian, matching the
// product language; add `i18n` only for filter chrome, not taxonomy values.

export interface CategoryLeaf {
  slug: string;
  label: string;
}

export interface CategorySub {
  slug: string;
  label: string;
  leaves: CategoryLeaf[];
}

export interface CategoryGroup {
  slug: string;
  label: string;
  /** Not-yet-populated groups render disabled ("Скоро") in the filter. */
  enabled: boolean;
  subs: CategorySub[];
}

// Top-level taxonomy. Only "Договоры" is populated for now; the other five
// groups exist in the design but are disabled until their templates land.
export const CATEGORY_TREE: CategoryGroup[] = [
  {
    slug: "dogovory",
    label: "Договоры",
    enabled: true,
    subs: [
      {
        slug: "kuplya-prodazha",
        label: "Договор купли-продажи",
        leaves: [
          { slug: "kp-dvizhimoe", label: "Купли-продажи движимого имущества" },
          {
            slug: "kp-nedvizhimoe",
            label: "Купли-продажи недвижимого имущества",
          },
          { slug: "kp-nezhiloe", label: "Купли-продажи нежилого помещения" },
          { slug: "kp-kvartira", label: "Купли-продажи квартиры" },
          { slug: "kp-ts", label: "Купли-продажи транспортного средства" },
          { slug: "kp-zemlya", label: "Купли-продажи земельного участка" },
        ],
      },
      {
        slug: "postavka",
        label: "Поставка",
        leaves: [
          { slug: "postavka-grafik", label: "Поставки по графику/заявкам" },
          { slug: "postavka-razovaya", label: "Разовой поставки" },
        ],
      },
      {
        slug: "arenda",
        label: "Аренда",
        leaves: [
          {
            slug: "arenda-kvartira-sutki",
            label: "Аренды квартиры (посуточная)",
          },
          {
            slug: "arenda-kvartira-dolgo",
            label: "Аренды квартиры (долгосрочная)",
          },
          { slug: "arenda-dom-sutki", label: "Аренды дома (посуточная)" },
          { slug: "arenda-dom-dolgo", label: "Аренды дома (долгосрочная)" },
          { slug: "arenda-nezhiloe", label: "Аренды нежилого помещения" },
          { slug: "arenda-ofis", label: "Аренды офиса" },
          { slug: "arenda-sklad", label: "Аренды склада/гаража/кладовки" },
          { slug: "arenda-torgovoe", label: "Аренды торгового помещения" },
          {
            slug: "arenda-proizvodstvennoe",
            label: "Аренды производственного помещения",
          },
          { slug: "arenda-zemlya", label: "Аренды земельного участка" },
          {
            slug: "arenda-zemlya-stroitelstvo",
            label: "Аренды земельного участка для строительства",
          },
          {
            slug: "arenda-oborudovanie-uslugi-dolgo",
            label: "Аренды оборудования и услуг (долгосрочный)",
          },
          {
            slug: "arenda-oborudovanie-dolgo",
            label: "Аренды оборудования (долгосрочный)",
          },
          {
            slug: "arenda-oborudovanie-tehnika-razovyy",
            label: "Аренды техники/декора (разовый)",
          },
          {
            slug: "arenda-oborudovanie-mebel-razovyy",
            label: "Аренды мебели (разовый)",
          },
          { slug: "arenda-ts-ekipazh", label: "Аренды ТС с экипажем" },
          { slug: "arenda-ts-bez-ekipazha", label: "Аренды ТС без экипажа" },
        ],
      },
      {
        slug: "podryad",
        label: "Подряд",
        leaves: [
          { slug: "podryad-stroitelnyy", label: "Строительного подряда" },
          {
            slug: "podryad-remont",
            label: "Подряда ремонтно-монтажных работ",
          },
        ],
      },
      {
        slug: "uslugi",
        label: "Услуги",
        leaves: [
          { slug: "uslugi-razovyy", label: "Оказания услуг (разовый)" },
          {
            slug: "uslugi-mnogorazovyy",
            label: "Оказания услуг (многоразовый/по заявкам)",
          },
          { slug: "uslugi-razrabotka-po", label: "Разработка сайта/ПО" },
          { slug: "uslugi-dizayn", label: "Разработка дизайна/лого (разовый)" },
          { slug: "uslugi-smm", label: "СММ (разовый)" },
          {
            slug: "uslugi-perevod-offline",
            label: "Переводческие (офлайн, разовый)",
          },
          {
            slug: "uslugi-perevod-online",
            label: "Переводческие (онлайн, разовый)",
          },
          {
            slug: "uslugi-konsultacii-razovyy",
            label: "Консультации (разовый)",
          },
          {
            slug: "uslugi-konsultacii-zayavki",
            label: "Консультации (по заявкам)",
          },
          {
            slug: "uslugi-yur-konsultacii",
            label: "Юр. консультации (разовый)",
          },
        ],
      },
      {
        slug: "mena",
        label: "Мена",
        leaves: [
          { slug: "mena-dvizhimoe", label: "Мены движимых имуществ" },
          { slug: "mena-nedvizhimoe", label: "Мены недвижимых имуществ" },
          { slug: "mena-ts", label: "Мены транспортных средств" },
          {
            slug: "mena-ts-nedvizhimoe",
            label: "Мены ТС на недвижимое имущество",
          },
        ],
      },
      {
        slug: "darenie",
        label: "Дарение",
        leaves: [
          { slug: "darenie-dvizhimoe", label: "Дарения движимого имущества" },
          { slug: "darenie-ts", label: "Дарения транспортного средства" },
          {
            slug: "darenie-nedvizhimoe",
            label: "Дарения недвижимого имущества",
          },
        ],
      },
      {
        slug: "publichnaya-oferta",
        label: "Публичный договор (оферта)",
        leaves: [
          { slug: "oferta-prokat", label: "Публичный договор (прокат)" },
          {
            slug: "oferta-online-kursy",
            label: "Публичный договор (онлайн курсы)",
          },
          { slug: "oferta-sportzal", label: "Публичный договор (спортзал)" },
        ],
      },
      {
        slug: "trudovoy-dogovor",
        label: "Трудовой договор",
        leaves: [],
      },
    ],
  },
  {
    slug: "korporativnye",
    label: "Корпоративные документы",
    enabled: false,
    subs: [],
  },
  { slug: "trudovye", label: "Трудовые отношения", enabled: false, subs: [] },
  {
    slug: "pretenzii",
    label: "Претензии и уведомления",
    enabled: false,
    subs: [],
  },
  {
    slug: "sudebnoe",
    label: "Судебное производство",
    enabled: false,
    subs: [],
  },
  { slug: "inye", label: "Иные документы", enabled: false, subs: [] },
];

// Document types ("Вид документа"). A template has at most one.
export const DOCUMENT_TYPE_VALUES = [
  "dogovor",
  "soglashenie",
  "prilozhenie",
  "akt",
  "reshenie",
  "protokol",
  "prikaz",
  "uvedomlenie",
  "pretenziya",
  "zayavlenie",
  "isk",
  "hodataystvo",
  "zhaloba",
  "doverennost",
  "pismo",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPE_VALUES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  dogovor: "Договор",
  soglashenie: "Соглашение",
  prilozhenie: "Приложение к договору",
  akt: "Акт",
  reshenie: "Решение",
  protokol: "Протокол",
  prikaz: "Приказ",
  uvedomlenie: "Уведомление",
  pretenziya: "Претензия",
  zayavlenie: "Заявление",
  isk: "Иск",
  hodataystvo: "Ходатайство",
  zhaloba: "Жалоба",
  doverennost: "Доверенность",
  pismo: "Письмо",
};

// Which document types are relevant per top-level group. Implements the PDF
// rule: "Вид документа" is inactive until a category is chosen, then only the
// relevant types for the chosen category(ies) are shown.
export const DOCUMENT_TYPES_BY_GROUP: Record<string, DocumentType[]> = {
  dogovory: ["dogovor", "soglashenie", "prilozhenie", "akt"],
  korporativnye: [
    "reshenie",
    "protokol",
    "prikaz",
    "doverennost",
    "soglashenie",
  ],
  trudovye: ["dogovor", "prikaz", "soglashenie", "zayavlenie", "uvedomlenie"],
  pretenzii: ["pretenziya", "uvedomlenie", "pismo"],
  sudebnoe: ["isk", "hodataystvo", "zhaloba", "zayavlenie"],
  inye: ["doverennost", "pismo", "zayavlenie", "akt", "soglashenie"],
};

// --- Derived lookups -------------------------------------------------------

// slug → label, for every node (group, subcategory, leaf). Used by chips and
// the catalogue card to render a human label from a stored slug.
export const CATEGORY_LABEL_BY_SLUG: Record<string, string> = {};

// slug → itself + every descendant slug. A template stores its own terminal
// slug(s); the catalogue expands a selection (at any level) downward through
// this map so an array overlap matches templates tagged at a deeper level.
// e.g. "arenda" → ["arenda", "arenda-ofis", "arenda-dom-sutki", …].
const DESCENDANTS_BY_SLUG = new Map<string, string[]>();

// slug → owning top-level group slug, for the document-type dependency.
const GROUP_BY_SLUG = new Map<string, string>();

// slug → depth (0 group, 1 subcategory, 2 leaf), for picking the most specific
// label to show on a catalogue card.
const DEPTH_BY_SLUG = new Map<string, number>();

for (const group of CATEGORY_TREE) {
  CATEGORY_LABEL_BY_SLUG[group.slug] = group.label;
  GROUP_BY_SLUG.set(group.slug, group.slug);
  DEPTH_BY_SLUG.set(group.slug, 0);
  const groupDescendants = [group.slug];
  for (const sub of group.subs) {
    CATEGORY_LABEL_BY_SLUG[sub.slug] = sub.label;
    GROUP_BY_SLUG.set(sub.slug, group.slug);
    DEPTH_BY_SLUG.set(sub.slug, 1);
    const subDescendants = [sub.slug];
    for (const leaf of sub.leaves) {
      CATEGORY_LABEL_BY_SLUG[leaf.slug] = leaf.label;
      GROUP_BY_SLUG.set(leaf.slug, group.slug);
      DEPTH_BY_SLUG.set(leaf.slug, 2);
      subDescendants.push(leaf.slug);
    }
    DESCENDANTS_BY_SLUG.set(sub.slug, subDescendants);
    groupDescendants.push(...subDescendants);
  }
  DESCENDANTS_BY_SLUG.set(group.slug, groupDescendants);
}

/**
 * A category slug plus all of its descendants. Templates store their own
 * terminal slug; expanding a broader selection downward lets a single array
 * overlap match them. Unknown slugs return themselves.
 */
export function selfAndDescendants(slug: string): string[] {
  return DESCENDANTS_BY_SLUG.get(slug) ?? [slug];
}

/**
 * Flatten a set of selected category slugs (any level) into the full set of
 * slugs a matching template could be tagged with. Pass the result to the
 * catalogue list query for an array-overlap match.
 */
export function expandCategorySelection(selected: string[]): string[] {
  const out = new Set<string>();
  for (const slug of selected) {
    for (const descendant of selfAndDescendants(slug)) {
      out.add(descendant);
    }
  }
  return [...out];
}

/**
 * The most specific (deepest) known slug among a template's stored categories,
 * for rendering a single label on the catalogue card. Returns undefined when
 * none are recognised.
 */
export function mostSpecificCategory(
  slugs: string[] | null | undefined
): string | undefined {
  let best: string | undefined;
  let bestDepth = -1;
  for (const slug of slugs ?? []) {
    const depth = DEPTH_BY_SLUG.get(slug);
    if (depth !== undefined && depth > bestDepth) {
      best = slug;
      bestDepth = depth;
    }
  }
  return best;
}

/** The top-level group a category slug belongs to, or undefined if unknown. */
export function categoryGroupOf(slug: string): string | undefined {
  return GROUP_BY_SLUG.get(slug);
}

/**
 * Given selected category slugs, the union of document types relevant to their
 * groups (deduped, in DOCUMENT_TYPE_VALUES order). Empty when nothing selected.
 */
export function relevantDocumentTypes(
  selectedCategorySlugs: string[]
): DocumentType[] {
  const groups = new Set<string>();
  for (const slug of selectedCategorySlugs) {
    const group = categoryGroupOf(slug);
    if (group) {
      groups.add(group);
    }
  }
  const allowed = new Set<DocumentType>();
  for (const group of groups) {
    for (const type of DOCUMENT_TYPES_BY_GROUP[group] ?? []) {
      allowed.add(type);
    }
  }
  return DOCUMENT_TYPE_VALUES.filter((type) => allowed.has(type));
}

/** True when a slug is a known category node. */
export function isKnownCategorySlug(value: unknown): value is string {
  return typeof value === "string" && value in CATEGORY_LABEL_BY_SLUG;
}

/** True when a slug is a known document type. */
export function isDocumentType(value: unknown): value is DocumentType {
  return (
    typeof value === "string" &&
    (DOCUMENT_TYPE_VALUES as readonly string[]).includes(value)
  );
}

// --- Localization -----------------------------------------------------------

// Document locales for per-language template versions (matches the UI i18n).
export const TEMPLATE_LOCALES = ["kk", "ru", "en"] as const;
export type TemplateLocale = (typeof TEMPLATE_LOCALES)[number];

export const TEMPLATE_LOCALE_LABELS: Record<TemplateLocale, string> = {
  kk: "Қазақша",
  ru: "Русский",
  en: "English",
};

export interface LocaleContent {
  title?: string;
  description?: string | null;
  typstContent?: string;
}

interface BaseContent {
  title: string;
  description: string | null;
  typstContent: string;
}

/**
 * Resolve a template's title/description/typstContent for a locale, falling
 * back per-field to the template's default content when a localized override is
 * missing or empty.
 */
export function resolveLocalized(
  base: BaseContent,
  localizedContent: Record<string, LocaleContent> | null | undefined,
  locale: string | null | undefined
): BaseContent {
  const override = (locale && localizedContent?.[locale]) || {};
  return {
    title: override.title || base.title,
    description: override.description || base.description,
    typstContent: override.typstContent || base.typstContent,
  };
}
