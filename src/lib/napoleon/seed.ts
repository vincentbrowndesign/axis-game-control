import type {
  NapoleonAgentResult,
  NapoleonCashLoop,
  NapoleonConnection,
  NapoleonNextMove,
  NapoleonNode,
  NapoleonProof,
  NapoleonQuery,
} from "./types";

export const napoleonGenesisNode: NapoleonNode = {
  id: "axis-genesis-node",
  title: "Axis Genesis Node",
  subtitle: "Basketball reality became cash flow.",
  proof: "Trophy Champs -> private training -> Bridge validation at $1K/month",
  cta: "View Genesis",
};

export const napoleonSeedLoops: NapoleonCashLoop[] = [
  {
    id: "loop-player-memory-pass",
    title: "Player Memory Pass",
    status: "building",
    targetCustomer: "Parents who already pay for development",
    offer: "Recurring session memory after every workout",
    nextAction: "Build checkout path and first parent message",
    proofStatus: "Bridge validation supports the direction",
    createdAt: "2026-06-23T12:00:00.000Z",
  },
  {
    id: "loop-practice-report",
    title: "Practice Report",
    status: "idea",
    targetCustomer: "Coaches and small programs",
    offer: "Turn practice notes into next-session carryovers",
    nextAction: "Package one report from a real practice",
    proofStatus: "Needs one paid test",
    createdAt: "2026-06-23T12:05:00.000Z",
  },
  {
    id: "loop-game-report",
    title: "Game Report",
    status: "idea",
    targetCustomer: "Parents and teams after games",
    offer: "Readable game recap with proof and next work",
    nextAction: "Use one finished game as the sample",
    proofStatus: "Awaiting cash wire",
    createdAt: "2026-06-23T12:10:00.000Z",
  },
  {
    id: "loop-napoleon-install",
    title: "Napoleon Cash Loop Install",
    status: "building",
    targetCustomer: "Operators with hidden offers",
    offer: "Find leaks, shape offers, and install repeatable cash loops",
    nextAction: "Create the first query-first walkthrough",
    proofStatus: "Historical proof only",
    createdAt: "2026-06-23T12:15:00.000Z",
  },
];

export const napoleonSeedProof: NapoleonProof[] = [
  {
    id: "proof-bridge-validation",
    type: "Historical proof",
    text: "Bridge validation at $1K/month.",
    createdAt: "2026-06-23T12:20:00.000Z",
  },
];

export const napoleonNextMove: NapoleonNextMove = {
  id: "next-player-memory-pass",
  title: "Build Player Memory Pass checkout path.",
  reason: "Parents already pay for training. The proof/recap layer can become recurring revenue.",
};

