import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Eye, History, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";

interface VersionHistoryProps {
  documentId: string;
  currentVersion: number;
  onPreviewVersion: (
    variables: Record<string, unknown>,
    logo: string | null,
    style: { font?: string; preset?: string } | null
  ) => void;
  onRevert: (
    variables: Record<string, unknown>,
    logo: string | null,
    style: { font?: string; preset?: string } | null
  ) => void;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) {
    return "just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  if (diffHr < 24) {
    return `${diffHr}h ago`;
  }
  if (diffDay < 7) {
    return `${diffDay}d ago`;
  }
  return date.toLocaleDateString();
}

export function VersionHistory({
  documentId,
  currentVersion,
  onPreviewVersion,
  onRevert,
}: VersionHistoryProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [previewingVersion, setPreviewingVersion] = useState<number | null>(
    null
  );

  const { data: versions = [], isLoading } = useQuery(
    trpc.documents.listVersions.queryOptions({ documentId })
  );

  const fetchAndCallback = async (
    version: number,
    callback: (
      variables: Record<string, unknown>,
      logo: string | null,
      style: { font?: string; preset?: string } | null
    ) => void
  ) => {
    const fullVersion = await queryClient.fetchQuery(
      trpc.documents.getVersion.queryOptions({
        documentId,
        version,
      })
    );
    callback(
      fullVersion.variables as Record<string, unknown>,
      fullVersion.logo,
      fullVersion.style as { font?: string; preset?: string } | null
    );
  };

  const handlePreviewVersion = async (version: number) => {
    if (version === currentVersion) {
      // Clicking current version resets preview
      setPreviewingVersion(null);
      await fetchAndCallback(version, onPreviewVersion);
      return;
    }
    setPreviewingVersion(version);
    await fetchAndCallback(version, onPreviewVersion);
  };

  const revertMutation = useMutation(
    trpc.documents.revert.mutationOptions({
      onSuccess: async (_data, variables) => {
        setPreviewingVersion(null);
        await fetchAndCallback(variables.version, onRevert);
        queryClient.invalidateQueries({
          queryKey: trpc.documents.listVersions.queryKey({ documentId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.documents.getById.queryKey({ id: documentId }),
        });
      },
    })
  );

  if (isLoading) {
    return (
      <div className="py-4 text-center text-muted-foreground text-xs">
        Loading history...
      </div>
    );
  }

  if (versions.length === 0) {
    return null;
  }

  return (
    <div className="border-border border-t pt-4">
      <div className="mb-3 flex items-center gap-1.5">
        <History className="size-3.5 text-muted-foreground" />
        <h3 className="font-medium text-foreground text-xs">Version History</h3>
      </div>
      <div className="flex flex-col gap-1">
        {versions.map((ver) => {
          const isCurrent = ver.version === currentVersion;
          const isPreviewing = previewingVersion === ver.version;

          return (
            <button
              className={cn(
                "group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors",
                isPreviewing
                  ? "bg-primary/10 ring-1 ring-primary/20"
                  : "hover:bg-muted/50"
              )}
              key={ver.id}
              onClick={() => handlePreviewVersion(ver.version)}
              type="button"
            >
              <div className="flex items-center gap-2">
                {isPreviewing ? (
                  <Eye className="size-3 text-primary" />
                ) : (
                  <Clock className="size-3 text-muted-foreground" />
                )}
                <div>
                  <span
                    className={cn(
                      "text-xs",
                      isPreviewing ? "text-primary" : "text-foreground"
                    )}
                  >
                    v{ver.version}
                    {isCurrent && (
                      <span className="ml-1 text-muted-foreground">
                        (current)
                      </span>
                    )}
                    {isPreviewing && !isCurrent && (
                      <span className="ml-1 text-primary/70">(previewing)</span>
                    )}
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(new Date(ver.createdAt))}
                  </p>
                </div>
              </div>
              {!isCurrent && (
                <Button
                  className="opacity-0 group-hover:opacity-100"
                  disabled={revertMutation.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    revertMutation.mutate({
                      documentId,
                      version: ver.version,
                    });
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <RotateCcw className="mr-1 size-3" />
                  <span className="text-xs">Revert</span>
                </Button>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
