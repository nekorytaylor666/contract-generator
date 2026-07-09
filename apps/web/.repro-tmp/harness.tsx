/** jsdom harness: mounts the real TemplateForm + InteractiveDocumentPreview with
 * builder-route state logic, clicks radios like a user, watches for crashes. */
import { readFileSync } from "node:fs";
import { JSDOM } from "/Users/hellomik/projects/contract-generator/apps/web/node_modules/jsdom/lib/api.js";

const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { pretendToBeVisual: true, url: "http://localhost/" }
);

const g = globalThis as Record<string, unknown>;
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "Element",
  "Node",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "KeyboardEvent",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "localStorage",
  "MutationObserver",
  "DocumentFragment",
  "SVGElement",
]) {
  try {
    Object.defineProperty(g, key, {
      value: (dom.window as unknown as Record<string, unknown>)[key],
      configurable: true,
      writable: true,
    });
  } catch {
    /* read-only global */
  }
}
// jsdom has no Element.scrollTo — the preview calls container.scrollTo on highlight.
(dom.window.Element.prototype as unknown as Record<string, unknown>).scrollTo =
  () => {
    /* noop */
  };
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
g.ResizeObserver = ResizeObserverStub;
(dom.window as unknown as Record<string, unknown>).ResizeObserver =
  ResizeObserverStub;

const errors: string[] = [];
dom.window.addEventListener("error", (e: ErrorEvent) => {
  errors.push(`window.onerror: ${e.message}`);
});
dom.window.addEventListener("unhandledrejection", (e) => {
  errors.push(
    `unhandledrejection: ${String((e as { reason?: unknown }).reason)}`
  );
});
const origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args.map(String).join(" ");
  if (!msg.includes("act(")) {
    errors.push(`console.error: ${msg.slice(0, 500)}`);
  }
};

const source = readFileSync(new URL("./template.typ", import.meta.url), "utf8");

