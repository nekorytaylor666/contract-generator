import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import kk from "./locales/kk.json";
import ru from "./locales/ru.json";

export const SUPPORTED_LANGUAGES = ["kk", "ru"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const DEFAULT_LANGUAGE: Language = "kk";
// Английский убран из выбора языков. Сохранённый выбор старых пользователей
// переносим на русский, а не на дефолтный казахский: для них это ближе к
// прежнему интерфейсу. locales/en.json оставлен в репозитории — если язык
// когда-нибудь вернут, достаточно снова зарегистрировать ресурс.
const RETIRED_LANGUAGE = "en";
const RETIRED_LANGUAGE_FALLBACK: Language = "ru";
const STORAGE_KEY = "lang";

function isLanguage(value: unknown): value is Language {
  return (
    typeof value === "string" &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}

function getInitialLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === RETIRED_LANGUAGE) {
    localStorage.setItem(STORAGE_KEY, RETIRED_LANGUAGE_FALLBACK);
    return RETIRED_LANGUAGE_FALLBACK;
  }
  return isLanguage(saved) ? saved : DEFAULT_LANGUAGE;
}

i18n.use(initReactI18next).init({
  resources: {
    kk: { translation: kk },
    ru: { translation: ru },
  },
  lng: getInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

// Persist the user's choice and keep <html lang> in sync.
i18n.on("languageChanged", (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
  document.documentElement.lang = lng;
});
document.documentElement.lang = i18n.language;
