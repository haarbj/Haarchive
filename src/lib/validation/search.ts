import { z } from "zod";

// Boundary this schema actually guards: the header input and the /search
// URL's ?q= param. Short minimum rules out an empty/whitespace submit; the
// max is generous for any real query while still ruling out someone pasting
// a paragraph into the box and running it through the retrieval+AI-fallback
// path below for nothing.
export const searchQuerySchema = z.string().trim().min(1).max(120);

export type SearchQuery = z.infer<typeof searchQuerySchema>;
