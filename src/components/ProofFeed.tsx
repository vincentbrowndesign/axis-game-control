"use client";

import * as tus from "tus-js-client";
import { type TouchEvent, useEffect, useMemo, useRef, useState } from "react";

type ProofCard = {
  clip: string;
  duration: string;
  endTime?: number;
  id: string;
  poster: string;
  sessionId?: string;
  startTime?: number;
  stackId?: string;
  timestamp?: string;
  title: string;
  tone: "cut" | "glass" | "paint";
};

type ProofStack = {
  currentStreak: number;
  id: string;
  longestStreak: number;
  nextUnlock: string;
  proofCount: number;
  title: string;
};

type StoredReplayAnchor = {
  eventId?: unknown;
  eventType?: unknown;
  replayLabel?: unknown;
  timestamp?: unknown;
  videoTimestamp?: unknown;
};

type StoredShotEvent = {
  filmTimeSeconds?: unknown;
  shotId?: unknown;
  timestamp?: unknown;
  type?: unknown;
};

type StoredSession = {
  endedAt?: unknown;
  id?: unknown;
  muxPlaybackId?: unknown;
  replayAnchors?: unknown;
  shotEvents?: unknown;
  startedAt?: unknown;
  thumbnailUrl?: unknown;
};

type StoredProofSave = {
  sessions?: unknown;
};

type ProofData = {
  proofs: ProofCard[];
  stack: ProofStack;
};

type ProofImportSession = {
  id: string;
  muxAssetId?: string;
  muxPlaybackId?: string;
  originalVideoUrl: string;
  startedAt: string;
  status: "creating" | "review" | "saved";
  thumbnailUrl?: string;
  uploadId?: string;
};

type MomentCandidate = {
  duration: number;
  id: string;
  label: string;
  selected: boolean;
  thumbnail: string;
  timestamp: number;
};

type MomentAnalysisStatus = "idle" | "extracting" | "analyzing" | "done" | "failed";

const temporaryProofs: ProofCard[] = [
  {
    clip: "",
    duration: "0:12",
    id: "shot-after-miss",
    poster:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1600'%3E%3Crect width='1200' height='1600' fill='%23030303'/%3E%3Cpath d='M0 250h1200M0 510h1200M0 770h1200M0 1030h1200M0 1290h1200M220 0v1600M600 0v1600M980 0v1600' stroke='%23f4f4f0' stroke-opacity='.08' stroke-width='2'/%3E%3Ccircle cx='600' cy='800' r='250' fill='none' stroke='%23a8d933' stroke-opacity='.42' stroke-width='10'/%3E%3Ccircle cx='600' cy='800' r='82' fill='%23a8d933' fill-opacity='.16'/%3E%3C/svg%3E",
    stackId: "after-the-miss",
    title: "You took the shot after a miss.",
    tone: "paint",
  },
  {
    clip: "",
    duration: "0:09",
    id: "you-blocked-it",
    poster:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1600'%3E%3Crect width='1200' height='1600' fill='%23030303'/%3E%3Cpath d='M180 1300 980 160M320 1420 1120 280M40 1040 820 40' stroke='%23f4f4f0' stroke-opacity='.08' stroke-width='12'/%3E%3Crect x='420' y='560' width='360' height='520' rx='180' fill='none' stroke='%23a8d933' stroke-opacity='.38' stroke-width='10'/%3E%3C/svg%3E",
    stackId: "got-there-first",
    title: "You blocked it.",
    tone: "cut",
  },
  {
    clip: "",
    duration: "0:07",
    id: "pass-before-basket",
    poster:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1600'%3E%3Crect width='1200' height='1600' fill='%23030303'/%3E%3Ccircle cx='280' cy='720' r='140' fill='none' stroke='%23f4f4f0' stroke-opacity='.12' stroke-width='8'/%3E%3Ccircle cx='875' cy='920' r='210' fill='none' stroke='%23a8d933' stroke-opacity='.34' stroke-width='10'/%3E%3Cpath d='M285 720 C460 560 690 1110 875 920' fill='none' stroke='%23a8d933' stroke-opacity='.5' stroke-width='12'/%3E%3C/svg%3E",
    stackId: "pass-before-basket",
    title: "You made the pass before the basket.",
    tone: "glass",
  },
  {
    clip: "",
    duration: "0:10",
    id: "you-made-it",
    poster:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1600'%3E%3Crect width='1200' height='1600' fill='%23030303'/%3E%3Cpath d='M160 1180 C360 780 600 760 1010 410' fill='none' stroke='%23a8d933' stroke-opacity='.42' stroke-width='12'/%3E%3Ccircle cx='250' cy='1110' r='132' fill='none' stroke='%23f4f4f0' stroke-opacity='.12' stroke-width='8'/%3E%3Ccircle cx='980' cy='390' r='92' fill='%23a8d933' fill-opacity='.12'/%3E%3C/svg%3E",
    stackId: "after-the-miss",
    title: "You made it.",
    tone: "glass",
  },
  {
    clip: "",
    duration: "0:11",
    id: "there-first",
    poster:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1600'%3E%3Crect width='1200' height='1600' fill='%23030303'/%3E%3Cpath d='M260 240h680v1120H260z' fill='none' stroke='%23f4f4f0' stroke-opacity='.08' stroke-width='8'/%3E%3Cpath d='M250 1070h900' stroke='%23a8d933' stroke-opacity='.4' stroke-width='14'/%3E%3Ccircle cx='385' cy='1068' r='118' fill='none' stroke='%23a8d933' stroke-opacity='.38' stroke-width='10'/%3E%3C/svg%3E",
    stackId: "got-there-first",
    title: "You got there first.",
    tone: "paint",
  },
];

