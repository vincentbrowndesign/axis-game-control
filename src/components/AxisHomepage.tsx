"use client";

import Link from "next/link";
import { useState } from "react";

const timelineMoments = [
  {
    detail: "A first step turns raw footage into a saved attacking moment.",
    label: "Drive",
    time: "00:14",
  },
  {
    detail: "The release point becomes a replay window instead of another file.",
    label: "Shot",
    time: "01:22",
  },
  {
    detail: "A possession change is pinned to time and ready to watch again.",
    label: "Steal",
    time: "02:48",
  },
  {
    detail: "A spacing break becomes a visual memory for the whole session.",
    label: "Advantage",
    time: "04:15",
  },
];

const archiveItems = [
  {
    detail: "Saved repetitions, session rhythm, and the plays worth returning to.",
    label: "Practice",
    moment: "04 moments",
  },
  {
    detail: "Game memory organized around the possessions that changed the night.",
    label: "Game",
    moment: "09 moments",
  },
  {
    detail: "A player history built from effort, growth, and replayable proof.",
    label: "Player Development",
    moment: "18 moments",
  },
  {
    detail: "A clean case file of moments, context, and visual evidence.",
    label: "Scout Report",
    moment: "06 moments",
  },
];

export function AxisHomepage() {
  const [selectedMoment, setSelectedMoment] = useState(timelineMoments[0]);

  return (
    <main className="axis-home-page">
      <section className="axis-home-hero" aria-labelledby="axis-home-title">
        <nav className="axis-home-nav" aria-label="Axis">
          <Link href="/" aria-label="Axis home">
            AXIS
          </Link>
          <div>
            <a href="#evidence">Evidence</a>
            <a href="#timeline">Timeline</a>
            <a href="#overlay">Overlays</a>
            <a href="#archive">Archive</a>
            <Link href="/capture">Upload</Link>
          </div>
        </nav>

        <div className="axis-home-hero-copy">
          <p>Evidence / Timeline / Reconstruction / Overlays / Archive</p>
          <h1 id="axis-home-title">What Happened Here?</h1>
          <span>Upload footage and watch one basketball moment become visible, replayable, and saved.</span>
          <div className="axis-home-actions">
            <Link className="axis-home-primary" href="/capture">
              Upload Footage
            </Link>
            <a className="axis-home-secondary" href="#overlay">
              View Demo
            </a>
          </div>
        </div>

        <div className="axis-home-hero-visual" aria-hidden="true">
          <div className="axis-home-video-frame">
            <div className="axis-home-court-lines" />
            <span className="axis-home-player axis-home-player-one">12</span>
            <span className="axis-home-player axis-home-player-two">8</span>
            <span className="axis-home-ball" />
            <span className="axis-home-ball-trail axis-home-ball-trail-one" />
            <span className="axis-home-ball-trail axis-home-ball-trail-two" />
            <span className="axis-home-pulse" />
            <strong>Moment 03</strong>
          </div>
        </div>
      </section>

      <section className="axis-home-section axis-home-evidence" id="evidence" aria-labelledby="axis-evidence-title">
        <div>
          <span>01 / Evidence</span>
          <h2 id="axis-evidence-title">The moment starts with proof.</h2>
        </div>
        <div className="axis-home-evidence-stage" aria-hidden="true">
          <div className="axis-home-evidence-frame">
            <span className="axis-home-evidence-time">00:14</span>
            <span className="axis-home-evidence-tag">Drive</span>
            <span className="axis-home-evidence-player axis-home-evidence-player-a">12</span>
            <span className="axis-home-evidence-player axis-home-evidence-player-b">8</span>
            <span className="axis-home-evidence-ball" />
            <span className="axis-home-evidence-path axis-home-evidence-path-a" />
            <span className="axis-home-evidence-path axis-home-evidence-path-b" />
          </div>
        </div>
      </section>

      <section className="axis-home-section axis-home-timeline" id="timeline" aria-labelledby="axis-timeline-title">
        <div>
          <span>02 / Timeline</span>
          <h2 id="axis-timeline-title">Every answer has a time.</h2>
        </div>
        <div className="axis-home-evidence-system">
          <div className="axis-home-timeline-rail" aria-label="Example evidence timeline">
            {timelineMoments.map((moment) => (
              <button
                aria-pressed={selectedMoment.time === moment.time}
                key={moment.time}
                onClick={() => setSelectedMoment(moment)}
                type="button"
              >
                <time>{moment.time}</time>
                <strong>{moment.label}</strong>
              </button>
            ))}
          </div>
          <article className="axis-home-replay-card" aria-live="polite">
            <div className="axis-home-replay-card-screen" aria-hidden="true">
              <span className="axis-home-replay-card-line axis-home-replay-card-line-a" />
              <span className="axis-home-replay-card-line axis-home-replay-card-line-b" />
              <span className="axis-home-replay-card-player axis-home-replay-card-player-a">7</span>
              <span className="axis-home-replay-card-player axis-home-replay-card-player-b">21</span>
              <span className="axis-home-replay-card-ball" />
              <span className="axis-home-replay-card-pulse" />
            </div>
            <div>
              <time>{selectedMoment.time}</time>
              <strong>{selectedMoment.label}</strong>
              <p>{selectedMoment.detail}</p>
            </div>
          </article>
        </div>
      </section>

      <section className="axis-home-section axis-home-reconstruct" aria-labelledby="axis-reconstruct-title">
        <div>
          <span>03 / Reconstruction</span>
          <h2 id="axis-reconstruct-title">See What Happened.</h2>
        </div>
        <div className="axis-home-reconstruct-system">
          <p>Turn footage into a replayable story.</p>
          <div className="axis-home-reconstruction-board" aria-hidden="true">
            <span className="axis-home-reconstruct-flow axis-home-reconstruct-video">Video</span>
            <span className="axis-home-reconstruct-flow axis-home-reconstruct-events">Events</span>
            <span className="axis-home-reconstruct-flow axis-home-reconstruct-replay">Replay</span>
            <span className="axis-home-reconstruct-connector axis-home-reconstruct-connector-a" />
            <span className="axis-home-reconstruct-connector axis-home-reconstruct-connector-b" />
            <span className="axis-home-reconstruct-marker axis-home-reconstruct-marker-a">00:14</span>
            <span className="axis-home-reconstruct-marker axis-home-reconstruct-marker-b">01:22</span>
            <span className="axis-home-reconstruct-marker axis-home-reconstruct-marker-c">02:48</span>
            <span className="axis-home-reconstruct-memory axis-home-reconstruct-memory-a" />
            <span className="axis-home-reconstruct-memory axis-home-reconstruct-memory-b" />
            <span className="axis-home-reconstruct-memory axis-home-reconstruct-memory-c" />
          </div>
        </div>
      </section>

      <section className="axis-home-section axis-home-overlay" id="overlay" aria-labelledby="axis-overlay-title">
        <div>
          <span>04 / Overlays</span>
          <h2 id="axis-overlay-title">The overlays become the show.</h2>
        </div>
        <div className="axis-home-showcase" aria-hidden="true">
          <div className="axis-home-showcase-screen">
            <span className="axis-home-showcase-heat axis-home-showcase-heat-a" />
            <span className="axis-home-showcase-heat axis-home-showcase-heat-b" />
            <span className="axis-home-showcase-zone axis-home-showcase-zone-a">Pressure Zone</span>
            <span className="axis-home-showcase-zone axis-home-showcase-zone-b">Heat Effect</span>
            <span className="axis-home-showcase-ring axis-home-showcase-ring-a" />
            <span className="axis-home-showcase-ring axis-home-showcase-ring-b" />
            <span className="axis-home-showcase-ring axis-home-showcase-ring-c" />
            <span className="axis-home-showcase-player-label axis-home-showcase-player-label-a">Player Indicator</span>
            <span className="axis-home-showcase-player-label axis-home-showcase-player-label-b">Player Indicator</span>
            <span className="axis-home-showcase-ball" />
            <span className="axis-home-showcase-trail axis-home-showcase-trail-a" />
            <span className="axis-home-showcase-trail axis-home-showcase-trail-b" />
            <span className="axis-home-showcase-trail axis-home-showcase-trail-c" />
            <span className="axis-home-showcase-lane axis-home-showcase-lane-a">Passing Lane</span>
            <span className="axis-home-showcase-lane axis-home-showcase-lane-b">Passing Lane</span>
            <span className="axis-home-showcase-sweep" />
          </div>
        </div>
      </section>

      <section className="axis-home-section axis-home-archive" id="archive" aria-labelledby="axis-archive-title">
        <div>
          <span>05 / Archive</span>
          <h2 id="axis-archive-title">Build a Library of Moments.</h2>
        </div>
        <div className="axis-home-archive-strip" aria-label="Example archive">
          {archiveItems.map((item) => (
            <article className="axis-home-archive-card" key={item.label}>
              <div className="axis-home-archive-visual" aria-hidden="true">
                <span className="axis-home-archive-frame axis-home-archive-frame-a" />
                <span className="axis-home-archive-frame axis-home-archive-frame-b" />
                <span className="axis-home-archive-dot axis-home-archive-dot-a" />
                <span className="axis-home-archive-dot axis-home-archive-dot-b" />
                <span className="axis-home-archive-line" />
              </div>
              <div>
                <span>{item.moment}</span>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="axis-home-cta" aria-labelledby="axis-home-cta-title">
        <h2 id="axis-home-cta-title">Start With One Moment.</h2>
        <div className="axis-home-actions">
          <Link className="axis-home-primary" href="/capture">
            Upload Footage
          </Link>
          <a className="axis-home-secondary" href="#overlay">
            View Demo
          </a>
        </div>
      </section>
    </main>
  );
}
