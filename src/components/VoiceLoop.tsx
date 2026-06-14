"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AXIS_CHALLENGES, type AxisChallenge } from "../lib/axis-challenges";
import { type AxisEvidence } from "../lib/axis-evidence";

type LoopPhase = "IDLE" | "SPEAKING" | "LISTENING" | "DONE";

type Props = {
  challenges?: AxisChallenge[];
  onAttempt: (challenge: AxisChallenge, evidence: AxisEvidence) => void;
  onEnd: () => void;
};

export default function VoiceLoop({ challenges, onAttempt, onEnd }: Props) {
  const activeChallenges = challenges ?? AXIS_CHALLENGES;

  const [phase, setPhase] = useState<LoopPhase>("IDLE");
  const [challengeIndex, setChallengeIndex] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const videoBgRef = useRef<HTMLVideoElement | null>(null);
  const presentChallengeRef = useRef<(index: number) => void>(() => null);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // Ambient camera background — silent fail if denied
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((s) => {
        stream = s;
        const v = videoBgRef.current;
        if (v) {
          v.srcObject = s;
          v.play().catch(() => null);
        }
      })
      .catch(() => null);
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = useCallback((text: string, onDone?: () => void) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.88;
    u.pitch = 1.0;
    u.onend = () => onDone?.();
    u.onerror = () => onDone?.();
    window.speechSynthesis.speak(u);
  }, []);

  const startListening = useCallback(
    (challenge: AxisChallenge, onComplete: (evidence: AxisEvidence) => void) => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechAPI) return;

      const rec: SpeechRecognition = new SpeechAPI();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      let latest = "";
      isListeningRef.current = true;

      rec.onresult = (e: SpeechRecognitionEvent) => {
        let acc = "";
        for (let i = 0; i < e.results.length; i++) {
          if (i > 0) acc += " ";
          acc += e.results[i][0].transcript;
        }
        latest = acc.trim();
      };

      const finish = () => {
        if (!isListeningRef.current) return;
        isListeningRef.current = false;
        onComplete({ kind: challenge.requiredEvidence, source: "VOICE", value: latest || null });
      };

      rec.onend = finish;
      rec.onerror = finish;

      recognitionRef.current = rec;
      rec.start();
      setPhase("LISTENING");
    },
    [],
  );

  function presentChallenge(index: number) {
    const c = activeChallenges[index];
    if (!c) return;

    recognitionRef.current?.abort();
    recognitionRef.current = null;
    isListeningRef.current = false;
    window.speechSynthesis.cancel();
    setChallengeIndex(index);
    setPhase("SPEAKING");

    const isLast = index === activeChallenges.length - 1;

    function complete(evidence: AxisEvidence) {
      onAttempt(c, evidence);
      if (isLast) {
        setPhase("DONE");
        speak("Done.");
      } else {
        presentChallengeRef.current(index + 1);
      }
    }

    speak(c.text, () => {
      setTimeout(() => startListening(c, complete), 900);
    });
  }

  // Keep ref current every render
  presentChallengeRef.current = presentChallenge;

  function handleTap() {
    if (phase === "LISTENING") {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    }
  }

  function handleExit() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    isListeningRef.current = false;
    window.speechSynthesis?.cancel();
    onEnd();
  }

  const challenge = activeChallenges[challengeIndex];
  const incomingChallenge = activeChallenges[0];

  let displayText = "";
  if (phase === "IDLE") {
    displayText = incomingChallenge.text;
  } else if (phase === "DONE") {
    displayText = "Done.";
  } else {
    displayText = challenge.text;
  }

  const isTappable = phase === "LISTENING";

  return (
    <main className="voice-loop">
      <video ref={videoBgRef} muted playsInline aria-hidden className="camera-bg" />

      <header>
        <button aria-label="Back" className="back" onClick={handleExit} type="button">
          ←
        </button>
        <span>
          {phase !== "IDLE" && phase !== "DONE"
            ? `${challengeIndex + 1} / ${activeChallenges.length}`
            : ""}
        </span>
      </header>

      <section
        className={`stage${isTappable ? " tappable" : ""}`}
        onClick={isTappable ? handleTap : undefined}
        role={isTappable ? "button" : undefined}
        aria-label={phase === "LISTENING" ? "Tap to finish" : undefined}
      >
        {phase === "SPEAKING" && <span className="dot" />}
        {phase === "LISTENING" && <span className="dot listening" />}

        <p
          className={`challenge-text${
            phase === "IDLE" || phase === "DONE" ? " dim" : ""
          }`}
        >
          {displayText}
        </p>
      </section>

      <footer>
        {phase === "IDLE" && (
          <button
            className="primary"
            disabled={!isSupported}
            onClick={() => presentChallenge(0)}
            type="button"
          >
            Go
          </button>
        )}

        {phase === "DONE" && (
          <button className="primary" onClick={handleExit} type="button">
            Done
          </button>
        )}
      </footer>

      <style jsx>{`
        .voice-loop {
          background: #0d0d0a;
          color: #f7f7f2;
          display: grid;
          grid-template-rows: auto 1fr auto;
          min-height: 100dvh;
          overflow: hidden;
          position: relative;
        }

        .camera-bg {
          filter: blur(24px);
          height: 100%;
          left: 0;
          object-fit: cover;
          opacity: 0.18;
          pointer-events: none;
          position: absolute;
          top: 0;
          transform: scaleX(-1);
          width: 100%;
          z-index: 0;
        }

        header,
        .stage,
        footer {
          position: relative;
          z-index: 1;
        }

        header {
          align-items: center;
          border-bottom: 1px solid rgba(247, 247, 242, 0.08);
          display: flex;
          justify-content: space-between;
          padding: 14px clamp(18px, 5vw, 64px);
        }

        header span {
          color: rgba(247, 247, 242, 0.3);
          font-size: 11px;
          font-weight: 850;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .back {
          background: transparent;
          border: 0;
          color: rgba(247, 247, 242, 0.3);
          cursor: pointer;
          font: inherit;
          font-size: 18px;
          line-height: 1;
          min-height: 44px;
          min-width: 44px;
          padding: 0;
        }

        .back:hover {
          color: rgba(247, 247, 242, 0.6);
        }

        .stage {
          align-content: center;
          display: grid;
          gap: 20px;
          padding: 48px clamp(18px, 5vw, 64px);
        }

        .stage.tappable {
          cursor: pointer;
        }

        .dot {
          background: rgba(247, 247, 242, 0.2);
          border-radius: 50%;
          display: block;
          height: 8px;
          width: 8px;
        }

        .dot.listening {
          animation: pulse 1.1s ease-in-out infinite;
          background: #b8ff3d;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }

        .challenge-text {
          font-size: clamp(32px, 6vw, 64px);
          font-weight: 900;
          line-height: 1.0;
          margin: 0;
          max-width: 18ch;
        }

        .challenge-text.dim {
          color: rgba(247, 247, 242, 0.35);
        }

        footer {
          border-top: 1px solid rgba(247, 247, 242, 0.08);
          display: flex;
          gap: 10px;
          min-height: 88px;
          padding: 22px clamp(18px, 5vw, 64px) 32px;
        }

        button.primary {
          background: #f7f7f2;
          border: 0;
          border-radius: 999px;
          color: #0d0d0a;
          cursor: pointer;
          font: inherit;
          font-size: 14px;
          font-weight: 850;
          min-height: 48px;
          padding: 0 22px;
        }

        button.primary:disabled {
          cursor: not-allowed;
          opacity: 0.4;
        }
      `}</style>
    </main>
  );
}
