import model from "@/../public/data/cv-threshold-pieces-v2026-09-05.json";
import type { CvPiecesModel } from "@/lib/cv-threshold-math";

// The calculators load this same file client-side via `fetch("/data/...")`
// (see cv-threshold-calculator.tsx) since
// they run on statically-generated pages with no server render to inject
// data from. Server Components have no such constraint -- a static import
// of the public JSON file is simpler than a self-fetch over HTTP.
export const cvThresholdModel = model as unknown as CvPiecesModel;
