"use client";

import type { ReactNode } from "react";

export function FormCard({ title, children, meta }: { title: string; children: ReactNode; meta?: string }) {
  return (
    <article className="pi-form-card">
      <div className="pi-form-card-head">
        <h2>{title}</h2>
        {meta ? <span>{meta}</span> : null}
      </div>
      <div className="pi-form-grid">{children}</div>
    </article>
  );
}

export function Field({
  label,
  value,
  onChange,
  textarea,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  type?: string;
}) {
  return (
    <label className={textarea ? "pi-field pi-field--wide" : "pi-field"}>
      <span>{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
      ) : (
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

export function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className={checked ? "pi-switch pi-switch--on" : "pi-switch"}>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <IconMark label={checked ? "Yes" : "Set"} />
      <span>{label}</span>
    </label>
  );
}

export function IconMark({ label }: { label: string }) {
  return (
    <span className="pi-icon" aria-hidden="true">
      {label}
    </span>
  );
}

export function Meter({ done, total, percent }: { done: number; total: number; percent: number }) {
  return (
    <div className="pi-meter" aria-label={`${done} of ${total} complete`}>
      <span style={{ width: `${percent}%` }} />
      <strong>{percent}%</strong>
    </div>
  );
}

export function PlayerIntelligenceStyles() {
  return (
    <style>{`
      .pi-os, .pi-os * { box-sizing: border-box; }
      .pi-os {
        --pi-panel: rgba(246, 248, 240, 0.045);
        --pi-border: rgba(246, 248, 240, 0.14);
        --pi-ink: var(--ax-ink, #f6f8f0);
        --pi-muted: rgba(246, 248, 240, 0.62);
        --pi-primary: var(--ax-lime, #9dff45);
        display: grid;
        gap: 0.85rem;
        padding: clamp(1rem, 3vw, 2rem) var(--ax-pad, clamp(1rem, 3vw, 2rem)) 3rem;
      }
      .pi-hero, .pi-panel, .pi-card, .pi-form-card {
        background: var(--pi-panel);
        border: 1px solid var(--pi-border);
        border-radius: 0.5rem;
      }
      .pi-hero {
        align-items: end;
        display: grid;
        gap: 1rem;
        grid-template-columns: minmax(0, 1fr) auto;
        padding: clamp(1rem, 3vw, 1.5rem);
      }
      .pi-hero p, .pi-panel-head p, .pi-card p, .pi-label {
        color: var(--pi-primary);
        font-size: 0.72rem;
        font-weight: 850;
        letter-spacing: 0.12em;
        margin: 0;
        text-transform: uppercase;
      }
      .pi-hero h1 {
        font-size: clamp(2rem, 6vw, 4rem);
        line-height: 0.95;
        margin: 0.2rem 0 0.55rem;
      }
      .pi-hero span, .pi-panel-head span, .pi-muted { color: var(--pi-muted); }
      .pi-hero nav, .pi-actions, .pi-row-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      .pi-nav, .pi-actions a, .pi-button, .pi-file-button {
        align-items: center;
        background: rgba(246, 248, 240, 0.055);
        border: 1px solid var(--pi-border);
        border-radius: 999px;
        color: var(--pi-ink);
        cursor: pointer;
        display: inline-flex;
        font: inherit;
        font-size: 0.9rem;
        font-weight: 750;
        gap: 0.45rem;
        min-height: 2.75rem;
        padding: 0 0.9rem;
        text-decoration: none;
      }
      .pi-nav--on, .pi-actions a:hover, .pi-button:hover, .pi-button--primary {
        background: var(--pi-primary);
        border-color: var(--pi-primary);
        color: #050706;
      }
      .pi-button--done {
        border-color: rgba(157, 255, 69, 0.7);
        color: var(--pi-primary);
      }
      .pi-button:disabled { cursor: not-allowed; opacity: 0.52; }
      .pi-file-button input { display: none; }
      .pi-grid { display: grid; gap: 0.85rem; }
      .pi-grid--map { grid-template-columns: repeat(5, minmax(0, 1fr)); }
      .pi-grid--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .pi-grid--proof { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .pi-grid--sessions { grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); }
      .pi-card, .pi-form-card, .pi-panel { padding: 1rem; }
      .pi-card ul, .pi-priority { display: grid; gap: 0.45rem; margin: 0.8rem 0 0; padding-left: 1.1rem; }
      .pi-card li, .pi-priority li, .pi-copy { color: rgba(246, 248, 240, 0.78); font-size: 0.9rem; line-height: 1.4; }
      .pi-panel { display: grid; gap: 1rem; }
      .pi-panel-head, .pi-form-card-head { align-items: center; display: flex; flex-wrap: wrap; gap: 0.8rem; justify-content: space-between; }
      .pi-panel-head a { color: var(--pi-primary); font-size: 0.88rem; font-weight: 750; }
      .pi-form-card { align-content: start; display: grid; gap: 0.9rem; }
      .pi-form-card h2 { font-size: 1rem; margin: 0; }
      .pi-form-card-head span { color: var(--pi-muted); font-size: 0.78rem; }
      .pi-form-grid { display: grid; gap: 0.75rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .pi-field, .pi-field--wide { display: grid; gap: 0.35rem; }
      .pi-field--wide, .pi-switch, .pi-report-output { grid-column: 1 / -1; }
      .pi-field span { color: rgba(246, 248, 240, 0.68); font-size: 0.78rem; font-weight: 700; }
      .pi-field input, .pi-field textarea, .pi-table-input, .pi-report-output {
        background: rgba(0, 0, 0, 0.18);
        border: 1px solid rgba(246, 248, 240, 0.15);
        border-radius: 0.45rem;
        color: var(--pi-ink);
        font: inherit;
        min-height: 2.65rem;
        padding: 0.65rem 0.75rem;
        width: 100%;
      }
      .pi-field textarea, .pi-report-output { resize: vertical; }
      .pi-report-output { min-height: 24rem; white-space: pre-wrap; }
      .pi-field input:focus, .pi-field textarea:focus, .pi-table-input:focus, .pi-report-output:focus { border-color: var(--pi-primary); outline: none; }
      .pi-checklist { display: grid; gap: 0.55rem; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); }
      .pi-checklist--sprint { grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); }
      .pi-check, .pi-switch, .pi-session-card {
        align-items: center;
        background: rgba(246, 248, 240, 0.045);
        border: 1px solid var(--pi-border);
        border-radius: 0.5rem;
        color: rgba(246, 248, 240, 0.78);
        cursor: pointer;
        display: flex;
        gap: 0.55rem;
        min-height: 3rem;
        padding: 0.65rem 0.75rem;
      }
      .pi-session-card { align-items: start; cursor: default; display: grid; gap: 0.6rem; }
      .pi-session-card strong { color: var(--pi-ink); }
      .pi-check input, .pi-switch input { opacity: 0; position: absolute; }
      .pi-icon {
        align-items: center;
        border: 1px solid rgba(246, 248, 240, 0.22);
        border-radius: 0.3rem;
        color: rgba(246, 248, 240, 0.62);
        display: inline-flex;
        flex: 0 0 auto;
        font-size: 0.62rem;
        font-weight: 850;
        height: 1.35rem;
        justify-content: center;
        line-height: 1;
        min-width: 1.35rem;
        padding: 0 0.25rem;
      }
      .pi-check--on, .pi-switch--on, .pi-session-card--on { border-color: rgba(157, 255, 69, 0.65); color: var(--pi-ink); }
      .pi-check--on .pi-icon, .pi-switch--on .pi-icon, .pi-nav--on .pi-icon {
        border-color: currentColor;
        color: currentColor;
      }
      .pi-meter {
        align-items: center;
        background: rgba(0, 0, 0, 0.22);
        border: 1px solid rgba(246, 248, 240, 0.1);
        border-radius: 999px;
        display: grid;
        height: 1.7rem;
        min-width: 8rem;
        overflow: hidden;
        position: relative;
      }
      .pi-meter span { background: rgba(157, 255, 69, 0.72); bottom: 0; left: 0; position: absolute; top: 0; }
      .pi-meter strong { color: var(--pi-ink); font-size: 0.72rem; justify-self: center; position: relative; }
      .pi-banner {
        border: 1px solid rgba(255, 212, 122, 0.38);
        border-radius: 0.5rem;
        color: rgba(255, 236, 196, 0.95);
        line-height: 1.4;
        padding: 0.8rem;
      }
      .pi-closeout {
        border-color: rgba(157, 255, 69, 0.32);
      }
      .pi-closeout-grid {
        display: grid;
        gap: 0.85rem;
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .pi-closeout-grid--proof {
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
      }
      .pi-closeout-value {
        color: rgba(246, 248, 240, 0.84);
        font-size: 0.92rem;
        line-height: 1.45;
        margin: 0;
      }
      .pi-closeout-proof {
        color: rgba(246, 248, 240, 0.84);
        display: grid;
        gap: 0.55rem;
        line-height: 1.45;
        margin: 0;
        padding-left: 1.2rem;
      }
      .pi-closeout-actions {
        display: grid;
        gap: 0.65rem;
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .pi-closeout-actions .pi-button {
        justify-content: center;
        min-height: 3.2rem;
      }
      .pi-empty {
        color: rgba(246, 248, 240, 0.48);
        font-style: italic;
      }
      .pi-privacy-note {
        align-items: center;
        border: 1px solid rgba(255, 212, 122, 0.38);
        border-radius: 0.5rem;
        color: rgba(255, 236, 196, 0.95);
        display: flex;
        gap: 0.6rem;
        line-height: 1.35;
        padding: 0.8rem;
      }
      .pi-copy-status {
        color: var(--pi-primary);
        font-size: 0.85rem;
        font-weight: 750;
        margin: 0;
      }
      .pi-table-wrap { overflow-x: auto; }
      .pi-table { border-collapse: separate; border-spacing: 0; min-width: 78rem; width: 100%; }
      .pi-table th, .pi-table td { border-bottom: 1px solid rgba(246, 248, 240, 0.1); padding: 0.45rem; text-align: left; vertical-align: middle; }
      .pi-table th { color: rgba(246, 248, 240, 0.55); font-size: 0.72rem; font-weight: 800; text-transform: uppercase; white-space: nowrap; }
      .pi-table td:first-child { color: var(--pi-primary); font-variant-numeric: tabular-nums; font-weight: 850; text-align: center; }
      .pi-table-input { border-radius: 0.35rem; font-size: 0.85rem; min-height: 2.25rem; min-width: 9rem; padding: 0.45rem 0.55rem; }
      .pi-table-check { color: rgba(246, 248, 240, 0.74); font-size: 0.82rem; white-space: nowrap; }
      @media (max-width: 72rem) {
        .pi-hero, .pi-grid--map, .pi-grid--two, .pi-grid--proof, .pi-closeout-grid, .pi-closeout-grid--proof, .pi-closeout-actions { grid-template-columns: 1fr; }
        .pi-hero { align-items: start; }
      }
      @media (max-width: 42rem) {
        .pi-os { padding-inline: 0.75rem; }
        .pi-form-grid { grid-template-columns: 1fr; }
        .pi-nav, .pi-actions a, .pi-button, .pi-file-button { width: 100%; }
      }
      @media print {
        body * { visibility: hidden; }
        .pi-report-output, .pi-report-output * { visibility: visible; }
        .pi-report-output { border: 0; color: #000; left: 0; min-height: auto; position: absolute; top: 0; white-space: pre-wrap; }
      }
    `}</style>
  );
}
