export const runtime = "nodejs";

type VoiceEventRequest = {
  audioBase64?: unknown;
  audioUrl?: unknown;
  athleteName?: unknown;
  cameraDirection?: unknown;
  cameraId?: unknown;
  filmId?: unknown;
  filmTimestampSeconds?: unknown;
  mimeType?: unknown;
  muxAssetId?: unknown;
  participantId?: unknown;
  sessionId?: unknown;
  sessionStartedAt?: unknown;
  timestamp?: unknown;
  workId?: unknown;
};

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function getNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getFilmTimestamp(timestamp: string, sessionStartedAt: string, fallback = 0) {
  const eventTime = new Date(timestamp).getTime();
  const startTime = new Date(sessionStartedAt).getTime();

  if (!Number.isFinite(eventTime) || !Number.isFinite(startTime)) return fallback;

  return Math.max(0, (eventTime - startTime) / 1000);
}

function getTranscript(response: unknown) {
  if (!response || typeof response !== "object") return "";

  const result = response as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{
          transcript?: string;
        }>;
      }>;
    };
  };

  return result.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
}

async function transcribeWithDeepgram(body: VoiceEventRequest) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return { error: "voice_unavailable" as const, status: 503 };

  const audioUrl = getString(body.audioUrl);
  const audioBase64 = getString(body.audioBase64);
  const endpoint = "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true";
  const headers: Record<string, string> = {
    Authorization: `Token ${apiKey}`,
  };
  let requestBody: BodyInit;

  if (audioUrl) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify({ url: audioUrl });
  } else if (audioBase64) {
    headers["Content-Type"] = getString(body.mimeType, "audio/webm");
    requestBody = Buffer.from(audioBase64, "base64");
  } else {
    return { error: "audio_required" as const, status: 400 };
  }

  const response = await fetch(endpoint, {
    body: requestBody,
    headers,
    method: "POST",
  });
  const raw = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Unable to create voice event", {
      status: response.status,
      type: "deepgram_request_failed",
    });

    return { error: "voice_event_failed" as const, status: 502 };
  }

  return {
    raw,
    status: 200,
    transcript: getTranscript(raw),
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as VoiceEventRequest | null;
  if (!body) return Response.json({ created: false }, { status: 400 });

  const workId = getString(body.workId);
  if (!workId) return Response.json({ created: false }, { status: 400 });

  try {
    const transcription = await transcribeWithDeepgram(body);

    if ("error" in transcription) {
      return Response.json({ created: false, reason: transcription.error }, { status: transcription.status });
    }

    if (!transcription.transcript) {
      return Response.json({ created: false, reason: "empty_voice_event" }, { status: 422 });
    }

    const timestamp = getString(body.timestamp, new Date().toISOString());
    const sessionId = getString(body.sessionId, workId);
    const sessionStartedAt = getString(body.sessionStartedAt, timestamp);
    const filmTimestampSeconds = getNumber(body.filmTimestampSeconds, getFilmTimestamp(timestamp, sessionStartedAt));
    const id = `voice:${workId}:${timestamp}`;
    const participantId = getString(body.participantId) || undefined;
    const athleteName = getString(body.athleteName) || undefined;
    const cameraDirection = getString(body.cameraDirection, "back");
    const cameraId = getString(body.cameraId, `axis-camera-${cameraDirection}`);
    const event = {
      filmId: getString(body.filmId) || undefined,
      filmTimeSeconds: filmTimestampSeconds,
      id,
      label: transcription.transcript,
      participantId,
      source: "voice",
      timestamp,
      type: "coach_voice",
      workId,
    };
    const replayAnchor = {
      athleteId: participantId,
      athleteName,
      cameraDirection,
      cameraId,
      eventId: id,
      eventType: "coach_voice",
      muxAssetId: getString(body.muxAssetId, "pending"),
      replayLabel: transcription.transcript,
      sessionId,
      timestamp,
      videoTimestamp: filmTimestampSeconds,
    };
    const filmMoment = {
      filmTimeSeconds: filmTimestampSeconds,
      id,
      label: transcription.transcript,
      type: "coach_voice",
    };

    return Response.json({ created: true, event, filmMoment, replayAnchor }, { status: 201 });
  } catch (error) {
    console.error("Unable to create voice event", error);

    return Response.json({ created: false, reason: "voice_event_failed" }, { status: 502 });
  }
}