export const napoleonConnections: NapoleonConnection[] = [
  {
    id: "stripe",
    name: "Stripe",
    status: "planned",
    proves: "Payment received, subscription started, cash protected",
    events: ["Payment received", "Subscription started", "Cash leak detected"],
    actions: ["Create checkout link", "Check failed payments"],
    connectedCashLoop: "Player Memory Pass",
    lastSync: "Not connected yet",
  },
  {
    id: "shopify",
    name: "Shopify",
    status: "needs connection",
    proves: "Product interest and checkout intent",
    events: ["Checkout started", "Order paid"],
    actions: ["Inspect offer page", "Find checkout leaks"],
    connectedCashLoop: "Napoleon Cash Loop Install",
    lastSync: "Not connected yet",
  },
  {
    id: "instagram",
    name: "Instagram",
    status: "planned",
    proves: "Attention, replies, and offer pull",
    events: ["Post published", "Message received", "Link tapped"],
    actions: ["Draft post", "Turn reply into offer"],
    connectedCashLoop: "Practice Report",
    lastSync: "Not connected yet",
  },
  {
    id: "facebook",
    name: "Facebook",
    status: "planned",
    proves: "Parent audience response",
    events: ["Post response", "Group reply", "Message received"],
    actions: ["Share offer", "Follow up with interested parent"],
    connectedCashLoop: "Player Memory Pass",
    lastSync: "Not connected yet",
  },
  {
    id: "google-analytics",
    name: "Google Analytics",
    status: "needs connection",
    proves: "Offer page traffic and leaks",
    events: ["Page viewed", "Button clicked", "Drop-off detected"],
    actions: ["Find leak", "Protect checkout path"],
    connectedCashLoop: "Napoleon Cash Loop Install",
    lastSync: "Not connected yet",
  },
  {
    id: "gmail",
    name: "Gmail",
    status: "planned",
    proves: "Replies, objections, and follow-up gaps",
    events: ["Reply received", "No response", "Offer sent"],
    actions: ["Draft reply", "Follow up"],
    connectedCashLoop: "Game Report",
    lastSync: "Not connected yet",
  },
  {
    id: "calendar",
    name: "Calendar",
    status: "planned",
    proves: "Session demand and booked time",
    events: ["Session booked", "Session missed", "Follow-up due"],
    actions: ["Create next step", "Protect recurring session"],
    connectedCashLoop: "Player Memory Pass",
    lastSync: "Not connected yet",
  },
  {
    id: "twilio",
    name: "Twilio",
    status: "planned",
    proves: "Text follow-up and response rate",
    events: ["Text sent", "Text reply", "Follow-up missed"],
    actions: ["Send reminder", "Turn reply into next action"],
    connectedCashLoop: "Practice Report",
    lastSync: "Not connected yet",
  },
  {
    id: "tiktok",
    name: "TikTok",
    status: "planned",
    proves: "Short-form attention and offer pull",
    events: ["Video posted", "Comment received", "Profile tap"],
    actions: ["Turn clip into hook", "Route interest to offer"],
    connectedCashLoop: "Game Report",
    lastSync: "Not connected yet",
  },
  {
    id: "youtube",
    name: "YouTube",
    status: "planned",
    proves: "Longer proof consumption",
    events: ["Video viewed", "Description link tapped", "Comment received"],
    actions: ["Package proof", "Move viewer to offer"],
    connectedCashLoop: "Napoleon Cash Loop Install",
    lastSync: "Not connected yet",
  },
];

export function createNapoleonMockResult(input: string): NapoleonAgentResult {
  const now = new Date().toISOString();
  const query: NapoleonQuery = {
    id: createNapoleonId("query"),
    input,
    createdAt: now,
    status: "answered",
  };

  return {
    id: createNapoleonId("result"),
    query,
    createdAt: now,
    voices: [
      {
        id: "visionary",
        label: "Visionary",
        headline: "Player development memory is the first company node.",
        points: [
          "The opportunity is not more training. It is proving what training created.",
          "Axis powers the memory. Napoleon turns the memory into the offer path.",
          "The company node is recurring proof for players and parents.",
        ],
      },
      {
        id: "numbers",
        label: "Numbers",
        headline: "Sell Player Memory Pass at $25-$75/month.",
        points: [
          "First target: 10 parents = $250-$750 MRR.",
          "Revenue logic: training already has trust, memory creates the repeat reason.",
          "Leak risk: sessions disappear if no recap, proof, or next action follows.",
          "Next money action: build one checkout path and ask the warmest 10 parents.",
        ],
      },
      {
        id: "words",
        label: "Words",
        headline: "Training disappears unless you turn it into memory.",
        points: [
          "Hook: Your kid works hard, but the progress disappears between sessions.",
          "Offer: I am giving players proof after every session.",
          "CTA: Want the first Player Memory Pass for your next month of training?",
        ],
      },
    ],
    suggestedLoop: {
      title: "Player Memory Pass",
      targetCustomer: "Parents already paying for basketball development",
      offer: "Recurring session proof, recap, and next-session card",
      nextAction: "Create checkout path and send the first parent message",
      proofStatus: "Historical proof supports the direction",
    },
  };
}

export function createNapoleonId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
