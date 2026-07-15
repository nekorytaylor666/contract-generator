import type { TemplateVariable } from "@/routes/templates";

/**
 * Carries form values across a contract-language switch. Values of selects are
 * locale-bound literals («Юридическое лицо» ↔ «Заңды тұлға») that `#if`
 * conditions in the new locale's typst compare byte-for-byte, so they must be
 * translated, not kept. Option lists across locales are parallel translations
 * in the same order (template rules §2.3) — selects map by option index.
 * A value equal to the old locale's defaultValue maps to the new default
 * (covers untouched non-select fields with localized defaults). Free-typed
 * text can't be translated and is left as is.
 */
export function remapValuesForLocale(
  values: Record<string, unknown>,
  fromVars: TemplateVariable[],
  toVars: TemplateVariable[]
): { values: Record<string, unknown>; changed: Set<string> } {
  const toByName = new Map(toVars.map((v) => [v.name, v]));
  const next = { ...values };
  const changed = new Set<string>();

  for (const fromVar of fromVars) {
    const toVar = toByName.get(fromVar.name);
    const value = values[fromVar.name];
    if (!toVar || typeof value !== "string" || value === "") {
      continue;
    }
    let mapped: unknown;
    // Index mapping is only trustworthy when the lists plausibly correspond:
    // stored option lists can drift apart (sync unions old options into the
    // base list; a later-added locale is seeded fresh). On length mismatch,
    // keeping the old literal renders as a visibly unfilled branch — silently
    // substituting a WRONG option in a legal document is far worse.
    const fromOptions = fromVar.options;
    const toOptions = toVar.options;
    if (fromOptions && toOptions && fromOptions.length === toOptions.length) {
      const optionIndex = fromOptions.indexOf(value);
      if (optionIndex >= 0) {
        mapped = toOptions[optionIndex];
      }
    }
    if (typeof mapped !== "string" && value === fromVar.defaultValue) {
      mapped = toVar.defaultValue;
    }
    if (typeof mapped === "string" && mapped !== value) {
      next[fromVar.name] = mapped;
      changed.add(fromVar.name);
    }
  }
  return { values: next, changed };
}
