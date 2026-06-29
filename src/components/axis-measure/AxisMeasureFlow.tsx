"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

import {
  axisSessionTypes,
  clearCurrentAxisRep,
  createAxisRep,
  getAxisMeasureStatus,
  getAxisRead,
  readCurrentAxisRep,
  type AxisRep,
  type AxisSessionType,
  writeCurrentAxisRep,
} from "../../lib/axis-measure";

type AxisMeasureStep = "home" | "session" | "capture" | "replay" | "result";

export function AxisMeasureFlow({ step }: { step: AxisMeasureStep }) {
  const router = useRouter();
  const [playerName, setPlayerName] = useState("");
  const [sessionType, setSessionType] = useState<AxisSessionType>("shooting");
  const [rep, setRep] = useState<AxisRep | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const current = readCurrentAxisRep();
      setRep(current);
      if (current) {
        setPlayerName(current.playerName);
        setSessionType(current.sessionType);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const ready = playerName.trim().length > 1;
  const status = useMemo(() => getAxisMeasureStatus(rep, ready), [ready, rep]);

  function persist(nextRep: AxisRep) {
    setRep(nextRep);
    writeCurrentAxisRep(nextRep);
  }

  function startSession() {
    if (!ready) {
      setError("Add a player name to start.");
      return;
    }
    const nextRep = createAxisRep({ playerName, sessionType });
    persist(nextRep);
    setError("");
    router.push("/capture");
  }

  function handleClipUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size <= 0) {
      setError("This video did not load. Download it to your device, then choose it again.");
      return;
    }
    if (!file.type.startsWith("video/") && !/\.(mov|mp4)$/i.test(file.name)) {
      setError("Choose a video file.");
      return;
    }

    const current = rep ?? createAxisRep({ playerName: playerName || "Player", sessionType });
    const nextRep: AxisRep = {
      ...current,
      clipUrl: URL.createObjectURL(file),
      status: "uploaded",
    };
    persist(nextRep);
    setError("");
    router.push("/replay");
  }

  function generateRead() {
    if (!rep || !rep.clipUrl) {
      setError("Upload a clip first.");
      return;
    }

    const readingRep: AxisRep = { ...rep, status: "reading" };
    persist(readingRep);
    const reviewedRep: AxisRep = {
      ...readingRep,
      status: "reviewed",
      read: getAxisRead(readingRep.sessionType),
      source: "mock",
    };
    persist(reviewedRep);
    setError("");
    router.push("/result");
  }

  function saveRep() {
    if (!rep) return;
    persist({ ...rep, status: "saved" });
  }

  function nextRep() {
    clearCurrentAxisRep();
    setRep(null);
    setPlayerName("");
    setSessionType("shooting");
    router.push("/session/new");
  }

  return (
    <main className="axis-measure">
      <section className="axis-measure__shell">
        <header className="axis-measure__top">
          <Link href="/" aria-label="OnTheAxis home">
            OnTheAxis
          </Link>
          <span>{status}</span>
        </header>

        {step === "home" ? (
          <section className="axis-measure__hero" aria-labelledby="axis-measure-home-title">
            <p>OnTheAxis</p>
            <h1 id="axis-measure-home-title">Axis Measure</h1>
            <strong>Capture. Read. Replay. Improve.</strong>
            <p>Movement intelligence for players, coaches, and training environments.</p>
            <p>AxisMeasure is the first instrument.</p>
            <Link className="axis-measure__primary" href="/session/new">
              Start Measuring
            </Link>
          </section>
        ) : null}

        {step === "session" ? (
          <section className="axis-measure__panel" aria-labelledby="axis-measure-session-title">
            <StepLabel label="Player" />
            <h1 id="axis-measure-session-title">Start a rep.</h1>
            <label className="axis-measure__field">
              <span>Player</span>
              <input
                autoComplete="name"
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="Player name"
                value={playerName}
              />
            </label>
            <div className="axis-measure__choice-group" aria-label="Session Type">
              <StepLabel label="Session Type" />
              <div>
                {axisSessionTypes.map((type) => (
                  <button
                    className={sessionType === type.value ? "is-selected" : ""}
                    key={type.value}
                    onClick={() => setSessionType(type.value)}
                    type="button"
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
            {error ? <p className="axis-measure__error">{error}</p> : null}
            <button className="axis-measure__primary" onClick={startSession} type="button">
              Start Session
            </button>
          </section>
        ) : null}

        {step === "capture" ? (
          <section className="axis-measure__panel" aria-labelledby="axis-measure-capture-title">
            <StepLabel label="Capture" />
            <h1 id="axis-measure-capture-title">Upload one clip.</h1>
            <p>Upload one clip. Get one read. Save the rep. Run the next one.</p>
            <label className="axis-measure__upload">
              <span>Choose Clip</span>
              <input accept="video/*,.mov,.mp4" onChange={handleClipUpload} type="file" />
            </label>
            {error ? <p className="axis-measure__error">{error}</p> : null}
            {rep?.clipUrl ? (
              <Link className="axis-measure__secondary" href="/replay">
                Review Replay
              </Link>
            ) : null}
          </section>
        ) : null}

        {step === "replay" ? (
          <section className="axis-measure__panel" aria-labelledby="axis-measure-replay-title">
            <StepLabel label="Replay" />
            <h1 id="axis-measure-replay-title">Review the clip.</h1>
            {rep?.clipUrl ? <video controls playsInline src={rep.clipUrl} /> : <EmptyState href="/capture" label="Upload Clip" />}
            {error ? <p className="axis-measure__error">{error}</p> : null}
            <button className="axis-measure__primary" disabled={!rep?.clipUrl} onClick={generateRead} type="button">
              Generate Axis Read
            </button>
          </section>
        ) : null}

        {step === "result" ? (
          <section className="axis-measure__panel" aria-labelledby="axis-measure-result-title">
            <StepLabel label="Axis Read" />
            <h1 id="axis-measure-result-title">Result.</h1>
            {rep?.read.summary ? (
              <div className="axis-measure__read">
                <p>{rep.read.summary}</p>
                <div aria-label="Tags">
                  {rep.read.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <StepLabel label="Next Action" />
                <strong>{rep.read.nextAction}</strong>
              </div>
            ) : (
              <EmptyState href="/replay" label="Generate Read" />
            )}
            {rep?.status === "saved" ? <p className="axis-measure__saved">NEXT REP</p> : null}
            <div className="axis-measure__actions">
              <button className="axis-measure__primary" disabled={!rep?.read.summary} onClick={saveRep} type="button">
                Save Rep
              </button>
              <button className="axis-measure__secondary" onClick={nextRep} type="button">
                Next Rep
              </button>
            </div>
          </section>
        ) : null}
      </section>

      <style jsx>{`
        .axis-measure,
        .axis-measure * {
          box-sizing: border-box;
        }

        .axis-measure {
          background: #060807;
          color: #f5f2e8;
          display: grid;
          font-family: var(--font-geist-sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
          min-height: 100dvh;
          padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom));
        }

        .axis-measure__shell {
          display: grid;
          gap: 1rem;
          margin: 0 auto;
          max-width: 620px;
          width: 100%;
        }

        .axis-measure__top {
          align-items: center;
          display: flex;
          justify-content: space-between;
          min-height: 2.5rem;
        }

        .axis-measure__top a,
        .axis-measure__top span,
        .axis-measure__hero p:first-child,
        .axis-measure__panel > span,
        .axis-measure__choice-group > span {
          color: rgba(245, 242, 232, 0.62);
          font-size: 0.76rem;
          font-weight: 850;
          letter-spacing: 0;
          text-decoration: none;
          text-transform: uppercase;
        }

        .axis-measure__top span {
          border: 1px solid rgba(245, 242, 232, 0.16);
          border-radius: 999px;
          color: #f5f2e8;
          padding: 0.45rem 0.7rem;
        }

        .axis-measure__hero,
        .axis-measure__panel {
          background: #0d1110;
          border: 1px solid rgba(245, 242, 232, 0.12);
          border-radius: 1.25rem;
          display: grid;
          gap: 1rem;
          padding: 1.1rem;
        }

        .axis-measure__hero {
          align-content: center;
          min-height: calc(100dvh - 5.5rem);
        }

        h1 {
          font-size: clamp(2.5rem, 14vw, 5.5rem);
          letter-spacing: -0.07em;
          line-height: 0.88;
          margin: 0;
          max-width: 7ch;
        }

        .axis-measure__panel h1 {
          font-size: clamp(2.2rem, 12vw, 4.4rem);
        }

        .axis-measure__hero strong {
          font-size: clamp(1.3rem, 7vw, 2.2rem);
          line-height: 1;
        }

        p {
          color: rgba(245, 242, 232, 0.72);
          font-size: 1rem;
          line-height: 1.45;
          margin: 0;
        }

        .axis-measure__field {
          display: grid;
          gap: 0.45rem;
        }

        .axis-measure__field span {
          color: rgba(245, 242, 232, 0.62);
          font-size: 0.76rem;
          font-weight: 850;
          text-transform: uppercase;
        }

        input {
          background: #161b19;
          border: 1px solid rgba(245, 242, 232, 0.14);
          border-radius: 0.85rem;
          color: #f5f2e8;
          font: inherit;
          min-height: 3.2rem;
          padding: 0 1rem;
        }

        .axis-measure__choice-group {
          display: grid;
          gap: 0.55rem;
        }

        .axis-measure__choice-group div,
        .axis-measure__actions {
          display: grid;
          gap: 0.65rem;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        button,
        .axis-measure__primary,
        .axis-measure__secondary,
        .axis-measure__upload {
          align-items: center;
          border-radius: 0.9rem;
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: 0.9rem;
          font-weight: 900;
          justify-content: center;
          min-height: 3.15rem;
          text-align: center;
          text-decoration: none;
          text-transform: uppercase;
        }

        button {
          background: #161b19;
          border: 1px solid rgba(245, 242, 232, 0.14);
          color: #f5f2e8;
        }

        button.is-selected,
        .axis-measure__primary {
          background: #f5f2e8;
          border: 1px solid #f5f2e8;
          color: #060807;
          width: 100%;
        }

        .axis-measure__secondary {
          background: transparent;
          border: 1px solid rgba(245, 242, 232, 0.22);
          color: #f5f2e8;
          width: 100%;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.42;
        }

        .axis-measure__upload {
          background: #f5f2e8;
          color: #060807;
          overflow: hidden;
          position: relative;
        }

        .axis-measure__upload input {
          cursor: pointer;
          inset: 0;
          opacity: 0;
          position: absolute;
        }

        video {
          aspect-ratio: 16 / 9;
          background: #050706;
          border: 1px solid rgba(245, 242, 232, 0.14);
          border-radius: 1rem;
          object-fit: contain;
          width: 100%;
        }

        .axis-measure__read {
          background: #151a18;
          border: 1px solid rgba(245, 242, 232, 0.12);
          border-radius: 1rem;
          display: grid;
          gap: 0.85rem;
          padding: 1rem;
        }

        .axis-measure__read p {
          color: #f5f2e8;
          font-size: 1.08rem;
          font-weight: 760;
        }

        .axis-measure__read div {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .axis-measure__read span {
          background: rgba(245, 242, 232, 0.08);
          border: 1px solid rgba(245, 242, 232, 0.1);
          border-radius: 999px;
          color: rgba(245, 242, 232, 0.78);
          font-size: 0.75rem;
          font-weight: 850;
          padding: 0.45rem 0.6rem;
        }

        .axis-measure__read strong {
          font-size: 1.2rem;
          line-height: 1.25;
        }

        .axis-measure__error {
          color: #ffbd8a;
          font-weight: 760;
        }

        .axis-measure__saved {
          color: #b9ff7a;
          font-weight: 900;
          text-transform: uppercase;
        }

        @media (min-width: 760px) {
          .axis-measure {
            padding: 2rem;
          }

          .axis-measure__hero,
          .axis-measure__panel {
            padding: 1.4rem;
          }
        }
      `}</style>
    </main>
  );
}

function StepLabel({ label }: { label: string }) {
  return <span>{label}</span>;
}

function EmptyState({ href, label }: { href: string; label: string }) {
  return (
    <div className="axis-measure__read">
      <p>No clip signal yet.</p>
      <Link className="axis-measure__secondary" href={href}>
        {label}
      </Link>
    </div>
  );
}
