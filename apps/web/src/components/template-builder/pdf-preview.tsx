import { Download, FileText, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PdfPreviewProps {
  svgPages: string[] | null;
  isLoading?: boolean;
  onDownload?: () => void;
  isDownloading?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
}

export function PdfPreview({
  svgPages,
  isLoading,
  onDownload,
  isDownloading,
  onSave,
  isSaving,
}: PdfPreviewProps) {
  if (!svgPages) {
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
        <h2 className="font-medium text-foreground text-sm">Предпросмотр</h2>
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

        <div className="flex flex-col items-center gap-4 p-4">
          {svgPages.map((svg, i) => (
            <div
              className="w-full shadow-sm [&>svg]:h-auto [&>svg]:w-full"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG from our own Typst compiler
              dangerouslySetInnerHTML={{ __html: svg }}
              key={`page-${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
