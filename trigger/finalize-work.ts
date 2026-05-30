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
  exportQueue?: {
    label: string;
    sourceCount: number;
    status: "available" | "processing" | "waiting";
    type: string;
  }[];
  film: {
    clips?: {
      clipEnd: number;
      clipKind?: string;
      clipStart: number;
      eventId: string;
      id: string;
      leadInSeconds: number;
      leadOutSeconds: number;
      playlistOrder: number;
      sourceLabel?: string;
      type: string;
    }[];
    id?: string;
    moments: {
      filmTimeSeconds: number;
      id: string;
      label: string;
      type: string;
    }[];
    muxAssetId?: string;
    overlays?: {
      filmTimeSeconds: number;
      id: string;
      label: string;
      type: string;
    }[];
    playbackId?: string;
    playlist?: {
      clipEnd: number;
      clipKind?: string;
      clipStart: number;
      eventId: string;
      id: string;
      label: string;
      order: number;
    }[];
    status: "processing" | "ready" | "unavailable";
    timeline?: {
      filmTimeSeconds: number;
      id: string;
      label: string;
      type: string;
    }[];
    thumbnailUrl?: string;
    workId: string;
  };
  overlayProfile?: Record<string, boolean>;
  pipeline?: {
    capability: string;
    outputs: string[];
    provider: string;
    sourceCount: number;
    status: "available" | "processing" | "waiting";
  }[];
  playerReport?: {
    attendance: number;
    averageReleaseAngle: number | null;
    averageReleaseSpeed: number | null;
    averageReleaseTime: number | null;
    fieldGoalPercentage: number;
    makes: number;
    misses: number;
    outputs: {
      label: string;
      sourceCount: number;
      status: "available" | "processing" | "waiting";
      type: string;
    }[];
    playerId?: string;
    playerName: string;
    progressGraph: {
      attempts: number;
      fieldGoalPercentage: number;
      makes: number;
      timestamp: string;
    }[];
    releaseMetrics: {
      arcHeightFeet: number;
      attemptNumber: number;
      entryAngle: number;
      releaseAngle: number;
      releaseSpeed: number;
      releaseTime: number;
    }[];
    sessionHours: number;
    shotLocations: {
      attemptNumber: number;
      distance: number;
      x: number;
      y: number;
    }[];
    timeline: {
      label: string;
      timestamp: string;
      videoTimestamp: number;
    }[];
    totalAttempts: number;
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
  shots?: {
    attemptNumber: number;
    apexFrame: number;
    arcHeight: number;
    athleteId?: string;
    athleteName: string;
    distance: number;
    apexPoint?: {
      x: number;
      y: number;
    };
    entryPoint?: {
      x: number;
      y: number;
    };
    entryAngle: number;
    flightTime: number;
    filmTimeSeconds: number;
    makeStreak: number;
    releaseFrame: number;
    releaseAngle: number;
    releasePoint?: {
      x: number;
      y: number;
    };
    releaseSpeed: number;
    releaseTime: number;
    resultFrame: number;
    rimFrame: number;
    shotArcFeet: number;
    shotDistance: number;
    shotEndTimestamp: string;
    shotId: string;
    shotStartTimestamp: string;
    startFrame: number;
    timestamp: string;
    trajectorySpline: {
      x: number;
      y: number;
    }[];
    type: string;
  }[];
  work: {
    endedAt: string;
    id: string;
    participantIds: string[];
    rimLock?: {
      cameraDirection: string;
      center: {
        x: number;
        y: number;
      };
      createdAt: string;
      height: number;
      id: string;
      polygon: {
        x: number;
        y: number;
      }[];
      sessionId: string;
      width: number;
    };
    startedAt: string;
    status: "complete";
    type: string;
  };
};

