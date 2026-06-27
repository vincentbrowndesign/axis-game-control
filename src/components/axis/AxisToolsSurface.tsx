"use client";

import { AxisSurfaceHeader } from "./AxisSurfaceHeader";

const tools = [
  {
    title: "Clip Room",
    purpose: "Record or upload a clip. Axis extracts activity, stats, and check plays.",
    status: "Available",
    href: "/axis/clip-room",
  },
  {
    title: "Build Map",
    purpose: "See what is active, locked, and next.",
    status: "Available",
    href: "/axis/build-map",
  },
  {
    title: "Session Setup",
    purpose: "Defaults for player, focus, and session type.",
    status: "Placeholder",
  },
  {
    title: "Capture Setup",
    purpose: "Camera and capture helpers will stay out of the main session flow.",
    status: "Placeholder",
  },
  {
    title: "Export",
    purpose: "Package session memory when exports are ready.",
    status: "Placeholder",
  },
  {
    title: "Axis Lab",
    purpose: "Advanced experiments belong behind this wall.",
    status: "Placeholder",
  },
];

export function AxisToolsSurface() {
  return (
    <section className="axis-surface">
      <AxisSurfaceHeader
        eyebrow="Tools"
        title="Hidden power stays out of the session."
        body="Use these only when they help session memory. The main screen stays clean."
      />

      <div className="axis-tool-list">
        {tools.map((tool) => (
          <article className="axis-tool-row" key={tool.title}>
            <div>
              <strong>{tool.title}</strong>
              <span>{tool.purpose}</span>
            </div>
            {tool.href ? (
              <a href={tool.href}>{tool.status}</a>
            ) : (
              <small>{tool.status}</small>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
