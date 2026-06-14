// ---------------------------------------------------------------------------
// Axis Expansion Engine V1
//
// Position in the loop:
//   Intent → Expand → Constrain → Witness → Expand
//                 ^^^
//
// Job: take vague intent, find the actual problem, produce one constraint.
// Never routes directly. First understands. Then constrains.
//
// Max 1 clarifying question per intent. Never more.
// Output always: { constraint, duration }.
// ---------------------------------------------------------------------------

export interface ExpansionQuestion {
  text: string;
}

export interface GeneratedConstraint {
  constraint: string;
}

export interface ExpansionAnalysis {
  needsExpansion: boolean;
  question: ExpansionQuestion | null;
  // Non-null when intent is specific enough to skip expansion
  directConstraint: GeneratedConstraint | null;
}

// ---------------------------------------------------------------------------
// Knowledge base types
// ---------------------------------------------------------------------------

interface AnswerMapping {
  keywords: string[];
  constraint: string;
}

// One expansion rule = one domain
// question: what Axis asks to find the real problem
// answers: (answer keywords) → constraint
// fallback: constraint when answer doesn't match any mapping
interface ExpansionRule {
  triggers: string[];
  question: string;
  answers: AnswerMapping[];
  fallback: string;
}

// Intents specific enough to produce a constraint without asking
interface DirectRule {
  triggers: string[];
  constraint: string;
}

// ---------------------------------------------------------------------------
// Expansion rules
// ---------------------------------------------------------------------------

