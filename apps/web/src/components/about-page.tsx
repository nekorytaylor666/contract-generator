import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ConsultationDialog } from "@/components/consultation-dialog";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

// Палитра нового лендинга из Figma (frame «/about», node 5220:12053): тёплый
// фон, чернильный текст, приглушённый серый и бордовый бренда.
const PAGE_BG = "#faf9f6";
const INK = "#1b1b1b";
const MUTED = "#a3a3a3";
// Песочная панель под скриншотом продукта (brand-shades/primary/secondary/200).
const SAND = "#f5d9b0";

// Контакты футера — номер из макета. Кнопка «Получить консультацию» в хиро
// открывает форму заявки (ConsultationDialog), а не чат.
const WHATSAPP_URL = "https://wa.me/77711017744";
const PHONE_DISPLAY = "+7 771 101 77 44";
const PHONE_HREF = "tel:+77711017744";
const EMAIL = "info@zhebe.kz";

// «О решении» — якорь этой же страницы (страница и есть рассказ о решении),
// «Библиотека» и «Тарифы» — отдельные публичные страницы.
const NAV_LINKS: {
  href?: string;
  to?: "/library" | "/plans";
  labelKey: string;
}[] = [
  { href: "#why", labelKey: "landing.nav.about" },
  { to: "/library", labelKey: "landing.nav.library" },
  { to: "/plans", labelKey: "landing.nav.plans" },
];

function ZhebeLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-label="Zhebe"
      className={className}
      fill="none"
      role="img"
      viewBox="0 0 103 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Zhebe</title>
      <g fill="currentColor">
        <path d="M18.8124 17.2454L9.40513 0L0 17.2454H3.21506L3.75948 16.1282C4.91047 14.1452 7.06242 12.8948 9.40727 12.8948C11.7521 12.8948 13.9041 14.1452 15.0551 16.1282L15.5995 17.2454H18.8145H18.8124ZM9.25509 10.9226C8.19412 10.9226 6.93167 11.2276 5.99716 11.6423L9.40727 4.84684L12.7145 11.6423C11.78 11.2255 10.3182 10.9226 9.25723 10.9226H9.25509Z" />
        <path d="M10.6869 12.9056H8.12339V48H10.6869V12.9056Z" />
        <path d="M30.3996 29.4892H38.1586V31.9449H26.9295V30.2541L34.367 19.7827H27.221V17.327H37.8671V19.0179L30.3996 29.4892Z" />
        <path d="M47.4052 16.9468C48.2604 16.9468 49.0341 17.0886 49.7243 17.37C50.4145 17.6536 51.0082 18.0532 51.5033 18.5688C51.9984 19.0845 52.3821 19.7139 52.6564 20.4551C52.9286 21.1963 53.0637 22.0342 53.0637 22.9688V31.9449H50.5259V23.1364C50.5259 21.9504 50.2044 21.0309 49.5635 20.3799C48.9227 19.729 48.0374 19.4024 46.91 19.4024C45.6454 19.4024 44.6252 19.7956 43.8472 20.584C43.0691 21.3725 42.6812 22.5821 42.6812 24.2149V31.9449H40.1434V11.479H42.6812V19.4325C43.6928 17.7761 45.2682 16.9468 47.4073 16.9468H47.4052Z" />
        <path d="M57.3225 25.8047C57.5755 27.1109 58.1692 28.125 59.1015 28.8447C60.0339 29.5666 61.2021 29.9275 62.6017 29.9275C64.5264 29.9275 65.9261 29.2164 66.8027 27.7941L68.9611 29.023C67.5229 31.2252 65.3838 32.3273 62.5438 32.3273C60.2482 32.3273 58.3621 31.6054 56.8853 30.1639C55.4471 28.6836 54.7269 26.8402 54.7269 24.6381C54.7269 22.436 55.4364 20.584 56.8553 19.1425C58.2742 17.6815 60.1111 16.9489 62.3681 16.9489C64.5071 16.9489 66.2476 17.7095 67.5893 19.2284C68.9504 20.7108 69.6319 22.5219 69.6319 24.666C69.6319 25.0571 69.6019 25.4373 69.5441 25.8069H57.3225V25.8047ZM62.3681 19.3444C61.007 19.3444 59.8796 19.729 58.9837 20.5003C58.0899 21.2715 57.5347 22.2985 57.3204 23.5854H67.062C66.8477 22.1825 66.3033 21.1255 65.4288 20.4122C64.5543 19.701 63.5319 19.3444 62.3659 19.3444H62.3681Z" />
        <path d="M79.5493 16.9468C81.592 16.9468 83.3303 17.6966 84.7706 19.1983C86.2088 20.7001 86.929 22.5112 86.929 24.636C86.929 26.7608 86.2088 28.602 84.7706 30.1037C83.3517 31.5861 81.6113 32.3252 79.5493 32.3252C77.1188 32.3252 75.2797 31.3605 74.0366 29.4312V31.9449H71.4988V11.479H74.0366V19.8407C75.2819 17.9114 77.1188 16.9468 79.5493 16.9468ZM79.2278 29.8695C80.6853 29.8695 81.9113 29.3732 82.9037 28.3785C83.8961 27.3645 84.3912 26.1184 84.3912 24.636C84.3912 23.1536 83.8961 21.9161 82.9037 20.9235C81.9113 19.9094 80.6875 19.4024 79.2278 19.4024C77.7682 19.4024 76.5143 19.9094 75.5241 20.9235C74.5317 21.9182 74.0366 23.1557 74.0366 24.636C74.0366 26.1162 74.5317 27.3645 75.5241 28.3785C76.5165 29.3732 77.7511 29.8695 79.2278 29.8695Z" />
        <path d="M90.6906 25.8047C90.9435 27.1109 91.5372 28.125 92.4696 28.8447C93.402 29.5666 94.5701 29.9275 95.9697 29.9275C97.8945 29.9275 99.2941 29.2164 100.171 27.7941L102.329 29.023C100.891 31.2252 98.7518 32.3273 95.9119 32.3273C93.6163 32.3273 91.7301 31.6054 90.2533 30.1639C88.8151 28.6836 88.095 26.8402 88.095 24.6381C88.095 22.436 88.8044 20.584 90.2233 19.1425C91.6423 17.6815 93.4791 16.9489 95.7361 16.9489C97.8752 16.9489 99.6156 17.7095 100.957 19.2284C102.318 20.7108 103 22.5219 103 24.666C103 25.0571 102.97 25.4373 102.912 25.8069H90.6906V25.8047ZM95.7361 19.3444C94.3751 19.3444 93.2476 19.729 92.3517 20.5003C91.4579 21.2715 90.9028 22.2985 90.6885 23.5854H100.43C100.216 22.1825 99.6713 21.1255 98.7968 20.4122C97.9223 19.701 96.9 19.3444 95.734 19.3444H95.7361Z" />
      </g>
    </svg>
  );
}

