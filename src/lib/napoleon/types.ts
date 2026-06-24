export type NapoleonEventType =
  | "napoleon_opened"
  | "query_started"
  | "query_submitted"
  | "find_money_started"
  | "build_loop_started"
  | "observation_submitted"
  | "money_node_detected"
  | "agent_result_generated"
  | "cash_loop_created"
  | "offer_created"
  | "proof_attached"
  | "leak_detected"
  | "axis_genesis_viewed"
  | "connection_viewed";

export type NapoleonEvent = {
  id: string;
  type: NapoleonEventType;
  createdAt: string;
  payload?: Record<string, unknown>;
};

export type NapoleonQuery = {
  id: string;
  input: string;
  createdAt: string;
  status: "draft" | "submitted" | "answered";
};

export type NapoleonAgentVoice = {
  id: "visionary" | "numbers" | "words";
  label: "Visionary" | "Numbers" | "Words";
  headline: string;
  points: string[];
};

export type NapoleonAgentResult = {
  id: string;
  query: NapoleonQuery;
  createdAt: string;
  voices: NapoleonAgentVoice[];
  suggestedLoop: {
    title: string;
    targetCustomer: string;
    offer: string;
    nextAction: string;
    proofStatus: string;
  };
};

export type NapoleonCashLoop = {
  id: string;
  title: string;
  status: "idea" | "building" | "live" | "proven" | "leaking";
  targetCustomer: string;
  offer: string;
  nextAction: string;
  proofStatus: string;
  createdAt: string;
  sourceQueryId?: string;
};

export type NapoleonProofType =
  | "Historical proof"
  | "Awaiting cash wire"
  | "Payment received"
  | "Subscription started"
  | "Cash leak detected"
  | "Cash protected";

export type NapoleonProof = {
  id: string;
  type: NapoleonProofType;
  text: string;
  createdAt: string;
  loopId?: string;
};

export type NapoleonConnection = {
  id: string;
  name: string;
  status: "ready" | "planned" | "needs connection" | "broken wire";
  proves: string;
  events: string[];
  actions: string[];
  connectedCashLoop: string;
  lastSync: string;
};

export type NapoleonNode = {
  id: string;
  title: string;
  subtitle: string;
  proof: string;
  cta: string;
};

export type NapoleonNextMove = {
  id: string;
  title: string;
  reason: string;
};