const RULES: ExpansionRule[] = [
  {
    triggers: ["handle", "handling", "dribbling", "dribble", "ball handling"],
    question: "What's hardest right now?",
    answers: [
      { keywords: ["eyes", "looking down", "head down", "look up", "watch the ball", "i keep looking"], constraint: "Eyes Up" },
      { keywords: ["weak", "left hand", "off hand", "non-dominant", "weaker hand"], constraint: "Left Hand Only" },
      { keywords: ["speed", "quick", "fast", "pressure", "when guarded", "under pressure"], constraint: "Full Speed" },
      { keywords: ["crossover", "cross", "between legs", "through the legs"], constraint: "Crossover Only" },
      { keywords: ["contact", "body", "bumped", "physical", "tight", "defender"], constraint: "Tight Dribble" },
      { keywords: ["behind the back", "behind", "spin"], constraint: "Behind The Back Only" },
    ],
    fallback: "Eyes Up",
  },
  {
    triggers: ["finish", "finishing", "layup", "layups", "at the rim", "around the rim", "lay up"],
    question: "What causes the miss?",
    answers: [
      { keywords: ["contact", "bump", "hit", "foul", "physical", "getting hit", "through contact"], constraint: "Finish Through Contact" },
      { keywords: ["weak", "left", "off hand", "non-dominant"], constraint: "Left Hand Finish" },
      { keywords: ["floater", "float", "runner", "running"], constraint: "Floater Only" },
      { keywords: ["euro", "step through", "euro step"], constraint: "Euro Step Finish" },
      { keywords: ["footwork", "steps", "off foot", "landing", "feet"], constraint: "Two-Foot Finish" },
      { keywords: ["reverse", "backdoor", "under the rim"], constraint: "Reverse Layup Only" },
    ],
    fallback: "Finish Through Contact",
  },
  {
    triggers: ["shooting", "shot", "shoot", "jumper", "jump shot", "three", "3-pointer", "mid range", "pull up", "pull-up"],
    question: "What part?",
    answers: [
      { keywords: ["catch", "spot up", "feet", "catch and shoot", "set feet", "getting my feet set"], constraint: "Feet Before Ball" },
      { keywords: ["off dribble", "pull up", "create", "off the bounce", "off a dribble"], constraint: "One-Dribble Pull Up" },
      { keywords: ["release", "form", "mechanics", "arc", "high arc"], constraint: "High Arc Release" },
      { keywords: ["balance", "falling", "drift", "lean", "leaning", "falling away"], constraint: "Land Where You Jumped" },
      { keywords: ["quick", "quicker", "fast release", "slow release", "slow"], constraint: "Quick Release" },
      { keywords: ["free throw", "ft", "foul line", "charity"], constraint: "Routine First" },
    ],
    fallback: "Feet Before Ball",
  },
  {
    triggers: ["pick and roll", "ball screen", "p&r", "pnr", "pick", "roll man", "screen and roll"],
    question: "What part?",
    answers: [
      { keywords: ["hedge", "hard hedge", "high hedge", "hard", "trap", "two on one", "trapped"], constraint: "Pocket Pass Only" },
      { keywords: ["set", "setting", "body", "angle", "position", "bad screen", "setting the screen"], constraint: "Stop. Set. Go" },
      { keywords: ["turn corner", "attack", "using it", "get downhill", "turn the corner", "using the screen"], constraint: "Turn Corner" },
      { keywords: ["drop", "soft", "conservative", "coverage", "drop coverage", "soft coverage"], constraint: "Attack The Drop" },
      { keywords: ["switch", "switched", "mismatch", "they switch"], constraint: "Attack The Mismatch" },
      { keywords: ["pop", "shooter", "popping", "three", "pop for three"], constraint: "Pop For Three" },
    ],
    fallback: "Turn Corner",
  },
  {
    triggers: ["vision", "see", "seeing", "awareness", "court vision", "read", "reading", "not seeing"],
    question: "What part?",
    answers: [
      { keywords: ["find open", "open man", "who's open", "teammates", "see who's open"], constraint: "Corner First" },
      { keywords: ["defense", "read defense", "defender", "coverage", "read the defense"], constraint: "Eyes Up" },
      { keywords: ["pass", "passing", "pass lanes", "passing lanes", "see passes"], constraint: "Skip Pass Only" },
      { keywords: ["before", "pre-catch", "off ball", "without the ball", "before i catch"], constraint: "Know Before You Catch" },
      { keywords: ["drive", "penetration", "collapse", "kick", "kick out", "after i drive"], constraint: "Drive And Kick" },
    ],
    fallback: "Eyes Up",
  },
  {
    triggers: ["defense", "defending", "guarding", "stop", "defensive", "on ball defense", "help side"],
    question: "What part?",
    answers: [
      { keywords: ["on ball", "my man", "stay in front", "stay with", "guarding my man", "one on one"], constraint: "Stay Connected" },
      { keywords: ["help", "rotation", "rotate", "help side", "helping"], constraint: "Sprint To Help" },
      { keywords: ["position", "stance", "footwork", "feet", "body position", "where to be"], constraint: "Ball. Man. Hoop." },
      { keywords: ["closeout", "close out", "shooter", "open player", "closing out"], constraint: "Controlled Closeout" },
      { keywords: ["hands", "steal", "contest", "block", "active hands"], constraint: "Hands Active" },
    ],
    fallback: "Stay Connected",
  },
  {
    triggers: ["passing", "pass", "distribute", "distributing", "playmaking", "make plays", "playmaker"],
    question: "What part?",
    answers: [
      { keywords: ["timing", "late", "slow", "hesitate", "hold too long", "holding it"], constraint: "Pass Ahead" },
      { keywords: ["skip", "skip pass", "across", "far side", "weak side"], constraint: "Skip Pass Only" },
      { keywords: ["drive and kick", "kick out", "penetrate", "draw and kick", "after driving"], constraint: "Drive And Kick" },
      { keywords: ["entry", "post", "feed", "into the post", "post entry"], constraint: "Post Entry Pass" },
      { keywords: ["pocket", "pnr", "pick and roll", "out of pick and roll"], constraint: "Pocket Pass Only" },
    ],
    fallback: "Pass Ahead",
  },
  {
    triggers: ["post", "low post", "post up", "back to basket", "post move", "back to the basket"],
    question: "What part?",
    answers: [
      { keywords: ["footwork", "feet", "pivot", "drop step", "spin", "move"], constraint: "One Move Only" },
      { keywords: ["catch", "receive", "seal", "position", "getting open", "sealing"], constraint: "Seal And Catch" },
      { keywords: ["finish", "score", "go up", "shooting", "shot fake", "finishing"], constraint: "Finish With Contact" },
      { keywords: ["double", "double team", "trap", "read", "kick out", "find the double"], constraint: "Find The Double" },
    ],
    fallback: "One Move Only",
  },
  {
    triggers: ["footwork", "feet", "cutting", "off ball", "off-ball", "movement without the ball", "moving without"],
    question: "What part?",
    answers: [
      { keywords: ["cut", "v-cut", "backdoor", "getting open", "cuts", "cutting"], constraint: "Sharp Cut Only" },
      { keywords: ["pivot", "pivoting", "pivot foot", "foot"], constraint: "Pivot Work" },
      { keywords: ["jab", "jab step", "jab series", "create space", "jab and go"], constraint: "Jab And Go" },
      { keywords: ["speed", "quick", "explosive", "burst", "first step", "first move"], constraint: "Explosive First Step" },
    ],
    fallback: "Explosive First Step",
  },
];

