import { Download, FileText, Save } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  computeDerivedVariables,
  evaluateCondition,
  formatValue,
} from "@/lib/typst-evaluator";
import { parseTypstTemplate, type TypstNode } from "@/lib/typst-parser";
import type { TemplateVariable } from "@/routes/templates";
import type { DocumentStyle } from "./document-style-settings";
import { InlineVariableInput } from "./inline-variable-input";

const STYLE_PRESETS: Record<
  string,
  { fontSize: string; margin: string; leading: string; spacing: string }
> = {
  compact: {
    fontSize: "9pt",
    margin: "1.5cm",
    leading: "1.3",
    spacing: "0.6em",
  },
  default: {
    fontSize: "11pt",
    margin: "2cm",
    leading: "1.4",
    spacing: "0.8em",
  },
  comfortable: {
    fontSize: "12pt",
    margin: "2.5cm",
    leading: "1.5",
    spacing: "1em",
  },
  spacious: {
    fontSize: "13pt",
    margin: "3cm",
    leading: "1.6",
    spacing: "1.2em",
  },
};

const ALIGN_MAP: Record<string, React.CSSProperties["textAlign"]> = {
  center: "center",
  left: "left",
  right: "right",
};

function scrollIntoContainer(el: HTMLElement, container: HTMLElement | null) {
  if (!container) {
    return;
  }
  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const offsetTop = elRect.top - containerRect.top + container.scrollTop;
  const targetScroll =
    offsetTop - container.clientHeight / 2 + elRect.height / 2;
  container.scrollTo({ top: targetScroll, behavior: "smooth" });
}

function HighlightedBlock({
  children,
  scrollContainerRef,
  hasScrolledRef,
}: {
  children: React.ReactNode;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  hasScrolledRef: React.RefObject<boolean>;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current && !hasScrolledRef.current) {
      hasScrolledRef.current = true;
      scrollIntoContainer(ref.current, scrollContainerRef.current);
    }
  }, [scrollContainerRef, hasScrolledRef]);
  return (
    <span className="animate-highlight-fade rounded-sm" ref={ref}>
      {children}
    </span>
  );
}

interface RenderContext {
  variableMap: Map<string, TemplateVariable>;
  allValues: Record<string, unknown>;
  onValueChange: (name: string, value: unknown) => void;
  logo: string | null;
  changedVars: Set<string>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  hasScrolledRef: React.RefObject<boolean>;
}

function renderChildren(
  children: TypstNode[],
  key: string,
  ctx: RenderContext
): React.ReactNode[] {
  return children.map((c, i) => renderNode(c, `${key}-${i}`, ctx));
}

function renderLayoutNode(
  node: TypstNode,
  key: string,
  ctx: RenderContext
): React.ReactNode {
  switch (node.type) {
    case "heading":
      return (
        <h2 className="mt-6 mb-2 font-bold text-base first:mt-0" key={key}>
          {renderChildren(node.children, key, ctx)}
        </h2>
      );

    case "paragraph":
      return (
        <p
          className="my-2 whitespace-pre-wrap"
          key={key}
          style={{ textAlign: "justify" }}
        >
          {renderChildren(node.children, key, ctx)}
        </p>
      );

    case "align":
      return (
        <div
          key={key}
          style={{ textAlign: ALIGN_MAP[node.alignment] ?? "left" }}
        >
          {renderChildren(node.children, key, ctx)}
        </div>
      );

    case "grid":
      return (
        <div
          className="my-2"
          key={key}
          style={{
            display: "grid",
            gridTemplateColumns: node.columns.join(" "),
            gap: "1em",
          }}
        >
          {node.cells.map((cell, ci) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: grid cells have stable order
            <div key={`${key}-cell-${ci}`}>
              {cell.map((c, i) => renderNode(c, `${key}-c${ci}-${i}`, ctx))}
            </div>
          ))}
        </div>
      );

    case "block":
      return (
        <div className="my-2 pl-4" key={key}>
          {renderChildren(node.children, key, ctx)}
        </div>
      );

    case "vspace":
      return (
        <div key={key} style={{ height: node.amount.trim() || "0.5em" }} />
      );

    case "line":
      return <hr className="my-2 border-foreground/20" key={key} />;

    default:
      return null;
  }
}

