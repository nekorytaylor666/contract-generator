import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PdfPreviewProps {
  pdfDataUrl: string | null;
  isLoading?: boolean;
  templateTitle?: string;
}

export function PdfPreview({
  pdfDataUrl,
  isLoading,
  templateTitle,
}: PdfPreviewProps) {
  const handleDownload = () => {
    if (!pdfDataUrl) {
      return;
    }

    const link = document.createElement("a");
    link.href = pdfDataUrl;
    link.download = `${templateTitle ?? "document"}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
          <p className="text-muted-foreground text-sm">Generating PDF...</p>
        </div>
      </div>
    );
  }

  if (!pdfDataUrl) {
    return (
      <div className="flex aspect-[8.5/11] items-center justify-center rounded-lg border border-border border-dashed bg-background">
        <div className="text-center">
          <FileText className="mx-auto size-16 text-muted-foreground/30" />
          <p className="mt-3 text-muted-foreground text-sm">PDF Preview</p>
          <p className="mt-0.5 text-muted-foreground/60 text-xs">
            Fill in the form and click "Generate PDF" to see your document
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-foreground text-sm">
          Generated Document
        </h2>
        <Button onClick={handleDownload} size="sm" variant="outline">
          <Download className="mr-1.5 size-3.5" />
          Download PDF
        </Button>
      </div>
      <div className="flex-1 overflow-hidden rounded-lg border border-border bg-white">
        <iframe
          className="size-full"
          src={`${pdfDataUrl}#toolbar=0&navpanes=0&scrollbar=0`}
          title="PDF Preview"
        />
      </div>
    </div>
  );
}
