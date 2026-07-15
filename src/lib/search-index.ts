import { categories, categoryMap, sections } from "@/lib/sections";
import { headingId } from "@/lib/heading-id";
import { coaches } from "@/lib/coaches/data";
import { athletes } from "@/lib/athletes/data";

export type SearchEntry = {
  title: string;
  subtitle: string;
  href: string;
  group: string;
};

// Keywords participate in matching but never render -- lets a search for
// "muscle fibers" surface Exercise Physiology (one of its `topics`) without
// that phrase needing to appear in the title or mission shown to the user.
type IndexedEntry = SearchEntry & { keywords: string };

// Built once at module load from static data (categories/sections never
// change at runtime), so every keystroke just filters an in-memory array --
// no debouncing or async needed at this size (a few hundred entries).
function buildIndex(): IndexedEntry[] {
  const entries: IndexedEntry[] = categories.map((category) => ({
    title: category.title,
    subtitle: category.mission,
    href: `/${category.slug}`,
    group: "Categories",
    keywords: "",
  }));

  for (const section of sections) {
    const group = categoryMap.get(section.category)?.title ?? "Learn";
    entries.push({
      title: section.title,
      subtitle: section.mission,
      href: `/${section.slug}`,
      group,
      keywords: section.topics.join(" "),
    });

    // Indexing headings too (not just the section itself) is what makes
    // search actually useful once a section has 20+ subsections -- a query
    // like "cardiac drift" should land on that exact heading, not just on
    // "Data & Analytics" as a whole.
    for (const block of section.content ?? []) {
      if (block.type !== "heading") continue;
      entries.push({
        title: block.text,
        subtitle: section.title,
        href: `/${section.slug}#${headingId(block.text)}`,
        group,
        keywords: "",
      });
    }
  }

  // Individual coaches and athletes live in their own structured data files
  // (lib/coaches/data.ts, lib/athletes/data.ts), not in `sections` -- so
  // without these two loops a search for "Lydiard" or "Ingebrigtsen" would
  // only ever surface the library's own overview page, never the specific
  // person a reader is actually looking for.
  for (const coach of coaches) {
    entries.push({
      title: coach.name,
      subtitle: coach.oneLiner,
      href: `/coaching-library/${coach.slug}`,
      group: "Coaching Library",
      keywords: [coach.shortName, coach.compare.primaryIdea].filter(Boolean).join(" "),
    });
  }

  for (const athlete of athletes) {
    entries.push({
      title: athlete.name,
      subtitle: athlete.oneLiner,
      href: `/athlete-library/${athlete.slug}`,
      group: "Athlete Library",
      keywords: [athlete.country, athlete.primaryEvents].join(" "),
    });
  }

  return entries;
}

const index = buildIndex();

// Lower is better. Title matches outrank subtitle matches, which outrank
// keyword-only matches, so a query like "threshold" surfaces the Workout
// Library's "Double Threshold Sessions" heading before it surfaces every
// section that merely mentions threshold training in passing.
function rank(entry: IndexedEntry, query: string): number {
  const title = entry.title.toLowerCase();
  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  if (title.includes(query)) return 2;
  if (entry.subtitle.toLowerCase().includes(query)) return 3;
  if (entry.keywords.toLowerCase().includes(query)) return 4;
  return -1;
}

export function search(query: string, limit = 8): SearchEntry[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  return index
    .map((entry) => ({ entry, rank: rank(entry, trimmed) }))
    .filter((scored) => scored.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((scored) => scored.entry);
}
