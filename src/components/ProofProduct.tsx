"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type ProofSession = {
  createdAt: string;
  id: string;
  name: string;
  proofIds: string[];
  sourceThumbnailUrl: string;
  sourceVideoUrl: string;
};

type ProofMoment = {
  closeTime: number;
  createdAt: string;
  id: string;
  note: string;
  openTime: number;
  proofId?: string;
  sessionId: string;
  status: "saved";
  thumbnailUrl: string;
};

type SavedProof = {
  clipUrl: string;
  closeTime: number;
  createdAt: string;
  id: string;
  momentId: string;
  openTime: number;
  sessionId: string;
  stackId: string;
  thumbnailUrl: string;
  title: string;
};

type ProofStore = {
  moments: ProofMoment[];
  proofs: SavedProof[];
  sessions: ProofSession[];
};

type ProofProductProps =
  | { sessionId?: never; stackId?: never; proofId?: never; view: "home" | "new" | "stacks" }
  | { sessionId: string; stackId?: never; proofId?: never; view: "session" }
  | { proofId: string; sessionId?: never; stackId?: never; view: "proof" }
  | { stackId: string; proofId?: never; sessionId?: never; view: "stack" };

const proofStoreKey = "proof-session-moment-store-v1";

const emptyStore: ProofStore = {
  moments: [],
  proofs: [],
  sessions: [],
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(timestamp: string) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function getDefaultSessionName() {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function getStackId(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "proof";
}

function getStackTitle(stackId: string, proofs: SavedProof[]) {
  return proofs.find((proof) => proof.stackId === stackId)?.title.toUpperCase() ?? stackId.replaceAll("-", " ").toUpperCase();
}

function readStore(): ProofStore {
  if (typeof window === "undefined") return emptyStore;

  try {
    const raw = window.localStorage.getItem(proofStoreKey);
    if (!raw) return emptyStore;
    const parsed = JSON.parse(raw) as Partial<ProofStore>;

    return {
      moments: Array.isArray(parsed.moments) ? (parsed.moments as ProofMoment[]) : [],
      proofs: Array.isArray(parsed.proofs) ? (parsed.proofs as SavedProof[]) : [],
      sessions: Array.isArray(parsed.sessions) ? (parsed.sessions as ProofSession[]) : [],
    };
  } catch {
    return emptyStore;
  }
}

function writeStore(store: ProofStore) {
  window.localStorage.setItem(proofStoreKey, JSON.stringify(store));
}

function captureVideoFrame(video: HTMLVideoElement, time: number) {
  return new Promise<string>((resolve) => {
    const originalTime = video.currentTime;
    const captureTime = Math.min(Math.max(0, time), Math.max(0, (video.duration || time) - 0.05));

    const finish = () => {
      if (!video.videoWidth || !video.videoHeight) {
        resolve("");
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve("");
        return;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = canvas.toDataURL("image/jpeg", 0.82);
      video.currentTime = originalTime;
      resolve(frame);
    };

    if (Math.abs(video.currentTime - captureTime) < 0.05) {
      finish();
      return;
    }

    const timeout = window.setTimeout(() => {
      video.removeEventListener("seeked", onSeeked);
      resolve("");
    }, 1200);

    function onSeeked() {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", onSeeked);
      finish();
    }

    video.addEventListener("seeked", onSeeked, { once: true });
    video.currentTime = captureTime;
  });
}

async function shareProof(proof: SavedProof) {
  try {
    if (navigator.share && proof.clipUrl && !proof.clipUrl.startsWith("blob:")) {
      await navigator.share({ title: proof.title, text: proof.title, url: proof.clipUrl });
      return;
    }

    if (navigator.share) {
      await navigator.share({ title: proof.title, text: proof.title });
      return;
    }

    if (navigator.clipboard) await navigator.clipboard.writeText(proof.title);
  } catch {
    // Share sheets can be dismissed.
  }
}

export function ProofProduct(props: ProofProductProps) {
  const router = useRouter();
  const [store, setStore] = useState<ProofStore>(emptyStore);
  const [sessionName, setSessionName] = useState(getDefaultSessionName());
  const [sessionFileName, setSessionFileName] = useState("");
  const [openTime, setOpenTime] = useState<number | null>(null);
  const [closeTime, setCloseTime] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [proofEnded, setProofEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const proofVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setStore(readStore());
  }, []);

  function saveStore(nextStore: ProofStore) {
    writeStore(nextStore);
    setStore(nextStore);
  }

  const currentSession = props.view === "session" ? store.sessions.find((session) => session.id === props.sessionId) : undefined;
  const currentProof = props.view === "proof" ? store.proofs.find((proof) => proof.id === props.proofId) : undefined;
  const proofSession = currentProof ? store.sessions.find((session) => session.id === currentProof.sessionId) : undefined;

  const currentSessionProofs = useMemo(
    () => (currentSession ? store.proofs.filter((proof) => proof.sessionId === currentSession.id) : []),
    [currentSession, store.proofs],
  );

  const currentSessionMoments = useMemo(
    () => (currentSession ? store.moments.filter((moment) => moment.sessionId === currentSession.id) : []),
    [currentSession, store.moments],
  );

  const stackGroups = useMemo(() => {
    const groups = new Map<string, SavedProof[]>();
    store.proofs.forEach((proof) => {
      groups.set(proof.stackId, [...(groups.get(proof.stackId) ?? []), proof]);
    });
    return Array.from(groups.entries()).map(([id, proofs]) => ({ id, proofs }));
  }, [store.proofs]);

  const stackProofs = props.view === "stack" ? store.proofs.filter((proof) => proof.stackId === props.stackId) : [];

  async function createSession(file: File | undefined) {
    if (!file) return;

    const sourceVideoUrl = URL.createObjectURL(file);
    const id = createId("session");
    const now = new Date().toISOString();
    const session: ProofSession = {
      createdAt: now,
      id,
      name: sessionName.trim() || getDefaultSessionName(),
      proofIds: [],
      sourceThumbnailUrl: "",
      sourceVideoUrl,
    };

    saveStore({
      ...store,
      sessions: [session, ...store.sessions],
    });
    setSessionFileName(file.name);
    router.push(`/session/${id}`);
  }

  function markOpen() {
    const video = videoRef.current;
    if (!video) return;
    setOpenTime(video.currentTime);
    if (closeTime !== null && closeTime <= video.currentTime) setCloseTime(null);
  }

  function markClose() {
    const video = videoRef.current;
    if (!video || openTime === null || video.currentTime <= openTime) return;
    setCloseTime(video.currentTime);
  }

  async function saveProof() {
    const video = videoRef.current;
    if (!currentSession || !video || openTime === null || closeTime === null || closeTime <= openTime) return;

    const title = note.trim();
    if (!title) return;

    const momentId = createId("moment");
    const proofId = createId("proof");
    const stackId = getStackId(title);
    const thumbnailUrl = await captureVideoFrame(video, openTime);
    const now = new Date().toISOString();
    const moment: ProofMoment = {
      closeTime,
      createdAt: now,
      id: momentId,
      note: title,
      openTime,
      proofId,
      sessionId: currentSession.id,
      status: "saved",
      thumbnailUrl,
    };
    const proof: SavedProof = {
      clipUrl: currentSession.sourceVideoUrl,
      closeTime,
      createdAt: now,
      id: proofId,
      momentId,
      openTime,
      sessionId: currentSession.id,
      stackId,
      thumbnailUrl,
      title,
    };

    saveStore({
      moments: [moment, ...store.moments],
      proofs: [proof, ...store.proofs],
      sessions: store.sessions.map((session) =>
        session.id === currentSession.id
          ? {
              ...session,
              proofIds: [proof.id, ...session.proofIds],
              sourceThumbnailUrl: session.sourceThumbnailUrl || thumbnailUrl,
            }
          : session,
      ),
    });
    setOpenTime(null);
    setCloseTime(null);
    setNote("");
  }

  function replayProof() {
    const video = proofVideoRef.current;
    if (!video || !currentProof) return;
    setProofEnded(false);
    video.currentTime = currentProof.openTime;
    void video.play().catch(() => setProofEnded(false));
  }

  function nextProofId() {
    if (!currentProof) return "";
    const sessionProofs = store.proofs.filter((proof) => proof.sessionId === currentProof.sessionId);
    const index = sessionProofs.findIndex((proof) => proof.id === currentProof.id);
    return sessionProofs[(index + 1) % sessionProofs.length]?.id ?? currentProof.id;
  }

  if (props.view === "home") {
    return (
      <main className="proof-shell proof-home-shell">
        <header className="proof-header">
          <span>PROOF</span>
        </header>

        <Link className="proof-primary-link" href="/session/new">
          START SESSION
        </Link>

        <section className="proof-list-section" aria-label="Sessions">
          <h1>SESSIONS</h1>
          {store.sessions.length ? (
            <div className="proof-list">
              {store.sessions.map((session) => (
                <Link className="proof-row" href={`/session/${session.id}`} key={session.id}>
                  <strong>{session.name}</strong>
                  <span>{session.proofIds.length} {session.proofIds.length === 1 ? "Proof" : "Proofs"}</span>
                  <em>{formatDate(session.createdAt)}</em>
                </Link>
              ))}
            </div>
          ) : (
            <p className="proof-empty">Start a session.</p>
          )}
        </section>
      </main>
    );
  }

  if (props.view === "new") {
    return (
      <main className="proof-shell">
        <header className="proof-header">
          <Link className="proof-back-link" href="/">BACK</Link>
          <h1>START SESSION</h1>
        </header>

        <section className="proof-create" aria-label="Start session">
          <label className="proof-field">
            <span>SESSION NAME</span>
            <input onChange={(event) => setSessionName(event.currentTarget.value)} value={sessionName} />
          </label>
          <label className="proof-import">
            <input accept="video/*" onChange={(event: ChangeEvent<HTMLInputElement>) => void createSession(event.currentTarget.files?.[0])} type="file" />
            <span>IMPORT VIDEO</span>
          </label>
          {sessionFileName ? <em className="proof-create-message">{sessionFileName}</em> : null}
        </section>
      </main>
    );
  }

  if (props.view === "session") {
    if (!currentSession) {
      return (
        <main className="proof-shell">
          <header className="proof-header">
            <Link className="proof-back-link" href="/">BACK</Link>
            <h1>SESSION NOT FOUND</h1>
          </header>
        </main>
      );
    }

    return (
      <main className="proof-shell">
        <header className="proof-header">
          <Link className="proof-back-link" href="/">BACK</Link>
          <span>{formatDate(currentSession.createdAt)}</span>
          <h1>{currentSession.name}</h1>
        </header>

        <section className="proof-session-surface" aria-label="Session">
          <video className="proof-create-video" controls playsInline ref={videoRef} src={currentSession.sourceVideoUrl} />

          <section className="proof-create" aria-label="Create proof">
            <div className="proof-create-head">
              <strong>CREATE PROOF</strong>
            </div>
            <div className="proof-mark-row">
              <button onClick={markOpen} type="button">OPEN</button>
              <button onClick={markClose} type="button">CLOSE</button>
            </div>
            <div className="proof-time-row" aria-label="Proof range">
              <span>OPEN {openTime === null ? "--" : formatTime(openTime)}</span>
              <span>CLOSE {closeTime === null ? "--" : formatTime(closeTime)}</span>
            </div>
            <label className="proof-field">
              <span>NOTE</span>
              <input onChange={(event) => setNote(event.currentTarget.value)} placeholder="What happened?" value={note} />
            </label>
            <button className="proof-save" disabled={openTime === null || closeTime === null || !note.trim()} onClick={() => void saveProof()} type="button">
              SAVE PROOF
            </button>
          </section>
        </section>

        <section className="proof-list-section" aria-label="Moments">
          <h2>MOMENTS</h2>
          {currentSessionMoments.length ? (
            <div className="proof-list">
              {currentSessionMoments.map((moment) => (
                <article className="proof-row" key={moment.id}>
                  <strong>{moment.note}</strong>
                  <span>{formatTime(moment.openTime)} - {formatTime(moment.closeTime)}</span>
                  <em>SAVED</em>
                </article>
              ))}
            </div>
          ) : (
            <p className="proof-empty">Open and close a moment.</p>
          )}
        </section>

        <section className="proof-list-section" aria-label="Proofs">
          <h2>{currentSessionProofs.length} {currentSessionProofs.length === 1 ? "PROOF" : "PROOFS"}</h2>
          {currentSessionProofs.length ? (
            <div className="proof-feed">
              {currentSessionProofs.map((proof) => (
                <Link className="proof-card" href={`/proof/${proof.id}`} key={proof.id}>
                  <span className="proof-thumb">{proof.thumbnailUrl ? <img alt="" src={proof.thumbnailUrl} /> : null}<span className="proof-play">PLAY</span></span>
                  <span className="proof-card-body"><strong>{proof.title}</strong><em>{formatTime(proof.closeTime - proof.openTime)}</em></span>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  if (props.view === "proof") {
    if (!currentProof || !proofSession) {
      return (
        <main className="proof-shell">
          <header className="proof-header">
            <Link className="proof-back-link" href="/">BACK</Link>
            <h1>PROOF NOT FOUND</h1>
          </header>
        </main>
      );
    }

    return (
      <main className="proof-player proof-player-page">
        <Link className="proof-player-close" href={`/session/${currentProof.sessionId}`}>BACK</Link>
        <div className="proof-player-frame">
          <div className="proof-player-copy">
            <strong>{currentProof.title}</strong>
          </div>
          <video
            autoPlay
            className="proof-player-video"
            onEnded={() => setProofEnded(true)}
            onLoadedMetadata={(event) => {
              event.currentTarget.currentTime = currentProof.openTime;
            }}
            onTimeUpdate={(event) => {
              if (event.currentTarget.currentTime >= currentProof.closeTime) {
                event.currentTarget.pause();
                event.currentTarget.currentTime = currentProof.closeTime;
                setProofEnded(true);
              }
            }}
            playsInline
            poster={currentProof.thumbnailUrl}
            ref={proofVideoRef}
            src={currentProof.clipUrl}
          />
          {proofEnded ? (
            <div className="proof-player-nav-row">
              <button className="proof-player-nav" onClick={replayProof} type="button">REPLAY</button>
              <button className="proof-player-nav" onClick={() => void shareProof(currentProof)} type="button">SHARE</button>
              <Link className="proof-player-nav" href={`/proof/${nextProofId()}`}>NEXT</Link>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  if (props.view === "stacks") {
    return (
      <main className="proof-shell">
        <header className="proof-header">
          <Link className="proof-back-link" href="/">BACK</Link>
          <h1>STACKS</h1>
        </header>
        <section className="proof-stack-section" aria-label="Stacks">
          {stackGroups.length ? stackGroups.map((stack) => (
            <Link className="proof-stack" href={`/stack/${stack.id}`} key={stack.id}>
              <strong>{getStackTitle(stack.id, stack.proofs)}</strong>
              <span>{stack.proofs.length} {stack.proofs.length === 1 ? "Proof" : "Proofs"}</span>
            </Link>
          )) : <p className="proof-empty">Save a proof first.</p>}
        </section>
      </main>
    );
  }

  const activeStackId = props.stackId ?? "";

  return (
    <main className="proof-shell">
      <header className="proof-header">
        <Link className="proof-back-link" href="/stacks">BACK</Link>
        <h1>{getStackTitle(activeStackId, store.proofs)}</h1>
      </header>
      <section className="proof-list-section" aria-label="Stack proofs">
        <h2>{stackProofs.length} {stackProofs.length === 1 ? "PROOF" : "PROOFS"}</h2>
        <div className="proof-feed">
          {stackProofs.map((proof) => (
            <Link className="proof-card" href={`/proof/${proof.id}`} key={proof.id}>
              <span className="proof-thumb">{proof.thumbnailUrl ? <img alt="" src={proof.thumbnailUrl} /> : null}<span className="proof-play">PLAY</span></span>
              <span className="proof-card-body"><strong>{proof.title}</strong><em>{formatTime(proof.closeTime - proof.openTime)}</em></span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