async function main() {
  const React = (await import("react")).default;
  const { createRoot } = await import("react-dom/client");
  const { interpretNativeToMarkup } = await import(
    "/Users/hellomik/projects/contract-generator/apps/web/src/lib/native-interpreter"
  );
  const { interpretNative } = await import(
    "/Users/hellomik/projects/contract-generator/apps/web/src/lib/native-interpreter"
  );
  const { parseNativeLets, parseNativeSections } = await import(
    "/Users/hellomik/projects/contract-generator/apps/web/src/lib/native-typst"
  );
  const { TemplateForm } = await import(
    "/Users/hellomik/projects/contract-generator/apps/web/src/components/template-builder/template-form"
  );
  const { InteractiveDocumentPreview } = await import(
    "/Users/hellomik/projects/contract-generator/apps/web/src/components/template-builder/interactive-document-preview"
  );
  const { PreviewErrorBoundary } = await import(
    "/Users/hellomik/projects/contract-generator/apps/web/src/components/template-builder/preview-error-boundary"
  );
  const { NativeForm } = await import(
    "/Users/hellomik/projects/contract-generator/apps/web/src/components/template-builder/native-form"
  );
  const { NativeInlinePreview } = await import(
    "/Users/hellomik/projects/contract-generator/apps/web/src/components/template-builder/native-inline-preview"
  );

  const h = React.createElement;
  const { useState, useRef, useCallback, useMemo } = React;

  // Stored variables from the DB take priority in the builder — and there the
  // selects have NO defaultValue, so the route initializes them to "".
  const variables = JSON.parse(
    readFileSync(new URL("./db-variables.json", import.meta.url), "utf8")
  ) as ReturnType<typeof parseNativeLets>;
  const defaults: Record<string, unknown> = {};
  for (const v of variables) {
    if (v.defaultValue !== undefined) {
      defaults[v.name] = v.defaultValue;
    } else if (v.type === "boolean") {
      defaults[v.name] = false;
    } else {
      defaults[v.name] = "";
    }
  }

  // --- NativeInlinePreview clone (server fallback replaced by a marker) ---
  const FIELD_RE = /\{\{(\w+)\}\}/g;
  const BLOCK_LINE_RE =
    /^(#align|#grid|#v\(|#parbreak|#image|#line|#block|#set|#let|#if|=)/;
  function injectHighlights(prev: string, next: string): string {
    const oldLines = new Set(
      prev
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    );
    return next
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (
          !trimmed ||
          oldLines.has(trimmed) ||
          BLOCK_LINE_RE.test(trimmed) ||
          trimmed.includes("[") ||
          trimmed.includes("]")
        ) {
          return line;
        }
        const indent = line.slice(0, line.length - line.trimStart().length);
        let content = trimmed;
        let suffix = "";
        if (content.endsWith("\\")) {
          content = content.slice(0, -1).trimEnd();
          suffix = " \\";
        }
        return content ? `${indent}#hl[${content}]${suffix}` : line;
      })
      .join("\n");
  }
  function withBackfilledFields(markup: string, vars: typeof variables) {
    const known = new Set(vars.map((v) => v.name));
    const extra: typeof variables = [];
    for (const match of markup.matchAll(FIELD_RE)) {
      const name = match[1];
      if (!known.has(name)) {
        known.add(name);
        extra.push({ name, type: "text", label: name, required: false });
      }
    }
    return extra.length > 0 ? [...vars, ...extra] : vars;
  }

  function MiniInlinePreview(props: {
    values: Record<string, unknown>;
    changedVars: Set<string>;
    onValueChange: (name: string, value: unknown) => void;
  }) {
    const prevCleanRef = useRef<string | null>(null);
    const displayRef = useRef<string | null>(null);
    const valuesKey = JSON.stringify(props.values ?? {});
    const markup = useMemo(
      () => interpretNativeToMarkup(source, JSON.parse(valuesKey)),
      [valuesKey]
    );
    const resolvedVariables = useMemo(
      () =>
        markup === null ? variables : withBackfilledFields(markup, variables),
      [markup]
    );
    if (markup === null) {
      return h("div", null, "SERVER_FALLBACK");
    }
    if (markup !== prevCleanRef.current) {
      const prevClean = prevCleanRef.current;
      displayRef.current =
        prevClean === null ? markup : injectHighlights(prevClean, markup);
      prevCleanRef.current = markup;
    }
    const displayMarkup = displayRef.current ?? markup;
    return h(InteractiveDocumentPreview, {
      changedVars: props.changedVars,
      logo: null,
      onValueChange: props.onValueChange,
      style: { font: "New Computer Modern", preset: "default" },
      typstContent: displayMarkup,
      values: props.values,
      variables: resolvedVariables,
    });
  }

  // --- NativeForm clone ---
  const FIELD_SEP = ",";
  function filterSections(
    sections: ReturnType<typeof parseNativeSections>,
    allowed: ReadonlySet<string>
  ) {
    const result: typeof sections = [];
    for (const section of sections) {
      const fields = section.fields.filter((n) => allowed.has(n));
      const subsections = section.subsections
        .map((sub) => ({
          ...sub,
          fields: sub.fields.filter((n) => allowed.has(n)),
        }))
        .filter((sub) => sub.fields.length > 0);
      if (fields.length > 0 || subsections.length > 0) {
        result.push({ ...section, fields, subsections });
      }
    }
    return result;
  }

  function MiniNativeForm(props: {
    values: Record<string, unknown>;
    formApiRef: React.RefObject<{
      setFieldValue: (n: string, v: unknown) => void;
      getValues: () => Record<string, unknown>;
    } | null>;
    onValuesChange: (values: Record<string, unknown>) => void;
  }) {
    const valuesKey = JSON.stringify(props.values ?? {});
    const reachableKey = useMemo(() => {
      const fields = interpretNative(source, JSON.parse(valuesKey))?.fields;
      return fields ? [...fields].sort().join(FIELD_SEP) : null;
    }, [valuesKey]);
    const visibleVariables = useMemo(() => {
      if (reachableKey === null) {
        return variables;
      }
      const allowed = new Set(reachableKey.split(FIELD_SEP));
      return variables.filter((v) => allowed.has(v.name));
    }, [reachableKey]);
    const allSections = useMemo(() => parseNativeSections(source), []);
    const sections = useMemo(() => {
      if (allSections.length === 0) {
        return;
      }
      const allowed = new Set(visibleVariables.map((v) => v.name));
      return filterSections(allSections, allowed);
    }, [allSections, visibleVariables]);
    return h(TemplateForm, {
      formApiRef: props.formApiRef,
      onValuesChange: props.onValuesChange,
      sections,
      variables: visibleVariables,
    });
  }

  // --- builder-route state logic ---
  function Harness() {
    const [formValues, setFormValues] =
      useState<Record<string, unknown>>(defaults);
    const [changedVars, setChangedVars] = useState<Set<string>>(new Set());
    const latestValuesRef = useRef<Record<string, unknown> | null>(defaults);
    const isInlineUpdateRef = useRef(false);
    const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
      undefined
    );
    const formApiRef = useRef<{
      setFieldValue: (n: string, v: unknown) => void;
      getValues: () => Record<string, unknown>;
    } | null>(null);

    const triggerHighlight = useCallback((names: Set<string>) => {
      if (names.size === 0) {
        return;
      }
      setChangedVars(names);
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(
        () => setChangedVars(new Set()),
        4000
      );
    }, []);

    const handleInlineChange = useCallback(
      (name: string, value: unknown) => {
        isInlineUpdateRef.current = true;
        setFormValues((prev) => {
          const next = { ...prev, [name]: value };
          latestValuesRef.current = next;
          return next;
        });
        triggerHighlight(new Set([name]));
        formApiRef.current?.setFieldValue(name, value);
        requestAnimationFrame(() => {
          isInlineUpdateRef.current = false;
        });
      },
      [triggerHighlight]
    );

    const handleValuesChange = useCallback(
      (values: Record<string, unknown>) => {
        if (isInlineUpdateRef.current) {
          return;
        }
        const prev = latestValuesRef.current;
        if (prev) {
          const changed = new Set<string>();
          for (const key of Object.keys(values)) {
            if (String(values[key] ?? "") !== String(prev[key] ?? "")) {
              changed.add(key);
            }
          }
          triggerHighlight(changed);
        }
        latestValuesRef.current = values;
        setFormValues(values);
      },
      [triggerHighlight]
    );

    return h(
      "div",
      null,
      h(
        PreviewErrorBoundary,
        null,
        h(NativeInlinePreview, {
          typstContent: source,
          variables,
          values: formValues,
          changedVars,
          onValueChange: handleInlineChange,
          logo: null,
          style: { font: "New Computer Modern", preset: "default" },
        })
      ),
      h(
        PreviewErrorBoundary,
        null,
        h(NativeForm, {
          typstContent: source,
          values: formValues,
          variables,
          formApiRef,
          onValuesChange: handleValuesChange,
        })
      )
    );
  }

  const root = createRoot(
    dom.window.document.getElementById("root") as HTMLElement
  );
  root.render(h(React.StrictMode, null, h(Harness)));

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await sleep(500);

  function snapshot(label: string) {
    const body = dom.window.document.body;
    const hasDoc = body.textContent?.includes("ДОГОВОР РАЗОВОЙ ПОСТАВКИ");
    const boundaryTripped = body.textContent?.includes(
      "Не удалось отобразить документ"
    );
    const radios = body.querySelectorAll('input[type="radio"]').length;
    console.log(
      `[${label}] doc=${hasDoc ? "yes" : "NO"} boundary=${boundaryTripped ? "TRIPPED" : "ok"} radios=${radios} errors=${errors.length}`
    );
    for (const e of errors.splice(0)) {
      console.log(`   ${e}`);
    }
  }

  snapshot("initial");

  // Click every radio option group by group, like a user exploring the form.
  // Pass 1: click through every radio option group by group (doc order), waiting out the debounce.
  const groups = [
    ...new Set(
      [...dom.window.document.querySelectorAll('input[type="radio"]')].map(
        (el) => (el as HTMLInputElement).name
      )
    ),
  ];
  for (const name of groups) {
    const inputs = [
      ...dom.window.document.querySelectorAll(
        `input[type="radio"][name="${name}"]`
      ),
    ] as HTMLInputElement[];
    for (const input of inputs) {
      const value = input.value;
      input.click();
      await sleep(450);
      snapshot(`after ${name}=${value}`);
    }
  }
  // Pass 2: segmented 2-option groups render as buttons — click all buttons in the form.
  const segButtons = [
    ...dom.window.document.querySelectorAll("form button[type=button]"),
  ] as HTMLElement[];
  console.log(`segmented buttons: ${segButtons.length}`);
  for (const b of segButtons) {
    b.click();
    await sleep(450);
    snapshot(`after button "${b.textContent?.slice(0, 30)}"`);
  }
  // Pass 3: rapid-fire radios without waiting for the debounce.
  const radios = [
    ...dom.window.document.querySelectorAll('input[type="radio"]'),
  ] as HTMLInputElement[];
  for (const r of radios) {
    r.click();
    await sleep(30);
  }
  await sleep(800);
  snapshot("after rapid-fire");

  console.error = origConsoleError;
  root.unmount();
  console.log("harness done");
  process.exit(0);
}

main().catch((e) => {
  console.error = origConsoleError;
  console.error("HARNESS FAILED:", e);
  process.exit(1);
});
