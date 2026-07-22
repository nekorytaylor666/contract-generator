import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronDown,
  Download,
  type LucideIcon,
  Menu,
  Minus,
  MoreHorizontal,
  Scale,
  Search,
  Timer,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TAN = "#f5d9b0";

const NAV_LINKS = [
  { href: "#about", label: "О решении" },
  { href: "#library", label: "Библиотека" },
  { href: "#pricing", label: "Тарифы" },
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
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-landing text-landing-foreground">
      <nav className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6">
        <a aria-label="Zhebe" className="flex flex-1 items-center" href="#top">
          <ZhebeLogo className="h-8 w-auto text-landing-foreground" />
        </a>
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              className="rounded-lg px-4 py-2 text-landing-foreground/90 text-sm transition-colors hover:bg-landing-foreground/10"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
          <LanguageSwitcher triggerClassName="text-landing-foreground hover:bg-landing-foreground/10" />
          <Button
            asChild
            className="hidden h-9 border-landing-foreground/40 bg-transparent px-4 text-landing-foreground text-sm hover:bg-landing-foreground/10 sm:inline-flex"
            variant="outline"
          >
            <Link to="/login">Войти</Link>
          </Button>
          <Button
            asChild
            className="h-9 bg-landing-foreground px-3 text-landing text-sm hover:bg-landing-foreground/90 sm:px-4"
          >
            <Link to="/register">Регистрация</Link>
          </Button>
          <button
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
            className="flex size-9 items-center justify-center rounded-lg text-landing-foreground transition-colors hover:bg-landing-foreground/10 md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div className="border-landing-foreground/15 border-t px-4 pb-4 md:hidden">
          <div className="flex flex-col gap-1 pt-3">
            {NAV_LINKS.map((link) => (
              <a
                className="rounded-lg px-3 py-2.5 text-landing-foreground/90 text-sm transition-colors hover:bg-landing-foreground/10"
                href={link.href}
                key={link.href}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Link
              className="rounded-lg px-3 py-2.5 text-landing-foreground/90 text-sm transition-colors hover:bg-landing-foreground/10 sm:hidden"
              to="/login"
            >
              Войти
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function HeroFloatingCard() {
  return (
    <div className="w-[260px] rounded-2xl border border-[#ececec] bg-white p-5 text-foreground shadow-2xl">
      <div className="flex items-center gap-1">
        <span className="flex-1 truncate font-medium text-[12px]">
          ТОО «Meridian Logistics»
        </span>
        <MoreHorizontal className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-2 font-semibold text-[16px] text-black leading-5">
        Договор транспортной экспедиции
      </p>
      <div className="mt-3 space-y-1 text-[12px]">
        <div className="flex justify-between">
          <span className="text-[#737373]">Сумма</span>
          <span className="text-[#0a0a0a]">8 200 000 ₸</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#737373]">Завершение</span>
          <span className="text-[#0a0a0a]">15.03.2026</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="rounded-full bg-[#d6edd6] px-2 py-1 font-medium text-[#2e6b2e] text-[11px]">
          Подписан
        </span>
        <div className="flex">
          {["GA", "MU", "RK"].map((initials, i) => (
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border-2 border-white bg-[#f5f5f5] font-semibold text-[#0a0a0a] text-[10px]",
                i > 0 && "-ml-2"
              )}
              key={initials}
            >
              {initials}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="bg-landing text-landing-foreground" id="top">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-2 lg:py-24">
        <div className="flex flex-col gap-6">
          <span className="font-medium text-[16px]" style={{ color: TAN }}>
            Онлайн конструктор договоров
          </span>
          <h1 className="font-semibold text-4xl leading-[1.15] tracking-tight sm:text-5xl">
            Договор за пару кликов — доступно и составлено юристами
          </h1>
          <p className="max-w-md text-landing-foreground/85 leading-relaxed">
            Каждый шаблон составлен практикующими юристами — так, чтобы интересы
            обеих сторон были защищены. Выберите договор, заполните поля и
            скачайте готовый документ за пару минут.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              asChild
              className="h-11 rounded-full border-landing-foreground/60 bg-transparent px-6 text-landing-foreground text-sm hover:bg-landing-foreground/10"
              variant="outline"
            >
              <Link to="/register">
                Начать бесплатно
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <span className="px-3 text-landing-foreground/70 text-sm">
              Без привязки карты
            </span>
          </div>
        </div>

        <div className="relative hidden min-h-[420px] lg:block">
          <img
            alt="Договоры в конструкторе Zhebe"
            className="h-full w-full rounded-2xl object-cover"
            height={1067}
            src="/landing/hero-collage.png"
            width={1600}
          />
          <div className="absolute top-6 left-0">
            <span className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 font-medium text-black text-sm shadow-lg">
              Скачать в PDF, DOCX
              <ChevronDown className="size-4" />
            </span>
          </div>
          <div className="absolute bottom-6 left-2">
            <HeroFloatingCard />
          </div>
        </div>
      </div>
    </section>
  );
}

interface Step {
  n: string;
  title: string;
  desc: string;
  mock: () => React.ReactNode;
}

function CatalogMock() {
  return (
    <div className="space-y-2 rounded-lg bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-muted-foreground text-xs">
        <Search className="size-3.5" />
        Название договора или категория
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["Категория", "Тип договора", "Условия оплаты", "Срок действия"].map(
          (chip) => (
            <span
              className="rounded-md border px-2 py-1 text-[10px] text-muted-foreground"
              key={chip}
            >
              {chip}
            </span>
          )
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 pt-1">
        {["Аренда жилья", "Трудовой договор", "Поставка товаров"].map((c) => (
          <div className="rounded-md border p-2" key={c}>
            <div className="mb-1 h-1.5 w-8 rounded bg-muted" />
            <p className="font-medium text-[10px] text-foreground leading-tight">
              {c}
            </p>
            <div className="mt-2 h-1 w-full rounded bg-muted" />
            <div className="mt-1 h-1 w-2/3 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FormMock() {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg bg-white p-3 shadow-sm">
      <div className="space-y-1.5">
        <div className="h-1.5 w-16 rounded bg-muted" />
        <div className="h-2 w-full rounded bg-muted" />
        <div className="h-2 w-5/6 rounded bg-muted" />
        <div className="h-2 w-full rounded bg-muted" />
      </div>
      <div className="rounded-md border p-2">
        <p className="font-semibold text-[10px] text-foreground">
          Сведения об арендодателе
        </p>
        <div className="mt-2 space-y-1.5">
          <div className="h-2 w-full rounded bg-muted" />
          <div className="flex gap-1">
            <span className="rounded-full bg-landing px-2 py-0.5 text-[8px] text-landing-foreground">
              Физ. лицо
            </span>
            <span className="rounded-full border px-2 py-0.5 text-[8px] text-muted-foreground">
              Юр. лицо
            </span>
          </div>
          <div className="h-2 w-full rounded bg-muted" />
          <div className="h-2 w-2/3 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

function DownloadMock() {
  return (
    <div className="rounded-lg bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-[10px] text-foreground">
          Договор аренды нежилого помещения
        </span>
        <span className="flex items-center gap-1 rounded bg-landing px-2 py-1 text-[9px] text-landing-foreground">
          <Download className="size-2.5" /> Скачать договор
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="h-1.5 w-1/3 rounded bg-muted" />
        <div className="h-2 w-full rounded bg-muted" />
        <div className="h-2 w-full rounded bg-muted" />
        <div className="h-2 w-4/5 rounded bg-muted" />
        <div className="h-2 w-full rounded bg-muted" />
        <div className="h-2 w-3/5 rounded bg-muted" />
      </div>
    </div>
  );
}

const STEPS: Step[] = [
  {
    n: "Шаг 1",
    title: "Выберите шаблон",
    desc: "Найдите нужный договор в каталоге — по категории, ситуации или названию. Если нет нужного договора, напишите в тех.поддержку и мы создадим его.",
    mock: CatalogMock,
  },
  {
    n: "Шаг 2",
    title: "Заполните поля",
    desc: "Платформа задаёт точные вопросы под каждый тип договора. Никаких лишних юридических терминов.",
    mock: FormMock,
  },
  {
    n: "Шаг 3",
    title: "Скачайте документ",
    desc: "Готовый договор в формате Word или PDF, который соответствует законодательству Казахстана, справедливый для всех сторон в пару кликов.",
    mock: DownloadMock,
  },
];

function Steps() {
  return (
    <section className="scroll-mt-20 bg-background py-20" id="about">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1fr_1.4fr]">
        <h2 className="font-semibold text-3xl text-foreground leading-tight tracking-tight sm:text-4xl lg:sticky lg:top-28 lg:self-start">
          Три шага до готового договора
        </h2>
        <div className="flex flex-col gap-16">
          {STEPS.map((step) => (
            <div className="flex flex-col gap-5" key={step.n}>
              <div className="rounded-2xl bg-secondary/70 p-5">
                <step.mock />
              </div>
              <div className="grid gap-2 sm:grid-cols-[110px_1fr]">
                <span className="font-medium text-muted-foreground text-sm">
                  {step.n}
                </span>
                <div>
                  <h3 className="font-medium text-foreground">{step.title}</h3>
                  <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface LibraryCard {
  date: string;
  title: string;
  desc: string;
  tag: string;
}

const LIBRARY_CARDS: LibraryCard[] = [
  {
    date: "Март 2025",
    title: "Договор аренды жилого помещения",
    desc: "С описью имущества, актом приёма-передачи и порядком возврата депозита",
    tag: "Недвижимость",
  },
  {
    date: "Октябрь 2024",
    title: "Трудовой договор с дистанционным сотрудником",
    desc: "С режимом работы, постановкой задач и условиями расторжения по ТК РК",
    tag: "Кадры",
  },
  {
    date: "Июль 2023",
    title: "Договор поставки товаров и продукции",
    desc: "С условиями доставки, порядком приёмки и ответственностью за недостачу",
    tag: "Торговля",
  },
  {
    date: "Апр 2025",
    title: "Договор возмездного оказания услуг по разработке ПО",
    desc: "С передачей исключительных прав, поэтапной оплатой и актом сдачи-приёмки",
    tag: "Разработка",
  },
  {
    date: "Сентябрь 2024",
    title: "Договор подряда на строительные работы",
    desc: "С локальной сметой, актами КС-2 и гарантийными обязательствами подрядчика",
    tag: "Строительство",
  },
  {
    date: "Май 2023",
    title: "Договор займа между физическими лицами",
    desc: "С графиком возврата, процентной ставкой и штрафами за просрочку",
    tag: "Финансы",
  },
];

function Library() {
  return (
    <section className="scroll-mt-20 bg-muted/40 py-20" id="library">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <h2 className="font-semibold text-3xl text-foreground tracking-tight sm:text-4xl">
              В библиотеке более 1000+ договоров
            </h2>
            <p className="mt-3 text-muted-foreground">
              Найдите нужный шаблон по категории или через поиск. Каждый договор
              составлен юристом, актуален на сегодняшний день и готов к
              заполнению.
            </p>
          </div>
          <Button
            asChild
            className="h-10 shrink-0 rounded-full px-5 text-sm"
            variant="outline"
          >
            <Link to="/register">
              Открыть каталог
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LIBRARY_CARDS.map((card) => (
            <div
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
              key={card.title}
            >
              <span className="text-muted-foreground text-xs">{card.date}</span>
              <h3 className="font-medium text-foreground leading-snug">
                {card.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {card.desc}
              </p>
              <span className="mt-auto w-fit rounded-full bg-secondary/40 px-2.5 py-1 text-secondary-foreground text-xs">
                {card.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PERIODS = ["Ежемесячно", "Ежеквартально (- 7%)", "Ежегодно (-22%)"];

const PLAN_FEATURES = [
  "Скачивание",
  "Редактирование",
  "Поддержка",
  "Сохранение реквизитов",
  "Проверка документов",
  "Риск аналитика",
  "Пользователи в команде",
  "Составление документов",
  "Консультация от юриста",
];

interface PricingPlan {
  name: string;
  desc: string;
  price: string;
  period?: string;
  highlight: boolean;
  values: string[];
}

const PRICING_PLANS: PricingPlan[] = [
  {
    name: "Разовый",
    desc: "Один договор — одна оплата. Без подписки и обязательств. Достаточно для теста Zhebe.",
    price: "Бесплатно",
    highlight: false,
    values: ["1", "1", "Чат-бот", "—", "—", "—", "—", "—", "—"],
  },
  {
    name: "Базовый",
    desc: "Регулярный доступ к шаблонам для фрилансеров и небольших проектов.",
    price: "23 870 ₸",
    period: "/ в месяц",
    highlight: false,
    values: ["15", "5", "Чат-бот", "до 3", "1", "—", "—", "—", "—"],
  },
  {
    name: "Стандарт",
    desc: "Полный доступ и юридическая поддержка для команд до 10 человек.",
    price: "61 000 ₸",
    period: "/ в месяц",
    highlight: true,
    values: ["∞", "20", "до 5 в месяц", "∞", "3", "∞", "10", "1", "1"],
  },
  {
    name: "Премиум",
    desc: "Максимальные возможности платформы для компаний с высоким документооборотом.",
    price: "120 000 ₸",
    period: "/ в месяц",
    highlight: false,
    values: ["∞", "50", "до 10 в месяц", "∞", "5", "∞", "30", "3", "5"],
  },
];

function Pricing() {
  const [period, setPeriod] = useState(PERIODS[0]);

  return (
    <section className="scroll-mt-20 bg-background py-20" id="pricing">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center gap-6 text-center">
          <h2 className="font-semibold text-3xl text-foreground tracking-tight sm:text-4xl">
            Выберите формат, который вам подходит
          </h2>
          <div className="flex flex-wrap items-center gap-1 rounded-full bg-muted p-1">
            {PERIODS.map((option) => (
              <button
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm transition-colors",
                  option === period
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                key={option}
                onClick={() => setPeriod(option)}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRICING_PLANS.map((plan) => (
            <div
              className={cn(
                "flex flex-col gap-5 rounded-2xl border p-6",
                plan.highlight
                  ? "border-foreground/40 bg-foreground/[0.02] shadow-sm"
                  : "border-border bg-card"
              )}
              key={plan.name}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-foreground text-xl">
                    {plan.name}
                  </h3>
                  {plan.highlight && (
                    <span className="rounded-full bg-foreground px-2 py-0.5 text-background text-xs">
                      Популярный
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {plan.desc}
                </p>
              </div>
              <div className="flex items-end gap-1">
                <span className="font-semibold text-2xl text-foreground">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="pb-1 text-muted-foreground text-xs">
                    {plan.period}
                  </span>
                )}
              </div>
              <Button
                asChild
                className="h-9 w-full bg-foreground text-background text-sm hover:bg-foreground/90"
              >
                <Link to="/register">Выбрать</Link>
              </Button>
              <div className="flex flex-col gap-2 border-t pt-4">
                {PLAN_FEATURES.map((feature, i) => {
                  const value = plan.values[i];
                  const included = value !== "—";
                  return (
                    <div
                      className="flex items-start justify-between gap-2 text-xs"
                      key={feature}
                    >
                      <span className="flex items-start gap-1.5 text-foreground">
                        {included ? (
                          <Check className="mt-0.5 size-3.5 shrink-0 text-foreground" />
                        ) : (
                          <Minus className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        {feature}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface CtaFeature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const CTA_FEATURES: CtaFeature[] = [
  {
    icon: Scale,
    title: "Составлено юристами",
    desc: "Каждый шаблон разработан практикующими юристами — не алгоритмом и не копированием из интернета.",
  },
  {
    icon: CalendarCheck,
    title: "Актуально на сегодня",
    desc: "Следим за изменениями в ТК РК и ГК РК и обновляем шаблоны каждую неделю.",
  },
  {
    icon: Timer,
    title: "Готово за 7 минут",
    desc: "Выберите шаблон, заполните поля — и получите договор, готовый к подписанию.",
  },
  {
    icon: Wallet,
    title: "Без юриста в штате",
    desc: "Типовые договоры — без очередей, звонков и счетов на 50 000 ₸ за стандартный документ.",
  },
];

function CallToAction() {
  return (
    <section className="bg-landing text-landing-foreground">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-col items-center gap-5 text-center">
          <h2 className="font-semibold text-3xl tracking-tight sm:text-4xl">
            Первый договор — бесплатно
          </h2>
          <p className="max-w-md text-landing-foreground/80">
            Зарегистрируйтесь и получите доступ к каталогу прямо сейчас. Без
            карты, без обязательств.
          </p>
          <Button
            asChild
            className="h-11 rounded-full bg-landing-foreground px-6 text-landing text-sm hover:bg-landing-foreground/90"
          >
            <Link to="/register">
              Начать бесплатно
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {CTA_FEATURES.map((feature) => (
            <div className="flex flex-col gap-3" key={feature.title}>
              <feature.icon className="size-7" style={{ color: TAN }} />
              <h3 className="font-medium text-lg">{feature.title}</h3>
              <p className="text-landing-foreground/75 text-sm leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQ_ITEMS = [
  {
    q: "Чем Жебе отличается от шаблонов из интернета?",
    a: "Шаблоны из интернета никто не обновляет и никто за них не отвечает. Каждый договор на Жебе составлен практикующим юристом и обновляется еженедельно под актуальное законодательство РК. Вы точно знаете, что получаете рабочий документ.",
  },
  {
    q: "Можно ли доверять договорам, составленным через платформу?",
    a: "Да. Все шаблоны разработаны юристами платформы и соответствуют нормам ТК РК и ГК РК. Мы не генерируем договоры автоматически — каждый документ в каталоге проверен вручную.",
  },
  {
    q: "Что будет, если законодательство изменится после того, как я скачал договор?",
    a: "Если в шаблоне произошли изменения, вы получите уведомление. Актуальная версия договора всегда доступна в вашем личном кабинете.",
  },
  {
    q: "Нужна ли мне юридическая подготовка, чтобы пользоваться платформой?",
    a: "Нет. Платформа задаёт конкретные вопросы на понятном языке — вы заполняете поля, мы формируем корректный документ. Юридические термины остаются внутри договора, не в интерфейсе.",
  },
  {
    q: "В каком формате я получу договор?",
    a: "В форматах Word (.docx) и PDF — на выбор. Документ готов к печати и подписанию сразу после скачивания.",
  },
  {
    q: "Как работает пробный период?",
    a: "После регистрации вы получаете доступ к одному бесплатному договору на выбор — без привязки карты и без обязательств. Если платформа подойдёт, можно перейти на подписку или купить договоры по отдельности.",
  },
  {
    q: "Подходит ли платформа для юридических лиц?",
    a: "Да. Для компаний и команд предусмотрен корпоративный тариф с несколькими пользователями, управлением реквизитами контрагентов и персональным менеджером.",
  },
  {
    q: "Что если нужного договора нет в каталоге?",
    a: "Напишите нам — мы рассмотрим запрос и при необходимости добавим шаблон в каталог. Корпоративным клиентам доступна подготовка договора под индивидуальные условия.",
  },
];

function Faq() {
  return (
    <section className="scroll-mt-20 bg-background py-20" id="faq">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1fr_1.6fr]">
        <h2 className="font-semibold text-3xl text-foreground tracking-tight sm:text-4xl lg:sticky lg:top-28 lg:self-start">
          Часто задаваемые вопросы
        </h2>
        <div className="flex flex-col divide-y divide-border border-border border-t">
          {FAQ_ITEMS.map((item) => (
            <details className="group py-4" key={item.q}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground">
                {item.q}
                <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

const FOOTER_COLUMNS = [
  {
    title: "Семья и наследство",
    links: [
      "Брачный договор",
      "Соглашение о разделе имущества",
      "Соглашение об алиментах",
      "Договор дарения",
      "Завещание",
      "Согласие супруга на сделку",
      "Алименты",
    ],
  },
  {
    title: "Недвижимость",
    links: [
      "Договор аренды квартиры",
      "Договор купли-продажи квартиры",
      "Договор аренды нежилого помещения",
      "Договор найма жилого помещения",
      "Договор субаренды",
      "Акт приёма-передачи помещения",
      "Соглашение о задатке",
    ],
  },
  {
    title: "Для бизнеса",
    links: [
      "Договор оказания услуг",
      "Договор аренды офиса",
      "Агентский договор",
      "Договор конфиденциальности (NDA)",
      "Корпоративный договор",
      "Договор франшизы",
      "Договор с самозанятым",
    ],
  },
  {
    title: "Для фрилансеров",
    links: [
      "Договор на разработку сайта",
      "Договор на дизайн",
      "Договор на копирайтинг",
      "Договор на SMM-продвижение",
      "Договор авторского заказа",
      "Акт выполненных работ",
      "Договор оферты",
    ],
  },
];

function Footer() {
  return (
    <footer className="bg-landing text-landing-foreground">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col gap-8 border-landing-foreground/15 border-b pb-10 lg:flex-row lg:justify-between">
          <div className="flex flex-col gap-4">
            <ZhebeLogo className="h-8 w-auto text-landing-foreground" />
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-landing-foreground/80 text-sm">
              {["Решения", "Библиотека договоров", "Блог", "О нас"].map(
                (item) => (
                  <a
                    className="hover:text-landing-foreground"
                    href="#top"
                    key={item}
                  >
                    {item}
                  </a>
                )
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {FOOTER_COLUMNS.map((column) => (
              <div className="flex flex-col gap-3" key={column.title}>
                <span className="font-medium text-landing-foreground text-sm">
                  {column.title}
                </span>
                {column.links.map((link) => (
                  <a
                    className="text-landing-foreground/70 text-xs hover:text-landing-foreground"
                    href="#library"
                    key={link}
                  >
                    {link}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-3 pt-6 text-landing-foreground/70 text-xs sm:flex-row">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <a className="hover:text-landing-foreground" href="/privacy">
              Политика конфиденциальности
            </a>
            <a className="hover:text-landing-foreground" href="/terms">
              Пользовательское соглашение
            </a>
            <a
              className="hover:text-landing-foreground"
              href="/privacy#cookies"
            >
              Политика Cookies
            </a>
          </div>
          <span>Все права защищены. ТОО «Primeis»</span>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-svh scroll-smooth bg-background">
      <Navbar />
      <main>
        <Hero />
        <Steps />
        <Library />
        <Pricing />
        <CallToAction />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
