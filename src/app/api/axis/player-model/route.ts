export const runtime = "nodejs";

import {
  createSupabaseFromRequest,
  type AxisBelief,
  type AxisEvent,
  type AxisThread,
} from "../../../../lib/axis-server";
import {
  buildAxisPlayerModel,
  type AxisPlayerBreakthroughLink,
  type AxisPlayerEvidenceLink,
  type AxisPlayerExperimentLink,
} from "../../../../lib/axis-player-model";

type EvidenceRow = {
  id: string;
  thread_id: string;
  observation: string;
  source: string;
  confidence: number;
  created_at: string;
};

type ExperimentRow = {
  id: string;
  thread_id: string;
  hypothesis: string;
  status: string;
  result: string | null;
  verdict: string | null;
  created_at: string;
};

type BreakthroughRow = {
  id: string;
  thread_id: string;
  description: string;
  created_at: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const requestedName = url.searchParams.get("player")?.trim();
  const sb = createSupabaseFromRequest(req);

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return Response.json({ error: "No player session" }, { status: 401 });
  }

  const { data: threadRows, error: threadError } = await sb
    .from("axis_threads")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (threadError) {
    return Response.json({ error: threadError.message }, { status: 500 });
  }

  const threads = (threadRows ?? []) as AxisThread[];
  const threadIds = threads.map((thread) => thread.id);

  if (threadIds.length === 0) {
    return Response.json({
      playerModel: buildAxisPlayerModel({
        playerId: user.id,
        playerName: requestedName || user.email || "Player",
        threads: [],
        events: [],
        beliefs: [],
        evidence: [],
        experiments: [],
        breakthroughs: [],
      }),
    });
  }

  const [
    { data: eventRows },
    { data: beliefRows },
    { data: evidenceRows },
    { data: experimentRows },
    { data: breakthroughRows },
  ] = await Promise.all([
    sb
      .from("axis_thread_events")
      .select("*")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: true }),
    sb
      .from("axis_thread_beliefs")
      .select("*")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: true }),
    sb
      .from("axis_thread_evidence")
      .select("id, thread_id, observation, source, confidence, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: true }),
    sb
      .from("axis_thread_experiments")
      .select("id, thread_id, hypothesis, status, result, verdict, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: true }),
    sb
      .from("axis_thread_breakthroughs")
      .select("id, thread_id, description, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: true }),
  ]);

  const playerModel = buildAxisPlayerModel({
    playerId: user.id,
    playerName: requestedName || user.email || "Player",
    threads,
    events: (eventRows ?? []) as AxisEvent[],
    beliefs: (beliefRows ?? []) as AxisBelief[],
    evidence: ((evidenceRows ?? []) as EvidenceRow[]).map(toEvidenceLink),
    experiments: ((experimentRows ?? []) as ExperimentRow[]).map(toExperimentLink),
    breakthroughs: ((breakthroughRows ?? []) as BreakthroughRow[]).map(toBreakthroughLink),
  });

  return Response.json({ playerModel });
}

function toEvidenceLink(row: EvidenceRow): AxisPlayerEvidenceLink {
  return {
    id: row.id,
    threadId: row.thread_id,
    observation: row.observation,
    source: row.source,
    confidence: Number(row.confidence),
    createdAt: row.created_at,
  };
}

function toExperimentLink(row: ExperimentRow): AxisPlayerExperimentLink {
  return {
    id: row.id,
    threadId: row.thread_id,
    hypothesis: row.hypothesis,
    status: row.status,
    result: row.result,
    verdict: row.verdict,
    createdAt: row.created_at,
  };
}

function toBreakthroughLink(row: BreakthroughRow): AxisPlayerBreakthroughLink {
  return {
    id: row.id,
    threadId: row.thread_id,
    description: row.description,
    createdAt: row.created_at,
  };
}
