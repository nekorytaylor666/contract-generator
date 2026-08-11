import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { useTRPC } from "@/utils/trpc";

// Продуктовый тур из макета «05_Onboarding»: 7 тёмных подсказок ведут нового
// пользователя от каталога до скачивания первого договора. Прогресс живёт в
// localStorage (переживает оплату/перезагрузку), факт завершения — в БД.

const STEP_STORAGE_KEY = "zhebe-tour-step";
const TOOLTIP_WIDTH = 296;
const VIEWPORT_MARGIN = 8;
const TARGET_GAP = 10;
const REMEASURE_INTERVAL_MS = 400;
const CONFETTI_PIECES = 70;
const CONFETTI_LIFETIME_MS = 2600;
const CONFETTI_COLORS = [
  "#e91e63",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#a855f7",
];

type Placement = "center" | "bottom" | "bottom-end" | "top" | "left";

interface TourStep {
  /** Какому пути принадлежит шаг — на других страницах подсказка скрыта. */
  matches: (pathname: string) => boolean;
  target: string;
  placement: Placement;
  titleKey: string;
  textKey: string;
  /** «Вперёд» кликает по цели (переход на карточку / открытие редактора). */
  advanceByTargetClick?: boolean;
  /** Куда ведёт «Назад», если предыдущий шаг на другой странице. */
  backTo?: string;
  showBack?: boolean;
}

const CATALOGUE_PATH = /^\/templates\/?$/;
const TEMPLATE_PATH = /^\/templates\/[^/]+\/?$/;
const BUILDER_PATH = /^\/templates\/[^/]+\/builder\/?$/;

const isCatalogue = (p: string) => CATALOGUE_PATH.test(p);
const isTemplatePage = (p: string) => TEMPLATE_PATH.test(p);
const isBuilder = (p: string) => BUILDER_PATH.test(p);

const STEPS: TourStep[] = [
  {
    matches: isCatalogue,
    target: "catalog",
    placement: "center",
    titleKey: "tour.step1Title",
    textKey: "tour.step1Text",
  },
  {
    matches: isCatalogue,
    target: "search",
    placement: "bottom",
    titleKey: "tour.step2Title",
    textKey: "tour.step2Text",
    showBack: true,
  },
  {
    matches: isCatalogue,
    target: "filters",
    placement: "bottom",
    titleKey: "tour.step3Title",
    textKey: "tour.step3Text",
    showBack: true,
  },
  {
    matches: isCatalogue,
    target: "template-card",
    placement: "top",
    titleKey: "tour.step4Title",
    textKey: "tour.step4Text",
    advanceByTargetClick: true,
    showBack: true,
  },
  {
    matches: isTemplatePage,
    target: "edit",
    placement: "bottom-end",
    titleKey: "tour.step5Title",
    textKey: "tour.step5Text",
    advanceByTargetClick: true,
    backTo: "/templates",
    showBack: true,
  },
  {
    matches: isBuilder,
    target: "builder-form",
    placement: "left",
    titleKey: "tour.step6Title",
    textKey: "tour.step6Text",
  },
  {
    matches: isBuilder,
    target: "download",
    placement: "bottom-end",
    titleKey: "tour.step7Title",
    textKey: "tour.step7Text",
  },
];

function readStoredStep(): number {
  const raw = localStorage.getItem(STEP_STORAGE_KEY);
  const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0 || parsed >= STEPS.length) {
    return 0;
  }
  return parsed;
}

function findTarget(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
}

interface TooltipPosition {
  left: number;
  top: number;
  arrow: { side: "top" | "bottom" | "right"; offset: number } | null;
}

function positionFor(
  placement: Placement,
  rect: DOMRect,
  size: { width: number; height: number }
): TooltipPosition {
  const clampLeft = (left: number) =>
    Math.min(
      Math.max(left, VIEWPORT_MARGIN),
      window.innerWidth - size.width - VIEWPORT_MARGIN
    );
  const targetCenterX = rect.left + rect.width / 2;

  if (placement === "center") {
    // Приветственный шаг: висит над верхней частью сетки, как в макете.
    const top = Math.max(
      VIEWPORT_MARGIN,
      Math.min(
        rect.top + 140,
        window.innerHeight - size.height - VIEWPORT_MARGIN
      )
    );
    return {
      left: clampLeft(targetCenterX - size.width / 2),
      top,
      arrow: null,
    };
  }
  if (placement === "top") {
    const left = clampLeft(targetCenterX - size.width / 2);
    return {
      left,
      top: rect.top - size.height - TARGET_GAP,
      arrow: { side: "bottom", offset: targetCenterX - left },
    };
  }
  if (placement === "left") {
    return {
      left: clampLeft(rect.left - size.width - TARGET_GAP),
      top: rect.top + Math.min(rect.height / 2, 160) - size.height / 2,
      arrow: { side: "right", offset: size.height / 2 },
    };
  }
  // bottom / bottom-end
  const left = clampLeft(
    placement === "bottom-end"
      ? rect.right - size.width
      : targetCenterX - size.width / 2
  );
  return {
    left,
    top: rect.bottom + TARGET_GAP,
    arrow: { side: "top", offset: targetCenterX - left },
  };
}

// Рамка вокруг подсвеченного элемента — как в макете, тёмный контур с отступом.
function applyHighlight(el: HTMLElement) {
  el.style.outline = "2px solid #171717";
  el.style.outlineOffset = "3px";
  el.style.borderRadius = el.style.borderRadius || "10px";
}

function clearHighlight(el: HTMLElement) {
  el.style.outline = "";
  el.style.outlineOffset = "";
}

