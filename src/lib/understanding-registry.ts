// ---------------------------------------------------------------------------
// Understanding Registry
//
// Stores pre-known leverage points, mental models, and common mistakes
// for recognized domains. The engine searches this first before calling
// the LLM — reducing latency and cost for well-understood intents.
//
// Shape is intentionally flat. No behavior. No imports.
// ---------------------------------------------------------------------------

export interface UnderstandingEntry {
  id: string;
  triggers: string[];           // intent keywords that match this entry
  leveragePoint: string;        // the actual problem underneath the intent
  mentalModel: string;          // the conceptual reframe that unlocks it
  commonMistake: string;        // what athletes usually do wrong
  examples: string[];           // concrete situations where this shows up
}

export const UNDERSTANDING_REGISTRY: UnderstandingEntry[] = [
  {
    id: "u-triple-threat",
    triggers: ["triple threat", "triple-threat", "1v1", "one on one", "off the catch"],
    leveragePoint: "Waiting for information that the defender isn't going to give you.",
    mentalModel: "Information is created, not discovered. The defender is waiting too. Nothing changes until someone acts first.",
    commonMistake: "Reading the defender instead of making the defender read you.",
    examples: [
      "Catching on the wing and staring at the defender before deciding",
      "Holding the ball too long hoping the defense makes a mistake",
      "Going live only after the defender commits",
    ],
  },
  {
    id: "u-eyes-up",
    triggers: ["eyes up", "looking down", "head down", "watch the ball", "i keep looking"],
    leveragePoint: "The ball is demanding your attention instead of serving it.",
    mentalModel: "Your hands already know where the ball is. Your eyes are for reading the game, not confirming the dribble.",
    commonMistake: "Trusting the dribble with eyes, not with hands.",
    examples: [
      "Looking down when a defender pressures",
      "Losing sight of the open man because the ball pulled your gaze",
      "Having to look before changing hands",
    ],
  },
  {
    id: "u-finishing",
    triggers: ["finishing", "finish", "layup", "at the rim", "around the rim", "contact"],
    leveragePoint: "Bracing for contact instead of finishing through it.",
    mentalModel: "Contact is information — it tells you where the defender is. Your job is to use the contact, not avoid it.",
    commonMistake: "Absorbing contact passively instead of continuing the shooting motion.",
    examples: [
      "Stopping the motion when bumped",
      "Going to the off hand too late after contact",
      "Changing the finish decision mid-air based on contact",
    ],
  },
  {
    id: "u-passing",
    triggers: ["passing", "playmaking", "distribute", "see the floor", "find open"],
    leveragePoint: "Deciding after receiving instead of deciding before.",
    mentalModel: "The best pass is the one you were already ready to make. Catching and deciding is one beat too slow.",
    commonMistake: "Scanning after the catch instead of scanning before.",
    examples: [
      "Catching then looking for the open man",
      "Making the skip pass a half-second late",
      "Holding the ball while the window closes",
    ],
  },
  {
    id: "u-defense",
    triggers: ["defense", "defending", "staying in front", "on ball", "closeout"],
    leveragePoint: "Reacting to the ball instead of the body.",
    mentalModel: "The ball doesn't decide where the player goes — the feet do. Watch the hips, not the ball.",
    commonMistake: "Getting frozen by ball fakes because eyes are on the ball.",
    examples: [
      "Biting on crossover fakes",
      "Losing position on a jab step",
      "Getting beat because the first step was late",
    ],
  },
  {
    id: "u-pick-and-roll",
    triggers: ["pick and roll", "ball screen", "p&r", "pnr", "using screens"],
    leveragePoint: "Treating the screen as an event instead of a tool.",
    mentalModel: "The screen doesn't create the advantage — your read of the coverage does. The screen just forces a decision.",
    commonMistake: "Running off the screen the same way regardless of coverage.",
    examples: [
      "Turning the corner into a waiting hedge",
      "Missing the roller because the hedge demanded attention",
      "Not recognizing the drop until too late",
    ],
  },
  {
    id: "u-shooting",
    triggers: ["shooting", "shot", "jumper", "free throw", "form", "release"],
    leveragePoint: "The last thing you add is the first thing that breaks.",
    mentalModel: "Shooting is a chain. Every link connects. When something breaks, look at the foundation — feet, balance — not the end of the chain.",
    commonMistake: "Fixing the release without fixing the base.",
    examples: [
      "Drifting on catch-and-shoot because feet weren't set first",
      "Inconsistent release caused by inconsistent approach",
      "Free throw misses tied to routine breaks, not mechanics",
    ],
  },
  {
    id: "u-moving-without-ball",
    triggers: ["moving without the ball", "off ball", "off-ball", "cutting", "getting open", "movement"],
    leveragePoint: "Waiting to be found instead of creating a place to be seen.",
    mentalModel: "Movement creates the pass before the ball arrives. A useful cut gives the passer a signal, not just a target.",
    commonMistake: "Drifting into space instead of changing the defender's decision.",
    examples: [
      "Standing on the wing waiting for the ball",
      "Cutting after the passing window has already closed",
      "Moving without forcing the defender to turn their head",
    ],
  },
  {
    id: "u-handles",
    triggers: ["handles", "dribbling", "ball handling", "dribble", "crossover"],
    leveragePoint: "Dribbling to manage the ball instead of to create options.",
    mentalModel: "Every dribble should put the defense in a worse position than the last one. Dribbling without purpose is just possession risk.",
    commonMistake: "Dribbling to think instead of to attack.",
    examples: [
      "Extra dribbles that don't advance position",
      "Crossover in place without changing the defender's angle",
      "Dribbling away from pressure instead of through it",
    ],
  },
];

export function findEntry(intent: string): UnderstandingEntry | null {
  const lower = intent.toLowerCase();
  return UNDERSTANDING_REGISTRY.find((e) => e.triggers.some((t) => lower.includes(t))) ?? null;
}