const proofStacks: ProofStack[] = [
  {
    currentStreak: 2,
    id: "after-the-miss",
    longestStreak: 5,
    nextUnlock: "Still Shooting",
    proofCount: 0,
    title: "AFTER THE MISS",
  },
  {
    currentStreak: 1,
    id: "got-back",
    longestStreak: 3,
    nextUnlock: "First Step Back",
    proofCount: 0,
    title: "GOT BACK",
  },
  {
    currentStreak: 1,
    id: "pass-before-basket",
    longestStreak: 4,
    nextUnlock: "Early Pass",
    proofCount: 0,
    title: "PASS BEFORE BASKET",
  },
  {
    currentStreak: 0,
    id: "called-for-the-ball",
    longestStreak: 2,
    nextUnlock: "Keep Calling",
    proofCount: 0,
    title: "CALLED FOR THE BALL",
  },
  {
    currentStreak: 1,
    id: "got-there-first",
    longestStreak: 5,
    nextUnlock: "First Again",
    proofCount: 0,
    title: "GOT THERE FIRST",
  },
];

const labelToProofTitle: Record<string, string> = {
  Assist: "You made the pass before the basket.",
  "Ball Recovered": "You got it back.",
  Block: "You blocked it.",
  "Loose Ball": "You got there first.",
  "Pass Before Basket": "You made the pass before the basket.",
  Rebound: "You got there first.",
  "Second Effort": "You took the shot after a miss.",
  "Shot After Miss": "You took the shot after a miss.",
  "Shot Made": "You made it.",
  Steal: "You took it.",
};

const manualProofTitles = [
  "You took the shot after a miss.",
  "You made the pass before the basket.",
  "You got there first.",
  "You blocked it.",
  "You took it.",
] as const;

