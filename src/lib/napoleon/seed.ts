import type {
  NapoleonAgentResult,
  NapoleonCashLoop,
  NapoleonCashStreamSystem,
  NapoleonConnection,
  NapoleonIncomeType,
  NapoleonNextMove,
  NapoleonNode,
  NapoleonProof,
  NapoleonQuery,
  NapoleonWealthLayer,
} from "./types";

export const playerMemoryPassOffer = {
  targetCustomer: "Parents of players",
  coreProblem: "Training progress disappears without proof",
  offer: "Monthly player memory, recap, clips, development notes, and next focus",
  pricing: [
    { label: "Starter" as const, price: "$25/month" },
    { label: "Plus" as const, price: "$50/month" },
    { label: "Pro" as const, price: "$75/month" },
  ],
  fastestCashPath: "Start with Stripe payment link",
  scalableCashPath: "Shopify product + subscription + parent portal",
};

export const playerMemoryPassCheckoutWire = {
  status: "not_wired" as const,
  connections: [
    {
      name: "Stripe" as const,
      status: "not connected / ready placeholder",
      purpose: "Fastest payment link path",
    },
    {
      name: "Shopify" as const,
      status: "future product catalog",
      purpose: "Scalable product and subscription path",
    },
    {
      name: "Website" as const,
      status: "landing page needed",
      purpose: "Explain the pass and route parents to checkout",
    },
  ],
};

export const playerMemoryPassFulfillmentWire = {
  status: "not_wired" as const,
  buyerReceives: [
    "Session recap",
    "Player development note",
    "1-3 clips or proof moments",
    "Next focus",
    "Monthly progress summary",
  ],
};

export const playerMemoryPassLeakRule = {
  id: "leak-player-memory-pass-recap",
  rule: "If session_completed occurs and no recap_generated or payment_link_created occurs within 15 minutes, mark leak.",
  estimatedLeak: "Selected price tier",
  testStatus: "not_tested" as const,
};

export const napoleonGenesisNode: NapoleonNode = {
  id: "axis-genesis-node",
  title: "Axis Genesis Node",
  subtitle: "Basketball reality became cash flow.",
  proof: "Trophy Champs -> private training -> Bridge validation at $1K/month",
  cta: "View Genesis",
  visibility: "public",
};

