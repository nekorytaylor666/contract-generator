import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { ZhebeLogo } from "@/components/zhebe-logo";

/**
 * Shared chrome for public legal documents (privacy policy, user agreement).
 * Rendered chromeless (no app sidebar) and without auth.
 */
export function LegalPage({
  title,
  subtitle,
  publishedAt,
  children,
}: {
  title: string;
  subtitle?: string;
  publishedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-border border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link aria-label="Zhebe — на главную" to="/">
            <ZhebeLogo className="h-5 w-auto" />
          </Link>
          <Link
            className="flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
            to="/"
          >
            <ArrowLeft className="size-4" />
            На главную
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-semibold text-2xl text-foreground leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-muted-foreground text-sm">{subtitle}</p>
        )}
        <p className="mt-3 text-muted-foreground text-sm">
          Дата публикации: {publishedAt}
        </p>
        <div className="mt-10 flex flex-col gap-10">{children}</div>
      </main>

      <footer className="border-border border-t">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-6 py-8 text-muted-foreground text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>© ТОО «Primeis», БИН 931240001576</span>
          <div className="flex gap-4">
            <Link className="hover:text-foreground" to="/privacy">
              Политика конфиденциальности
            </Link>
            <Link className="hover:text-foreground" to="/terms">
              Пользовательское соглашение
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex scroll-mt-20 flex-col gap-3" id={id}>
      <h2 className="font-semibold text-foreground text-lg">{title}</h2>
      {children}
    </section>
  );
}

// A numbered clause paragraph: «1.1. Текст…».
export function Clause({
  n,
  children,
}: {
  n: string;
  children: React.ReactNode;
}) {
  return (
    <p className="text-[15px] text-foreground/90 leading-relaxed">
      <span className="font-medium text-foreground">{n}</span> {children}
    </p>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="ml-5 flex list-disc flex-col gap-1.5 text-[15px] text-foreground/90 leading-relaxed">
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static legal text, never reordered
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
