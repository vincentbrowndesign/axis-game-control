"use client";

import { useMemo, useState } from "react";

type PlayerNode = {
  id: string;
  label: string;
  role: string;
  x: number;
  y: number;
};

type EventCard = {
  id: string;
  label: string;
  time: string;
  evidence: string;
  x: number;
  y: number;
};

type PathSegment = {
  id: string;
  from: string;
  to: { x: number; y: number };
  label: string;
};

const initialNodes: PlayerNode[] = [
  { id: "p1", label: "P1", role: "handler", x: 46, y: 72 },
  { id: "p2", label: "P2", role: "wing", x: 22, y: 42 },
  { id: "p3", label: "P3", role: "corner", x: 82, y: 32 },
  { id: "p4", label: "P4", role: "rim", x: 50, y: 18 },
];

const events: EventCard[] = [
  {
    evidence: "ball path + player track",
    id: "moment-01",
    label: "Drive wall",
    time: "00:14",
    x: 56,
    y: 48,
  },
  {
    evidence: "voice tag + event marker",
    id: "moment-02",
    label: "Corner release",
    time: "00:18",
    x: 76,
    y: 30,
  },
  {
    evidence: "replay window",
    id: "moment-03",
    label: "Saved finish",
    time: "00:21",
    x: 50,
    y: 16,
  },
];

const pathSegments: PathSegment[] = [
  { from: "p1", id: "path-1", label: "entry path", to: { x: 54, y: 48 } },
  { from: "p2", id: "path-2", label: "support path", to: { x: 36, y: 36 } },
  { from: "p3", id: "path-3", label: "release path", to: { x: 76, y: 30 } },
];

const timeline = [
  { evidence: "raw footage", id: "t1", label: "material received", time: "00:00" },
  { evidence: "court plan", id: "t2", label: "ground plan locked", time: "00:08" },
  { evidence: "tracks", id: "t3", label: "moving structures placed", time: "00:14" },
  { evidence: "events", id: "t4", label: "load-bearing moments saved", time: "00:21" },
];

const archiveCells = [
  "raw footage",
  "court plan",
  "player paths",
  "pressure direction",
  "event cards",
  "case study",
];

export function AxisReconstructionSurface() {
  const [nodes, setNodes] = useState(initialNodes);
  const [activeEventId, setActiveEventId] = useState(events[0].id);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const activeEvent = events.find((event) => event.id === activeEventId) ?? events[0];

  function moveNode(id: string, clientX: number, clientY: number, element: HTMLButtonElement) {
    const court = element.closest<HTMLElement>(".axis-reconstruction-court");
    if (!court) return;
    const rect = court.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    setNodes((current) =>
      current.map((node) =>
        node.id === id
          ? {
              ...node,
              x: clampPercent(x),
              y: clampPercent(y),
            }
          : node,
      ),
    );
  }

  return (
    <main className="axis-reconstruction-shell">
      <header className="axis-reconstruction-header">
        <div>
          <span>AXIS RECONSTRUCTION</span>
          <h1>Building Site 004</h1>
        </div>
        <button className="axis-reconstruction-print" onClick={() => window.print()} type="button">
          Export Case Study
        </button>
      </header>

      <section className="axis-reconstruction-grid" aria-label="Reconstruction workspace">
        <div className="axis-reconstruction-plan">
          <div className="axis-plan-label">
            <span>GROUND PLAN</span>
            <strong>court / movement / evidence</strong>
          </div>

          <div className="axis-reconstruction-court" aria-label="Basketball court reconstruction plan">
            <div className="axis-court-half" />
            <div className="axis-court-paint" />
            <div className="axis-court-rim" />
            <div className="axis-court-arc" />

            <svg aria-hidden="true" className="axis-path-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
              {pathSegments.map((segment) => {
                const node = nodeById.get(segment.from);
                if (!node) return null;
                return (
                  <line
                    key={segment.id}
                    x1={node.x}
                    x2={segment.to.x}
                    y1={node.y}
                    y2={segment.to.y}
                  />
                );
              })}
            </svg>

            {pathSegments.map((segment) => (
              <span
                className="axis-path-label"
                key={`${segment.id}-label`}
                style={{ left: `${segment.to.x}%`, top: `${segment.to.y}%` }}
              >
                {segment.label}
              </span>
            ))}

            <div
              aria-label="pressure direction"
              className="axis-pressure-triangle"
              style={{ left: `${activeEvent.x}%`, top: `${activeEvent.y}%` }}
            />

            {events.map((event) => (
              <button
                aria-pressed={event.id === activeEventId}
                className="axis-event-square"
                key={event.id}
                onClick={() => setActiveEventId(event.id)}
                style={{ left: `${event.x}%`, top: `${event.y}%` }}
                type="button"
              >
                <span>{event.time}</span>
              </button>
            ))}

            {nodes.map((node) => (
              <button
                aria-label={`${node.label} ${node.role}`}
                className="axis-player-node"
                key={node.id}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  moveNode(node.id, event.clientX, event.clientY, event.currentTarget);
                }}
                onPointerMove={(event) => {
                  if (event.buttons !== 1) return;
                  moveNode(node.id, event.clientX, event.clientY, event.currentTarget);
                }}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                type="button"
              >
                {node.label}
              </button>
            ))}
          </div>
        </div>

        <aside className="axis-reconstruction-case" aria-label="Active moment evidence">
          <div className="axis-case-card">
            <span>LOAD-BEARING MOMENT</span>
            <strong>{activeEvent.label}</strong>
            <p>{activeEvent.evidence}</p>
            <time>{activeEvent.time}</time>
          </div>

          <div className="axis-case-legend" aria-label="Shape key">
            <span><i className="axis-key-circle" /> player</span>
            <span><i className="axis-key-line" /> path</span>
            <span><i className="axis-key-triangle" /> pressure</span>
            <span><i className="axis-key-square" /> saved event</span>
          </div>
        </aside>
      </section>

      <section className="axis-reconstruction-timeline" aria-label="Reconstruction timeline">
        {timeline.map((item) => (
          <article key={item.id}>
            <time>{item.time}</time>
            <strong>{item.label}</strong>
            <span>{item.evidence}</span>
          </article>
        ))}
      </section>

      <section className="axis-reconstruction-archive" aria-label="Archive structure">
        {archiveCells.map((cell) => (
          <div key={cell}>{cell}</div>
        ))}
      </section>
    </main>
  );
}

function clampPercent(value: number) {
  return Math.max(6, Math.min(94, value));
}