export const napoleonSeedLoops: NapoleonCashLoop[] = [
  createSeedLoop({
    id: "loop-trophy-champs-training",
    title: "Trophy Champs Training",
    status: "proven",
    incomeType: "earned_income",
    wealthLayer: "active_core",
    cashStreamSystem: "service_to_product_loop",
    systemBlueprint: "Service-to-Product Cash Loop",
    targetCustomer: "Players and parents paying for direct training",
    offer: "Private basketball training rooted in real session work",
    fastestCashPath: "Book the next paid workout from an existing relationship",
    automationPath: "Turn each session into recap proof and follow-up",
    reinvestmentRule: "Route surplus into the next productized proof layer",
    leakRule: "Do not let training progress disappear after the gym",
    nextAction: "Capture the next session as proof for the memory product",
    proofStatus: "Historical proof",
    createdAt: "2026-06-23T11:50:00.000Z",
    visibility: "founder",
  }),
  createSeedLoop({
    id: "loop-bridge-validation",
    title: "Bridge Validation",
    status: "proven",
    incomeType: "earned_income",
    wealthLayer: "active_core",
    cashStreamSystem: "service_to_product_loop",
    systemBlueprint: "Service-to-Product Cash Loop",
    targetCustomer: "Bridge customer already validating recurring value",
    offer: "Recurring productized service validation",
    fastestCashPath: "Protect the live validation path",
    automationPath: "Turn the validated work into repeatable onboarding",
    reinvestmentRule: "Use confirmed demand to fund the next product loop",
    leakRule: "Do not treat validation as permanent proof without retention",
    nextAction: "Document what made the $1K/month validation work",
    proofStatus: "Historical proof at $1K/month",
    createdAt: "2026-06-23T11:55:00.000Z",
    visibility: "founder",
  }),
  {
    id: "loop-player-memory-pass",
    title: "Player Memory Pass",
    status: "building",
    incomeType: "profit_income",
    wealthLayer: "leveraged_accelerator",
    cashStreamSystem: "digital_content_funnel",
    systemBlueprint: "Digital Content Funnel",
    targetCustomer: "Parents who already pay for development",
    offer: "Recurring session memory after every workout",
    fastestCashPath: "Ask the warmest 10 parents to buy the first pass",
    automationPath: "Session recap -> parent proof -> checkout -> next-session card",
    reinvestmentRule: "Use first payments to improve capture and delivery speed",
    leakRule: "No session should end without recap, proof, and a next action",
    nextAction: "Build checkout path and first parent message",
    proofStatus: "Bridge validation supports the direction",
    createdAt: "2026-06-23T12:00:00.000Z",
    visibility: "founder",
    offerBuilder: playerMemoryPassOffer,
    checkoutWire: playerMemoryPassCheckoutWire,
    fulfillmentWire: playerMemoryPassFulfillmentWire,
    leakRuleConfig: playerMemoryPassLeakRule,
    artifacts: [],
  },
  {
    id: "loop-practice-report",
    title: "Practice Report",
    status: "idea",
    incomeType: "profit_income",
    wealthLayer: "leveraged_accelerator",
    cashStreamSystem: "digital_content_funnel",
    systemBlueprint: "Digital Content Funnel",
    targetCustomer: "Coaches and small programs",
    offer: "Turn practice notes into next-session carryovers",
    fastestCashPath: "Sell one paid report from a real practice",
    automationPath: "Practice memory -> report draft -> coach approval -> repeat package",
    reinvestmentRule: "Use report sales to improve templates and distribution",
    leakRule: "Do not let practice value stay trapped in rough notes",
    nextAction: "Package one report from a real practice",
    proofStatus: "Needs one paid test",
    createdAt: "2026-06-23T12:05:00.000Z",
    visibility: "founder",
  },
  {
    id: "loop-game-report",
    title: "Game Report",
    status: "idea",
    incomeType: "profit_income",
    wealthLayer: "leveraged_accelerator",
    cashStreamSystem: "digital_content_funnel",
    systemBlueprint: "Digital Content Funnel",
    targetCustomer: "Parents and teams after games",
    offer: "Readable game recap with proof and next work",
    fastestCashPath: "Create one paid post-game report from a real game",
    automationPath: "Game notes -> recap -> parent proof -> paid report",
    reinvestmentRule: "Use paid reports to fund faster game-to-recap workflow",
    leakRule: "Do not imply proof the session did not capture",
    nextAction: "Use one finished game as the sample",
    proofStatus: "Awaiting cash wire",
    createdAt: "2026-06-23T12:10:00.000Z",
    visibility: "founder",
  },
  {
    id: "loop-napoleon-install",
    title: "Napoleon Cash Loop Install",
    status: "building",
    incomeType: "earned_income",
    wealthLayer: "active_core",
    cashStreamSystem: "service_to_product_loop",
    systemBlueprint: "Service-to-Product Cash Loop",
    targetCustomer: "Operators with hidden offers",
    offer: "Find leaks, shape offers, and install repeatable cash loops",
    fastestCashPath: "Run a paid install for one operator with existing demand",
    automationPath: "Query -> loop map -> offer -> checkout path -> proof feed",
    reinvestmentRule: "Use install cash to build reusable Napoleon systems",
    leakRule: "Do not build systems before the cash path is named",
    nextAction: "Create the first query-first walkthrough",
    proofStatus: "Historical proof only",
    createdAt: "2026-06-23T12:15:00.000Z",
    visibility: "founder",
  },
  createSeedLoop({
    id: "loop-napoleon-operator-referral",
    title: "Napoleon Operator Referral",
    status: "idea",
    incomeType: "capital_gains_commission",
    wealthLayer: "leveraged_accelerator",
    cashStreamSystem: "digital_content_funnel",
    systemBlueprint: "Commission Engine",
    targetCustomer: "Operators who need a trusted tool or service path",
    offer: "Referral into a tool, install, or partner service that closes the loop",
    fastestCashPath: "Match one operator to one paid solution with clear commission terms",
    automationPath: "Connection signal -> referral offer -> tracked follow-up -> commission proof",
    reinvestmentRule: "Route commission cash into better acquisition and proof capture",
    leakRule: "No referral without ownership of the follow-up and proof trail",
    nextAction: "Define the first referral target and commission agreement",
    proofStatus: "Needs permissioned tracking",
    createdAt: "2026-06-23T12:18:00.000Z",
    visibility: "founder",
  }),
  createSeedLoop({
    id: "loop-axis-napoleon-licensing",
    title: "Axis/Napoleon Licensing",
    status: "idea",
    incomeType: "royalty_income",
    wealthLayer: "passive_foundation",
    cashStreamSystem: "digital_content_funnel",
    systemBlueprint: "Licensing System",
    targetCustomer: "Programs or operators who want the system without custom service",
    offer: "Licensed Axis/Napoleon session-memory and cash-loop playbook",
    fastestCashPath: "Validate one repeatable install before licensing",
    automationPath: "Proof library -> license package -> onboarding -> recurring rights",
    reinvestmentRule: "Route licensed surplus into durable foundation, not more manual work",
    leakRule: "Do not license what is not repeatable yet",
    nextAction: "Identify what part of the install is truly repeatable",
    proofStatus: "Future only",
    createdAt: "2026-06-23T12:19:00.000Z",
    visibility: "founder",
  }),
];

