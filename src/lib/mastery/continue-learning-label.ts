// The recommended topic's own slug appearing in the caller's engaged-topic
// list means at least one learning_event already exists for it (every
// user_topic_mastery row -- the source of that list -- is only ever
// upserted by recomputeTopicMastery(), which runs right after a real event
// insert; see learning-actions.ts). No separate "has this been engaged"
// query: the same TopicProgress list already computed for recommendNextTopic
// is reused here rather than a second source of truth.
export function continueLearningLabel(
  engagedTopicSlugs: readonly string[],
  recommendedTopicSlug: string,
): "Start with →" | "Continue →" {
  return engagedTopicSlugs.includes(recommendedTopicSlug) ? "Continue →" : "Start with →";
}
