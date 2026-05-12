"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type TeamSide = "HOME" | "AWAY";

type EventType =
  | "SCORE"
  | "TIMEOUT"
  | "TURNOVER";

interface SessionEvent {
  id: string;
  type: EventType;
  team: TeamSide;
  points?: number;

  timestamp: number;
  gameTime: number;

  scoreSnapshot: {
    home: number;
    away: number;
  };

  inferredState?: string;
}

function createEvent({
  type,
  team,
  points,
  timestamp,
  gameTime,
  homeScore,
  awayScore,
  inferredState,
}: {
  type: EventType;
  team: TeamSide;
  points?: number;
  timestamp: number;
  gameTime: number;
  homeScore: number;
  awayScore: number;
  inferredState?: string;
}): SessionEvent {
  return {
    id: crypto.randomUUID(),
    type,
    team,
    points,
    timestamp,
    gameTime,
    scoreSnapshot: {
      home: homeScore,
      away: awayScore,
    },
    inferredState,
  };
}

function formatClock(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(
    2,
    "0"
  )}`;
}

function getInferenceState(
  homeScore: number,
  awayScore: number
) {
  const diff = Math.abs(homeScore - awayScore);

  if (diff >= 15) return "CONTROL";
  if (diff >= 8) return "PRESSURE";
  if (diff >= 4) return "SHIFT";

  return "STABLE";
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();

  const sessionId = params.id as string;

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const chunksRef = useRef<Blob[]>([]);

  const [stream, setStream] = useState<MediaStream | null>(null);

  const [isRecording, setIsRecording] = useState(false);

  const [elapsed, setElapsed] = useState(0);

  const [homeScore, setHomeScore] = useState(0);

  const [awayScore, setAwayScore] = useState(0);

  const [events, setEvents] = useState<SessionEvent[]>([]);

  const [selectedEvent, setSelectedEvent] =
    useState<SessionEvent | null>(null);

  const inference = useMemo(() => {
    return getInferenceState(homeScore, awayScore);
  }, [homeScore, awayScore]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRecording) {
      interval = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    async function setupCamera() {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
          },
          audio: true,
        });

        setStream(media);

        if (videoRef.current) {
          videoRef.current.srcObject = media;
        }
      } catch (err) {
        console.error(err);
      }
    }

    setupCamera();

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startRecording() {
    if (!stream) return;

    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm",
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, {
        type: "video/webm",
      });

      const formData = new FormData();

      formData.append(
        "file",
        blob,
        `axis-session-${Date.now()}.webm`
      );

      formData.append("sessionId", sessionId);

      formData.append(
        "events",
        JSON.stringify(events)
      );

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        console.log("UPLOAD RESULT", data);

        router.push(`/replay/${sessionId}`);
      } catch (error) {
        console.error(error);
      }
    };

    mediaRecorderRef.current = recorder;

    recorder.start(1000);

    setIsRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();

    setIsRecording(false);
  }

  function addScore(
    side: TeamSide,
    points: number
  ) {
    const currentTime =
      videoRef.current?.currentTime || elapsed;

    let newHome = homeScore;
    let newAway = awayScore;

    if (side === "HOME") {
      newHome += points;
      setHomeScore(newHome);
    } else {
      newAway += points;
      setAwayScore(newAway);
    }

    const event = createEvent({
      type: "SCORE",
      team: side,
      points,
      timestamp: currentTime,
      gameTime: currentTime,
      homeScore: newHome,
      awayScore: newAway,
      inferredState: getInferenceState(
        newHome,
        newAway
      ),
    });

    setEvents((prev) => [...prev, event]);

    setSelectedEvent(event);
  }

  function registerTimeout(side: TeamSide) {
    const currentTime =
      videoRef.current?.currentTime || elapsed;

    const timeoutEvent = createEvent({
      type: "TIMEOUT",
      team: side,
      timestamp: currentTime,
      gameTime: currentTime,
      homeScore,
      awayScore,
      inferredState: inference,
    });

    setEvents((prev) => [...prev, timeoutEvent]);

    setSelectedEvent(timeoutEvent);
  }

  function registerTurnover(side: TeamSide) {
    const currentTime =
      videoRef.current?.currentTime || elapsed;

    const turnoverEvent = createEvent({
      type: "TURNOVER",
      team: side,
      timestamp: currentTime,
      gameTime: currentTime,
      homeScore,
      awayScore,
      inferredState: inference,
    });

    setEvents((prev) => [...prev, turnoverEvent]);

    setSelectedEvent(turnoverEvent);
  }

  function undoLastEvent() {
    const copy = [...events];

    const removed = copy.pop();

    if (!removed) return;

    if (
      removed.type === "SCORE" &&
      removed.points
    ) {
      if (removed.team === "HOME") {
        setHomeScore((prev) => prev - removed.points!);
      } else {
        setAwayScore((prev) => prev - removed.points!);
      }
    }

    setEvents(copy);

    setSelectedEvent(null);
  }

  function jumpToEvent(event: SessionEvent) {
    if (!videoRef.current) return;

    videoRef.current.currentTime =
      event.timestamp;

    setSelectedEvent(event);
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-7xl gap-4 p-4">
        <ScoreStack
          side="HOME"
          score={homeScore}
          onScore={(pts) =>
            addScore("HOME", pts)
          }
          onTimeout={() =>
            registerTimeout("HOME")
          }
          color="text-violet-400"
        />

        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-4xl tracking-[0.5em]">
                AXIS
              </div>

              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <div className="h-2 w-2 rounded-full bg-red-500" />

                LIVE

                <span>
                  {formatClock(elapsed)}
                </span>
              </div>
            </div>

            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              {inference}
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="aspect-video w-full object-cover"
            />
          </div>

          <div className="mt-4 rounded-[28px] border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Timeline
              </div>

              <div className="text-sm text-zinc-400">
                {events.length} events
              </div>
            </div>

            <Timeline
              events={events}
              onJump={jumpToEvent}
              selectedEvent={selectedEvent}
            />
          </div>
        </div>

        <ScoreStack
          side="AWAY"
          score={awayScore}
          onScore={(pts) =>
            addScore("AWAY", pts)
          }
          onTimeout={() =>
            registerTimeout("AWAY")
          }
          color="text-orange-400"
        >
          <div className="mt-4 space-y-3">
            <button
              onClick={() =>
                registerTurnover("HOME")
              }
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-4 text-sm font-semibold uppercase tracking-[0.2em]"
            >
              HOME TOV
            </button>

            <button
              onClick={() =>
                registerTurnover("AWAY")
              }
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-4 text-sm font-semibold uppercase tracking-[0.2em]"
            >
              AWAY TOV
            </button>

            <button
              onClick={undoLastEvent}
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-4 text-sm font-semibold uppercase tracking-[0.2em]"
            >
              UNDO
            </button>

            {!isRecording ? (
              <button
                onClick={startRecording}
                className="w-full rounded-2xl bg-red-600 py-4 text-sm font-semibold uppercase tracking-[0.2em]"
              >
                START
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="w-full rounded-2xl bg-white py-4 text-sm font-semibold uppercase tracking-[0.2em] text-black"
              >
                STOP + SAVE
              </button>
            )}
          </div>
        </ScoreStack>
      </div>
    </main>
  );
}

function ScoreStack({
  side,
  score,
  onScore,
  onTimeout,
  color,
  children,
}: {
  side: TeamSide;
  score: number;
  onScore: (pts: number) => void;
  onTimeout: () => void;
  color: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="w-[140px] shrink-0">
      <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-4">
        <div className="mb-3 text-center text-xs uppercase tracking-[0.3em] text-zinc-500">
          {side}
        </div>

        <div
          className={`mb-6 text-center text-6xl font-black ${color}`}
        >
          {score}
        </div>

        <div className="space-y-3">
          <TapButton
            label="+1"
            onClick={() => onScore(1)}
          />

          <TapButton
            label="+2"
            onClick={() => onScore(2)}
          />

          <TapButton
            label="+3"
            onClick={() => onScore(3)}
          />

          <TapButton
            label="TO"
            onClick={onTimeout}
          />
        </div>

        {children}
      </div>
    </div>
  );
}

function TapButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl border border-zinc-800 bg-black py-5 text-lg font-bold tracking-[0.15em] transition hover:border-zinc-600"
    >
      {label}
    </button>
  );
}

function Timeline({
  events,
  onJump,
  selectedEvent,
}: {
  events: SessionEvent[];
  onJump: (event: SessionEvent) => void;
  selectedEvent: SessionEvent | null;
}) {
  return (
    <div className="space-y-2">
      {events.length === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-600">
          No events yet
        </div>
      ) : (
        events.map((event) => (
          <button
            key={event.id}
            onClick={() => onJump(event)}
            className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
              selectedEvent?.id === event.id
                ? "border-white bg-zinc-900"
                : "border-zinc-800 bg-black hover:border-zinc-700"
            }`}
          >
            <div>
              <div className="mb-1 text-sm font-semibold uppercase tracking-[0.2em]">
                {event.type}
              </div>

              <div className="text-xs text-zinc-500">
                {event.team} ·{" "}
                {formatClock(event.gameTime)}
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-bold">
                {event.scoreSnapshot.home}-
                {event.scoreSnapshot.away}
              </div>

              <div className="text-xs text-zinc-500">
                {event.inferredState}
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  );
}