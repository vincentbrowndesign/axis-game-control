const BEHAVIOR_TAG_RULES = [
  {
    tag: "stay-low",
    terms: ["stay low", "sink", "hips", "explode"],
  },
  {
    tag: "beat-spot",
    terms: ["beat him", "spot", "first"],
  },
  {
    tag: "screen-navigation",
    terms: ["screen", "pick", "send you"],
  },
  {
    tag: "tag-first",
    terms: ["tag", "closeout", "recover"],
  },
  {
    tag: "sprint-back",
    terms: ["sprint", "back", "transition"],
  },
  {
    tag: "hold-line",
    terms: ["drift", "wide", "float"],
  },
]

export function suggestBehaviorTags(behaviorSentence: string) {
  const sentence = behaviorSentence.toLowerCase()
  const tags = BEHAVIOR_TAG_RULES.filter((rule) =>
    rule.terms.some((term) => sentence.includes(term))
  ).map((rule) => rule.tag)

  return tags.length ? tags : ["review"]
}
