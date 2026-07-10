export type ParsedRace = { name: string; date: string };
export type ParseScheduleResult = { races: ParsedRace[]; warnings: string[] };

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_ABBR = MONTH_NAMES.map((m) => m.slice(0, 3));

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// MM/DD or MM/DD/YYYY (or MM-DD, MM-DD-YYYY)
const NUMERIC_DATE = /(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/;
// "March 2" / "Mar 2" / "March 2, 2026" -- month name, optional comma, day, optional year
const NAMED_DATE = new RegExp(
  `\\b(${MONTH_NAMES.join("|")}|${MONTH_ABBR.join("|")})\\.?\\s+(\\d{1,2})(?:,)?(?:\\s+(\\d{4}))?\\b`,
  "i",
);

function resolveYear(rawYear: string | undefined, referenceYear: number): number {
  if (!rawYear) return referenceYear;
  const year = Number(rawYear);
  if (rawYear.length === 2) return 2000 + year;
  return year;
}

function monthIndexFromName(name: string): number {
  const lower = name.toLowerCase();
  const fullIndex = MONTH_NAMES.indexOf(lower);
  if (fullIndex !== -1) return fullIndex;
  return MONTH_ABBR.indexOf(lower.slice(0, 3));
}

// Best-effort, line-based parser for a pasted race schedule (e.g. copied
// off an athletic.net team page) -- never treated as authoritative. Any
// line it can't confidently read becomes a warning instead of being
// silently dropped or guessed at; the coach reviews and edits every parsed
// row (and can add rows by hand for anything this misses) before a season
// is ever created from it.
export function parseScheduleText(text: string, referenceYear: number = new Date().getFullYear()): ParseScheduleResult {
  const races: ParsedRace[] = [];
  const warnings: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const numericMatch = line.match(NUMERIC_DATE);
    const namedMatch = line.match(NAMED_DATE);

    let month: number | null = null;
    let day: number | null = null;
    let year: number | null = null;
    let matchedText: string | null = null;

    if (numericMatch) {
      const [full, m, d, y] = numericMatch;
      const monthNum = Number(m);
      const dayNum = Number(d);
      if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
        month = monthNum - 1;
        day = dayNum;
        year = resolveYear(y, referenceYear);
        matchedText = full;
      }
    }

    // Prefer a named-month match over a numeric one when both are present
    // on the same line (e.g. "Sat, March 7" -- the leading "7" alone isn't
    // a date, but NUMERIC_DATE's day-only fallback could still misfire on
    // unrelated digits elsewhere in the line).
    if (namedMatch) {
      const [full, monthName, d, y] = namedMatch;
      const monthIndex = monthIndexFromName(monthName);
      if (monthIndex !== -1) {
        month = monthIndex;
        day = Number(d);
        year = resolveYear(y, referenceYear);
        matchedText = full;
      }
    }

    if (month === null || day === null || year === null || !matchedText) {
      warnings.push(`Couldn't find a date on this line: "${line}"`);
      continue;
    }

    const name = line
      .replace(matchedText, "")
      // Strip a leading day-of-week token ("Sat, ", "Monday - ") left
      // dangling once the date itself has been removed from the middle of
      // the line.
      .replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s*/i, "")
      .replace(/^[\s,\-–—:@]+|[\s,\-–—:@]+$/g, "")
      .trim();
    if (!name) {
      warnings.push(`Found a date but no race name on this line: "${line}"`);
      continue;
    }

    const date = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    races.push({ name, date });
  }

  return { races, warnings };
}