type FinalizeStageResult = {
  name:
    | "detect_objects"
    | "export_outputs"
    | "finalize_film"
    | "generate_results"
    | "generate_player_report"
    | "generate_clips"
    | "interpret_work"
    | "create_review"
    | "persist_session_object"
    | "update_archive"
    | "send_notifications";
  status: "complete" | "processing" | "queued" | "skipped";
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

function getPipelineStage(payload: FinalizeWorkPayload, provider: string) {
  return payload.pipeline?.find((stage) => stage.provider === provider);
}

function persistSessionObject(payload: FinalizeWorkPayload): FinalizeStageResult {
  const supabaseStage = getPipelineStage(payload, "supabase");

  return {
    detail: supabaseStage
      ? `${supabaseStage.outputs.join(", ")} stored from one work object.`
      : `Session object ready for ${payload.work.id}.`,
    name: "persist_session_object",
    status: supabaseStage?.status === "waiting" ? "queued" : "complete",
  };
}

function detectObjects(payload: FinalizeWorkPayload): FinalizeStageResult {
  const detectionStages = (payload.pipeline ?? []).filter((stage) => stage.provider === "roboflow" || stage.provider === "rf_detr");
  const sourceCount = detectionStages.reduce((total, stage) => total + stage.sourceCount, 0);

  return {
    detail: detectionStages.length
      ? detectionStages.map((stage) => `${stage.provider}: ${stage.capability}`).join(" / ")
      : "Detection waiting for film.",
    name: "detect_objects",
    status: sourceCount > 0 ? "processing" : "queued",
  };
}

function interpretWork(payload: FinalizeWorkPayload): FinalizeStageResult {
  const openAiStage = getPipelineStage(payload, "openai");

  return {
    detail: openAiStage
      ? `${openAiStage.outputs.join(", ")} queued from recorded facts.`
      : "Interpretation waiting for events.",
    name: "interpret_work",
    status: payload.events.length || payload.shots?.length ? "processing" : "skipped",
  };
}

function exportOutputs(payload: FinalizeWorkPayload): FinalizeStageResult {
  const muxStage = getPipelineStage(payload, "mux");
  const exportCount = payload.exportQueue?.length ?? 0;

  return {
    detail: `${exportCount} outputs queued through ${muxStage?.provider ?? "mux"} export factory.`,
    name: "export_outputs",
    status: payload.film.status === "unavailable" ? "queued" : "processing",
  };
}

function generateResults(payload: FinalizeWorkPayload): FinalizeStageResult {
  return {
    detail: `${formatWorkDuration(payload.results.durationSeconds)} / ${payload.results.attempts} attempts`,
    name: "generate_results",
    status: "complete",
  };
}

function generatePlayerReport(payload: FinalizeWorkPayload): FinalizeStageResult {
  const report = payload.playerReport;

  if (!report) {
    return {
      detail: "Player report waiting for session facts.",
      name: "generate_player_report",
      status: "skipped",
    };
  }

  return {
    detail: `${report.playerName} / ${report.totalAttempts} attempts / ${report.outputs.length} outputs.`,
    name: "generate_player_report",
    status: report.totalAttempts > 0 ? "complete" : "processing",
  };
}

function createReview(payload: FinalizeWorkPayload): FinalizeStageResult {
  return {
    detail: `${payload.work.type} complete. ${payload.film.moments.length} film moments ready for review.`,
    name: "create_review",
    status: "complete",
  };
}

function generateClips(payload: FinalizeWorkPayload): FinalizeStageResult {
  const clipCount =
    payload.film.playlist?.length ?? payload.film.clips?.length ?? payload.film.moments.filter((moment) => moment.type !== "session_start").length;

  return {
    detail: `${clipCount} clips prepared for export playlist.`,
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

function sendNotifications(payload: FinalizeWorkPayload): FinalizeStageResult {
  return {
    detail: `Notifications queued for ${payload.work.id}.`,
    name: "send_notifications",
    status: "queued",
  };
}

export const finalizeWork = task({
  id: "finalize-work",
  run: async (payload: FinalizeWorkPayload) => {
    const stages = [
      persistSessionObject(payload),
      finalizeFilm(payload),
      detectObjects(payload),
      generateResults(payload),
      interpretWork(payload),
      generatePlayerReport(payload),
      generateClips(payload),
      createReview(payload),
      exportOutputs(payload),
      updateArchive(payload),
      sendNotifications(payload),
    ];

    console.log("Axis finalizeWork completed", {
      pipeline: payload.pipeline ?? [],
      stages,
      exports: payload.exportQueue ?? [],
      overlayProfile: payload.overlayProfile ?? {},
      playerReport: payload.playerReport,
      shots: payload.shots ?? [],
      workId: payload.work.id,
    });

    return {
      exports: payload.exportQueue ?? [],
      overlayProfile: payload.overlayProfile ?? {},
      playerReport: payload.playerReport,
      pipeline: payload.pipeline ?? [],
      shots: payload.shots ?? [],
      stages,
      workId: payload.work.id,
    };
  },
});
