"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AXIS_CHALLENGES, type AxisChallenge } from "../lib/axis-challenges";
import { type AxisEvidence } from "../lib/axis-evidence";

type LoopPhase = "IDLE" | "SPEAKING" | "LISTENING" | "REVIEW" | "DONE";

type Props = {
  challenges?: AxisChallenge[];
  onAttempt: (challenge: AxisChallenge, evidence: AxisEvidence) => void;
  onEnd: () => void;
};

export default function VoiceLoop({ challenges, onAttempt, onEnd }: Props) {
  const activeChallenges = challenges ?? AXIS_CHALLENGES;
  const [phase, setPhase] = useState<LoopPhase>("IDLE");
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [transcript, setTranscript] = useState("");

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const challenge = activeChallenges[challengeIndex];
  const isLast = challengeIndex === activeChallenges.length - 1;

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      if (typeof window !== "undefined") {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  const speak = useCallback((text: string, onDone?: () => void) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.88;
    utterance.pitch = 1.0;
    utterance.onend = () => onDone?.();
    utterance.onerror = () => onDone?.();
    window.speechSynthesis.speak(utterance);
  }, []);

  const startListening = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition: SpeechRecognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let accumulated = "";
      for (let i = 0; i < event.results.length; i++) {
        if (i > 0) accumulated += " ";
        accumulated += event.results[i][0].transcript;
      }
      setTranscript(accumulated.trim());
    };

    recognition.onend = () => {
      setPhase((prev) => (prev === "LISTENING" ? "REVIEW" : prev));
    };

    recognition.onerror = () => {
      setPhase((prev) => (prev === "LISTENING" ? "REVIEW" : prev));
    };

    recognitionRef.current = recognition;
    recognition.start();
    setPhase("LISTENING");
  }, []);

  function presentChallenge(index: number) {
    const c = activeChallenges[index];
    if (!c) return;

    recognitionRef.current?.abort();
    recognitionRef.current = null;
    window.speechSynthesis.cancel();

    setTranscript("");
    setChallengeIndex(index);
    setPhase("SPEAKING");

    speak(c.text, () => {
      setTimeout(startListening, 900);
    });
  }

  function handleAnswer() {
    presentChallenge(0);
  }

  function handleDone() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setPhase("REVIEW");
  }

  function handleRecord() {
    onAttempt(challenge, {
      kind: challenge.requiredEvidence,
      source: "VOICE",
      value: transcript.trim() || null,
    });
    if (isLast) {
      setPhase("DONE");
      speak("Done.");
    } else {
      presentChallenge(challengeIndex + 1);
    }
  }

  function handlePass() {
    if (isLast) {
      setPhase("DONE");
      speak("Done.");
    } else {
      presentChallenge(challengeIndex + 1);
    }
  }

  function handleExit() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    window.speechSynthesis?.cancel();
    onEnd();
  }

  const incomingChallenge = activeChallenges[0];

  return (
    <main className="voice-loop">
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

      <section className="stage">
        {phase === "IDLE" && (
          <p className="challenge-text dim">{incomingChallenge.text}</p>
        )}

        {phase === "SPEAKING" && (
          <>
            <span className="dot" />
            <p className="challenge-text">{challenge.text}</p>
          </>
        )}

        {phase === "LISTENING" && (
          <>
            <span className="dot listening" />
            <p className="challenge-text dim">{challenge.text}</p>
          </>
        )}

        {phase === "REVIEW" && (
          <p className="challenge-text dim">{challenge.text}</p>
        )}

        {phase === "DONE" && (
          <p className="challenge-text dim">Done.</p>
        )}
      </section>

      <footer>
        {phase === "IDLE" && (
          <button
            className="primary"
            disabled={!isSupported}
            onClick={handleAnswer}
            type="button"
          >
            Go
          </button>
        )}

        {phase === "LISTENING" && (
          <button className="primary" onClick={handleDone} type="button">
            Done
          </button>
        )}

        {phase === "REVIEW" && (
          <>
            <button className="primary" onClick={handleRecord} type="button">
              Done
            </button>
            <button className="secondary" onClick={handlePass} type="button">
              Pass
            </button>
          </>
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
          padding: 22px clamp(18px, 5vw, 64px) 32px;
        }

        button.primary,
        button.secondary {
          border: 0;
          border-radius: 999px;
          cursor: pointer;
          font: inherit;
          font-size: 14px;
          font-weight: 850;
          min-height: 48px;
          padding: 0 22px;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.4;
        }

        button.primary {
          background: #f7f7f2;
          color: #0d0d0a;
        }

        button.secondary {
          background: rgba(247, 247, 242, 0.1);
          color: #f7f7f2;
        }
      `}</style>
    </main>
  );
}
