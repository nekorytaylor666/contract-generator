import { ImagePlus, X } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface LogoUploadProps {
  logo: string | null;
  onLogoChange: (logo: string | null) => void;
}

export function LogoUpload({ logo, onLogoChange }: LogoUploadProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onLogoChange(reader.result as string);
    };
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  if (logo) {
    return (
      <div className="mb-4">
        <p className="mb-1.5 font-medium text-foreground text-xs">
          {t("builder.logo.title")}
        </p>
        <div className="flex items-center gap-2 rounded-md border border-border p-2">
          <img
            alt={t("builder.logo.title")}
            className="h-8 w-auto object-contain"
            height={32}
            src={logo}
            width={80}
          />
          <span className="flex-1 truncate text-muted-foreground text-xs">
            {t("builder.logo.uploaded")}
          </span>
          <Button
            onClick={() => onLogoChange(null)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <p className="mb-1.5 font-medium text-foreground text-xs">
        {t("builder.logo.title")}
      </p>
      <button
        className="flex w-full items-center gap-2 rounded-md border border-border border-dashed p-3 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        <ImagePlus className="size-4" />
        <span className="text-xs">{t("builder.logo.upload")}</span>
      </button>
      <input
        accept="image/png,image/jpeg,image/svg+xml"
        className="hidden"
        onChange={handleFileChange}
        ref={inputRef}
        type="file"
      />
    </div>
  );
}
