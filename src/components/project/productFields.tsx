// Shared product-field helpers used by the manual tagging surfaces.
//
// Lifted verbatim out of ProjectImageTagger so the extracted ProductTagPicker
// and the tagger's edit modal share one implementation. Pure helpers only — no
// component state, no side effects.

/**
 * Fold the structured fields a scrape / manual capture can yield into the single
 * free-text description column the Product model actually has.
 */
export function composeDescription(f: {
  description?: string | null;
  dimensions?: string | null;
  materials?: string[];
  colors?: string[];
}): string {
  const parts: string[] = [];
  if (f.description) parts.push(f.description);
  if (f.dimensions) parts.push(`Dimensions: ${f.dimensions}`);
  if (f.materials?.length) parts.push(`Materials: ${f.materials.join(", ")}`);
  if (f.colors?.length) parts.push(`Colors: ${f.colors.join(", ")}`);
  return parts.join("\n");
}

/** Comma-separated text <-> string[] for the materials / colors fields. */
export function splitList(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * One labeled, editable field in a confirm panel. Empty values are highlighted
 * so a designer can see at a glance what the scrape missed.
 */
export function renderPreviewField(
  label: string,
  value: string,
  onChange: (v: string) => void,
  multiline = false,
) {
  const missing = !value.trim();
  const ring = missing
    ? "ring-1 ring-amber-300 bg-amber-50/50"
    : "ring-1 ring-folio-border-subtle bg-white";
  const cls = `w-full rounded-md px-2 py-1.5 text-sm ${ring} focus:outline-none focus:ring-2 focus:ring-[var(--accent)]`;
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[length:var(--type-eyebrow)] font-medium text-folio-text-secondary mb-1">
        {label}
        {missing && <span className="text-amber-600 text-[length:var(--type-fine)]">• missing</span>}
      </span>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={cls} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </label>
  );
}
