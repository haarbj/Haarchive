// A small, deterministic CSV serializer -- no third-party package, since
// the actual requirement (escape commas/quotes/newlines, header row, one
// row per record) is a handful of lines and doesn't warrant a dependency.
// RFC 4180-ish: a field is quoted only when it needs to be, and an
// embedded quote is escaped by doubling it.

export function escapeCsvField(value: string): boolean {
  return value.includes(",") || value.includes("\"") || value.includes("\n") || value.includes("\r");
}

export function formatCsvField(value: string): string {
  if (!escapeCsvField(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

// CRLF line endings (the RFC 4180 convention) -- Excel and most spreadsheet
// tools handle plain \n fine too, but \r\n is the safer default for a file
// that might be opened outside a browser/Numbers/Sheets.
export function serializeCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(formatCsvField).join(","));
  return lines.join("\r\n");
}
