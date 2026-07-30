// The reader-facing subset of article_citations -- deliberately narrower
// than ArticleCitation/mapArticleCitationRow (map-row.ts), which also
// carries notes/submitted_by/status/admin_notes: internal editorial fields
// that should never be selected for a public page, let alone rendered.
export type PublicCitation = {
  id: string;
  paperTitle: string;
  authors: string | null;
  year: number | null;
  linkOrDoi: string | null;
};

type PublicCitationRow = {
  id: string;
  paper_title: string;
  authors: string | null;
  year: number | null;
  link_or_doi: string | null;
};

export function mapPublicCitationRow(row: PublicCitationRow): PublicCitation {
  return {
    id: row.id,
    paperTitle: row.paper_title,
    authors: row.authors,
    year: row.year,
    linkOrDoi: row.link_or_doi,
  };
}
