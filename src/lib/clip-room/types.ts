// ─── Status labels (user-facing) ─────────────────────────────────────────────

export type ClipEventStatus = "counted" | "suggested" | "check" | "skipped";
export type ClipPlayStatus = "pending" | "resolved";
export type ClipSourceStatus = "pending" | "uploading" | "uploaded" | "processing" | "ready" | "failed";
export type ClipOrigin = "recorded" | "uploaded";
export type ClipSubjectType = "player" | "team";
export type ClipSessionType = "game" | "practice" | "training";
export type ClipScoreboardVisible = "yes" | "no" | "not_sure";

// ─── Proof labels (user-facing, no model internals) ──────────────────────────

export type ClipProof =
  | "shot detected"
  | "scoreboard changed"
  | "possession changed"
  | "player unclear"
  | "clip blurry"
  | "make detected"
  | "miss detected"
  | "rebound detected"
  | "assist detected"
  | "turnover detected"
  | "foul detected"
  | "block detected"
  | "steal detected"
  | "audio cue"
  | "user marked";

// ─── Event types ──────────────────────────────────────────────────────────────

export type ClipEventType =
  | "shot_attempt"
  | "make"
  | "miss"
  | "rebound"
  | "assist"
  | "turnover"
  | "foul"
  | "block"
  | "steal"
  | "free_throw";

export type ClipShotZone = "paint" | "mid_range" | "three_point" | "free_throw";

// ─── Core records ─────────────────────────────────────────────────────────────

export type ClipSource = {
  id: string;
  ownerId: string;
  origin: ClipOrigin;
  status: ClipSourceStatus;
  cloudflareUid: string | null;
  uploadUrl: string | null;
  videoUrl: string | null;
  filename: string | null;
  fileSize: number | null;
  durationSeconds: number | null;
  processingStage: string | null;
  processingProgress: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClipSetup = {
  id: string;
  clipId: string;
  ownerId: string;
  subjectType: ClipSubjectType;
  subjectName: string | null;
  sessionType: ClipSessionType;
  jerseyColor: string | null;
  scoreboardVisible: ClipScoreboardVisible | null;
  createdAt: string;
};

export type ClipEvent = {
  id: string;
  clipId: string;
  ownerId: string;
  eventType: ClipEventType;
  status: ClipEventStatus;
  timestampSeconds: number | null;
  playerLabel: string | null;
  points: number;
  shotZone: ClipShotZone | null;
  proof: ClipProof | null;
  metadata: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ClipPlay = {
  id: string;
  clipId: string;
  eventId: string | null;
  ownerId: string;
  question: string;
  context: string | null;
  timestampSeconds: number | null;
  status: ClipPlayStatus;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClipPressPack = {
  id: string;
  clipId: string;
  ownerId: string;
  headline: string | null;
  summary: string | null;
  keyMoments: Array<{ timestampSeconds: number; description: string }>;
  statLines: ClipStatLines;
  generatedAt: string;
};

// ─── Stats ────────────────────────────────────────────────────────────────────

export type ClipStatLines = {
  pts: number;
  fgm: number;
  fga: number;
  fg_pct: number | null;
  tpm: number;
  tpa: number;
  tp_pct: number | null;
  ftm: number;
  fta: number;
  ft_pct: number | null;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  to: number;
  pf: number;
};

// ─── API request / response shapes ───────────────────────────────────────────

export type CreateClipSourceRequest = {
  origin: ClipOrigin;
  filename: string;
  fileSize: number;
};

export type CreateClipSourceResponse = {
  clipId: string;
  uploadUrl: string;
  cloudflareUid: string;
};

export type ConfirmClipUploadRequest = {
  cloudflareUid: string;
};

export type SaveClipSetupRequest = {
  subjectType: ClipSubjectType;
  subjectName: string | null;
  sessionType: ClipSessionType;
  jerseyColor: string | null;
  scoreboardVisible: ClipScoreboardVisible | null;
};

export type ResolveClipPlayRequest = {
  resolution: string;
};

// ─── Processing pipeline internal types ──────────────────────────────────────

export type ClipFrameAnalysis = {
  timestampSeconds: number;
  frameIndex: number;
  hasPlayer: boolean;
  hasBall: boolean;
  hasRim: boolean;
  hasScoreboard: boolean;
  events: Array<{
    type: ClipEventType;
    confidence: "high" | "medium" | "low";
    shotZone?: ClipShotZone;
    points?: number;
    description: string;
  }>;
  scoreboardReading?: {
    homeScore?: number;
    awayScore?: number;
    quarter?: number;
    timeRemaining?: string;
  };
};

export type ClipAudioAnalysis = {
  transcript: string;
  cues: Array<{
    timestampSeconds: number;
    cue: string;
    type: "whistle" | "buzzer" | "coach" | "crowd" | "other";
  }>;
};

export type ClipProcessingPayload = {
  clipId: string;
  ownerId: string;
  cloudflareUid: string;
  originalStorageUri?: string | null;
};

// ─── Source probe + clip result ───────────────────────────────────────────────

export type ClipSourceType = "raw_game" | "screen_recording" | "gallery_playback" | "unknown";
export type ClipSourceQuality = "good" | "fair" | "poor" | "unusable";
export type ClipResultOutcome = "pending" | "success" | "no_events" | "poor_quality" | "failed";

export type ClipResult = {
  id: string;
  clipId: string;
  ownerId: string;
  isPlayable: boolean;
  sourceType: ClipSourceType | null;
  courtVisible: boolean | null;
  hoopVisible: boolean | null;
  playersVisible: boolean | null;
  scoreboardVisible: boolean | null;
  actionWindowFound: boolean | null;
  sourceQuality: ClipSourceQuality | null;
  probeNotes: string | null;
  framesAnalyzed: number;
  scoreboardsRead: number;
  scoreChangesFound: number;
  eventsDetected: number;
  eventsCounted: number;
  outcome: ClipResultOutcome;
  outcomeReason: string | null;
  createdAt: string;
  updatedAt: string;
};
