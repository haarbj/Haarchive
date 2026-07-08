import { groq } from "@ai-sdk/groq";

// Single place to swap AI providers, per the architecture doc's own
// "provider-agnostic abstraction layer" requirement -- already exercised
// once for a concrete reason, not a hypothetical: Gemini 2.5 Flash's free
// tier caps at 20 requests/day, which real testing exhausted almost
// immediately. Groq's free tier on a small, fast model (still $0, no
// credit card) allows 14,400/day -- the model itself is more than capable
// for recognizing a coaching intent and calling the matching tool, which
// is all this app asks of it. Everything that calls the model imports
// this instead of a specific provider package directly.
export const coachModel = groq("llama-3.1-8b-instant");
