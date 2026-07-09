export type IntakeState = {
  playerName: string;
  age: string;
  graduationYear: string;
  teamSchool: string;
  positionRole: string;
  parentGoal: string;
  playerGoal: string;
  coachConcern: string;
  currentStrength: string;
  currentStruggle: string;
  movementContext: string;
  mainReason: string;
};

export type PermissionState = {
  recordingPermission: boolean;
  privateProofClipPermission: boolean;
  privateReportPermission: boolean;
  approvedRecipients: string;
  publicContentPermission: boolean;
  marketingPermission: boolean;
  namingRestrictions: string;
  schoolRestrictions: string;
  parentRestrictions: string;
};

export type ProofMoment = {
  id: string;
  time: string;
  category: string;
  whatHappened: string;
  whyItMatters: string;
  possibleNextObjective: string;
  followUpIdea: string;
};

export type ReportState = {
  mainStrength: string;
  developmentPriority: string;
  developmentRead: string;
  proofClips: string;
  nextObjective: string;
  developmentPlanDirection: string;
  recommendedFollowUp: string;
};

export type OfferState = {
  offerName: string;
  offerType: string;
  price: string;
  status: string;
  notes: string;
};

export type DebriefState = {
  paidAmount: string;
  parentFeedback: string;
  whatCreatedTrust: string;
  whatConfused: string;
  bestProofClip: string;
  lesson: string;
  axisImprovement: string;
};

export type PlayerIntelligenceSession = {
  id: string;
  sessionNumber: number | null;
  status: "open" | "complete";
  createdAt: string;
  updatedAt: string;
  intake: IntakeState;
  permission: PermissionState;
  checklist: Record<string, boolean>;
  proofMoments: ProofMoment[];
  report: ReportState & { reportSent: boolean };
  offer: OfferState & {
    followUpOffered: boolean;
    followUpSold: boolean;
  };
  debrief: DebriefState;
};

export type PlayerIntelligenceStore = {
  version: 1;
  sprintDone: Record<string, boolean>;
  activeSessionId: string | null;
  sessions: PlayerIntelligenceSession[];
};

export type Completion = {
  done: number;
  total: number;
  percent: number;
};

export type FirstTenSlot = {
  number: number;
  session: PlayerIntelligenceSession | null;
  open: boolean;
};

export const PLAYER_INTELLIGENCE_STORAGE_KEY = "axis-player-intelligence-v1";
export const LEGACY_PLAYER_INTELLIGENCE_STORAGE_KEY = "axis-player-intelligence-v0";

export const emptyIntake: IntakeState = {
  playerName: "",
  age: "",
  graduationYear: "",
  teamSchool: "",
  positionRole: "",
  parentGoal: "",
  playerGoal: "",
  coachConcern: "",
  currentStrength: "",
  currentStruggle: "",
  movementContext: "",
  mainReason: "",
};

export const emptyPermission: PermissionState = {
  recordingPermission: false,
  privateProofClipPermission: false,
  privateReportPermission: false,
  approvedRecipients: "",
  publicContentPermission: false,
  marketingPermission: false,
  namingRestrictions: "",
  schoolRestrictions: "",
  parentRestrictions: "",
};

export const emptyReport: ReportState & { reportSent: boolean } = {
  mainStrength: "",
  developmentPriority: "",
  developmentRead: "",
  proofClips: "",
  nextObjective: "",
  developmentPlanDirection: "",
  recommendedFollowUp: "",
  reportSent: false,
};

export const emptyOffer: OfferState & { followUpOffered: boolean; followUpSold: boolean } = {
  offerName: "",
  offerType: "",
  price: "",
  status: "",
  notes: "",
  followUpOffered: false,
  followUpSold: false,
};

export const emptyDebrief: DebriefState = {
  paidAmount: "",
  parentFeedback: "",
  whatCreatedTrust: "",
  whatConfused: "",
  bestProofClip: "",
  lesson: "",
  axisImprovement: "",
};

export function createProofMoment(category: string): ProofMoment {
  return {
    id: createId("proof"),
    time: "",
    category,
    whatHappened: "",
    whyItMatters: "",
    possibleNextObjective: "",
    followUpIdea: "",
  };
}

export function defaultProofMoments(): ProofMoment[] {
  return [
    createProofMoment("Strength proof"),
    createProofMoment("Development priority proof"),
    createProofMoment("Next objective proof"),
  ];
}

export function createEmptyStore(): PlayerIntelligenceStore {
  return {
    version: 1,
    sprintDone: {},
    activeSessionId: null,
    sessions: [],
  };
}

export function createPlayerIntelligenceSession(sessionNumber: number | null = null): PlayerIntelligenceSession {
  const now = new Date().toISOString();
  return {
    id: createId("pi"),
    sessionNumber,
    status: "open",
    createdAt: now,
    updatedAt: now,
    intake: { ...emptyIntake },
    permission: { ...emptyPermission },
    checklist: {},
    proofMoments: defaultProofMoments(),
    report: { ...emptyReport },
    offer: { ...emptyOffer },
    debrief: { ...emptyDebrief },
  };
}