// Specific intents — skip expansion entirely
const DIRECT_RULES: DirectRule[] = [
  { triggers: ["eyes up", "keep my eyes up", "head up", "looking down at the ball", "i keep looking down"], constraint: "Eyes Up" },
  { triggers: ["weak hand only", "off hand only", "left hand only", "non-dominant only"], constraint: "Left Hand Only" },
  { triggers: ["pocket pass", "pocket"], constraint: "Pocket Pass Only" },
  { triggers: ["euro step", "eurostep"], constraint: "Euro Step Finish" },
  { triggers: ["floater", "runner"], constraint: "Floater Only" },
  { triggers: ["free throw routine", "at the foul line", "free throws specifically"], constraint: "Routine First" },
  { triggers: ["closeout", "close out"], constraint: "Controlled Closeout" },
  { triggers: ["drop step", "drop-step"], constraint: "Drop Step Finish" },
  { triggers: ["backdoor cut", "v-cut", "v cut"], constraint: "Sharp Cut Only" },
  { triggers: ["skip pass"], constraint: "Skip Pass Only" },
];

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function matchesTriggers(text: string, triggers: string[]): boolean {
  const lower = text.toLowerCase();
  return triggers.some((t) => lower.includes(t));
}

function findAnswerConstraint(answer: string, mappings: AnswerMapping[]): string | null {
  const lower = answer.toLowerCase();
  for (const m of mappings) {
    if (m.keywords.some((k) => lower.includes(k))) return m.constraint;
  }
  return null;
}

// Last resort: pull a constraint phrase from the answer text itself
function extractConstraintFromAnswer(answer: string): string {
  let s = answer.trim().toLowerCase();
  const fillers = [
    "i keep ", "i'm having trouble with ", "i struggle with ", "i can't ",
    "i need to work on ", "my problem is ", "when i ", "i have trouble with ",
    "it's hard to ", "i find it hard to ", "i always ", "i tend to ",
  ];
  for (const f of fillers) {
    if (s.startsWith(f)) s = s.slice(f.length).trim();
    s = s.replace(f, "").trim();
  }
  return s
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function analyzeIntent(intent: string): ExpansionAnalysis {
  // Specific intent → constraint directly, no question
  for (const rule of DIRECT_RULES) {
    if (matchesTriggers(intent, rule.triggers)) {
      return {
        needsExpansion: false,
        question: null,
        directConstraint: { constraint: rule.constraint },
      };
    }
  }

  // Recognized domain → ask one clarifying question
  for (const rule of RULES) {
    if (matchesTriggers(intent, rule.triggers)) {
      return {
        needsExpansion: true,
        question: { text: rule.question },
        directConstraint: null,
      };
    }
  }

  // Unknown intent → signal caller to fall back to context routing
  return { needsExpansion: false, question: null, directConstraint: null };
}

export function generateConstraint(intent: string, answer: string): GeneratedConstraint {
  for (const rule of RULES) {
    if (matchesTriggers(intent, rule.triggers)) {
      const found = findAnswerConstraint(answer, rule.answers);
      return { constraint: found ?? rule.fallback };
    }
  }
  // No matching domain — extract from the answer text itself
  const constraint = extractConstraintFromAnswer(answer) || "Eyes Up";
  return { constraint };
}