const storageKey = "axis-ritual-save";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getMuxThumbnail(playbackId: string) {
  return playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg` : "";
}

function getMuxClip(playbackId: string) {
  return playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : "";
}

function getFallbackTone(index: number): ProofCard["tone"] {
  return index % 3 === 0 ? "paint" : index % 3 === 1 ? "cut" : "glass";
}

function getProofStackId(title: string) {
  const normalized = title.toLowerCase();

  if (normalized.includes("after a miss") || normalized.includes("made it")) return "after-the-miss";
  if (normalized.includes("got back") || normalized.includes("turnover")) return "got-back";
  if (normalized.includes("pass before")) return "pass-before-basket";
  if (normalized.includes("called for")) return "called-for-the-ball";
  if (normalized.includes("there first") || normalized.includes("blocked")) return "got-there-first";

  return "after-the-miss";
}

function getProofTitle(type: string, fallback: string) {
  const normalized = type.toLowerCase();

  if (normalized === "make") return "You made it.";
  if (normalized === "miss") return "";
  if (normalized === "rebound") return "You got there first.";
  if (normalized === "assist") return "You made the pass before the basket.";
  if (normalized === "turnover") return "";
  if (normalized === "foul") return "";
  if (normalized === "steal") return "You took it.";
  if (normalized === "block") return "You blocked it.";

  // Reject all-caps event labels from the recording pipeline (SESSION START, BALL RECOVERED, etc.)
  const cleanFallback = fallback.trim();
  if (cleanFallback && cleanFallback === cleanFallback.toUpperCase()) return "";

  return cleanFallback || "You were there.";
}

function formatDurationFromSeconds(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function normalizeDay(timestamp: string) {
  const date = new Date(timestamp);

  if (!Number.isFinite(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Chicago",
    year: "numeric",
  }).format(date);
}

function calculateStreaks(sessions: StoredSession[]) {
  const days = Array.from(
    new Set(
      sessions
        .map((session) => normalizeDay(getString(session.endedAt) || getString(session.startedAt)))
        .filter(Boolean),
    ),
  ).sort((a, b) => new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime());

  if (!days.length) {
    return {
      currentStreak: proofStacks[0].currentStreak,
      longestStreak: proofStacks[0].longestStreak,
    };
  }

  let longestStreak = 1;
  let runningStreak = 1;
  let currentStreak = 1;

  for (let index = 1; index < days.length; index += 1) {
    const previous = new Date(`${days[index - 1]}T00:00:00`);
    const current = new Date(`${days[index]}T00:00:00`);
    const dayDifference = Math.round((previous.getTime() - current.getTime()) / 86_400_000);

    if (dayDifference === 1) {
      runningStreak += 1;
      longestStreak = Math.max(longestStreak, runningStreak);
      if (index === currentStreak) currentStreak += 1;
    } else {
      runningStreak = 1;
    }
  }

  const today = normalizeDay(new Date().toISOString());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = normalizeDay(yesterdayDate.toISOString());

  return {
    currentStreak: days[0] === today || days[0] === yesterday ? currentStreak : 0,
    longestStreak,
  };
}

function buildProofStacks(proofs: ProofCard[]) {
  return proofStacks.map((stack) => {
    const proofCount = proofs.filter((proof) => (proof.stackId || getProofStackId(proof.title)) === stack.id).length;

    return {
      ...stack,
      currentStreak: proofCount ? stack.currentStreak : 0,
      longestStreak: proofCount ? Math.max(stack.longestStreak, stack.currentStreak) : 0,
      proofCount,
    };
  });
}

function readStoredSessions() {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return [];

    const parsed = JSON.parse(stored) as StoredProofSave;
    if (!Array.isArray(parsed.sessions)) return [];

    return parsed.sessions.filter(isRecord) as StoredSession[];
  } catch {
    return [];
  }
}

function createProofsFromStoredSessions(sessions: StoredSession[]) {
  return sessions
    .flatMap((session, sessionIndex) => {
      const sessionId = getString(session.id) || `session-${sessionIndex}`;
      const playbackId = getString(session.muxPlaybackId);
      const thumbnail = getString(session.thumbnailUrl) || getMuxThumbnail(playbackId);
      const clip = getMuxClip(playbackId);
      const replayAnchors = Array.isArray(session.replayAnchors) ? (session.replayAnchors.filter(isRecord) as StoredReplayAnchor[]) : [];
      const shotEvents = Array.isArray(session.shotEvents) ? (session.shotEvents.filter(isRecord) as StoredShotEvent[]) : [];

      const anchorProofs = replayAnchors.map<ProofCard>((anchor, anchorIndex) => {
        const type = getString(anchor.eventType);
        const title = getProofTitle(type, getString(anchor.replayLabel));
        const videoTimestamp = getNumber(anchor.videoTimestamp);
        // Use time-indexed Mux frame for this specific proof moment — never the session thumbnail
        const poster = playbackId && videoTimestamp
          ? `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${videoTimestamp}&width=640`
          : "";

        return {
          clip,
          duration: formatDurationFromSeconds(videoTimestamp || 8),
          id: getString(anchor.eventId) || `${sessionId}-anchor-${anchorIndex}`,
          poster,
          stackId: getProofStackId(title),
          timestamp: getString(anchor.timestamp),
          title,
          tone: getFallbackTone(anchorIndex),
        };
      });

      const shotProofs = shotEvents.map<ProofCard>((shot, shotIndex) => {
        const type = getString(shot.type);
        const filmTimeSeconds = getNumber(shot.filmTimeSeconds);
        const title = getProofTitle(type, "");
        const poster = playbackId && filmTimeSeconds
          ? `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${filmTimeSeconds}&width=640`
          : "";

        return {
          clip,
          duration: formatDurationFromSeconds(filmTimeSeconds || 8),
          id: getString(shot.shotId) || `${sessionId}-shot-${shotIndex}`,
          poster,
          stackId: getProofStackId(title),
          timestamp: getString(shot.timestamp),
          title,
          tone: getFallbackTone(anchorProofs.length + shotIndex),
        };
      });

      return [...anchorProofs, ...shotProofs];
    })
    .filter((proof) => proof.title)
    .slice(0, 12);
}

function getProofData(): ProofData {
  const sessions = readStoredSessions();
  const storedProofs = createProofsFromStoredSessions(sessions);
  const proofs = storedProofs.length ? storedProofs : temporaryProofs;
  const streaks = calculateStreaks(sessions);

  return {
    proofs,
    stack: {
      ...proofStacks[0],
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak,
      proofCount: proofs.length,
    },
  };
}

function getNextIndex(currentIndex: number, direction: 1 | -1, proofCount: number) {
  return (currentIndex + direction + proofCount) % proofCount;
}

function getAssetExtension(type: string, fallback: string) {
  if (type.includes("png")) return "png";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webm")) return "webm";
  if (type.includes("quicktime")) return "mov";
  if (type.includes("mp4")) return "mp4";

  return fallback;
}

function getSafeProofName(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return slug || "proof";
}

async function createFileFromUrl(url: string, filename: string) {
  const response = await fetch(url);
  if (!response.ok) return null;

  const blob = await response.blob();
  if (!blob.size) return null;

  const extension = getAssetExtension(blob.type, filename.split(".").pop() || "bin");
  const basename = filename.replace(/\.[^.]+$/, "");

  return new File([blob], `${basename}.${extension}`, {
    type: blob.type || "application/octet-stream",
  });
}

async function createProofShareFiles(proof: ProofCard) {
  const basename = getSafeProofName(proof.title);
  const files: File[] = [];

  // HLS streams (.m3u8) cannot be fetched or shared as standalone files
  const isHls = proof.clip.includes(".m3u8");
  if (proof.clip && !isHls) {
    const clipFile = await createFileFromUrl(proof.clip, `${basename}-clip.mp4`).catch(() => null);
    if (clipFile) files.push(clipFile);
  }

  // SVG data URIs are not accepted by navigator.share on most platforms
  const isSvg = proof.poster.startsWith("data:image/svg") || proof.poster.includes("%3Csvg");
  if (proof.poster && !isSvg) {
    const thumbnailFile = await createFileFromUrl(proof.poster, `${basename}-thumbnail.jpg`).catch(() => null);
    if (thumbnailFile) files.push(thumbnailFile);
  }

  return files;
}

async function shareProof(proof: ProofCard) {
  const files = await createProofShareFiles(proof);
  const text = proof.title;

  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      const fileShareData: ShareData = { files, text, title: proof.title };

      if (files.length && navigator.canShare?.(fileShareData)) {
        await navigator.share(fileShareData);
        return;
      }

      // HLS stream URLs are useless to recipients — share title only
      if (proof.clip && !proof.clip.includes(".m3u8")) {
        await navigator.share({ text, title: proof.title, url: proof.clip });
        return;
      }

      await navigator.share({ text, title: proof.title });
      return;

      if (files.length) {
        await navigator.share({ text, title: proof.title });
        return;
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(proof.clip ? `${proof.title}\n${proof.clip}` : proof.title);
    }
  } catch {
    // dismissed
  }
}

function uploadVideoWithTus(uploadUrl: string, file: File) {
  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: uploadUrl,
      metadata: {
        filetype: file.type || "video/mp4",
        filename: file.name || "proof-video.mp4",
      },
      onError: reject,
      onSuccess: () => resolve(),
    });

    upload.start();
  });
}

function waitForVideoSeek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    if (Math.abs(video.currentTime - time) < 0.05) {
      resolve();
      return;
    }

    const timeout = window.setTimeout(() => {
      video.removeEventListener("seeked", onSeeked);
      reject(new Error("Thumbnail seek timed out"));
    }, 1200);

    function onSeeked() {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", onSeeked);
      resolve();
    }

    video.addEventListener("seeked", onSeeked, { once: true });
    video.currentTime = time;
  });
}

function waitForVideoFrame(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
      resolve();
      return;
    }

    const timeout = window.setTimeout(() => {
      video.removeEventListener("loadeddata", onLoadedData);
      reject(new Error("Video frame unavailable"));
    }, 1200);

    function onLoadedData() {
      window.clearTimeout(timeout);
      video.removeEventListener("loadeddata", onLoadedData);
      resolve();
    }

    video.addEventListener("loadeddata", onLoadedData, { once: true });
  });
}

async function extractVideoFrames(
  sourceUrl: string,
  maxFrames = 15,
): Promise<Array<{ dataUrl: string; thumbnail: string; time: number }>> {
  if (typeof document === "undefined") return [];

  const video = document.createElement("video");
  video.src = sourceUrl;
  video.muted = true;
  video.preload = "auto";

  try {
    await new Promise<void>((resolve, reject) => {
      if (video.readyState >= 2) { resolve(); return; }
      const timeout = window.setTimeout(() => reject(new Error("metadata timeout")), 8000);
      video.addEventListener("loadeddata", () => { window.clearTimeout(timeout); resolve(); }, { once: true });
      video.addEventListener("error", () => { window.clearTimeout(timeout); reject(new Error("video error")); }, { once: true });
      video.load();
    });
  } catch {
    video.src = "";
    return [];
  }

  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) { video.src = ""; return []; }

  const count = Math.min(maxFrames, Math.max(1, Math.ceil(duration / 3)));
  const interval = duration / count;
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext("2d");
  if (!ctx) { video.src = ""; return []; }

  const frames: Array<{ dataUrl: string; thumbnail: string; time: number }> = [];

  for (let i = 0; i < count; i++) {
    const time = Math.min(i * interval + interval / 2, duration - 0.1);
    try {
      await waitForVideoSeek(video, time);
      ctx.drawImage(video, 0, 0, 320, 180);
      frames.push({
        dataUrl: canvas.toDataURL("image/jpeg", 0.7),
        thumbnail: canvas.toDataURL("image/jpeg", 0.85),
        time,
      });
    } catch {
      // skip frame
    }
  }

  video.src = "";
  return frames;
}

function findNearestThumbnail(
  frames: Array<{ thumbnail: string; time: number }>,
  timestamp: number,
): string {
  if (!frames.length) return "";
  let nearest = frames[0];
  let minDiff = Math.abs((frames[0].time) - timestamp);
  for (const frame of frames) {
    const diff = Math.abs(frame.time - timestamp);
    if (diff < minDiff) { minDiff = diff; nearest = frame; }
  }
  return nearest.thumbnail;
}

export function ProofFeed() {
  const [proofData, setProofData] = useState<ProofData>({
    proofs: temporaryProofs,
    stack: proofStacks[0],
  });
  const [manualProofs, setManualProofs] = useState<ProofCard[]>([]);
  const [manualVideoUrl, setManualVideoUrl] = useState("");
  const [manualDuration, setManualDuration] = useState(0);
  const [manualScrubTime, setManualScrubTime] = useState(0);
  const [manualStartTime, setManualStartTime] = useState<number | null>(null);
  const [manualEndTime, setManualEndTime] = useState<number | null>(null);
  const [manualTitle, setManualTitle] = useState<string>(manualProofTitles[0]);
  const [manualMessage, setManualMessage] = useState("");
  const [importSession, setImportSession] = useState<ProofImportSession | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [proofEnded, setProofEnded] = useState(false);
  const [momentCandidates, setMomentCandidates] = useState<MomentCandidate[]>([]);
  const [momentAnalysisStatus, setMomentAnalysisStatus] = useState<MomentAnalysisStatus>("idle");
  const [previewingCandidateId, setPreviewingCandidateId] = useState<string | null>(null);
  const [showManualControls, setShowManualControls] = useState(false);
  const manualVideoRef = useRef<HTMLVideoElement | null>(null);
  const proofVideoRef = useRef<HTMLVideoElement | null>(null);
  const manualVideoUrlsRef = useRef<string[]>([]);
  const touchStartX = useRef<number | null>(null);
  const visibleProofs = useMemo(() => [...manualProofs, ...proofData.proofs], [manualProofs, proofData.proofs]);
  const visibleStacks = useMemo(() => buildProofStacks(visibleProofs), [visibleProofs]);
  const activeProof = useMemo(() => (activeIndex === null ? null : visibleProofs[activeIndex]), [activeIndex, visibleProofs]);

  useEffect(() => {
    setProofData(getProofData());
  }, []);

  useEffect(() => {
    setProofEnded(Boolean(activeProof && !activeProof.clip));
  }, [activeProof]);

  useEffect(() => {
    return () => {
      manualVideoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (activeIndex !== null && activeIndex >= visibleProofs.length) setActiveIndex(null);
  }, [activeIndex, visibleProofs.length]);

  useEffect(() => {
    if (activeIndex === null) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") setActiveIndex((current) => (current === null ? current : getNextIndex(current, -1, visibleProofs.length)));
      if (event.key === "ArrowRight") setActiveIndex((current) => (current === null ? current : getNextIndex(current, 1, visibleProofs.length)));
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, visibleProofs.length]);

  function openProof(index: number) {
    setActiveIndex(index);
  }

  function closeProof() {
    setActiveIndex(null);
  }

  function goToProof(direction: 1 | -1) {
    setActiveIndex((current) => (current === null ? current : getNextIndex(current, direction, visibleProofs.length)));
  }

  function replayProof() {
    const video = proofVideoRef.current;
    if (!video || !activeProof) return;

    const startTime = typeof activeProof.startTime === "number" ? activeProof.startTime : 0;
    setProofEnded(false);
    video.currentTime = startTime;
    void video.play().catch(() => {
      setProofEnded(false);
    });
  }

  function importManualVideo(file: File | undefined) {
    if (!file) return;

    const nextUrl = URL.createObjectURL(file);
    const sessionId = `proof-session-${Date.now()}`;
    manualVideoUrlsRef.current.push(nextUrl);
    setManualVideoUrl(nextUrl);
    setManualDuration(0);
    setManualScrubTime(0);
    setManualStartTime(null);
    setManualEndTime(null);
    setManualMessage("");
    setMomentCandidates([]);
    setMomentAnalysisStatus("idle");
    setShowManualControls(false);
    setReviewMode(true);
    setImportSession({
      id: sessionId,
      originalVideoUrl: nextUrl,
      startedAt: new Date().toISOString(),
      status: "creating",
    });
    void uploadImportedVideo(file, sessionId);
  }

  async function uploadImportedVideo(file: File, sessionId: string) {
    try {
      const uploadResponse = await fetch("/api/film/uploads", {
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const upload = (await uploadResponse.json().catch(() => null)) as { uploadId?: string; uploadUrl?: string } | null;

      if (!uploadResponse.ok || !upload?.uploadId || !upload.uploadUrl) {
        setImportSession((current) => (current?.id === sessionId ? { ...current, status: "review" } : current));
        return;
      }

      setImportSession((current) => (current?.id === sessionId ? { ...current, status: "review", uploadId: upload.uploadId } : current));
      await uploadVideoWithTus(upload.uploadUrl, file);

      for (let attempt = 0; attempt < 12; attempt += 1) {
        const filmResponse = await fetch(`/api/film/uploads/${upload.uploadId}`);
        const film = (await filmResponse.json().catch(() => null)) as
          | {
              muxAssetId?: string;
              playbackId?: string;
              ready?: boolean;
              thumbnailUrl?: string;
            }
          | null;

        if (film?.playbackId) {
          setImportSession((current) =>
            current?.id === sessionId
              ? {
                  ...current,
                  muxAssetId: film.muxAssetId,
                  muxPlaybackId: film.playbackId,
                  status: film.ready ? "saved" : "review",
                  thumbnailUrl: film.thumbnailUrl,
                }
              : current,
          );
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } catch {
      setImportSession((current) => (current?.id === sessionId ? { ...current, status: "review" } : current));
    }
  }

  async function analyzeMoments(videoUrl: string, duration: number) {
    setMomentAnalysisStatus("extracting");
    setMomentCandidates([]);

    const frames = await extractVideoFrames(videoUrl).catch(() => []);
    if (!frames.length) { setMomentAnalysisStatus("failed"); return; }

    setMomentAnalysisStatus("analyzing");

    try {
      const response = await fetch("/api/moments/suggest", {
        body: JSON.stringify({ frames: frames.map((f) => ({ dataUrl: f.dataUrl, time: f.time })), videoDuration: duration }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) { setMomentAnalysisStatus("failed"); return; }

      const result = (await response.json()) as {
        suggestions?: Array<{ confidence: number; duration: number; label: string; timestamp: number }>;
      };

      const suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
      const candidates: MomentCandidate[] = suggestions
        .filter((s) => typeof s.timestamp === "number" && typeof s.label === "string")
        .map((s, i) => ({
          duration: Math.min(Math.max(4, s.duration || 6), 10),
          id: `candidate-${Date.now()}-${i}`,
          label: s.label,
          selected: true,
          thumbnail: findNearestThumbnail(frames, s.timestamp),
          timestamp: Math.max(0, Math.min(s.timestamp, duration - 1)),
        }));

      setMomentCandidates(candidates);
      setMomentAnalysisStatus("done");
    } catch {
      setMomentAnalysisStatus("failed");
    }
  }

  function toggleCandidate(id: string) {
    setMomentCandidates((current) => current.map((c) => c.id === id ? { ...c, selected: !c.selected } : c));
  }

  function previewCandidate(candidate: MomentCandidate) {
    const video = manualVideoRef.current;
    if (!video) return;

    setPreviewingCandidateId(candidate.id);
    const stopAt = candidate.timestamp + candidate.duration;
    video.currentTime = Math.max(0, candidate.timestamp - 0.2);

    function onTimeUpdate() {
      if (!video) return;
      if (video.currentTime >= stopAt) {
        video.pause();
        video.removeEventListener("timeupdate", onTimeUpdate);
        setPreviewingCandidateId(null);
      }
    }

    video.addEventListener("timeupdate", onTimeUpdate);
    void video.play().catch(() => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      setPreviewingCandidateId(null);
    });
  }

  async function saveSelectedCandidates() {
    const selected = momentCandidates.filter((c) => c.selected);
    if (!selected.length) return;

    const newProofs: ProofCard[] = selected.map((candidate, i) => {
      const endTime = candidate.timestamp + candidate.duration;
      const title = labelToProofTitle[candidate.label] ?? candidate.label;
      return {
        clip: manualVideoUrl,
        duration: formatDurationFromSeconds(candidate.duration),
        endTime,
        id: `proof-${Date.now()}-${i}`,
        poster: candidate.thumbnail,
        sessionId: importSession?.id,
        stackId: getProofStackId(title),
        startTime: candidate.timestamp,
        timestamp: new Date().toISOString(),
        title,
        tone: getFallbackTone(manualProofs.length + i),
      };
    });

    setManualProofs((current) => [...newProofs, ...current]);
    setMomentCandidates((current) => current.filter((c) => !c.selected));
    setManualMessage(`${newProofs.length} proof${newProofs.length !== 1 ? "s" : ""} saved.`);
  }

  function updateManualScrub(time: number) {
    const nextTime = Math.min(Math.max(0, time), manualDuration || 0);

    setManualScrubTime(nextTime);
    if (manualVideoRef.current) manualVideoRef.current.currentTime = nextTime;
  }

  function markManualStart() {
    setManualStartTime(manualScrubTime);
    if (manualEndTime !== null && manualEndTime <= manualScrubTime) setManualEndTime(null);
    setManualMessage("");
  }

  function markManualEnd() {
    if (manualStartTime === null) {
      setManualMessage("Mark start first.");
      return;
    }

    if (manualScrubTime <= manualStartTime) {
      setManualMessage("Mark end after start.");
      return;
    }

    setManualEndTime(manualScrubTime);
    setManualMessage("");
  }

  async function captureProofThumbnail(startTime: number, endTime: number) {
    const video = manualVideoRef.current;
    if (!video) return "";

    try {
      await waitForVideoFrame(video);
    } catch {
      return "";
    }

    if (!video.videoWidth || !video.videoHeight) return "";

    const originalTime = video.currentTime;
    const midpoint = startTime + (endTime - startTime) / 2;
    const captureTimes = [midpoint, startTime, 0];

    for (const captureTime of captureTimes) {
      try {
        const safeTime = Math.min(Math.max(0, captureTime), Math.max(0, (video.duration || captureTime) - 0.05));
        await waitForVideoSeek(video, safeTime);

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (!context) continue;

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL("image/jpeg", 0.82);
        video.currentTime = originalTime;
        return thumbnail;
      } catch {
        // Try the next available frame.
      }
    }

    video.currentTime = originalTime;
    return "";
  }

  async function saveManualProof() {
    if (!manualVideoUrl) {
      setManualMessage("Import video first.");
      return;
    }

    if (manualStartTime === null || manualEndTime === null || manualEndTime <= manualStartTime) {
      setManualMessage("Mark start and end.");
      return;
    }

    const fallbackProof = temporaryProofs[manualProofs.length % temporaryProofs.length];
    const thumbnailUrl = await captureProofThumbnail(manualStartTime, manualEndTime);
    const proof: ProofCard = {
      clip: manualVideoUrl,
      duration: formatDurationFromSeconds(manualEndTime - manualStartTime),
      endTime: manualEndTime,
      id: `manual-proof-${Date.now()}`,
      poster: thumbnailUrl || fallbackProof.poster,
      sessionId: importSession?.id,
      startTime: manualStartTime,
      timestamp: new Date().toISOString(),
      title: manualTitle,
      stackId: getProofStackId(manualTitle),
      tone: getFallbackTone(manualProofs.length),
    };

    setManualProofs((current) => [proof, ...current]);
    setManualMessage("Proof saved.");
  }

  function onTouchStart(event: TouchEvent<HTMLElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: TouchEvent<HTMLElement>) {
    if (touchStartX.current === null) return;

    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const deltaX = endX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < 44) return;
    goToProof(deltaX < 0 ? 1 : -1);
  }

  return (
    <main className="proof-shell">
      <header className="proof-header">
        <span>PROOF</span>
        <h1>TODAY&apos;S PROOF</h1>
      </header>

      <section className="proof-create" aria-label="Create proof">
        <div className="proof-create-head">
          <strong>Import. Mark. Save.</strong>
        </div>

        <label className="proof-import">
          <input
            accept="video/*"
            onChange={(event) => importManualVideo(event.currentTarget.files?.[0])}
            type="file"
          />
          <span>IMPORT VIDEO</span>
        </label>

        {manualVideoUrl && reviewMode ? (
          <div className="proof-create-workflow">
            <div className="proof-review-head">
              <strong>{importSession?.status === "saved" ? "VIDEO SAVED" : "MARK PROOF"}</strong>
            </div>
            <video
              className="proof-create-video"
              controls
              onLoadedMetadata={(event) => {
                const dur = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
                setManualDuration(dur);
                if (dur > 0) void analyzeMoments(event.currentTarget.src, dur);
              }}
              onTimeUpdate={(event) => setManualScrubTime(event.currentTarget.currentTime)}
              playsInline
              ref={manualVideoRef}
              src={manualVideoUrl}
            />

            {/* Moment queue — primary workflow after analysis */}
            {momentAnalysisStatus === "extracting" && (
              <p className="moment-status">READING VIDEO</p>
            )}
            {momentAnalysisStatus === "analyzing" && (
              <p className="moment-status">FINDING MOMENTS</p>
            )}
            {momentAnalysisStatus === "done" && momentCandidates.length > 0 && (
              <div className="moment-queue">
                <div className="moment-queue-header">
                  <span>{momentCandidates.length} MOMENT{momentCandidates.length !== 1 ? "S" : ""} FOUND</span>
                  <strong>{momentCandidates.filter((c) => c.selected).length} SELECTED</strong>
                </div>
                {momentCandidates.map((candidate) => (
                  <label className="moment-card" key={candidate.id}>
                    <input
                      checked={candidate.selected}
                      className="moment-check"
                      onChange={() => toggleCandidate(candidate.id)}
                      type="checkbox"
                    />
                    {candidate.thumbnail ? (
                      <img alt="" className="moment-thumb" src={candidate.thumbnail} />
                    ) : (
                      <div className="moment-thumb moment-thumb-empty" />
                    )}
                    <div className="moment-card-body">
                      <strong>{labelToProofTitle[candidate.label] ?? candidate.label}</strong>
                      <span>{formatDurationFromSeconds(candidate.timestamp)} · {candidate.duration}s</span>
                    </div>
                    <button
                      className="moment-preview-btn"
                      data-active={previewingCandidateId === candidate.id ? "true" : undefined}
                      onClick={(e) => { e.preventDefault(); previewCandidate(candidate); }}
                      type="button"
                    >
                      {previewingCandidateId === candidate.id ? "●" : "PREVIEW"}
                    </button>
                  </label>
                ))}
                <button
                  className="proof-save"
                  disabled={momentCandidates.filter((c) => c.selected).length === 0}
                  onClick={() => void saveSelectedCandidates()}
                  type="button"
                >
                  {(() => {
                    const n = momentCandidates.filter((c) => c.selected).length;
                    return n > 0 ? `SAVE ${n} PROOF${n !== 1 ? "S" : ""}` : "SELECT MOMENTS";
                  })()}
                </button>
              </div>
            )}
            {momentAnalysisStatus === "done" && momentCandidates.length === 0 && (
              <p className="moment-status">NO MOMENTS DETECTED</p>
            )}

            {/* Manual controls toggle */}
            {(momentAnalysisStatus === "done" || momentAnalysisStatus === "failed") && (
              <button
                className="moment-manual-toggle"
                onClick={() => setShowManualControls((v) => !v)}
                type="button"
              >
                {showManualControls ? "HIDE MANUAL" : "ADD MANUALLY"}
              </button>
            )}

            {/* Manual fallback controls */}
            {(showManualControls || momentAnalysisStatus === "failed") && (
              <>
                <label className="proof-scrub">
                  <span>SCRUB</span>
                  <input
                    max={manualDuration || 0}
                    min={0}
                    onChange={(event) => updateManualScrub(Number(event.currentTarget.value))}
                    step={0.1}
                    type="range"
                    value={manualScrubTime}
                  />
                </label>

                <div className="proof-mark-row">
                  <button onClick={markManualStart} type="button">MARK START</button>
                  <button onClick={markManualEnd} type="button">MARK END</button>
                </div>

                <div className="proof-time-row" aria-label="Proof range">
                  <span>NOW {formatDurationFromSeconds(manualScrubTime)}</span>
                  <span>START {manualStartTime === null ? "--" : formatDurationFromSeconds(manualStartTime)}</span>
                  <span>END {manualEndTime === null ? "--" : formatDurationFromSeconds(manualEndTime)}</span>
                </div>

                <div className="proof-title-list" aria-label="Choose proof title">
                  {manualProofTitles.map((title) => (
                    <button
                      data-selected={manualTitle === title}
                      key={title}
                      onClick={() => setManualTitle(title)}
                      type="button"
                    >
                      {title}
                    </button>
                  ))}
                </div>

                <button className="proof-save" onClick={saveManualProof} type="button">
                  SAVE PROOF
                </button>
              </>
            )}

            {manualMessage ? <em className="proof-create-message">{manualMessage}</em> : null}
          </div>
        ) : null}
      </section>

      <section className="proof-feed" aria-label="Today's proof">
        {visibleProofs.map((proof, index) => (
          <button className="proof-card" key={proof.id} onClick={() => openProof(index)} type="button">
            <span className="proof-thumb" data-tone={proof.tone}>
              {proof.poster ? <img alt="" src={proof.poster} /> : null}
              <span className="proof-play" aria-hidden="true">
                PLAY
              </span>
            </span>
            <span className="proof-card-body">
              <strong>{proof.title}</strong>
              <em>{proof.duration}</em>
            </span>
          </button>
        ))}
      </section>

      {visibleStacks.some((stack) => stack.proofCount > 0) ? (
        <section className="proof-stack-section" aria-label="Proof stack">
          {visibleStacks
            .filter((stack) => stack.proofCount > 0)
            .map((stack) => (
              <article className="proof-stack" key={stack.id}>
                <strong>{stack.title}</strong>
                <span>{stack.proofCount} {stack.proofCount === 1 ? "PROOF" : "PROOFS"}</span>
                <span>{stack.currentStreak} {stack.currentStreak === 1 ? "DAY" : "DAYS"} RUNNING · {stack.longestStreak} BEST</span>
                {stack.nextUnlock ? <em>NEXT: {stack.nextUnlock}</em> : null}
              </article>
            ))}
        </section>
      ) : null}

      {activeProof ? (
        <section
          aria-label="Proof player"
          className="proof-player"
          onTouchEnd={onTouchEnd}
          onTouchStart={onTouchStart}
        >
          <button aria-label="Close proof" className="proof-player-close" onClick={closeProof} type="button">
            BACK
          </button>

          <div className="proof-player-frame" data-tone={activeProof.tone}>
            <div className="proof-player-copy">
              <strong>{activeProof.title}</strong>
            </div>
            {activeProof.clip ? (
              <video
                autoPlay
                className="proof-player-video"
                muted
                onEnded={() => setProofEnded(true)}
                onLoadedMetadata={(event) => {
                  if (typeof activeProof.startTime === "number") event.currentTarget.currentTime = activeProof.startTime;
                }}
                onTimeUpdate={(event) => {
                  if (typeof activeProof.endTime === "number" && event.currentTarget.currentTime >= activeProof.endTime) {
                    event.currentTarget.pause();
                    event.currentTarget.currentTime = activeProof.endTime;
                    setProofEnded(true);
                  }
                }}
                playsInline
                poster={activeProof.poster}
                ref={proofVideoRef}
                src={activeProof.clip}
              />
            ) : (
              <div
                aria-label="Proof clip preview"
                className="proof-player-video proof-player-video-placeholder"
                data-tone={activeProof.tone}
                role="img"
              >
                {activeProof.poster ? <img alt="" src={activeProof.poster} /> : null}
              </div>
            )}
            {proofEnded ? (
              <>
                {activeProof.clip ? (
                  <button aria-label="Replay proof" className="proof-player-nav proof-player-replay" onClick={replayProof} type="button">
                    REPLAY
                  </button>
                ) : null}
                <button aria-label="Share proof" className="proof-player-nav proof-player-share" onClick={() => void shareProof(activeProof)} type="button">
                  SHARE
                </button>
                <button aria-label="Next proof" className="proof-player-nav proof-player-next" onClick={() => goToProof(1)} type="button">
                  NEXT
                </button>
              </>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
