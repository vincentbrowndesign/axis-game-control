"use client";

import { type TouchEvent, useEffect, useMemo, useRef, useState } from "react";

type ProofCard = {
  clip: string;
  duration: string;
  id: string;
  poster: string;
  title: string;
  tone: "cut" | "glass" | "paint";
};

type ProofStack = {
  id: string;
  nextUnlock: string;
  proofCount: number;
  title: string;
};

const temporaryProofs: ProofCard[] = [
  {
    clip: "",
    duration: "0:12",
    id: "shot-after-miss",
    poster:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1600'%3E%3Crect width='1200' height='1600' fill='%23030303'/%3E%3Cpath d='M0 250h1200M0 510h1200M0 770h1200M0 1030h1200M0 1290h1200M220 0v1600M600 0v1600M980 0v1600' stroke='%23f4f4f0' stroke-opacity='.08' stroke-width='2'/%3E%3Ccircle cx='600' cy='800' r='250' fill='none' stroke='%23a8d933' stroke-opacity='.42' stroke-width='10'/%3E%3Ccircle cx='600' cy='800' r='82' fill='%23a8d933' fill-opacity='.16'/%3E%3C/svg%3E",
    title: "You took the shot after a miss.",
    tone: "paint",
  },
  {
    clip: "",
    duration: "0:09",
    id: "back-after-turnover",
    poster:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1600'%3E%3Crect width='1200' height='1600' fill='%23030303'/%3E%3Cpath d='M180 1300 980 160M320 1420 1120 280M40 1040 820 40' stroke='%23f4f4f0' stroke-opacity='.08' stroke-width='12'/%3E%3Crect x='420' y='560' width='360' height='520' rx='180' fill='none' stroke='%23a8d933' stroke-opacity='.38' stroke-width='10'/%3E%3C/svg%3E",
    title: "You got back after the turnover.",
    tone: "cut",
  },
  {
    clip: "",
    duration: "0:07",
    id: "pass-before-basket",
    poster:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1600'%3E%3Crect width='1200' height='1600' fill='%23030303'/%3E%3Ccircle cx='280' cy='720' r='140' fill='none' stroke='%23f4f4f0' stroke-opacity='.12' stroke-width='8'/%3E%3Ccircle cx='875' cy='920' r='210' fill='none' stroke='%23a8d933' stroke-opacity='.34' stroke-width='10'/%3E%3Cpath d='M285 720 C460 560 690 1110 875 920' fill='none' stroke='%23a8d933' stroke-opacity='.5' stroke-width='12'/%3E%3C/svg%3E",
    title: "You made the pass before the basket.",
    tone: "glass",
  },
  {
    clip: "",
    duration: "0:10",
    id: "called-for-ball",
    poster:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1600'%3E%3Crect width='1200' height='1600' fill='%23030303'/%3E%3Cpath d='M160 1180 C360 780 600 760 1010 410' fill='none' stroke='%23a8d933' stroke-opacity='.42' stroke-width='12'/%3E%3Ccircle cx='250' cy='1110' r='132' fill='none' stroke='%23f4f4f0' stroke-opacity='.12' stroke-width='8'/%3E%3Ccircle cx='980' cy='390' r='92' fill='%23a8d933' fill-opacity='.12'/%3E%3C/svg%3E",
    title: "You called for the ball.",
    tone: "glass",
  },
  {
    clip: "",
    duration: "0:11",
    id: "there-first",
    poster:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1600'%3E%3Crect width='1200' height='1600' fill='%23030303'/%3E%3Cpath d='M260 240h680v1120H260z' fill='none' stroke='%23f4f4f0' stroke-opacity='.08' stroke-width='8'/%3E%3Cpath d='M250 1070h900' stroke='%23a8d933' stroke-opacity='.4' stroke-width='14'/%3E%3Ccircle cx='385' cy='1068' r='118' fill='none' stroke='%23a8d933' stroke-opacity='.38' stroke-width='10'/%3E%3C/svg%3E",
    title: "You got there first.",
    tone: "paint",
  },
];

const proofStacks: ProofStack[] = [
  {
    id: "after-the-miss",
    nextUnlock: "Still Shooting",
    proofCount: 4,
    title: "AFTER THE MISS",
  },
];

function getNextIndex(currentIndex: number, direction: 1 | -1) {
  return (currentIndex + direction + temporaryProofs.length) % temporaryProofs.length;
}

export function ProofFeed() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const activeProof = useMemo(() => (activeIndex === null ? null : temporaryProofs[activeIndex]), [activeIndex]);

  useEffect(() => {
    if (activeIndex === null) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") setActiveIndex((current) => (current === null ? current : getNextIndex(current, -1)));
      if (event.key === "ArrowRight") setActiveIndex((current) => (current === null ? current : getNextIndex(current, 1)));
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex]);

  function openProof(index: number) {
    setActiveIndex(index);
  }

  function closeProof() {
    setActiveIndex(null);
  }

  function goToProof(direction: 1 | -1) {
    setActiveIndex((current) => (current === null ? current : getNextIndex(current, direction)));
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

      <section className="proof-feed" aria-label="Today's proof">
        {temporaryProofs.map((proof, index) => (
          <button className="proof-card" key={proof.id} onClick={() => openProof(index)} type="button">
            <span className="proof-thumb" data-tone={proof.tone}>
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

      <section className="proof-stack-section" aria-label="Proof stack">
        {proofStacks.map((stack) => (
          <article className="proof-stack" key={stack.id}>
            <strong>{stack.title}</strong>
            <span>{`${stack.proofCount} Proofs`}</span>
            <em>{`Next Unlock: ${stack.nextUnlock}`}</em>
          </article>
        ))}
      </section>

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
                onEnded={() => goToProof(1)}
                playsInline
                poster={activeProof.poster}
                src={activeProof.clip}
              />
            ) : (
              <div
                aria-label="Proof clip preview"
                className="proof-player-video proof-player-video-placeholder"
                data-tone={activeProof.tone}
                role="img"
              />
            )}
            <button aria-label="Next proof" className="proof-player-nav proof-player-next" onClick={() => goToProof(1)} type="button">
              NEXT
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
