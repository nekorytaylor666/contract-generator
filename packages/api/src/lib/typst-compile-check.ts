import { exec } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// Validation runs inside the admin save mutation, so a pathological source
// (huge #for loops etc.) must not hang the request or leave typst processes
// pinning the VPS — kill hard and report the timeout as its own warning.
const COMPILE_TIMEOUT_MS = 20_000;

// Cap so the message stays toast-sized even when the parser can't extract
// individual diagnostics and we fall back to raw compiler output.
const MAX_ERROR_LENGTH = 1200;

// `error: <message>` line opening a diagnostic block in typst CLI output.
const ERROR_LINE_REGEX = /^error(?:\[[^\]]*\])?:\s*(.+)$/;
// `┌─ <path>:<line>:<col>` location line inside a diagnostic block.
const LOCATION_LINE_REGEX = /┌─\s.*?:(\d+):\d+\s*$/;

export interface CompileCheckOptions {
  /**
   * Number of lines the pre-compile transforms added ABOVE/inside the admin's
   * original source — subtracted from reported line numbers so they match the
   * source exactly as the admin sees it in the editor.
   */
  lineOffset?: number;
}

/**
 * Turns raw typst CLI stderr into a compact per-error list the admin UI can
 * show in a toast: `строка 281: the character \`#\` is not valid in code`.
 * Warnings are dropped. Falls back to (capped) raw output when nothing parses.
 */
function summarizeTypstErrors(stderr: string, lineOffset: number): string {
  const lines = stderr.split("\n");
  const summaries: string[] = [];
  let pendingMessage: string | null = null;

  for (const line of lines) {
    const errorMatch = line.match(ERROR_LINE_REGEX);
    if (errorMatch) {
      // Previous error block had no location line — flush it without one.
      if (pendingMessage) {
        summaries.push(pendingMessage);
      }
      pendingMessage = errorMatch[1] ?? null;
      continue;
    }
    if (!pendingMessage) {
      continue;
    }
    const locationMatch = line.match(LOCATION_LINE_REGEX);
    if (locationMatch) {
      const reported = Number(locationMatch[1]);
      const original = Math.max(1, reported - lineOffset);
      summaries.push(`строка ${original}: ${pendingMessage}`);
      pendingMessage = null;
    }
  }
  if (pendingMessage) {
    summaries.push(pendingMessage);
  }

  const text = summaries.length > 0 ? summaries.join("\n") : stderr.trim();
  return text.length > MAX_ERROR_LENGTH
    ? `${text.slice(0, MAX_ERROR_LENGTH)}…`
    : text;
}

/**
 * Compiles template source with the real Typst CLI and returns null when it
 * compiles, else a compact error summary with line numbers matching the
 * admin's editor (see CompileCheckOptions.lineOffset).
 *
 * The in-app previews intentionally render through a lenient interpreter that
 * forgives syntax the real compiler rejects, so admin save is the only point
 * where a broken source can be caught before the photo/PDF endpoints hit it.
 */
export async function checkTypstCompiles(
  typstContent: string,
  options?: CompileCheckOptions
): Promise<string | null> {
  const id = randomUUID();
  const inputPath = join(tmpdir(), `${id}.typ`);
  const outputPath = join(tmpdir(), `${id}.png`);

  try {
    await writeFile(inputPath, typstContent, "utf-8");
    // PNG of page 1 at minimal resolution: the whole document still gets
    // parsed and evaluated (that's what we're checking), but export is cheap.
    await execAsync(
      `typst compile --format png --pages 1 --ppi 36 "${inputPath}" "${outputPath}"`,
      { timeout: COMPILE_TIMEOUT_MS, killSignal: "SIGKILL" }
    );
    return null;
  } catch (error) {
    const err = error as {
      stderr?: string;
      message?: string;
      killed?: boolean;
      signal?: string;
      code?: number | string;
    };
    if (err.killed || err.signal) {
      return `компиляция не уложилась в ${COMPILE_TIMEOUT_MS / 1000} секунд и была прервана — упростите шаблон`;
    }
    // A missing/broken typst binary is an ops problem, not a template problem —
    // log it server-side instead of blaming the admin's source in a toast.
    if (err.code === 127 || err.code === "ENOENT") {
      console.error(
        "typst compile check unavailable (binary missing?):",
        err.message ?? error
      );
      return null;
    }
    // Keep server tmp paths / the raw command line out of client-facing text
    // even when the output doesn't parse into per-error summaries.
    const raw = (err.stderr || err.message || String(error))
      .replaceAll(inputPath, "шаблон.typ")
      .replaceAll(outputPath, "превью.png");
    return summarizeTypstErrors(raw, options?.lineOffset ?? 0);
  } finally {
    for (const file of [inputPath, outputPath]) {
      await unlink(file).catch(() => undefined);
    }
  }
}