export function loadPlayerIntelligenceStore(storage: Storage): PlayerIntelligenceStore {
  const v1 = parseStore(storage.getItem(PLAYER_INTELLIGENCE_STORAGE_KEY));
  if (v1) return v1;

  const legacy = storage.getItem(LEGACY_PLAYER_INTELLIGENCE_STORAGE_KEY);
  if (legacy) {
    const migrated = migrateLegacyStore(legacy);
    savePlayerIntelligenceStore(storage, migrated);
    return migrated;
  }

  return createEmptyStore();
}

export function savePlayerIntelligenceStore(storage: Storage, store: PlayerIntelligenceStore) {
  storage.setItem(PLAYER_INTELLIGENCE_STORAGE_KEY, JSON.stringify(store));
}

export function serializePlayerIntelligenceStore(store: PlayerIntelligenceStore) {
  return JSON.stringify(store, null, 2);
}

export function importPlayerIntelligenceStore(raw: string): PlayerIntelligenceStore {
  const parsed = JSON.parse(raw) as Partial<PlayerIntelligenceStore>;
  if (parsed.version !== 1 || !Array.isArray(parsed.sessions)) {
    throw new Error("This backup is not a Player Intelligence v1 export.");
  }
  return {
    version: 1,
    sprintDone: parsed.sprintDone ?? {},
    activeSessionId: parsed.activeSessionId ?? parsed.sessions[0]?.id ?? null,
    sessions: parsed.sessions.map(normalizeSession),
  };
}

export function getNextFirstTenSessionNumber(sessions: PlayerIntelligenceSession[]) {
  const used = new Set(sessions.map((session) => session.sessionNumber).filter((number): number is number => typeof number === "number"));
  for (let number = 1; number <= 10; number += 1) {
    if (!used.has(number)) return number;
  }
  return null;
}

export function getFirstTenSlots(sessions: PlayerIntelligenceSession[]): FirstTenSlot[] {
  return Array.from({ length: 10 }, (_, index) => {
    const number = index + 1;
    const session = sessions.find((item) => item.sessionNumber === number) ?? null;
    return { number, session, open: !session };
  });
}

export function calculateIntakeCompleteness(intake: IntakeState): Completion {
  return countFilled([
    intake.playerName,
    intake.age,
    intake.parentGoal,
    intake.playerGoal,
    intake.currentStrength,
    intake.currentStruggle,
    intake.mainReason,
  ]);
}

export function calculatePermissionCompleteness(permission: PermissionState): Completion {
  return countFilled([
    permission.recordingPermission,
    permission.privateProofClipPermission,
    permission.privateReportPermission,
    permission.approvedRecipients,
  ]);
}

export function calculateChecklistCompleteness(checklist: Record<string, boolean>, checklistItems: string[]): Completion {
  return countFilled(checklistItems.map((item) => checklist[item]));
}

export function calculateProofCompleteness(proofMoments: ProofMoment[]): Completion {
  const completeMoments = proofMoments.filter((moment) => moment.whatHappened.trim() && moment.whyItMatters.trim()).length;
  return makeCompletion(Math.min(completeMoments, 3), 3);
}

export function calculateReportCompleteness(report: ReportState & { reportSent: boolean }): Completion {
  return countFilled([
    report.mainStrength,
    report.developmentPriority,
    report.developmentRead,
    report.nextObjective,
    report.developmentPlanDirection,
    report.recommendedFollowUp,
  ]);
}

export function calculateOfferCompleteness(offer: OfferState & { followUpOffered: boolean; followUpSold: boolean }): Completion {
  return countFilled([offer.offerName, offer.offerType, offer.price, offer.status, offer.followUpOffered]);
}

export function calculateDebriefCompleteness(debrief: DebriefState): Completion {
  return countFilled([debrief.paidAmount, debrief.parentFeedback, debrief.whatCreatedTrust, debrief.bestProofClip, debrief.lesson, debrief.axisImprovement]);
}

export function calculateSessionCompleteness(session: PlayerIntelligenceSession, checklistItems: string[]): Completion {
  const completions = [
    calculateIntakeCompleteness(session.intake),
    calculatePermissionCompleteness(session.permission),
    calculateChecklistCompleteness(session.checklist, checklistItems),
    calculateProofCompleteness(session.proofMoments),
    calculateReportCompleteness(session.report),
    calculateOfferCompleteness(session.offer),
    calculateDebriefCompleteness(session.debrief),
  ];
  const done = completions.reduce((sum, item) => sum + item.done, 0);
  const total = completions.reduce((sum, item) => sum + item.total, 0);
  return makeCompletion(done, total);
}

