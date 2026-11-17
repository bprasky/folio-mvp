import styles from "@/components/ui/WorkflowForms.module.css";

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
 * One labeled, theme-aware field shared by product review and manual editing.
 */
export function renderPreviewField(
  label: string,
  value: string,
  onChange: (v: string) => void,
  multiline = false,
) {
  const cls = styles.field;
  return (
    <label className={styles.label}>
      <span>{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={cls} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </label>
  );
}