function renderInlineNode(
  node: TypstNode,
  key: string,
  ctx: RenderContext
): React.ReactNode {
  switch (node.type) {
    case "text":
      return <span key={key}>{node.content}</span>;

    case "linebreak":
      return <br key={key} />;

    case "bold":
    case "strong":
      return (
        <strong key={key}>{renderChildren(node.children, key, ctx)}</strong>
      );

    case "styledText": {
      const inlineStyles: React.CSSProperties = {};
      if (node.styles.size) {
        inlineStyles.fontSize = node.styles.size;
      }
      if (node.styles.weight === "bold") {
        inlineStyles.fontWeight = "bold";
      }
      return (
        <span key={key} style={inlineStyles}>
          {renderChildren(node.children, key, ctx)}
        </span>
      );
    }

    case "box":
      return (
        <span className="inline-block" key={key} style={{ width: node.width }}>
          {renderChildren(node.children, key, ctx)}
        </span>
      );

    case "repeat":
      return (
        <span
          className="mx-1 inline-block min-w-12 border-muted-foreground/30 border-b border-dotted"
          key={key}
        >
          &nbsp;
        </span>
      );

    case "variable": {
      const varDef = ctx.variableMap.get(node.name);
      const val = ctx.allValues[node.name];
      const display = formatValue(val);
      const highlighted = ctx.changedVars.has(node.name);
      if (!varDef) {
        return (
          <span className="text-inherit" key={key}>
            {display ?? node.name}
          </span>
        );
      }
      return (
        <InlineVariableInput
          displayValue={display}
          hasScrolledRef={ctx.hasScrolledRef}
          isHighlighted={highlighted}
          key={key}
          onChange={ctx.onValueChange}
          scrollContainerRef={ctx.scrollContainerRef}
          value={val}
          variable={varDef}
        />
      );
    }

    case "image":
      if (ctx.logo) {
        return (
          // biome-ignore lint/correctness/useImageSize: dynamic base64 logo, size unknown
          <img
            alt="Logo"
            className="mx-auto my-2 max-h-16 object-contain"
            key={key}
            src={ctx.logo}
          />
        );
      }
      return null;

    default:
      return null;
  }
}