function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_PIECES }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 1.6 + Math.random() * 1.2,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: Math.random() * 360,
        width: 6 + Math.random() * 6,
        height: 10 + Math.random() * 8,
      })),
    []
  );
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[70] overflow-hidden"
    >
      {pieces.map((p) => (
        <span
          className="absolute top-[-24px] block animate-tour-confetti rounded-[2px]"
          key={p.id}
          style={{
            left: `${p.left}%`,
            width: p.width,
            height: p.height,
            backgroundColor: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

function TourArrow({
  arrow,
}: {
  arrow: NonNullable<TooltipPosition["arrow"]>;
}) {
  const base = "absolute size-2.5 rotate-45 bg-[#1f1f1f]";
  if (arrow.side === "top") {
    return (
      <span
        className={`${base} top-[-5px]`}
        style={{ left: arrow.offset - 5 }}
      />
    );
  }
  if (arrow.side === "bottom") {
    return (
      <span
        className={`${base} bottom-[-5px]`}
        style={{ left: arrow.offset - 5 }}
      />
    );
  }
  return (
    <span
      className={`${base} right-[-5px]`}
      style={{ top: arrow.offset - 5 }}
    />
  );
}

export function ProductTour() {
  const { t } = useTranslation();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const statusQuery = useQuery(trpc.onboarding.status.queryOptions());
  const completeTourMutation = useMutation(
    trpc.onboarding.completeTour.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.onboarding.status.queryKey(),
        }),
    })
  );

  const [step, setStep] = useState(readStoredStep);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [tooltipSize, setTooltipSize] = useState({
    width: TOOLTIP_WIDTH,
    height: 160,
  });
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const highlightedRef = useRef<HTMLElement | null>(null);

  const status = statusQuery.data;
  const active = Boolean(
    status?.completedAt && !status.tourCompletedAt && !celebrating
  );
  const current = STEPS[step];
  const onStepRoute = active && current.matches(location.pathname);

  useEffect(() => {
    localStorage.setItem(STEP_STORAGE_KEY, String(step));
  }, [step]);

  // Следим за целью шага: пока страница грузится, элемента может не быть —
  // перемеряем по интервалу, а также на скролл/резайз (в т.ч. вложенный скролл).
  useEffect(() => {
    if (!onStepRoute) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = findTarget(current.target);
      if (!el) {
        setRect(null);
        return;
      }
      if (highlightedRef.current !== el) {
        if (highlightedRef.current) {
          clearHighlight(highlightedRef.current);
        }
        highlightedRef.current = el;
        if (current.placement !== "center") {
          applyHighlight(el);
        }
      }
      setRect(el.getBoundingClientRect());
    };
    measure();
    const interval = window.setInterval(measure, REMEASURE_INTERVAL_MS);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      if (highlightedRef.current) {
        clearHighlight(highlightedRef.current);
        highlightedRef.current = null;
      }
    };
  }, [onStepRoute, current.target, current.placement]);

  // Размер зависит от текста шага и наличия цели — меряем после каждого рендера
  // с новым rect/шагом.
  // biome-ignore lint/correctness/useExhaustiveDependencies: rect и step — триггеры перезамера, не данные эффекта
  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (el) {
      setTooltipSize({ width: el.offsetWidth, height: el.offsetHeight });
    }
  }, [rect, step]);

  if (!(active && onStepRoute && rect)) {
    return celebrating ? createPortal(<ConfettiBurst />, document.body) : null;
  }

  const finish = () => {
    localStorage.removeItem(STEP_STORAGE_KEY);
    completeTourMutation.mutate();
  };

  const handleSkip = () => finish();

  const handleNext = () => {
    if (step === STEPS.length - 1) {
      // «Завершить»: конфетти как на финальном экране макета.
      setCelebrating(true);
      window.setTimeout(() => setCelebrating(false), CONFETTI_LIFETIME_MS);
      finish();
      return;
    }
    if (current.advanceByTargetClick) {
      findTarget(current.target)?.click();
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    if (current.backTo) {
      navigate({ to: current.backTo });
    }
    setStep(Math.max(0, step - 1));
  };

  const pos = positionFor(current.placement, rect, tooltipSize);
  const isLast = step === STEPS.length - 1;

  return createPortal(
    <div
      className="fixed z-[60] flex w-[296px] flex-col gap-2 rounded-2xl bg-[#1f1f1f] p-4 shadow-lg"
      ref={tooltipRef}
      style={{ left: pos.left, top: pos.top }}
    >
      {pos.arrow && <TourArrow arrow={pos.arrow} />}
      <div className="flex items-start justify-between gap-6">
        <p className="font-semibold text-[16px] text-white leading-5">
          {t(current.titleKey)}
        </p>
        <button
          aria-label={t("tour.skip")}
          className="mt-0.5 text-white/80 transition-colors hover:text-white"
          onClick={handleSkip}
          type="button"
        >
          <XIcon className="size-4" />
        </button>
      </div>
      <p className="text-[#a3a3a3] text-xs leading-4">{t(current.textKey)}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-white text-xs">
          {step + 1}/{STEPS.length}
        </span>
        <div className="flex items-center gap-2">
          {current.showBack && (
            <button
              className="min-h-8 rounded-full border border-[#404040] px-3 text-[#fafafa] text-sm transition-colors hover:bg-white/10"
              onClick={handleBack}
              type="button"
            >
              {t("tour.back")}
            </button>
          )}
          <button
            className="min-h-8 rounded-full bg-[#f5f5f5] px-3 text-[#0a0a0a] text-sm transition-colors hover:bg-white"
            onClick={handleNext}
            type="button"
          >
            {isLast ? t("tour.finish") : t("tour.next")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