function Navbar() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  // Лендинг живёт вне app-shell, поэтому сессию проверяем сами: авторизованному
  // показываем вход в приложение вместо «Войти»/«Регистрация».
  const { data: session, isPending } = authClient.useSession();
  // Навбар остаётся закреплённым (как на старом лендинге), но поверх фото героя
  // он прозрачный; фон появляется только после начала скролла.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 -mb-[72px] transition-colors duration-200",
        scrolled && "bg-[#1b1b1b]/90 backdrop-blur-md"
      )}
    >
      <nav className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-[60px]">
        {/* Логотип со страницы о компании ведёт на главную. */}
        <Link aria-label="Zhebe" className="flex flex-1 items-center" to="/">
          <ZhebeLogo className="h-10 w-auto text-[#faf9f6] sm:h-12" />
        </Link>
        <div className="hidden items-center gap-0.5 md:flex">
          {NAV_LINKS.map((link) =>
            link.to ? (
              <Link
                className="rounded-lg px-4 py-2 font-medium text-[#faf9f6] text-sm transition-colors hover:bg-white/10"
                key={link.to}
                to={link.to}
              >
                {t(link.labelKey)}
              </Link>
            ) : (
              <a
                className="rounded-lg px-4 py-2 font-medium text-[#faf9f6] text-sm transition-colors hover:bg-white/10"
                href={link.href}
                key={link.href}
              >
                {t(link.labelKey)}
              </a>
            )
          )}
        </div>
        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-4">
          <LanguageSwitcher triggerClassName="text-[#faf9f6] hover:bg-white/10" />
          {/* На самых узких экранах кнопка не влезает — она дублируется в
              бургер-меню. */}
          {session && (
            <Button
              asChild
              className="hidden h-9 rounded-lg bg-[#faf9f6] px-3 font-medium text-[#0a0a0a] text-sm hover:bg-[#faf9f6]/90 sm:px-4 min-[400px]:inline-flex"
            >
              <Link to="/templates">{t("landing.nav.openApp")}</Link>
            </Button>
          )}
          {/* Пока сессия грузится, гостевые кнопки не показываем — иначе
              авторизованный пользователь видит мигающее «Войти». */}
          {!(session || isPending) && (
            <>
              <Button
                asChild
                className="hidden h-9 rounded-lg border-[#faf9f6] bg-transparent px-4 font-medium text-[#faf9f6] text-sm hover:bg-white/10 sm:inline-flex"
                variant="outline"
              >
                <Link to="/login">{t("landing.nav.login")}</Link>
              </Button>
              <Button
                asChild
                className="h-9 rounded-lg bg-[#faf9f6] px-3 font-medium text-[#0a0a0a] text-sm hover:bg-[#faf9f6]/90 sm:px-4"
              >
                <Link to="/register">{t("landing.nav.register")}</Link>
              </Button>
            </>
          )}
          <button
            aria-expanded={menuOpen}
            aria-label={
              menuOpen ? t("landing.nav.closeMenu") : t("landing.nav.openMenu")
            }
            className="flex size-9 items-center justify-center rounded-lg text-[#faf9f6] transition-colors hover:bg-white/10 md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div className="border-white/15 border-t bg-black/60 px-4 pb-4 backdrop-blur-sm md:hidden">
          <div className="flex flex-col gap-1 pt-3">
            {NAV_LINKS.map((link) =>
              link.to ? (
                <Link
                  className="rounded-lg px-3 py-2.5 text-[#faf9f6]/90 text-sm transition-colors hover:bg-white/10"
                  key={link.to}
                  onClick={() => setMenuOpen(false)}
                  to={link.to}
                >
                  {t(link.labelKey)}
                </Link>
              ) : (
                <a
                  className="rounded-lg px-3 py-2.5 text-[#faf9f6]/90 text-sm transition-colors hover:bg-white/10"
                  href={link.href}
                  key={link.href}
                  onClick={() => setMenuOpen(false)}
                >
                  {t(link.labelKey)}
                </a>
              )
            )}
            {session && (
              <Link
                className="rounded-lg px-3 py-2.5 text-[#faf9f6]/90 text-sm transition-colors hover:bg-white/10 min-[400px]:hidden"
                onClick={() => setMenuOpen(false)}
                to="/templates"
              >
                {t("landing.nav.openApp")}
              </Link>
            )}
            {!(session || isPending) && (
              <Link
                className="rounded-lg px-3 py-2.5 text-[#faf9f6]/90 text-sm transition-colors hover:bg-white/10 sm:hidden"
                onClick={() => setMenuOpen(false)}
                to="/login"
              >
                {t("landing.nav.login")}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function Hero() {
  const { t } = useTranslation();
  const [consultOpen, setConsultOpen] = useState(false);
  return (
    <section className="relative" id="top">
      <img
        alt=""
        className="absolute inset-0 size-full object-cover"
        height={799}
        src="/landing/about/hero-bg.jpg"
        width={1200}
      />
      <div aria-hidden className="absolute inset-0 bg-black/40" />
      {/* pt-[104px] = 72px закреплённого навбара + отступ контента. */}
      <div className="relative z-10 mx-auto flex min-h-[592px] max-w-[1200px] items-center px-4 pt-[104px] pb-16 sm:px-6 lg:min-h-[691px] lg:px-[60px]">
        <div className="flex max-w-[519px] flex-col gap-16">
          <div className="flex flex-col gap-6 text-[#faf9f6]">
            <h1 className="font-semibold text-4xl leading-[44px] sm:text-[48px] sm:leading-[56px]">
              {t("about.hero.title")}
            </h1>
            <p className="max-w-[389px] font-medium text-base leading-5">
              {t("about.hero.text")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button
              className="h-9 rounded-full bg-[#f5f5f5] px-4 font-medium text-[#0a0a0a] text-sm hover:bg-white"
              onClick={() => setConsultOpen(true)}
              type="button"
            >
              {t("about.hero.consult")}
            </Button>
            <ConsultationDialog
              onOpenChange={setConsultOpen}
              open={consultOpen}
            />
            <Button
              asChild
              className="h-9 rounded-full border-[#faf9f6] bg-transparent px-4 font-medium text-[#faf9f6] text-sm hover:bg-white/10"
              variant="outline"
            >
              <Link to="/register">
                {t("about.hero.start")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

const WHY_PARAGRAPH_KEYS = [
  "about.why.p1",
  "about.why.p2",
  "about.why.p3",
  "about.why.p4",
];

function WhySection() {
  const { t } = useTranslation();
  return (
    <section className="scroll-mt-20 py-16 lg:py-[144px]" id="why">
      <div className="mx-auto flex max-w-[624px] flex-col gap-4 px-4 sm:px-8">
        <h2
          className="whitespace-pre-line font-semibold text-[32px] leading-10 sm:text-[40px] sm:leading-[48px]"
          style={{ color: INK }}
        >
          {t("about.why.title")}
        </h2>
        <div
          className="flex flex-col gap-[22px] font-medium text-lg leading-[22px]"
          style={{ color: "#0a0a0a" }}
        >
          {WHY_PARAGRAPH_KEYS.map((key) => (
            <p key={key}>{t(key)}</p>
          ))}
        </div>
        <div className="flex items-center gap-4 pt-8">
          <img
            alt={t("about.why.founderName")}
            className="size-[60px] rounded-full object-cover"
            height={60}
            src="/landing/about/founder-meruert.png"
            width={60}
          />
          <div className="flex flex-col gap-0.5 font-medium text-base leading-5">
            <span style={{ color: "#0a0a0a" }}>
              {t("about.why.founderName")}
            </span>
            <span style={{ color: MUTED }}>{t("about.why.founderRole")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

interface HistoryCard {
  n: number;
  year: string;
  hasNote?: boolean;
  image: string;
  imageClassName: string;
}

const HISTORY_CARDS: HistoryCard[] = [
  {
    n: 1,
    year: "(1940)",
    image: "/landing/about/primeis-1940.jpg",
    imageClassName: "absolute inset-0 size-full object-cover",
  },
  {
    n: 2,
    year: "(2003)",
    hasNote: true,
    image: "/landing/about/primeis-2003.jpg",
    imageClassName: "absolute inset-0 size-full object-cover",
  },
  {
    n: 3,
    year: "(2026)",
    image: "/landing/about/primeis-today.jpg",
    // Кадрирование из макета подогнано под колонку ~528px (lg); на узких
    // экранах контейнер уже при той же высоте, поэтому ниже lg — обычный cover.
    imageClassName:
      "absolute inset-0 size-full object-cover lg:top-[-90.58%] lg:left-[-7.37%] lg:h-[275.36%] lg:w-[114.82%] lg:max-w-none",
  },
];

function HistorySection() {
  const { t } = useTranslation();
  return (
    <section className="py-12">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-6 lg:px-[60px]">
        {/* top-24 — ниже 72px закреплённого навбара. */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <h2
            className="max-w-[453px] font-semibold text-[32px] leading-10 sm:text-[40px] sm:leading-[48px]"
            style={{ color: INK }}
          >
            {t("about.history.title")}
          </h2>
          <p
            className="max-w-[338px] font-medium text-lg leading-[22px]"
            style={{ color: "#0a0a0a" }}
          >
            {t("about.history.text")}
          </p>
        </div>
        <div className="flex flex-col gap-12">
          {HISTORY_CARDS.map((card) => (
            <article className="flex flex-col gap-6" key={card.year}>
              <div className="relative h-[330px] overflow-hidden rounded-lg bg-[#d4d4d4]">
                <img
                  alt={`${t(`about.history.card${card.n}Label`)}, ${card.year}`}
                  className={card.imageClassName}
                  height={330}
                  src={card.image}
                  width={528}
                />
              </div>
              {/* gap-x нужен: казахские лейблы («Тарихтың жаңа кезеңі»)
                  заполняют колонку целиком и без зазора липнут к тексту. */}
              <div className="grid gap-2 pr-2 sm:grid-cols-[1fr_2fr] sm:gap-x-4 sm:gap-y-0">
                <div className="flex flex-col gap-0.5">
                  <span
                    className="font-medium text-base leading-5"
                    style={{ color: INK }}
                  >
                    {t(`about.history.card${card.n}Label`)}
                  </span>
                  <span
                    className="font-medium text-sm leading-[18px]"
                    style={{ color: MUTED }}
                  >
                    {card.year}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <p
                    className="font-medium text-sm leading-[18px]"
                    style={{ color: INK }}
                  >
                    {t(`about.history.card${card.n}Text`)}
                  </p>
                  {card.hasNote && (
                    <p
                      className="max-w-[227px] font-medium text-sm leading-[18px]"
                      style={{ color: MUTED }}
                    >
                      {t(`about.history.card${card.n}Note`)}
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const WHO_CARDS = [
  { n: 1, image: "/landing/about/who-1.svg" },
  { n: 2, image: "/landing/about/who-2.svg" },
  { n: 3, image: "/landing/about/who-3.svg" },
];

function WhoSection() {
  const { t } = useTranslation();
  return (
    <section className="py-12">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 sm:px-6 lg:px-[60px]">
        <div className="flex flex-col items-center gap-4 py-8 text-center lg:py-14">
          <h2
            className="max-w-[374px] font-semibold text-[32px] leading-10 sm:text-[40px] sm:leading-[48px]"
            style={{ color: INK }}
          >
            {t("about.who.title")}
          </h2>
          <p
            className="max-w-[363px] font-medium text-lg leading-[22px]"
            style={{ color: "#0a0a0a" }}
          >
            {t("about.who.text")}
          </p>
        </div>
        <div className="grid gap-10 md:grid-cols-3">
          {WHO_CARDS.map((card) => (
            <div className="flex flex-col gap-6" key={card.n}>
              <img
                alt={t(`about.who.alt${card.n}`)}
                className="mx-auto aspect-square w-full max-w-[333px]"
                height={333}
                src={card.image}
                width={333}
              />
              <div className="flex flex-col items-center gap-3">
                <span
                  className="flex size-6 items-center justify-center rounded-full border font-medium text-[13px]"
                  style={{ borderColor: INK, color: INK }}
                >
                  {card.n}
                </span>
                <p
                  className="text-balance text-center font-medium text-lg leading-[22px]"
                  style={{ color: INK }}
                >
                  {t(`about.who.card${card.n}`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function KazakhSection() {
  const { t } = useTranslation();
  return (
    <section className="py-16 lg:py-[144px]">
      <div className="mx-auto flex max-w-[624px] flex-col items-start gap-4 px-4 sm:px-8">
        {/* Мок-интерфейс переключателя языка — чисто декоративный. */}
        <div aria-hidden="true" className="relative">
          <img
            alt=""
            className="size-[100px]"
            height={100}
            src="/landing/about/kk-icon-bg.svg"
            width={100}
          />
          <img
            alt=""
            className="absolute top-[27px] left-[27px] size-[46px]"
            height={46}
            src="/landing/about/kk-icon-glyph.svg"
            width={46}
          />
          {/* Наклонённый ярлык «Казақша» поверх иконки — как в макете. */}
          <span className="absolute top-[8px] left-[84px] flex -rotate-[6.74deg] items-center gap-1.5 rounded-lg bg-white py-1.5 pr-2 pl-3 font-medium text-[#0a0a0a] text-sm shadow-lg">
            Қазақша
            <ChevronDown className="size-4" />
          </span>
        </div>
        <div className="flex flex-col gap-4 pt-8">
          {/* Базовый размер меньше остальных h2: слово «профессиональном» не
              влезает в 320px при 32px. */}
          <h2
            className="whitespace-pre-line font-semibold text-[28px] leading-9 sm:text-[40px] sm:leading-[48px]"
            style={{ color: "#0a0a0a" }}
          >
            {t("about.kazakh.title")}
          </h2>
          <div
            className="flex flex-col gap-[22px] font-medium text-lg leading-[22px]"
            style={{ color: "#0a0a0a" }}
          >
            <p>{t("about.kazakh.p1")}</p>
            <p>{t("about.kazakh.p2")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

interface TeamMember {
  n: number;
  image: string;
  // Кадрирование квадратного портрета из макета (проценты от контейнера).
  imageClassName: string;
}

const TEAM: TeamMember[] = [
  {
    n: 1,
    image: "/landing/about/team-gauhar.jpg",
    imageClassName:
      "absolute left-[-17.76%] top-[-13.57%] h-[183.59%] w-[122.41%] max-w-none object-cover",
  },
  {
    n: 2,
    image: "/landing/about/team-meruert.jpg",
    imageClassName:
      "absolute left-[-4.4%] top-[-7.63%] h-[177.25%] w-[118.09%] max-w-none object-cover",
  },
  {
    n: 3,
    image: "/landing/about/team-amina.jpg",
    imageClassName:
      "absolute left-[-29.83%] top-[-23.17%] h-[194.83%] w-[129.84%] max-w-none object-cover",
  },
];

function TeamSection() {
  const { t } = useTranslation();
  return (
    <section className="py-16">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 sm:px-6 lg:px-[60px]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <h2
            className="font-semibold text-[32px] leading-10 sm:text-[40px] sm:leading-[48px]"
            style={{ color: "#0a0a0a" }}
          >
            {t("about.team.title")}
          </h2>
          <p
            className="max-w-[389px] font-medium text-base leading-5 lg:pt-3"
            style={{ color: "#0a0a0a" }}
          >
            {t("about.team.text")}
          </p>
        </div>
        <div className="grid gap-10 md:grid-cols-3">
          {TEAM.map((member) => (
            <div className="flex flex-col gap-4" key={member.n}>
              <div className="relative aspect-square overflow-hidden rounded-lg bg-[#d4d4d4]">
                <img
                  alt={t(`about.team.name${member.n}`).replace("\n", " ")}
                  className={member.imageClassName}
                  height={333}
                  src={member.image}
                  width={333}
                />
              </div>
              <div className="flex flex-col gap-2 text-black">
                <h3 className="whitespace-pre-line font-semibold text-xl leading-6">
                  {t(`about.team.name${member.n}`)}
                </h3>
                <p className="font-medium text-sm leading-[18px]">
                  {t(`about.team.bio${member.n}`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const DISCLAIMER_PARAGRAPH_KEYS = [
  "about.disclaimer.p1",
  "about.disclaimer.p2",
  "about.disclaimer.p3",
];

function DisclaimerSection() {
  const { t } = useTranslation();
  return (
    <section className="py-16 lg:py-[144px]">
      <div className="mx-auto flex max-w-[624px] flex-col px-4 sm:px-8">
        {/* Песочная панель с обрезанным скриншотом каталога — как в макете. */}
        <div
          className="relative aspect-[560/350] overflow-hidden rounded-lg"
          style={{ backgroundColor: SAND }}
        >
          <div className="absolute inset-x-8 top-[30px] overflow-hidden rounded-lg border border-[#ececec] bg-white shadow-2xl">
            <img
              alt={t("about.disclaimer.screenshotAlt")}
              className="block h-auto w-full"
              height={810}
              src="/landing/step-catalog.jpg"
              width={1440}
            />
          </div>
        </div>
        <h2
          className="pt-20 font-semibold text-[32px] leading-10 sm:text-[40px] sm:leading-[48px]"
          style={{ color: "#0a0a0a" }}
        >
          {t("about.disclaimer.title")}
        </h2>
        <div
          className="flex flex-col gap-[22px] pt-4 font-medium text-lg leading-[22px]"
          style={{ color: "#0a0a0a" }}
        >
          {DISCLAIMER_PARAGRAPH_KEYS.map((key) => (
            <p key={key}>{t(key)}</p>
          ))}
        </div>
        <div className="pt-10">
          <Button
            asChild
            className="h-9 rounded-full bg-[#171717] px-4 font-medium text-[#fafafa] text-sm hover:bg-[#171717]/90"
          >
            <Link to="/register">
              {t("about.hero.start")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

const FAQ_COUNT = 8;
const FAQ_ITEMS = Array.from({ length: FAQ_COUNT }, (_, index) => index + 1);

function FaqSection() {
  const { t } = useTranslation();
  return (
    <section className="scroll-mt-20 py-12" id="faq">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:px-[60px]">
        <h2
          className="max-w-[374px] font-semibold text-[32px] leading-10 sm:text-[40px] sm:leading-[48px] lg:self-start"
          style={{ color: "#0a0a0a" }}
        >
          {t("about.faq.title")}
        </h2>
        <div className="flex flex-col gap-6">
          {FAQ_ITEMS.map((n) => (
            <details
              className="group border-[#0a0a0a] border-b pb-6 last:border-b-0 last:pb-0"
              key={n}
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-12">
                <span className="flex-1 font-semibold text-[#0a0a0a] text-xl leading-6 sm:text-2xl sm:leading-7">
                  {t(`about.faq.q${n}`)}
                </span>
                <ChevronDown className="mt-1 size-5 shrink-0 text-[#0a0a0a] transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-4 pr-12 font-medium text-[#0a0a0a] text-base leading-5">
                {t(`about.faq.a${n}`)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useTranslation();
  // «Решения» ведёт на секцию главного лендинга, «Библиотека договоров» — на
  // публичную библиотеку, «О нас» — наверх этой страницы.
  const itemClassName =
    "flex min-h-8 items-center gap-2 rounded-md px-2 py-1.5 font-medium text-[#fafafa] text-sm hover:bg-white/10";

  return (
    <footer className="bg-[#1b1b1b] text-[#fafafa]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-12 sm:px-6 lg:px-[60px]">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <Link aria-label="Zhebe" className="self-start" to="/">
            <ZhebeLogo className="h-[72px] w-auto text-[#fafafa]" />
          </Link>
          <div className="flex flex-wrap items-center gap-1">
            <Link className={itemClassName} hash="about" to="/">
              {t("about.footer.solutions")}
              <ArrowUpRight className="size-4" />
            </Link>
            <Link className={itemClassName} to="/library">
              {t("about.footer.library")}
              <ArrowUpRight className="size-4" />
            </Link>
            <a className={itemClassName} href="#top">
              {t("about.footer.aboutUs")}
              <ArrowUpRight className="size-4" />
            </a>
          </div>
        </div>

        <div className="h-px w-full bg-white/10" />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-medium text-sm">
            <LanguageSwitcher triggerClassName="text-[#fafafa] hover:bg-white/10" />
            <Link className="py-2 hover:underline" to="/terms">
              {t("about.footer.terms")}
            </Link>
            <Link className="py-2 hover:underline" to="/privacy">
              {t("about.footer.privacy")}
            </Link>
            <Link className="py-2 hover:underline" hash="cookies" to="/privacy">
              {t("about.footer.cookies")}
            </Link>
            <a
              className="py-2 text-[#faf9f6] hover:underline"
              href={PHONE_HREF}
            >
              {PHONE_DISPLAY}
            </a>
            <a
              className="py-2 text-[#faf9f6] hover:underline"
              href={`mailto:${EMAIL}`}
            >
              {EMAIL}
            </a>
          </div>
          <div className="flex items-center gap-2">
            {/* Адрес Instagram пока не определён — проставьте реальный. */}
            <a
              aria-label="Instagram"
              className="flex size-10 items-center justify-center rounded-full bg-[#262626] transition-colors hover:bg-[#333]"
              href="#top"
            >
              <img
                alt=""
                className="size-6"
                height={24}
                src="/landing/social-instagram.svg"
                width={24}
              />
            </a>
            <a
              aria-label="WhatsApp"
              className="flex size-10 items-center justify-center rounded-full bg-[#262626] transition-colors hover:bg-[#333]"
              href={WHATSAPP_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              <img
                alt=""
                className="size-6"
                height={24}
                src="/landing/social-whatsapp.svg"
                width={24}
              />
            </a>
          </div>
        </div>

        <p className="font-medium text-base leading-5">
          {t("about.footer.copyright")}
        </p>
      </div>
    </footer>
  );
}

export function AboutPage() {
  // data-landing-smooth включает плавный якорный скролл на html (index.css):
  // scroll-behavior работает только на реально скроллящемся элементе.
  return (
    <div
      className="min-h-svh font-landing"
      data-landing-smooth
      style={{ backgroundColor: PAGE_BG }}
    >
      <Navbar />
      <main>
        <Hero />
        <WhySection />
        <HistorySection />
        <WhoSection />
        <KazakhSection />
        <TeamSection />
        <DisclaimerSection />
        <FaqSection />
      </main>
      <Footer />
    </div>
  );
}