export const napoleonCashStreamSystems = [
  {
    id: "service_to_product_loop",
    title: "Service-to-Product Cash Loop",
    subtitle: "Turn real work into a repeatable paid product.",
    example: "Basketball session -> recap/report -> payment -> proof.",
  },
  {
    id: "digital_content_funnel",
    title: "Digital Content Funnel",
    subtitle: "Turn proof/content into 24/7 offers and checkout.",
    example: "Proof post -> message -> offer page -> checkout.",
  },
  {
    id: "automated_rental_engine",
    title: "Automated Rental Engine",
    subtitle: "Turn physical assets into managed booking income.",
    example: "Asset -> listing -> booking -> managed payout.",
  },
  {
    id: "retail_arbitrage_wheel",
    title: "Retail Arbitrage Wheel",
    subtitle: "Turn sourced products into automated fulfillment profit.",
    example: "Source -> list -> fulfill -> replenish.",
  },
  {
    id: "automated_wealth_sweep",
    title: "Automated Wealth Sweep",
    subtitle: "Route surplus profits into long-term financial foundation.",
    example: "Future permissioned allocation system. No auto-investing yet.",
  },
] as const;

export const napoleonSeedProof: NapoleonProof[] = [
  {
    id: "proof-bridge-validation",
    type: "Historical proof",
    text: "Bridge validation at $1K/month.",
    createdAt: "2026-06-23T12:20:00.000Z",
    visibility: "public",
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
    cashStream: {
      moneyType: "profit_income",
      wealthLayer: "leveraged_accelerator",
      systemBlueprint: "Digital Content Funnel",
      fastestCashPath: "Ask the warmest 10 parents to buy the first Player Memory Pass.",
      automationPath: "Session memory -> proof recap -> parent message -> checkout path.",
      reinvestmentValve: "Use first payments to improve capture, delivery speed, and proof quality.",
      leakRule: "No session should disappear without recap, proof, and a next action.",
      nextAction: "Create checkout path and send the first parent message.",
    },
    suggestedLoop: {
      title: "Player Memory Pass",
      targetCustomer: "Parents already paying for basketball development",
      offer: "Recurring session proof, recap, and next-session card",
      nextAction: "Create checkout path and send the first parent message",
      proofStatus: "Historical proof supports the direction",
      incomeType: "profit_income",
      wealthLayer: "leveraged_accelerator",
      cashStreamSystem: "digital_content_funnel",
      systemBlueprint: "Digital Content Funnel",
      fastestCashPath: "Ask the warmest 10 parents to buy the first Player Memory Pass",
      automationPath: "Session memory -> proof recap -> parent message -> checkout path",
      reinvestmentRule: "Use first payments to improve capture, delivery speed, and proof quality",
      leakRule: "No session should disappear without recap, proof, and a next action",
    },
  };
}

export function createNapoleonId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSeedLoop(loop: NapoleonCashLoop) {
  return loop;
}

export function labelNapoleonIncomeType(type: NapoleonIncomeType) {
  return type
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function labelNapoleonWealthLayer(layer: NapoleonWealthLayer) {
  if (layer === "active_core") return "Active Core";
  if (layer === "leveraged_accelerator") return "Leveraged Accelerator";
  return "Passive Foundation";
}

export function labelNapoleonCashStreamSystem(system: NapoleonCashStreamSystem) {
  if (system === "service_to_product_loop") return "Service-to-Product Cash Loop";
  if (system === "digital_content_funnel") return "Digital Content Funnel";
  if (system === "automated_rental_engine") return "Automated Rental Engine";
  if (system === "retail_arbitrage_wheel") return "Retail Arbitrage Wheel";
  return "Automated Wealth Sweep";
}
