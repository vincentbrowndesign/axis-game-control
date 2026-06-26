"use client";

import { useRef, useState } from "react";

type WatchStatus = "queued" | "sampling" | "watching" | "ready" | "failed";

type WatchCandidate = {
  id: string;
  note: string;
  timestampSeconds: number;
  title: string;
  status: "pending" | "accepted" | "rejected";
};

type WatchJob = {
  acceptedCount: number;
  candidates: WatchCandidate[];
  clipName: string;
  createdAt: string;
  error?: string;
  id: string;
  query: string;
  sampledFrameCount: number;
  status: WatchStatus;
};

const quickQueries = [
  "Watch for spacing breakdowns in Delta offense.",
  "Find rushed decisions.",
  "Find poor transition spacing.",
  "Watch weak-side movement.",
  "Find coachable moments.",
];

export function AxisWatchRoot() {
  const [clipFile, setClipFile] = useState<File | null>(null);
  const [clipUrl, setClipUrl] = useState("");
  const [query, setQuery] = useState("Watch for spacing breakdowns in Delta offense.");
  const [jobs, setJobs] = useState<WatchJob[]>([]);
  const [recordingState, setRecordingState] = useState<"idle" | "preview" | "recording">("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  function setUploadedClip(file: File | null) {
    if (!file) return;
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    const nextUrl = URL.createObjectURL(file);
    setClipFile(file);
    setClipUrl(nextUrl);
  }

  async function startRecordingPreview() {
    if (!navigator.mediaDevices?.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "environment" } });
    streamRef.current = stream;
    setRecordingState("preview");
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = stream;
      await videoPreviewRef.current.play();
    }
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") return;
    recordingChunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordingChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "video/webm" });
      const file = new File([blob], `axis-recorded-clip-${Date.now()}.webm`, { type: blob.type });
      setUploadedClip(file);
      stopRecordingPreview();
    };
    recorder.start();
    setRecordingState("recording");
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  function stopRecordingPreview() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
    setRecordingState("idle");
  }

  async function watchWithAxis() {
    if (!clipUrl || !query.trim()) return;
    const jobId = `watch-${Date.now()}`;
    const baseJob: WatchJob = {
      acceptedCount: 0,
      candidates: [],
      clipName: clipFile?.name || "Recorded clip",
      createdAt: new Date().toISOString(),
      id: jobId,
      query: query.trim(),
      sampledFrameCount: 0,
      status: "queued",
    };
    setJobs((currentJobs) => [baseJob, ...currentJobs]);

    try {
      updateJob(jobId, { status: "sampling" });
      const frames = await sampleVideoFrames(clipUrl, 60);
      updateJob(jobId, { sampledFrameCount: frames.length, status: "watching" });
      const response = await fetch("/api/axis/watch", {
        body: JSON.stringify({ frames, query: query.trim() }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { candidates?: Array<Omit<WatchCandidate, "status">>; error?: string };
      if (!response.ok || !payload.candidates) {
        updateJob(jobId, { error: payload.error || "Axis could not watch this clip.", status: "failed" });
        return;
      }
      updateJob(jobId, {
        candidates: payload.candidates.map((candidate) => ({ ...candidate, status: "pending" })),
        status: "ready",
      });
    } catch {
      updateJob(jobId, { error: "Axis could not sample or watch this clip.", status: "failed" });
    }
  }

  function updateJob(jobId: string, patch: Partial<WatchJob>) {
    setJobs((currentJobs) => currentJobs.map((job) => (job.id === jobId ? { ...job, ...patch } : job)));
  }

  function updateCandidate(jobId: string, candidateId: string, patch: Partial<WatchCandidate>) {
    setJobs((currentJobs) =>
      currentJobs.map((job) => {
        if (job.id !== jobId) return job;
        const candidates = job.candidates.map((candidate) => (candidate.id === candidateId ? { ...candidate, ...patch } : candidate));
        return {
          ...job,
          acceptedCount: candidates.filter((candidate) => candidate.status === "accepted").length,
          candidates,
        };
      }),
    );
  }

  const latestReadyJob = jobs.find((job) => job.status === "ready");
  const acceptedCandidates = latestReadyJob?.candidates.filter((candidate) => candidate.status === "accepted") ?? [];

  return (
    <main className="axis-watch" aria-labelledby="axis-watch-title">
      <section className="axis-watch__shell">
        <header className="axis-watch__header">
          <p>AXIS</p>
          <h1 id="axis-watch-title">AXIS</h1>
          <span>Upload a clip. Tell Axis what to watch. Review the moments.</span>
        </header>

        <section className="axis-watch__card" aria-label="Clip input">
          <div className="axis-watch__section-title">
            <h2>Clip</h2>
            <span>Upload or record locally.</span>
          </div>
          <label className="axis-watch__file">
            <span>Upload clip</span>
            <input accept="video/*" onChange={(event) => setUploadedClip(event.target.files?.[0] ?? null)} type="file" />
          </label>
          <div className="axis-watch__record">
            {recordingState === "idle" && <button onClick={() => void startRecordingPreview()} type="button">Record Clip</button>}
            {recordingState === "preview" && <button onClick={startRecording} type="button">Start Recording</button>}
            {recordingState === "recording" && <button onClick={stopRecording} type="button">Stop Recording</button>}
            {recordingState !== "idle" && <button onClick={stopRecordingPreview} type="button">Cancel</button>}
          </div>
          <video className="axis-watch__video" controls muted playsInline ref={videoPreviewRef} src={clipUrl || undefined} />
        </section>

        <section className="axis-watch__card axis-watch__query" aria-label="Axis Query Bar">
          <label>
            <span>Axis Query Bar</span>
            <textarea onChange={(event) => setQuery(event.target.value)} rows={3} value={query} />
          </label>
          <div className="axis-watch__chips" aria-label="Quick watch queries">
            {quickQueries.map((chip) => (
              <button key={chip} onClick={() => setQuery(chip)} type="button">{chip}</button>
            ))}
          </div>
          <button className="axis-watch__primary" disabled={!clipUrl || !query.trim()} onClick={() => void watchWithAxis()} type="button">
            Watch with Axis
          </button>
        </section>

        <section className="axis-watch__card" aria-labelledby="axis-watch-queue-title">
          <div className="axis-watch__section-title">
            <h2 id="axis-watch-queue-title">Watch Queue</h2>
            <span>{jobs.length === 0 ? "No clips queued yet." : `${jobs.length} local job${jobs.length === 1 ? "" : "s"}`}</span>
          </div>
          <div className="axis-watch__queue">
            {jobs.map((job) => (
              <article className="axis-watch__job" key={job.id}>
                <div>
                  <strong>{job.clipName}</strong>
                  <span>{job.status}</span>
                </div>
                <p>{job.query}</p>
                <small>{job.sampledFrameCount > 0 ? `${job.sampledFrameCount} sampled frames` : "Waiting for frames"}</small>
                {job.error && <em>{job.error}</em>}
                {job.status === "ready" && (
                  <CandidateReview candidates={job.candidates} jobId={job.id} onUpdateCandidate={updateCandidate} />
                )}
              </article>
            ))}
          </div>
        </section>

        {latestReadyJob && (
          <section className="axis-watch__card" aria-label="Clip follow up">
            <label>
              <span>Ask about this clip...</span>
              <input placeholder="Ask about this clip..." type="text" />
            </label>
          </section>
        )}

        <section className="axis-watch__card" aria-labelledby="axis-report-preview-title">
          <div className="axis-watch__section-title">
            <h2 id="axis-report-preview-title">Report Preview</h2>
            <span>Accepted candidates only.</span>
          </div>
          {acceptedCandidates.length === 0 ? (
            <p>No accepted moments yet.</p>
          ) : (
            <ul className="axis-watch__report-list">
              {acceptedCandidates.map((candidate) => (
                <li key={candidate.id}>
                  <strong>{candidate.title}</strong>
                  <span>{formatTimestamp(candidate.timestampSeconds)} - {candidate.note}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

function CandidateReview({
  candidates,
  jobId,
  onUpdateCandidate,
}: {
  candidates: WatchCandidate[];
  jobId: string;
  onUpdateCandidate: (jobId: string, candidateId: string, patch: Partial<WatchCandidate>) => void;
}) {
  return (
    <div className="axis-watch__candidates">
      {candidates.map((candidate) => (
        <article key={candidate.id}>
          <span>{formatTimestamp(candidate.timestampSeconds)}</span>
          <input
            aria-label="Candidate title"
            onChange={(event) => onUpdateCandidate(jobId, candidate.id, { title: event.target.value })}
            value={candidate.title}
          />
          <textarea
            aria-label="Candidate note"
            onChange={(event) => onUpdateCandidate(jobId, candidate.id, { note: event.target.value })}
            rows={2}
            value={candidate.note}
          />
          <div>
            <button onClick={() => onUpdateCandidate(jobId, candidate.id, { status: "accepted" })} type="button">Accept</button>
            <button onClick={() => onUpdateCandidate(jobId, candidate.id, { status: "rejected" })} type="button">Reject</button>
            <button onClick={() => onUpdateCandidate(jobId, candidate.id, { status: "pending" })} type="button">Edit</button>
          </div>
        </article>
      ))}
    </div>
  );
}

async function sampleVideoFrames(videoUrl: string, maxFrames: number) {
  const video = document.createElement("video");
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  await waitForVideoMetadata(video);

  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
  const sampleCount = Math.min(maxFrames, Math.max(1, Math.ceil(duration)));
  const canvas = document.createElement("canvas");
  const width = Math.min(480, video.videoWidth || 480);
  const height = Math.max(1, Math.round(width / ((video.videoWidth || 16) / (video.videoHeight || 9))));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return [];

  const frames: Array<{ imageDataUrl: string; timestampSeconds: number }> = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const timestampSeconds = Math.min(duration, (duration * index) / sampleCount);
    video.currentTime = timestampSeconds;
    await waitForSeek(video);
    context.drawImage(video, 0, 0, width, height);
    frames.push({ imageDataUrl: canvas.toDataURL("image/jpeg", 0.62), timestampSeconds });
  }
  return frames;
}

function waitForVideoMetadata(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Clip could not load."));
  });
}

function waitForSeek(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
  });
}

function formatTimestamp(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

const styles = `
  .axis-watch {
    background: #f7f4eb;
    color: #141610;
    min-height: 100dvh;
    overflow-x: hidden;
    padding: max(0.9rem, env(safe-area-inset-top)) 0.9rem max(6rem, env(safe-area-inset-bottom));
  }

  .axis-watch,
  .axis-watch * {
    box-sizing: border-box;
  }

  .axis-watch__shell {
    display: grid;
    gap: 0.85rem;
    margin: 0 auto;
    max-width: 48rem;
  }

  .axis-watch__header {
    display: grid;
    gap: 0.3rem;
  }

  .axis-watch__header p,
  .axis-watch label span,
  .axis-watch__section-title span,
  .axis-watch__job span,
  .axis-watch__candidates span {
    color: rgba(20, 22, 16, 0.58);
    font-size: 0.72rem;
    font-weight: 850;
    letter-spacing: 0.08em;
    margin: 0;
    text-transform: uppercase;
  }

  .axis-watch h1,
  .axis-watch h2,
  .axis-watch p {
    margin: 0;
  }

  .axis-watch h1 {
    font-size: clamp(3.4rem, 18vw, 7rem);
    font-weight: 950;
    letter-spacing: 0;
    line-height: 0.85;
  }

  .axis-watch h2 {
    font-size: 1.2rem;
    letter-spacing: 0;
  }

  .axis-watch__header span,
  .axis-watch__job p,
  .axis-watch__job small,
  .axis-watch__card > p {
    color: rgba(20, 22, 16, 0.68);
  }

  .axis-watch__card,
  .axis-watch__job,
  .axis-watch__candidates article {
    background: #fffdf7;
    border: 1px solid rgba(20, 22, 16, 0.12);
    border-radius: 0.55rem;
    display: grid;
    gap: 0.7rem;
    padding: 0.85rem;
  }

  .axis-watch__section-title,
  .axis-watch__job > div:first-child {
    align-items: center;
    display: flex;
    gap: 0.65rem;
    justify-content: space-between;
  }

  .axis-watch label {
    display: grid;
    gap: 0.35rem;
  }

  .axis-watch input,
  .axis-watch textarea {
    background: #fffdf7;
    border: 1px solid rgba(20, 22, 16, 0.16);
    border-radius: 0.5rem;
    color: #141610;
    font: inherit;
    min-height: 3rem;
    padding: 0.75rem;
    width: 100%;
  }

  .axis-watch__file input {
    background: #f7f4eb;
  }

  .axis-watch__video {
    aspect-ratio: 16 / 9;
    background: #141610;
    border-radius: 0.5rem;
    width: 100%;
  }

  .axis-watch button {
    border-radius: 0.5rem;
    font: inherit;
    font-weight: 850;
    min-height: 2.85rem;
    padding: 0 0.8rem;
  }

  .axis-watch__primary {
    background: #141610;
    border: 1px solid #141610;
    color: #f7f4eb;
    width: 100%;
  }

  .axis-watch__primary:disabled {
    opacity: 0.45;
  }

  .axis-watch__record,
  .axis-watch__chips,
  .axis-watch__candidates article div {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .axis-watch__record button,
  .axis-watch__chips button,
  .axis-watch__candidates button {
    background: rgba(20, 22, 16, 0.06);
    border: 1px solid rgba(20, 22, 16, 0.14);
    color: #141610;
  }

  .axis-watch__queue,
  .axis-watch__candidates,
  .axis-watch__report-list {
    display: grid;
    gap: 0.6rem;
  }

  .axis-watch__job em {
    background: #fff0d9;
    border: 1px solid #f1c078;
    border-radius: 0.45rem;
    color: #5d3a00;
    font-style: normal;
    padding: 0.6rem;
  }

  .axis-watch__report-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .axis-watch__report-list li {
    display: grid;
    gap: 0.15rem;
  }

  @media (min-width: 760px) {
    .axis-watch {
      padding: 1.5rem;
    }

    .axis-watch__query {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`;
