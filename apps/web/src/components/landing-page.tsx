import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  CircleCheck,
  CodeXml,
  Coins,
  FileUser,
  Globe,
  Hammer,
  House,
  type LucideIcon,
  Megaphone,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Scale,
  Tags,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

// Палитра лендинга из Figma (Landing, node 4264:23659): тёплый фон страницы,
// песочные акценты и чернильный текст. Бордовый — общий токен --landing.
const PAGE_BG = "#faf9f6";
const TAN = "#f5d9b0";
const PANEL = "#ecc07d";
const INK = "#1b1b1b";

const NAV_LINKS = [
  { href: "#about", label: "О решении" },
  { href: "#library", label: "Библиотека" },
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
  // Лендинг живёт вне app-shell, поэтому сессию проверяем сами: авторизованному
  // показываем вход в приложение вместо «Войти»/«Регистрация».
  const { data: session, isPending } = authClient.useSession();

  return (
    <header className="sticky top-0 z-50 bg-landing text-landing-foreground">
      <nav className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-4 sm:px-12">
        <a aria-label="Zhebe" className="flex flex-1 items-center" href="#top">
          <ZhebeLogo className="h-10 w-auto text-[#faf9f6] sm:h-12" />
        </a>
        <div className="hidden items-center gap-0.5 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              className="rounded-lg px-4 py-2 font-medium text-[#faf9f6] text-sm transition-colors hover:bg-landing-foreground/10"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-4">
          <LanguageSwitcher triggerClassName="text-landing-foreground hover:bg-landing-foreground/10" />
          {session && (
            <Button
              asChild
              className="h-9 rounded-lg bg-[#faf9f6] px-3 font-medium text-[#0a0a0a] text-sm hover:bg-[#faf9f6]/90 sm:px-4"
            >
              <Link to="/templates">Открыть приложение</Link>
            </Button>
          )}
          {/* Пока сессия грузится, гостевые кнопки не показываем — иначе
              авторизованный пользователь видит мигающее «Войти». */}
          {!(session || isPending) && (
            <>
              <Button
                asChild
                className="hidden h-9 rounded-lg border-[#faf9f6] bg-transparent px-4 font-medium text-[#fafafa] text-sm hover:bg-landing-foreground/10 sm:inline-flex"
                variant="outline"
              >
                <Link to="/login">Войти</Link>
              </Button>
              <Button
                asChild
                className="h-9 rounded-lg bg-[#faf9f6] px-3 font-medium text-[#0a0a0a] text-sm hover:bg-[#faf9f6]/90 sm:px-4"
              >
                <Link to="/register">Регистрация</Link>
              </Button>
            </>
          )}
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
            {!session && (
              <Link
                className="rounded-lg px-3 py-2.5 text-landing-foreground/90 text-sm transition-colors hover:bg-landing-foreground/10 sm:hidden"
                to="/login"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

// Плавающее меню выбора контрагента поверх ноутбука — маркетинговая имитация
// продукта из макета, не интерактив.
function HeroContragentMenu() {
  return (
    <div className="w-[167px] rounded-md border border-[#e5e5e5] bg-white p-1.5 shadow-xl">
      <div className="flex flex-col gap-1">
        {[
          "ТОО «Ромашка», Юр.лицо",
          "ИП «Square», Юр.лицо",
          "Руслан Кошкаров, Физ.лицо",
        ].map((item) => (
          <span
            className="rounded px-1.5 py-1 font-medium text-[#0a0a0a] text-[10px] leading-3"
            key={item}
          >
            {item}
          </span>
        ))}
        <span className="my-0.5 h-px w-full bg-[#e5e5e5]" />
        <span className="flex items-center gap-1 rounded bg-[#f5f5f5] px-1.5 py-1.5 font-medium text-[#0a0a0a] text-[10px] leading-3">
          <Plus className="size-3" />
          Новый контрагент
        </span>
      </div>
    </div>
  );
}

function HeroDocumentCard() {
  return (
    <div className="w-[262px] rounded-2xl border border-[#ececec] bg-white p-5 text-foreground shadow-2xl">
      <div className="flex items-center gap-1">
        <span className="flex-1 truncate font-medium text-[#0a0a0a] text-[12px]">
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
        <span className="flex items-center gap-1 rounded-full bg-[#d6edd6] px-2 py-1.5 font-medium text-[#2e6b2e] text-[12px] leading-none">
          <CircleCheck className="size-3" />
          Подписан
        </span>
        <div className="flex">
          {["GA", "MU"].map((initials) => (
            <span
              className="-mr-2 flex size-8 items-center justify-center rounded-full border border-white bg-[#f5f5f5] font-semibold text-[#0a0a0a] text-[12px]"
              key={initials}
            >
              {initials}
            </span>
          ))}
          <img
            alt=""
            className="size-8 rounded-full border border-white object-cover"
            height={32}
            src="/landing/avatar-photo.png"
            width={32}
          />
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="bg-landing text-landing-foreground" id="top">
      <div className="mx-auto grid max-w-[1200px] items-center gap-6 px-4 pt-16 pb-16 sm:px-12 sm:pt-24 lg:grid-cols-2">
        <div className="flex flex-col gap-10 lg:gap-16">
          <div className="flex flex-col gap-6">
            <span className="font-medium text-[16px]" style={{ color: TAN }}>
              Онлайн конструктор договоров
            </span>
            <h1
              className="max-w-[519px] font-semibold text-[40px] leading-[48px] sm:text-[48px] sm:leading-[56px]"
              style={{ color: TAN }}
            >
              Договор за пару кликов — доступно и составлено юристами
            </h1>
            <p className="max-w-[389px] font-medium text-[#faf9f6] text-base leading-5">
              Каждый шаблон составлен практикующими юристами — так, чтобы
              интересы обеих сторон были защищены. Выберите договор, заполните
              поля и скачайте готовый документ за пару минут.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button
              asChild
              className="h-9 rounded-full border-[#faf9f6] bg-transparent px-4 font-medium text-[#faf9f6] text-sm hover:bg-landing-foreground/10"
              variant="outline"
            >
              <Link to="/register">
                Начать бесплатно
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <span className="px-4 py-2 font-medium text-[#faf9f6] text-sm">
              Без привязки карты
            </span>
          </div>
        </div>

        <div className="relative hidden min-h-[531px] lg:block">
          <img
            alt="Конструктор договоров Zhebe на ноутбуке"
            className="h-[531px] w-full rounded-lg object-cover"
            height={1062}
            src="/landing/hero-laptop.jpg"
            width={1128}
          />
          <div className="absolute top-8 right-[-8px]">
            <span className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 font-medium text-black text-sm shadow-lg">
              Скачать в PDF, DOCX
              <ChevronDown className="size-4" />
            </span>
          </div>
          <div className="absolute top-[190px] left-[-24px]">
            <HeroContragentMenu />
          </div>
          <div className="absolute right-2 bottom-[-28px]">
            <HeroDocumentCard />
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
  image: string;
  // Смещение «скриншота приложения» внутри персиковой панели (в процентах от
  // её ширины/высоты) — каждая панель показывает свой участок продукта.
  offset: { left: string; top: string };
}

const STEPS: Step[] = [
  {
    n: "Шаг 1",
    title: "Выберите шаблон",
    desc: "Найдите нужный договор в каталоге — по категории, ситуации или названию. Если нет нужного договора, напишите в тех.поддержку и мы создадим его.",
    image: "/landing/step-catalog.jpg",
    offset: { left: "7%", top: "9%" },
  },
  {
    n: "Шаг 2",
    title: "Заполните поля",
    desc: "Платформа задаёт точные вопросы под каждый тип договора. Никаких лишних юридических терминов.",
    image: "/landing/step-builder.jpg",
    offset: { left: "-31%", top: "-35%" },
  },
  {
    n: "Шаг 3",
    title: "Скачайте документ",
    desc: "Готовый договор в формате Word или PDF, который соответствует законодательству Казахстана, справедливый для всех сторон в пару кликов.",
    image: "/landing/step-builder.jpg",
    offset: { left: "-33%", top: "10%" },
  },
];

// Уровень «застревания» страницы: грид секции замирает на 58% высоты экрана
// минус 115px (окно дважды увеличивали: +100px, потом ещё +10%) — сверху
// остаётся виден низ бордового героя. Правое окно дополняет эту долю до
// 100svh и затекает на 48px вверх (lg:-mt-12 lg:pt-12) — под самый край
// героя, чтобы при листании контент уходил за цветовую границу. Высота окна
// = (100 − 58)svh + 48px затека + 115px подъёма уровня — при изменении
// констант поменяйте и класс высоты lg:h-[calc(42svh+163px)].
const STEPS_LOCK_RATIO = 0.58;
const STEPS_LOCK_LIFT = 115;
// Верхний «затек» окна под героя = py-12 секции (48px). Должен совпадать с
// классами lg:-mt-12 / lg:pt-12 / +48px в высоте окна.
const STEPS_TOP_BLEED = 48;
// Шаги листания с клавиатуры, пока страница заблокирована.
const KEY_LINE_STEP = 60;
const KEY_PAGE_SHARE = 0.8;

/**
 * «Три шага»: когда грид секции докручивается до 62% высоты экрана (низ героя
 * ещё виден), страница блокируется целиком (overflow hidden) — «долистать»
 * дальше нельзя. Колесо/тач/клавиши в этот момент листают только правое окно
 * со степами; когда оно докручено до конца (или обратно до начала), блокировка
 * снимается и страница едет дальше. На мобильных — обычный поток.
 */
function Steps() {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const win = windowRef.current;
    const track = trackRef.current;
    if (!(outer && win && track)) {
      return;
    }

    const mq = window.matchMedia("(min-width: 1024px)");
    let extra = 0;
    let progress = 0;
    let locked = false;
    let prevTop = Number.POSITIVE_INFINITY;
    let touchY = 0;

    const levelPx = () =>
      Math.round(window.innerHeight * STEPS_LOCK_RATIO) - STEPS_LOCK_LIFT;
    const apply = () => {
      track.style.transform = `translateY(${-Math.round(progress)}px)`;
    };
    const measure = () => {
      // Верхние 48px окна (STEPS_TOP_BLEED) — зона «под героем», куда контент
      // уезжает при листании; из видимой высоты для расчёта они исключаются.
      extra = mq.matches
        ? Math.max(
            0,
            Math.ceil(track.scrollHeight - (win.clientHeight - STEPS_TOP_BLEED))
          )
        : 0;
      progress = Math.min(progress, extra);
      apply();
    };

    const lock = () => {
      locked = true;
      // Выравниваем страницу ровно на уровень застревания и замораживаем её —
      // герой сверху остаётся на месте, скроллится только окно степов.
      const top =
        outer.getBoundingClientRect().top + window.scrollY - levelPx();
      window.scrollTo(0, top);
      document.documentElement.style.overflow = "hidden";
    };
    const unlock = () => {
      locked = false;
      document.documentElement.style.overflow = "";
      prevTop = outer.getBoundingClientRect().top;
    };

    // Продвигает листание окна; на краях — отпускает страницу.
    const page = (delta: number) => {
      progress = Math.min(extra, Math.max(0, progress + delta));
      apply();
      if ((delta > 0 && progress >= extra) || (delta < 0 && progress <= 0)) {
        unlock();
      }
    };

    const onScroll = () => {
      if (locked || extra <= 0) {
        return;
      }
      const top = outer.getBoundingClientRect().top;
      const level = levelPx();
      // Блокируемся при пересечении уровня в сторону недолистанного края.
      const crossedDown = prevTop > level && top <= level && progress < extra;
      const crossedUp = prevTop < level && top >= level && progress > 0;
      prevTop = top;
      if (crossedDown || crossedUp) {
        lock();
      }
    };
    const onWheel = (event: WheelEvent) => {
      if (!locked) {
        return;
      }
      event.preventDefault();
      page(event.deltaY);
    };
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!locked) {
        return;
      }
      event.preventDefault();
      const y = event.touches[0]?.clientY ?? touchY;
      page(touchY - y);
      touchY = y;
    };
    // Без обработки клавиш клавиатурный пользователь застрял бы навсегда.
    const onKeyDown = (event: KeyboardEvent) => {
      if (!locked) {
        return;
      }
      const pageStep = window.innerHeight * KEY_PAGE_SHARE;
      const deltas: Record<string, number> = {
        ArrowDown: KEY_LINE_STEP,
        ArrowUp: -KEY_LINE_STEP,
        PageDown: pageStep,
        PageUp: -pageStep,
        " ": pageStep,
        End: extra,
        Home: -extra,
      };
      const delta = deltas[event.key];
      if (delta !== undefined) {
        event.preventDefault();
        page(delta);
      }
    };
    const onViewportChange = () => {
      if (locked) {
        unlock();
      }
      measure();
    };

    measure();
    prevTop = outer.getBoundingClientRect().top;
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onViewportChange);
    mq.addEventListener("change", onViewportChange);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      if (locked) {
        document.documentElement.style.overflow = "";
      }
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onViewportChange);
      mq.removeEventListener("change", onViewportChange);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <section
      className="scroll-mt-20 py-12"
      id="about"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div ref={outerRef}>
        <div className="mx-auto grid max-w-[1200px] gap-6 px-4 sm:px-6 lg:grid-cols-2">
          <h2
            className="max-w-[374px] font-semibold text-[32px] leading-10 sm:text-[40px] sm:leading-[48px] lg:self-start"
            style={{ color: INK }}
          >
            Три шага до готового договора
          </h2>
          {/* Окно от низа героя (затекает на 48px выше грида) до низа экрана:
              оба обреза совпадают с естественными границами. Листается только
              его содержимое. */}
          <div
            className="lg:-mt-12 lg:h-[calc(42svh+163px)] lg:overflow-hidden lg:pt-12"
            ref={windowRef}
          >
            <div className="flex flex-col gap-10" ref={trackRef}>
              {STEPS.map((step) => (
                <div className="flex flex-col gap-6" key={step.n}>
                  {/* Персиковая панель с обрезанным «скриншотом» продукта */}
                  <div
                    className="relative aspect-[564/317] overflow-hidden rounded-lg"
                    style={{ backgroundColor: PANEL }}
                  >
                    <div
                      className="absolute w-[128%] overflow-hidden rounded-[10px] border border-[#ececec] bg-white shadow-2xl"
                      style={{ left: step.offset.left, top: step.offset.top }}
                    >
                      <img
                        alt={step.title}
                        className="block h-auto w-full"
                        height={810}
                        src={step.image}
                        width={1440}
                      />
                    </div>
                  </div>
                  {/* Подпись: Шаг N | Название | Описание */}
                  <div
                    className="flex flex-col gap-2 sm:flex-row sm:gap-6"
                    style={{ color: INK }}
                  >
                    <span className="w-[74px] shrink-0 font-medium text-base leading-5">
                      {step.n}
                    </span>
                    <span className="w-[172px] shrink-0 font-medium text-lg leading-[22px]">
                      {step.title}
                    </span>
                    <p className="flex-1 font-medium text-sm leading-[18px]">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
  icon: LucideIcon;
}

const LIBRARY_CARDS: LibraryCard[] = [
  {
    date: "Март 2025",
    title: "Договор аренды жилого помещения",
    desc: "С описью имущества, актом приёма-передачи и порядком возврата депозита",
    tag: "Недвижимость",
    icon: House,
  },
  {
    date: "Апр 2025",
    title: "Договор возмездного оказания услуг по разработке ПО",
    desc: "С передачей исключительных прав, поэтапной оплатой и актом сдачи-приёмки",
    tag: "Разработка",
    icon: CodeXml,
  },
  {
    date: "Сентябрь 2024",
    title: "Договор подряда на строительные работы",
    desc: "С локальной сметой, актами КС-2 и гарантийными обязательствами подрядчика",
    tag: "Строительство",
    icon: Hammer,
  },
  {
    date: "Май 2023",
    title: "Договор займа между физическими лицами",
    desc: "С графиком возврата, процентной ставкой и штрафами за просрочку",
    tag: "Финансы",
    icon: Coins,
  },
  {
    date: "Июнь 2023",
    title: "Договор на оказание маркетинговых услуг",
    desc: "С перечнем услуг, KPI и порядком сдачи результата для проектной работы",
    tag: "Маркетинг",
    icon: Megaphone,
  },
  {
    date: "Октябрь 2024",
    title: "Трудовой договор с дистанционным сотрудником",
    desc: "С режимом работы, постановкой задач и условиями расторжения по ТК РК",
    tag: "Кадры",
    icon: FileUser,
  },
  {
    date: "Июль 2023",
    title: "Договор поставки товаров и продукции",
    desc: "С условиями доставки, порядком приёмки и ответственностью за недостачу",
    tag: "Торговля",
    icon: Tags,
  },
  {
    date: "Март 2025",
    title: "Договор об оказании юридических услуг",
    desc: "С объёмом правовой помощи, стоимостью и условиями досрочного расторжения",
    tag: "Юриспруденция",
    icon: Scale,
  },
];

function Library() {
  return (
    <section
      className="scroll-mt-20 py-12"
      id="library"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 sm:px-6">
        <div className="flex flex-col items-start gap-4 lg:flex-row lg:justify-between">
          <h2 className="max-w-[374px] font-semibold text-[32px] text-black leading-10 sm:text-[40px] sm:leading-[48px]">
            В библиотеке более 1000+ договоров
          </h2>
          <p className="max-w-[389px] font-medium text-base text-black leading-5 lg:pt-3">
            Найдите нужный шаблон по категории или через поиск. Каждый договор
            составлен юристом, актуален на сегодняшний день и готов к
            заполнению.
          </p>
          <Button
            asChild
            className="h-9 shrink-0 rounded-full border-[#404040] bg-transparent px-4 font-medium text-[#0a0a0a] text-sm hover:bg-black/5"
            variant="outline"
          >
            <Link to="/register">
              Открыть каталог
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LIBRARY_CARDS.map((card) => (
            <div
              className="flex h-[242px] flex-col overflow-hidden rounded-2xl bg-white p-5"
              key={card.title}
            >
              <div className="flex h-6 items-center justify-between">
                <span className="flex items-center gap-2.5 font-medium text-[#0a0a0a] text-sm">
                  <RefreshCw className="size-4" />
                  {card.date}
                </span>
                <MoreHorizontal className="size-4 text-[#0a0a0a]" />
              </div>
              <h3 className="mt-4 line-clamp-2 font-semibold text-base text-black leading-5">
                {card.title}
              </h3>
              <p className="mt-2 line-clamp-3 font-medium text-[#a3a3a3] text-sm leading-[18px]">
                {card.desc}
              </p>
              <span className="mt-auto flex items-center gap-2 pt-4 font-medium text-[#0a0a0a] text-sm">
                <card.icon className="size-4" />
                {card.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface Benefit {
  lines: [string, string];
  desc: string;
}

const BENEFITS: Benefit[] = [
  {
    lines: ["Составлено", "юристами"],
    desc: "Каждый шаблон разработан практикующими юристами — не алгоритмом и не копированием из интернета.",
  },
  {
    lines: ["Актуально", "на сегодня"],
    desc: "Следим за изменениями в ТК РК и ГК РК и обновляем шаблоны каждую неделю.",
  },
  {
    lines: ["Готово", "за 7 минут"],
    desc: "Выберите шаблон, заполните поля — и получите договор, готовый к подписанию.",
  },
  {
    lines: ["Без юриста", "в штате"],
    desc: "Типовые договоры — без очередей, звонков и счетов на 50 000 ₸ за стандартный документ.",
  },
];

function CallToAction() {
  return (
    <section className="py-12" style={{ backgroundColor: PAGE_BG }}>
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-4 sm:px-6">
        <h2 className="max-w-[368px] text-center font-semibold text-[32px] text-black leading-10 sm:text-[40px] sm:leading-[48px]">
          Первый договор — бесплатно
        </h2>
        <p className="max-w-[389px] text-center font-medium text-base text-black leading-5">
          Зарегистрируйтесь и получите доступ к каталогу прямо сейчас. Без
          карты, без обязательств.
        </p>
        <Button
          asChild
          className="h-9 rounded-full bg-landing px-4 font-medium text-[#faf9f6] text-sm hover:bg-landing/90"
        >
          <Link to="/register">
            Начать бесплатно
            <ArrowRight className="size-4" />
          </Link>
        </Button>

        <div className="grid w-full gap-6 pt-16 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((benefit, index) => (
            <div className="flex flex-col gap-4" key={benefit.lines[0]}>
              <div className="flex items-start gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-black font-semibold text-base text-black">
                  {index + 1}
                </span>
                <h3 className="font-semibold text-2xl text-black leading-7">
                  {benefit.lines[0]}
                  <br />
                  {benefit.lines[1]}
                </h3>
              </div>
              <p className="pl-12 font-medium text-base text-black leading-5">
                {benefit.desc}
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
    <section
      className="scroll-mt-20 py-12"
      id="faq"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 sm:px-12 lg:grid-cols-2">
        <h2 className="max-w-[374px] font-semibold text-[32px] text-black leading-10 sm:text-[40px] sm:leading-[48px] lg:self-start">
          Часто задаваемые вопросы
        </h2>
        <div className="flex flex-col gap-6">
          {FAQ_ITEMS.map((item) => (
            <details
              className="group border-[#0a0a0a] border-b pb-6 last:border-b-0 last:pb-0"
              key={item.q}
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-12">
                <span className="flex-1 font-semibold text-2xl text-[#0a0a0a] leading-7">
                  {item.q}
                </span>
                <ChevronDown className="mt-1 size-6 shrink-0 text-[#0a0a0a] transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-4 pr-12 font-medium text-[#0a0a0a] text-base leading-5">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

const FOOTER_MENU = [
  { href: "#about", label: "Решения" },
  { href: "#library", label: "Библиотека договоров" },
  { href: "#top", label: "Блог" },
  { href: "#top", label: "О нас" },
];

// Ссылки на соцсети пока не определены — проставьте реальные адреса.
const FOOTER_SOCIALS = [
  { label: "Instagram", icon: "/landing/social-instagram.svg", href: "#top" },
  { label: "Telegram", icon: "/landing/social-telegram.svg", href: "#top" },
  { label: "WhatsApp", icon: "/landing/social-whatsapp.svg", href: "#top" },
  { label: "YouTube", icon: "/landing/social-youtube.svg", href: "#top" },
];

function Footer() {
  return (
    <footer className="bg-[#1b1b1b] text-[#fafafa]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-12 sm:px-12">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <ZhebeLogo className="h-[72px] w-auto text-[#fafafa]" />
          <div className="flex flex-wrap items-center gap-1">
            {FOOTER_MENU.map((item) => (
              <a
                className="flex min-h-8 items-center gap-2 rounded-md px-2 py-1.5 font-medium text-[#fafafa] text-sm hover:bg-white/10"
                href={item.href}
                key={item.label}
              >
                {item.label}
                <ArrowUpRight className="size-4" />
              </a>
            ))}
          </div>
        </div>

        <div className="h-px w-full bg-white/10" />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-medium text-sm">
            <Globe className="size-4" />
            <a className="py-2 hover:underline" href="/terms">
              Договор оферты
            </a>
            <a className="py-2 hover:underline" href="/privacy">
              Политика конфиденциальности
            </a>
            <a className="py-2 hover:underline" href="/privacy#cookies">
              Политика Cookies
            </a>
            <span className="py-2">Все права защищены. ТОО «Zhebe»</span>
            <a
              className="py-2 text-[#faf9f6] hover:underline"
              href="tel:+87753864010"
            >
              +8 775 386 40 10
            </a>
          </div>
          <div className="flex items-center gap-2">
            {FOOTER_SOCIALS.map((social) => (
              <a
                aria-label={social.label}
                className="flex size-10 items-center justify-center rounded-full bg-[#262626] transition-colors hover:bg-[#333]"
                href={social.href}
                key={social.label}
              >
                <img
                  alt=""
                  className="size-6"
                  height={24}
                  src={social.icon}
                  width={24}
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div
      className="min-h-svh scroll-smooth"
      style={{ backgroundColor: PAGE_BG }}
    >
      <Navbar />
      <main>
        <Hero />
        <Steps />
        <Library />
        <CallToAction />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
