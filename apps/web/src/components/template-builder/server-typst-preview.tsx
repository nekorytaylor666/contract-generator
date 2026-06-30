import { useMutation } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useTRPC } from "@/utils/trpc";

import { renderTypstVector } from "./typst-canvas-preview";

/**
 * Read-only preview for *native* Typst templates (those using `#let`, functions,
 * `#fill`, etc. instead of our `{{var}}` placeholders). The interactive client
 * parser can't render these, so we compile them server-side with the real Typst
 * compiler and render the resulting vector via the WASM renderer.
 */
export function ServerTypstPreview({
  typstContent,
  values,
}: {
  typstContent: string;
  // Native `#let` values to substitute before compiling (omitted = defaults).
  values?: Record<string, unknown>;
}) {
  const trpc = useTRPC();
  const containerRef = useRef<HTMLDivElement>(null);
  const [vectorData, setVectorData] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const compile = useMutation(
    trpc.templates.previewDraft.mutationOptions({
      onSuccess: (result) => {
        setVectorData(result.vectorData);
        setFailed(false);
      },
      onError: () => setFailed(true),
    })
  );

  // Recompile when the Typst or values change (debounced for smooth editing).
  // Serialize values so object identity doesn't trigger needless recompiles.
  const { mutate } = compile;
  const valuesKey = JSON.stringify(values ?? {});
  useEffect(() => {
    const id = setTimeout(
      () =>
        mutate({ typstContent, variables: [], values: JSON.parse(valuesKey) }),
      300
    );
    return () => clearTimeout(id);
  }, [typstContent, valuesKey, mutate]);

  useEffect(() => {
    if (vectorData && containerRef.current) {
      renderTypstVector(containerRef.current, vectorData);
    }
  }, [vectorData]);

  if (failed) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <FileText className="mx-auto size-12 text-muted-foreground/30" />
          <p className="mt-3 text-muted-foreground text-sm">
            Не удалось отобразить предпросмотр документа
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-auto">
      {compile.isPending && !vectorData && (
        <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
          Рендеринг…
        </div>
      )}
      <div
        className="flex w-full flex-col items-center gap-4 p-4"
        ref={containerRef}
      />
    </div>
  );
}

const VAR_PLACEHOLDER_REGEX = /\{\{\w+\}\}/;

// Native Typst = no `{{var}}` placeholders (uses #let / functions instead).
export function isNativeTypst(content: string): boolean {
  return !VAR_PLACEHOLDER_REGEX.test(content);
}
