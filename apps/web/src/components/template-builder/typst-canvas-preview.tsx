import { Download, FileText, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface TypstCanvasPreviewProps {
  vectorData: string | null;
  isLoading?: boolean;
  onDownload?: () => void;
  isDownloading?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
}

interface RendererState {
  renderer: import("@myriaddreamin/typst.ts").TypstRenderer;
  initialized: boolean;
}

let rendererPromise: Promise<RendererState> | null = null;

function getRenderer(): Promise<RendererState> {
  if (rendererPromise) {
    return rendererPromise;
  }
  rendererPromise = (async () => {
    const { createTypstRenderer } = await import("@myriaddreamin/typst.ts");
    const renderer = createTypstRenderer();
    await renderer.init({
      getModule: () => fetch("/typst_ts_renderer_bg.wasm"),
    });
    return { renderer, initialized: true };
  })();
  return rendererPromise;
}

export function TypstCanvasPreview({
  vectorData,
  isLoading,
  onDownload,
  isDownloading,
  onSave,
  isSaving,
}: TypstCanvasPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const renderingRef = useRef(false);

  const renderDocument = useCallback(async (data: string) => {
    if (renderingRef.current || !containerRef.current) {
      return;
    }
    renderingRef.current = true;

    try {
      const { renderer } = await getRenderer();
      const binaryStr = atob(data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const container = containerRef.current;
      if (!container) {
        return;
      }

      // Clear previous render
      container.innerHTML = "";

      await renderer.renderToCanvas({
        container,
        pixelPerPt: 2.5,
        backgroundColor: "#ffffff",
        format: "vector",
        artifactContent: bytes,
      });

      // Count rendered pages from the generated canvases
      const canvases = container.querySelectorAll("canvas");
      setPageCount(canvases.length);
    } catch (err) {
      console.error("Typst canvas render failed:", err);
    } finally {
      renderingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (vectorData) {
      renderDocument(vectorData);
    }
  }, [vectorData, renderDocument]);

  if (!vectorData) {
    return (
      <div className="flex aspect-[8.5/11] items-center justify-center rounded-lg border border-border border-dashed bg-background">
        <div className="text-center">
          <FileText className="mx-auto size-16 text-muted-foreground/30" />
          <p className="mt-3 text-muted-foreground text-sm">Предпросмотр PDF</p>
          <p className="mt-0.5 text-muted-foreground/60 text-xs">
            Начните заполнять форму для предпросмотра
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-foreground text-sm">
          Предпросмотр
          {pageCount > 0 && (
            <span className="ml-2 text-muted-foreground text-xs">
              ({pageCount} {pageCount === 1 ? "стр." : "стр."})
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {onSave && (
            <Button
              disabled={isSaving}
              onClick={onSave}
              size="sm"
              variant="outline"
            >
              <Save className="mr-1.5 size-3.5" />
              {isSaving ? "Сохранение..." : "Сохранить"}
            </Button>
          )}
          <Button
            disabled={isDownloading}
            onClick={onDownload}
            size="sm"
            variant="outline"
          >
            <Download className="mr-1.5 size-3.5" />
            {isDownloading ? "Скачивание..." : "Скачать PDF"}
          </Button>
        </div>
      </div>
      <div className="relative flex-1 overflow-auto rounded-lg border border-border bg-white">
        {isLoading && (
          <div className="absolute inset-x-0 top-0 z-10 flex justify-center py-3">
            <div className="flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur-sm">
              <div className="size-3.5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
              <span className="text-muted-foreground text-xs">
                Обновление...
              </span>
            </div>
          </div>
        )}

        <div
          className="flex flex-col items-center gap-4 p-4"
          ref={containerRef}
        />
      </div>
    </div>
  );
}
