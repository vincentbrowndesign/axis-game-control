export type MidheavenSource = {
  id: string;
  raw: string;
  items: string[];
  createdAt: string;
};

export type MoneyLane = {
  id: string;
  label: string;
};

export type IncomeStream = {
  id: string;
  label: string;
};

export type FirstLoop = {
  id: string;
  title: string;
  description: string;
};

export type MoneyMap = {
  id: string;
  source: MidheavenSource;
  lanes: MoneyLane[];
  streams: IncomeStream[];
  firstLoop: FirstLoop;
  nextStep: string;
  createdAt: string;
};

export type MoneyMapRefinement =
  | "true"
  | "not_me"
  | "more"
  | "less"
  | "build_this";

export type MoneyMapShare = {
  id: string;
  moneyMapId: string;
  url: string;
  createdAt: string;
};

export type MidheavenEventType =
  | "midheaven_opened"
  | "source_added"
  | "money_map_generated"
  | "money_map_refined"
  | "first_loop_selected"
  | "money_map_shared"
  | "money_map_viewed";

export type MidheavenEvent = {
  id: string;
  type: MidheavenEventType;
  createdAt: string;
  payload?: Record<string, unknown>;
};
