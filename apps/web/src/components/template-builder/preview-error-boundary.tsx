import { AlertTriangle } from "lucide-react";
import { Component, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

interface PreviewErrorBoundaryProps {
  children: ReactNode;
}

interface PreviewErrorBoundaryState {
  error: Error | null;
}

// Function child so the class boundary stays hook-free; the fallback itself
// picks up the current UI language via useTranslation.
function PreviewErrorFallback({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <AlertTriangle className="mx-auto size-10 text-destructive/60" />
        <p className="mt-3 font-medium text-foreground text-sm">
          {t("builder.preview.renderFailed")}
        </p>
        <p className="mt-1 text-muted-foreground text-xs">{message}</p>
        <Button className="mt-4" onClick={onRetry} size="sm" variant="outline">
          {t("builder.preview.retry")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Guards the builder preview/form: a render error inside shows a local
 * fallback instead of white-screening the whole page.
 */
export class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  state: PreviewErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PreviewErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <PreviewErrorFallback
          message={this.state.error.message}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