export function formatPlayerIntelligenceReport(session: PlayerIntelligenceSession) {
  const proofMoments = session.proofMoments
    .filter((moment) => moment.whatHappened.trim() || moment.whyItMatters.trim())
    .map((moment, index) => {
      const time = moment.time.trim() ? ` (${moment.time.trim()})` : "";
      return `${index + 1}. ${moment.category}${time}\nWhat happened: ${orPending(moment.whatHappened)}\nWhy it matters: ${orPending(moment.whyItMatters)}\nNext correction: ${orPending(moment.possibleNextObjective)}`;
    })
    .join("\n\n");

  return [
    "Trophy Labs Player Intelligence Report",
    "",
    `Player: ${orPending(session.intake.playerName)}`,
    `Session: ${session.sessionNumber ? `First 10 #${session.sessionNumber}` : "Player Intelligence Session"}`,
    "",
    "Development Read",
    orPending(session.report.developmentRead),
    "",
    "Main Strength",
    orPending(session.report.mainStrength),
    "",
    "Development Priority",
    orPending(session.report.developmentPriority),
    "",
    "Proof Clips",
    proofMoments || orPending(session.report.proofClips),
    "",
    "Development Plan",
    orPending(session.report.developmentPlanDirection),
    "",
    "Next Objective",
    orPending(session.report.nextObjective),
    "",
    "Recommended Follow-Up",
    orPending(session.report.recommendedFollowUp),
    "",
    "Private note: minor-athlete information stays private unless parent permission says otherwise.",
  ].join("\n");
}

function migrateLegacyStore(raw: string): PlayerIntelligenceStore {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const legacySession = {
      id: createId("pi"),
      sessionNumber: 1,
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      intake: isRecord(parsed.intake) ? (parsed.intake as Partial<IntakeState>) : undefined,
      permission: isRecord(parsed.permission) ? (parsed.permission as Partial<PermissionState>) : undefined,
      checklist: isRecord(parsed.checklist) ? booleanRecord(parsed.checklist) : undefined,
      proofMoments: Array.isArray(parsed.proofMoments) ? (parsed.proofMoments as ProofMoment[]) : undefined,
      report: isRecord(parsed.report) ? (parsed.report as Partial<ReportState & { reportSent: boolean }>) : undefined,
      offer: isRecord(parsed.offer) ? (parsed.offer as Partial<OfferState & { followUpOffered: boolean; followUpSold: boolean }>) : undefined,
      debrief: emptyDebrief,
    } as unknown as Partial<PlayerIntelligenceSession>;
    const session = normalizeSession(legacySession);
    return {
      version: 1,
      sprintDone: isRecord(parsed.sprintDone) ? booleanRecord(parsed.sprintDone) : {},
      activeSessionId: session.id,
      sessions: [session],
    };
  } catch {
    return createEmptyStore();
  }
}

function parseStore(raw: string | null): PlayerIntelligenceStore | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PlayerIntelligenceStore>;
    if (parsed.version !== 1 || !Array.isArray(parsed.sessions)) return null;
    return {
      version: 1,
      sprintDone: parsed.sprintDone ?? {},
      activeSessionId: parsed.activeSessionId ?? parsed.sessions[0]?.id ?? null,
      sessions: parsed.sessions.map(normalizeSession),
    };
  } catch {
    return null;
  }
}

function normalizeSession(input: Partial<PlayerIntelligenceSession>): PlayerIntelligenceSession {
  const now = new Date().toISOString();
  return {
    id: input.id ?? createId("pi"),
    sessionNumber: typeof input.sessionNumber === "number" ? input.sessionNumber : null,
    status: input.status === "complete" ? "complete" : "open",
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    intake: { ...emptyIntake, ...input.intake },
    permission: { ...emptyPermission, ...input.permission },
    checklist: input.checklist ?? {},
    proofMoments: normalizeProofMoments(input.proofMoments),
    report: { ...emptyReport, ...input.report },
    offer: { ...emptyOffer, ...input.offer },
    debrief: { ...emptyDebrief, ...input.debrief },
  };
}

function normalizeProofMoments(moments: PlayerIntelligenceSession["proofMoments"] | undefined) {
  if (!moments?.length) return defaultProofMoments();
  return moments.map((moment, index) => ({
    id: moment.id ?? createId(`proof-${index}`),
    time: moment.time ?? "",
    category: moment.category ?? "Proof moment",
    whatHappened: moment.whatHappened ?? "",
    whyItMatters: moment.whyItMatters ?? "",
    possibleNextObjective: moment.possibleNextObjective ?? "",
    followUpIdea: moment.followUpIdea ?? "",
  }));
}

function countFilled(values: Array<string | boolean>): Completion {
  return makeCompletion(values.filter((value) => (typeof value === "boolean" ? value : value.trim().length > 0)).length, values.length);
}

function makeCompletion(done: number, total: number): Completion {
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

function orPending(value: string) {
  return value.trim() || "[draft]";
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function booleanRecord(record: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, Boolean(value)]));
}
