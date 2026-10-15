// Both formatters live in lib/coaching-engine now -- the AI layer's tool
// results need the identical description to narrate from, not raw JSON,
// and the public plan-preview page (src/app/training-plans/build/) needed
// the identical workout-type labels without a cross-route-group import
// from this (app)/(protected)/plan/-local file, so neither stays
// app-route-local anymore. Re-exported here so this file's own existing
// imports don't need to change.
export { describePrescription, workoutTypeLabel } from "@/lib/coaching-engine";
