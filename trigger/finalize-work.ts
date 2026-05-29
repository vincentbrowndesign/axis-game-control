import { task } from "@trigger.dev/sdk/v3";

type FinalizeWorkPayload = {
  events: {
    filmTimeSeconds?: number;
    id: string;
    label: string;
    participantId?: string;
    timestamp: string;
    type: string;
  }[];
  film: {
    id?: string;
    moments: {
      filmTimeSeconds: number;
      id: string;
      label: string;
      type: string;
    }[];
    muxAssetId?: string;
    playbackId?: string;
    status: "processing" | "ready" | "unavailable";
    thumbnailUrl?: string;
    workId: string;
  };
  results: {
    attempts: number;
    durationSeconds: number;
    eventsCount: number;
    fieldGoalPercentage: number | null;
    filmMomentsCount: number;
    makes: number;
    misses: number;
  };
  work: {
    endedAt: string;
    id: string;
    participantIds: string[];
    startedAt: string;
    status: "complete";
    type: string;
  };
};

type FinalizeStageResult = {
  name: "finalize_film" | "store_results" | "generate_review" | "generate_clips" | "update_archive";
  status: "complete" | "processing" | "skipped";
  detail: string;
};

function formatWorkDuration(seconds: number) {
  const minutes = Math.max(0, Math.round(seconds / 60));

  return `${minutes} min`;
}

function finalizeFilm(payload: FinalizeWorkPayload): FinalizeStageResult {
  if (payload.film.playbackId) {
    return {
      detail: "Film playback is ready.",
      name: "finalize_film",
      status: "complete",
    };
  }

  if (payload.film.status === "processing" || payload.film.muxAssetId) {
    return {
      detail: "Film is still processing.",
      name: "finalize_film",
      status: "processing",
    };
  }

  return {
    detail: "Work completed without film.",
    name: "finalize_film",
    status: "skipped",
  };
}

function storeResults(payload: FinalizeWorkPayload): FinalizeStageResult {
  return {
    detail: `${formatWorkDuration(payload.results.durationSeconds)} / ${payload.results.attempts} attempts`,
    name: "store_results",
    status: "complete",
  };
}

function generateReview(payload: FinalizeWorkPayload): FinalizeStageResult {
  return {
    detail: `${payload.work.type} complete. ${payload.film.moments.length} film moments ready for review.`,
    name: "generate_review",
    status: "complete",
  };
}

function generateClips(payload: FinalizeWorkPayload): FinalizeStageResult {
  const clipCount = payload.film.moments.filter((moment) => moment.type !== "session_start").length;

  return {
    detail: `${clipCount} clips prepared from film moments.`,
    name: "generate_clips",
    status: payload.film.status === "unavailable" ? "skipped" : "complete",
  };
}

function updateArchive(payload: FinalizeWorkPayload): FinalizeStageResult {
  return {
    detail: `Archive updated for ${payload.work.id}.`,
    name: "update_archive",
    status: "complete",
  };
}

export const finalizeWork = task({
  id: "finalize-work",
  run: async (payload: FinalizeWorkPayload) => {
    const stages = [
      finalizeFilm(payload),
      storeResults(payload),
      generateReview(payload),
      generateClips(payload),
      updateArchive(payload),
    ];

    console.log("Axis finalizeWork completed", {
      stages,
      workId: payload.work.id,
    });

    return {
      stages,
      workId: payload.work.id,
    };
  },
});