function nodeContainsChangedVar(
  nodes: TypstNode[],
  changed: Set<string>
): boolean {
  for (const node of nodes) {
    if (node.type === "variable" && changed.has(node.name)) {
      return true;
    }
    if ("children" in node && nodeContainsChangedVar(node.children, changed)) {
      return true;
    }
    if (node.type === "conditional") {
      for (const b of node.branches) {
        if (nodeContainsChangedVar(b.body, changed)) {
          return true;
        }
      }
    }
    if (
      node.type === "paragraph" &&
      nodeContainsChangedVar(node.children, changed)
    ) {
      return true;
    }
  }
  return false;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: conditional highlight logic requires branch + content checks
function renderNode(
  node: TypstNode,
  key: string,
  ctx: RenderContext
): React.ReactNode {
  if (node.type === "conditional") {
    if (ctx.changedVars.size === 0) {
      // No changes — render without highlight
      for (let bi = 0; bi < node.branches.length; bi++) {
        const branch = node.branches[bi];
        if (evaluateCondition(branch.condition, ctx.allValues)) {
          return (
            <span key={key}>
              {branch.body.map((c, i) =>
                renderNode(c, `${key}-b${bi}-${i}`, ctx)
              )}
            </span>
          );
        }
      }
      return null;
    }

    // Check if the branch switched (condition variable changed)
    const branchSwitched = node.branches.some(
      (b) => b.condition !== "else" && ctx.changedVars.has(b.condition.variable)
    );

    for (let bi = 0; bi < node.branches.length; bi++) {
      const branch = node.branches[bi];
      if (evaluateCondition(branch.condition, ctx.allValues)) {
        const content = branch.body.map((c, i) =>
          renderNode(c, `${key}-b${bi}-${i}`, ctx)
        );
        // Highlight if branch switched OR any variable inside the active branch changed
        const shouldHighlight =
          branchSwitched ||
          nodeContainsChangedVar(branch.body, ctx.changedVars);
        if (shouldHighlight) {
          return (
            <HighlightedBlock
              hasScrolledRef={ctx.hasScrolledRef}
              key={key}
              scrollContainerRef={ctx.scrollContainerRef}
            >
              {content}
            </HighlightedBlock>
          );
        }
        return <span key={key}>{content}</span>;
      }
    }
    return null;
  }

  if (node.type === "setting") {
    return null;
  }

  return renderLayoutNode(node, key, ctx) ?? renderInlineNode(node, key, ctx);
}

interface InteractiveDocumentPreviewProps {
  typstContent: string;
  variables: TemplateVariable[];
  values: Record<string, unknown>;
  onValueChange: (name: string, value: unknown) => void;
  logo: string | null;
  style: DocumentStyle;
  changedVars?: Set<string>;
  onDownload?: () => void;
  onSave?: () => void;
  isDownloading?: boolean;
  isSaving?: boolean;
}

const EMPTY_SET = new Set<string>();

export function InteractiveDocumentPreview({
  typstContent,
  variables,
  values,
  onValueChange,
  logo,
  style,
  changedVars = EMPTY_SET,
  onDownload,
  onSave,
  isDownloading,
  isSaving,
}: InteractiveDocumentPreviewProps) {
  const parsed = useMemo(
    () => parseTypstTemplate(typstContent),
    [typstContent]
  );

  const variableMap = useMemo(() => {
    const map = new Map<string, TemplateVariable>();
    for (const v of variables) {
      map.set(v.name, v);
    }
    return map;
  }, [variables]);

  const allValues = useMemo(
    () => computeDerivedVariables(values, variables),
    [values, variables]
  );

  const preset = STYLE_PRESETS[style.preset] ?? STYLE_PRESETS.default;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  // Reset scroll flag when changedVars changes so the first element scrolls
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-run when changedVars identity changes
  useEffect(() => {
    hasScrolledRef.current = false;
  }, [changedVars]);

  const ctx: RenderContext = {
    variableMap,
    allValues,
    onValueChange,
    logo,
    changedVars,
    scrollContainerRef,
    hasScrolledRef,
  };

  if (!typstContent) {
    return (
      <div className="flex aspect-[8.5/11] items-center justify-center rounded-lg border border-border border-dashed bg-background">
        <div className="text-center">
          <FileText className="mx-auto size-16 text-muted-foreground/30" />
          <p className="mt-3 text-muted-foreground text-sm">
            Предпросмотр документа
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-foreground text-sm">
          Редактирование документа
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
          {onDownload && (
            <Button
              disabled={isDownloading}
              onClick={onDownload}
              size="sm"
              variant="outline"
            >
              <Download className="mr-1.5 size-3.5" />
              {isDownloading ? "Скачивание..." : "Скачать PDF"}
            </Button>
          )}
        </div>
      </div>

      <div
        className="flex-1 overflow-auto rounded-lg border border-border bg-white"
        ref={scrollContainerRef}
      >
        <div
          className="mx-auto"
          style={{
            fontFamily: style.font
              ? `"${style.font}", serif`
              : '"New Computer Modern", serif',
            fontSize: preset.fontSize,
            lineHeight: preset.leading,
            padding: preset.margin,
            maxWidth: "210mm",
          }}
        >
          {logo && (
            // biome-ignore lint/correctness/useImageSize: dynamic base64 logo, size unknown
            <img
              alt="Logo"
              className="mx-auto mb-4 max-h-16 object-contain"
              src={logo}
            />
          )}
          {parsed.nodes.map((node, i) => renderNode(node, `n-${i}`, ctx))}
        </div>
      </div>
    </div>
  );
}
