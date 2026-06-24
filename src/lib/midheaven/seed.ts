import type { MidheavenSource, MoneyMap } from "./types";

export const midheavenExamples = [
  "screenshot",
  "link",
  "note",
  "receipt",
  "playlist",
  "post",
  "cash flow",
];

export function createMidheavenId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createMidheavenSource(raw: string): MidheavenSource {
  const items = raw
    .split(/[,;\n]+|\band\b/gi)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(toTitleCase);

  return {
    id: createMidheavenId("source"),
    raw,
    items: items.length > 0 ? [...new Set(items)] : [raw.trim()],
    createdAt: new Date().toISOString(),
  };
}

export function createMoneyMapFromSource(source: MidheavenSource): MoneyMap {
  const lower = source.raw.toLowerCase();
  const createdAt = new Date().toISOString();

  if (hasAny(lower, ["basketball", "training", "coach", "game", "practice", "player"])) {
    return {
      id: "demo-coach-v",
      source,
      lanes: createLanes(["Training", "Proof", "Content", "Software"]),
      streams: createStreams([
        "Player Memory Pass",
        "Practice Reports",
        "Game Reports",
        "Parent proof subscription",
        "Program installs",
        "Sponsorships",
        "Axis software layer",
      ]),
      firstLoop: {
        id: "basketball-proof-loop",
        title: "Basketball Proof Loop",
        description: "Basketball reality -> proof product -> checkout -> report delivery.",
      },
      nextStep: "Build the Player Memory Pass checkout and proof template.",
      createdAt,
    };
  }

  if (hasAny(lower, ["playlist", "books", "coffee", "social", "media", "post"])) {
    return {
      id: "demo-stephanie",
      source,
      lanes: createLanes(["Taste", "Routine", "Curation", "Community"]),
      streams: createStreams([
        "Morning playlist posts",
        "Coffee routine content",
        "Book notes / reading list",
        "Affiliate links",
        "Small digital guide",
        "Social community",
      ]),
      firstLoop: {
        id: "morning-taste-loop",
        title: "Morning Taste Loop",
        description: "Coffee + playlist + book note + post.",
      },
      nextStep: "Create the first public format: coffee + playlist + book note + post.",
      createdAt,
    };
  }

  return {
    id: "demo-source-map",
    source,
    lanes: createLanes(["Offer", "Audience", "Proof", "Distribution"]),
    streams: createStreams([
      "Simple paid service",
      "Proof post",
      "Small guide",
      "Checkout page",
      "Follow-up loop",
    ]),
    firstLoop: {
      id: "first-source-loop",
      title: "First Source Loop",
      description: "Turn the strongest source into one offer, one checkout path, and one delivery promise.",
    },
    nextStep: "Pick the source with the clearest buyer and write the first paid offer.",
    createdAt,
  };
}

export function getSharedMoneyMap(id: string): MoneyMap {
  if (id === "demo-coach-v") {
    return createMoneyMapFromSource(createMidheavenSource("basketball, social media, tech"));
  }

  if (id === "demo-stephanie") {
    return createMoneyMapFromSource(createMidheavenSource("playlist, books, coffee, social media"));
  }

  return createMoneyMapFromSource(createMidheavenSource("note, receipt, post, cash flow"));
}

function createLanes(labels: string[]) {
  return labels.map((label) => ({ id: slugify(label), label }));
}

function createStreams(labels: string[]) {
  return labels.map((label) => ({ id: slugify(label), label }));
}

function hasAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function toTitleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
