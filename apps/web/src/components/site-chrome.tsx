import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { ZhebeLogo } from "@/components/zhebe-logo";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

// Общий каркас публичных страниц /library и /plans (макеты «/Library»,
// «/Plans»): светлый навбар с тёмным текстом и тёмный футер. Лендинг и
// /about несут собственные навбары (бордовый и поверх фото).

const NAV_ITEMS = [
  { to: "/about", labelKey: "landing.nav.aboutUs" },
  { to: "/library", labelKey: "landing.nav.library" },
  { to: "/plans", labelKey: "landing.nav.plans" },
] as const;

export function PublicNavbar({
  scrolledClassName = "bg-white/90 backdrop-blur-md",
}: {
  /** Фон закреплённого навбара после начала скролла — под цвет страницы. */
  scrolledClassName?: string;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  // Публичные страницы живут вне app-shell — сессию проверяем сами.
  const { data: session, isPending } = authClient.useSession();
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
        "sticky top-0 z-50 transition-colors duration-200",
        scrolled && scrolledClassName
      )}
    >
      <nav className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <Link aria-label="Zhebe" className="flex flex-1 items-center" to="/">
          <ZhebeLogo className="h-10 w-auto text-[#1b1b1b] sm:h-12" />
        </Link>
        <div className="hidden items-center gap-0.5 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              className="rounded-lg px-4 py-2 font-medium text-[#1b1b1b] text-sm transition-colors hover:bg-black/5"
              key={item.to}
              to={item.to}
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </div>
        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-4">
          <LanguageSwitcher triggerClassName="text-[#1b1b1b] hover:bg-black/5" />
          {/* На самых узких экранах кнопка не влезает — она дублируется в
              бургер-меню. */}
          {session && (
            <Button
              asChild
              className="hidden h-9 rounded-lg bg-[#1b1b1b] px-3 font-medium text-[#faf9f6] text-sm hover:bg-[#1b1b1b]/90 sm:px-4 min-[400px]:inline-flex"
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
                className="hidden h-9 rounded-lg border-[#1b1b1b] bg-transparent px-4 font-medium text-[#1b1b1b] text-sm hover:bg-black/5 sm:inline-flex"
                variant="outline"
              >
                <Link to="/login">{t("landing.nav.login")}</Link>
              </Button>
              <Button
                asChild
                className="h-9 rounded-lg bg-[#1b1b1b] px-3 font-medium text-[#faf9f6] text-sm hover:bg-[#1b1b1b]/90 sm:px-4"
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
            className="flex size-9 items-center justify-center rounded-lg text-[#1b1b1b] transition-colors hover:bg-black/5 md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div className="border-black/10 border-t bg-white/95 px-4 pb-4 backdrop-blur-sm md:hidden">
          <div className="flex flex-col gap-1 pt-3">
            {NAV_ITEMS.map((item) => (
              <Link
                className="rounded-lg px-3 py-2.5 text-[#1b1b1b]/90 text-sm transition-colors hover:bg-black/5"
                key={item.to}
                onClick={() => setMenuOpen(false)}
                to={item.to}
              >
                {t(item.labelKey)}
              </Link>
            ))}
            {session && (
              <Link
                className="rounded-lg px-3 py-2.5 text-[#1b1b1b]/90 text-sm transition-colors hover:bg-black/5 min-[400px]:hidden"
                onClick={() => setMenuOpen(false)}
                to="/templates"
              >
                {t("landing.nav.openApp")}
              </Link>
            )}
            {!(session || isPending) && (
              <Link
                className="rounded-lg px-3 py-2.5 text-[#1b1b1b]/90 text-sm transition-colors hover:bg-black/5 sm:hidden"
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

// Консультации/соцсети — как в футере /about.
const WHATSAPP_URL = "https://wa.me/77711017744";
const PHONE_DISPLAY = "+7 771 101 77 44";
const PHONE_HREF = "tel:+77711017744";
const EMAIL = "info@zhebe.kz";

export function PublicFooter() {
  const { t } = useTranslation();
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
            <Link className={itemClassName} to="/library">
              {t("about.footer.library")}
              <ArrowUpRight className="size-4" />
            </Link>
            <Link className={itemClassName} to="/about">
              {t("about.footer.aboutUs")}
              <ArrowUpRight className="size-4" />
            </Link>
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
