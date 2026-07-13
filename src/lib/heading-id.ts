// Single source of truth for turning a heading's text into its anchor id --
// used both when rendering headings and when generating the table of
// contents, so the two can never drift apart.
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
