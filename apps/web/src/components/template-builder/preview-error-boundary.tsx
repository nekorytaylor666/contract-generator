import { AlertTriangle } from "lucide-react";
import { Component, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface PreviewErrorBoundaryProps {
  children: ReactNode;
}

interface PreviewErrorBoundaryState {
  error: Error | null;
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
        <div className="flex h-full items-center justify-center p-6 text-center">
          <div className="max-w-md">
            <AlertTriangle className="mx-auto size-10 text-destructive/60" />
            <p className="mt-3 font-medium text-foreground text-sm">
              Не удалось отобразить документ
            </p>
            <p className="mt-1 text-muted-foreground text-xs">
              {this.state.error.message}
            </p>
            <Button
              className="mt-4"
              onClick={() => this.setState({ error: null })}
              size="sm"
              variant="outline"
            >
              Попробовать снова
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
