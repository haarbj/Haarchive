"use server";

import { runSiteSearch, type SiteSearchResults } from "@/lib/search/run-search";

export async function searchAction(query: string): Promise<SiteSearchResults> {
  return runSiteSearch(query);
}
