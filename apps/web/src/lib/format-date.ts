// Даты «день + месяц» на языке интерфейса без Intl: у части браузеров ICU
// для kk-KZ отдаёт «M09» вместо названия месяца, поэтому таблицы свои.
const MONTHS_RU_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const MONTHS_KK = [
  "қаңтар",
  "ақпан",
  "наурыз",
  "сәуір",
  "мамыр",
  "маусым",
  "шілде",
  "тамыз",
  "қыркүйек",
  "қазан",
  "қараша",
  "желтоқсан",
];

// Местный падеж («1 тамызда жаңартылады») — для фраз «обновится <дата>».
const MONTHS_KK_LOCATIVE = [
  "қаңтарда",
  "ақпанда",
  "наурызда",
  "сәуірде",
  "мамырда",
  "маусымда",
  "шілдеде",
  "тамызда",
  "қыркүйекте",
  "қазанда",
  "қарашада",
  "желтоқсанда",
];

// Именительный падеж с заглавной — чип «Сентябрь 2026» на карточках.
const MONTHS_RU_NOMINATIVE = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

export function isKazakhLanguage(language: string): boolean {
  return language.startsWith("kk");
}

/** «21 сентября» / «21 қыркүйек» (или «21 қыркүйекте» при locative). */
export function formatDayMonth(
  language: string,
  value: Date | string,
  options: { locative?: boolean } = {}
): string {
  const d = new Date(value);
  const month = d.getMonth();
  if (isKazakhLanguage(language)) {
    const names = options.locative ? MONTHS_KK_LOCATIVE : MONTHS_KK;
    return `${d.getDate()} ${names[month]}`;
  }
  return `${d.getDate()} ${MONTHS_RU_GENITIVE[month]}`;
}

/** «Сентябрь 2026» / «Қыркүйек 2026» — чип даты обновления шаблона. */
export function formatMonthYear(
  language: string,
  value: Date | string
): string {
  const d = new Date(value);
  const month = isKazakhLanguage(language)
    ? MONTHS_KK[d.getMonth()]
    : MONTHS_RU_NOMINATIVE[d.getMonth()];
  const capitalized = `${month.charAt(0).toUpperCase()}${month.slice(1)}`;
  return `${capitalized} ${d.getFullYear()}`;
}

/** «21 сентября, 2026» / «21 қыркүйек, 2026». */
export function formatDayMonthYear(
  language: string,
  value: Date | string
): string {
  return `${formatDayMonth(language, value)}, ${new Date(value).getFullYear()}`;
}
