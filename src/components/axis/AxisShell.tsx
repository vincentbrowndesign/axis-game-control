import type {
  AxisActivityItem,
  AxisCapability,
  AxisNavigationItem,
  AxisOutput,
  AxisProjectStatus,
  AxisRunStep,
} from "../../lib/axis/types";
import { AxisActiveRunPanel } from "./AxisActiveRunPanel";
import { AxisActivityRail } from "./AxisActivityRail";
import { AxisCapabilityGrid } from "./AxisCapabilityGrid";
import { AxisCommandComposer } from "./AxisCommandComposer";
import { AxisRecentOutputs } from "./AxisRecentOutputs";
import { AxisSidebar } from "./AxisSidebar";
import { AxisStatusCard } from "./AxisStatusCard";
import { AxisSuggestionBar } from "./AxisSuggestionBar";
import { AxisTopbar } from "./AxisTopbar";

export function AxisShell({
  activity,
  capabilities,
  navigation,
  outputs,
  projectStatus,
  runSteps,
  suggestions,
  uiV2Enabled,
}: {
  activity: AxisActivityItem[];
  capabilities: AxisCapability[];
  navigation: AxisNavigationItem[];
  outputs: AxisOutput[];
  projectStatus: AxisProjectStatus;
  runSteps: AxisRunStep[];
  suggestions: string[];
  uiV2Enabled: boolean;
}) {
  return (
    <main className="axis-v2" data-axis-ui-v2={uiV2Enabled ? "true" : "false"}>
      <AxisSidebar items={navigation} />
      <div className="axis-v2__workspace">
        <AxisTopbar />
        <div className="axis-v2__body">
          <div className="axis-v2__main">
            <section className="axis-hero" aria-label="Axis command center">
              <div>
                <p>Unified AI Output Layer</p>
                <h2>Run anything. Keep every result as an Axis Output.</h2>
              </div>
              <AxisStatusCard />
            </section>
            <AxisCommandComposer />
            <AxisSuggestionBar suggestions={suggestions} />
            <AxisActiveRunPanel steps={runSteps} />
            <AxisCapabilityGrid capabilities={capabilities} />
            <AxisRecentOutputs outputs={outputs} />
          </div>
          <AxisActivityRail activity={activity} projectStatus={projectStatus} />
        </div>
      </div>
      <style>{`
        :root {
          color-scheme: dark;
        }

        html,
        body {
          margin: 0;
          min-height: 100%;
          overflow-x: hidden;
        }

        .axis-v2,
        .axis-v2 * {
          box-sizing: border-box;
        }

        .axis-v2 {
          --axis-bg: #08090d;
          --axis-panel: #11131a;
          --axis-panel-soft: #171a23;
          --axis-line: rgba(255, 255, 255, 0.1);
          --axis-line-strong: rgba(255, 255, 255, 0.18);
          --axis-ink: #f4f1ea;
          --axis-muted: rgba(244, 241, 234, 0.64);
          --axis-faint: rgba(244, 241, 234, 0.42);
          --axis-accent: #d8ff7a;
          --axis-accent-soft: rgba(216, 255, 122, 0.13);
          --axis-danger: #ff7c6f;
          background:
            radial-gradient(circle at 32% 0%, rgba(216, 255, 122, 0.09), transparent 30rem),
            radial-gradient(circle at 100% 18%, rgba(119, 151, 255, 0.12), transparent 34rem),
            var(--axis-bg);
          color: var(--axis-ink);
          display: grid;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          grid-template-columns: 17rem minmax(0, 1fr);
          min-height: 100dvh;
          width: 100%;
        }

        .axis-sidebar {
          border-right: 1px solid var(--axis-line);
          min-height: 100dvh;
          padding: 1.25rem;
          position: sticky;
          top: 0;
        }

        .axis-sidebar__brand {
          align-items: center;
          display: flex;
          gap: 0.8rem;
          margin-bottom: 2rem;
        }

        .axis-sidebar__brand > span {
          align-items: center;
          background: var(--axis-accent);
          border-radius: 0.9rem;
          color: #10130b;
          display: inline-flex;
          font-size: 0.8rem;
          font-weight: 900;
          height: 2.5rem;
          justify-content: center;
          letter-spacing: 0.04em;
          width: 2.5rem;
        }

        .axis-sidebar__brand strong,
        .axis-sidebar__brand small {
          display: block;
        }

        .axis-sidebar__brand strong {
          font-size: 1rem;
        }

        .axis-sidebar__brand small {
          color: var(--axis-faint);
          font-size: 0.74rem;
          margin-top: 0.15rem;
        }

        .axis-sidebar nav {
          display: grid;
          gap: 0.35rem;
        }

        .axis-sidebar__link {
          align-items: center;
          border: 1px solid transparent;
          border-radius: 0.95rem;
          color: var(--axis-muted);
          display: flex;
          gap: 0.65rem;
          min-height: 2.55rem;
          padding: 0 0.8rem;
          text-decoration: none;
        }

        .axis-sidebar__link--active,
        .axis-sidebar__link:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--axis-line);
          color: var(--axis-ink);
        }

        .axis-v2__workspace {
          min-width: 0;
          padding: clamp(1rem, 2.4vw, 2rem);
        }

        .axis-v2__body {
          align-items: start;
          display: grid;
          gap: clamp(1rem, 2vw, 1.35rem);
          grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
          margin: 0 auto;
          max-width: 104rem;
        }

        .axis-v2__main {
          min-width: 0;
        }

        .axis-topbar {
          align-items: center;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
          margin: 0 auto 1.2rem;
          max-width: 88rem;
        }

        .axis-topbar p,
        .axis-hero p,
        .axis-section-heading p,
        .axis-command__header p {
          color: var(--axis-faint);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          margin: 0 0 0.35rem;
          text-transform: uppercase;
        }

        .axis-topbar h1 {
          font-size: clamp(1rem, 1.4vw, 1.28rem);
          margin: 0;
        }

        .axis-topbar__status,
        .axis-status-card {
          align-items: center;
          border: 1px solid var(--axis-line);
          border-radius: 999px;
          display: inline-flex;
          gap: 0.55rem;
        }

        .axis-topbar__status {
          color: var(--axis-muted);
          font-size: 0.83rem;
          padding: 0.55rem 0.75rem;
          white-space: nowrap;
        }

        .axis-topbar__status span,
        .axis-status-card > span {
          background: var(--axis-accent);
          border-radius: 999px;
          box-shadow: 0 0 22px rgba(216, 255, 122, 0.5);
          height: 0.48rem;
          width: 0.48rem;
        }

        .axis-topbar__status small {
          color: var(--axis-faint);
          font-size: 0.72rem;
          font-weight: 700;
        }

        .axis-hero {
          align-items: end;
          display: grid;
          gap: 1rem;
          grid-template-columns: minmax(0, 1fr) auto;
          margin-bottom: 1rem;
        }

        .axis-hero h2 {
          font-size: clamp(2rem, 5vw, 5.4rem);
          letter-spacing: -0.04em;
          line-height: 0.95;
          margin: 0;
          max-width: 11ch;
        }

        .axis-status-card {
          background: rgba(255, 255, 255, 0.045);
          border-radius: 1.2rem;
          padding: 1rem;
        }

        .axis-run-panel {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid var(--axis-line);
          border-radius: 1.25rem;
          margin-top: 1rem;
          padding: 1rem;
        }

        .axis-section-heading--compact {
          margin-bottom: 0.7rem;
        }

        .axis-run-panel__meter {
          background: rgba(255, 255, 255, 0.07);
          border-radius: 999px;
          height: 0.45rem;
          overflow: hidden;
        }

        .axis-run-panel__meter span {
          background: linear-gradient(90deg, var(--axis-accent), rgba(119, 151, 255, 0.85));
          border-radius: inherit;
          display: block;
          height: 100%;
          width: 68%;
        }

        .axis-run-panel__steps {
          display: grid;
          gap: 0.55rem;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          list-style: none;
          margin: 0.85rem 0 0;
          padding: 0;
        }

        .axis-run-panel__step {
          align-items: center;
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid var(--axis-line);
          border-radius: 0.85rem;
          color: var(--axis-muted);
          display: flex;
          gap: 0.45rem;
          min-height: 2.55rem;
          min-width: 0;
          padding: 0 0.7rem;
        }

        .axis-run-panel__step span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .axis-run-panel__step--processing,
        .axis-run-panel__step--loading {
          border-color: rgba(216, 255, 122, 0.28);
          color: var(--axis-ink);
        }

        .axis-run-panel__step--failed {
          border-color: rgba(255, 124, 111, 0.28);
          color: var(--axis-danger);
        }

        .axis-status-card h2,
        .axis-status-card p,
        .axis-status-card strong {
          display: block;
          margin: 0;
        }

        .axis-status-card h2 {
          font-size: 0.92rem;
        }

        .axis-status-card p,
        .axis-status-card strong {
          color: var(--axis-muted);
          font-size: 0.78rem;
          font-weight: 600;
          margin-top: 0.2rem;
        }

        .axis-command {
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.035)),
            var(--axis-panel);
          border: 1px solid var(--axis-line-strong);
          border-radius: 1.55rem;
          box-shadow: 0 2rem 5rem rgba(0, 0, 0, 0.24);
          padding: clamp(1rem, 2.4vw, 1.5rem);
        }

        .axis-command__header h2,
        .axis-section-heading h2 {
          font-size: clamp(1.15rem, 1.8vw, 1.7rem);
          margin: 0;
        }

        .axis-command__form {
          display: grid;
          gap: 1rem;
          margin-top: 1rem;
        }

        .axis-command textarea {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid var(--axis-line);
          border-radius: 1.15rem;
          color: var(--axis-ink);
          font: inherit;
          font-size: clamp(1rem, 1.2vw, 1.12rem);
          line-height: 1.45;
          min-height: 8.5rem;
          outline: none;
          padding: 1rem;
          resize: vertical;
          width: 100%;
        }

        .axis-command textarea:focus {
          border-color: rgba(216, 255, 122, 0.55);
          box-shadow: 0 0 0 4px rgba(216, 255, 122, 0.1);
        }

        .axis-command textarea::placeholder {
          color: var(--axis-faint);
        }

        .axis-command__footer,
        .axis-command__modes {
          align-items: center;
          display: flex;
          gap: 0.65rem;
        }

        .axis-command__footer {
          justify-content: space-between;
        }

        .axis-command button,
        .axis-suggestions button {
          border: 0;
          cursor: pointer;
          font: inherit;
        }

        .axis-command__modes button,
        .axis-suggestions button {
          align-items: center;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--axis-line);
          border-radius: 999px;
          color: var(--axis-muted);
          display: inline-flex;
          gap: 0.45rem;
          min-height: 2.35rem;
          padding: 0 0.8rem;
        }

        .axis-command__modes button:hover,
        .axis-suggestions button:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--axis-ink);
        }

        .axis-command__send {
          align-items: center;
          background: var(--axis-accent);
          border-radius: 999px;
          color: #11150b;
          display: inline-flex;
          font-weight: 800;
          gap: 0.5rem;
          min-height: 2.55rem;
          padding: 0 1rem;
        }

        .axis-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
          margin: 1rem auto 1.45rem;
          max-width: 100%;
        }

        .axis-capabilities,
        .axis-recent {
          margin-top: 1.5rem;
        }

        .axis-section-heading {
          align-items: end;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
          margin-bottom: 0.85rem;
        }

        .axis-capabilities__grid {
          display: grid;
          gap: 0.8rem;
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .axis-capability-card,
        .axis-output-card {
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid var(--axis-line);
          border-radius: 1.15rem;
          min-width: 0;
        }

        .axis-capability-card {
          min-height: 11rem;
          padding: 1rem;
        }

        .axis-capability-card > div,
        .axis-output-card__top,
        .axis-output-card__meta {
          align-items: center;
          display: flex;
          gap: 0.55rem;
        }

        .axis-capability-card > div,
        .axis-output-card__top {
          justify-content: space-between;
        }

        .axis-capability-card span,
        .axis-output-card__icon {
          align-items: center;
          background: var(--axis-accent-soft);
          border: 1px solid rgba(216, 255, 122, 0.22);
          border-radius: 0.8rem;
          color: var(--axis-accent);
          display: inline-flex;
          height: 2.25rem;
          justify-content: center;
          width: 2.25rem;
        }

        .axis-capability-card small,
        .axis-output-card__type,
        .axis-output-card__status,
        .axis-output-card__meta {
          color: var(--axis-faint);
          font-size: 0.72rem;
          font-weight: 750;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .axis-capability-card h3,
        .axis-output-card h3 {
          font-size: 1rem;
          margin: 1.25rem 0 0.4rem;
        }

        .axis-capability-card p,
        .axis-output-card p {
          color: var(--axis-muted);
          font-size: 0.9rem;
          line-height: 1.45;
          margin: 0;
        }

        .axis-recent__grid {
          display: grid;
          gap: 0.8rem;
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .axis-output-card {
          display: grid;
          gap: 0.8rem;
          min-height: 12rem;
          padding: 1rem;
        }

        .axis-output-card--processing {
          border-color: rgba(216, 255, 122, 0.28);
        }

        .axis-output-card--failed {
          border-color: rgba(255, 124, 111, 0.28);
        }

        .axis-output-card--failed .axis-output-card__status {
          color: var(--axis-danger);
        }

        .axis-output-card__meta {
          align-self: end;
          justify-content: space-between;
        }

        .axis-activity-rail {
          display: grid;
          gap: 0.85rem;
          min-width: 0;
          position: sticky;
          top: 1rem;
        }

        .axis-rail-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--axis-line);
          border-radius: 1.15rem;
          padding: 1rem;
        }

        .axis-rail-card__heading {
          align-items: center;
          color: var(--axis-faint);
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.8rem;
        }

        .axis-rail-card__heading h2 {
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-rail-card > strong {
          display: block;
          font-size: 1rem;
          margin-bottom: 0.85rem;
        }

        .axis-rail-card dl {
          display: grid;
          gap: 0.6rem;
          margin: 0;
        }

        .axis-rail-card dl div {
          align-items: center;
          display: flex;
          justify-content: space-between;
        }

        .axis-rail-card dt,
        .axis-rail-card dd,
        .axis-rail-card li,
        .axis-activity-item p {
          color: var(--axis-muted);
          font-size: 0.82rem;
          margin: 0;
        }

        .axis-rail-card dd {
          color: var(--axis-ink);
          font-weight: 750;
        }

        .axis-activity-list {
          display: grid;
          gap: 0.75rem;
        }

        .axis-activity-item {
          display: grid;
          gap: 0.65rem;
          grid-template-columns: auto minmax(0, 1fr);
        }

        .axis-activity-item > span {
          background: var(--axis-accent);
          border-radius: 999px;
          height: 0.5rem;
          margin-top: 0.28rem;
          width: 0.5rem;
        }

        .axis-activity-item--processing > span {
          background: rgba(119, 151, 255, 0.95);
        }

        .axis-activity-item--failed > span {
          background: var(--axis-danger);
        }

        .axis-activity-item h3 {
          font-size: 0.9rem;
          margin: 0 0 0.22rem;
        }

        .axis-rail-card ul {
          display: grid;
          gap: 0.55rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .axis-rail-card li {
          align-items: center;
          display: flex;
          gap: 0.45rem;
        }

        @media (max-width: 1180px) {
          .axis-v2 {
            grid-template-columns: 5.25rem minmax(0, 1fr);
          }

          .axis-sidebar {
            padding: 1rem 0.7rem;
          }

          .axis-sidebar__brand {
            justify-content: center;
          }

          .axis-sidebar__brand div,
          .axis-sidebar__link span {
            display: none;
          }

          .axis-sidebar__link {
            justify-content: center;
            padding: 0;
          }

          .axis-capabilities__grid,
          .axis-recent__grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .axis-v2__body {
            grid-template-columns: minmax(0, 1fr);
          }

          .axis-activity-rail {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            position: static;
          }
        }

        @media (max-width: 760px) {
          .axis-v2 {
            display: block;
          }

          .axis-sidebar {
            border-bottom: 1px solid var(--axis-line);
            border-right: 0;
            min-height: 0;
            overflow-x: auto;
            padding: 0.75rem;
            position: static;
          }

          .axis-sidebar__brand {
            display: none;
          }

          .axis-sidebar nav {
            display: flex;
            min-width: max-content;
          }

          .axis-sidebar__link {
            min-width: 2.75rem;
          }

          .axis-v2__workspace {
            padding: 1rem 0.85rem 2rem;
          }

          .axis-topbar,
          .axis-hero,
          .axis-command__footer,
          .axis-section-heading,
          .axis-run-panel__steps {
            align-items: stretch;
            display: grid;
            grid-template-columns: 1fr;
          }

          .axis-topbar {
            gap: 0.8rem;
          }

          .axis-topbar__status,
          .axis-status-card {
            justify-self: start;
          }

          .axis-hero h2 {
            max-width: 12ch;
          }

          .axis-command__modes,
          .axis-suggestions {
            overflow-x: auto;
            padding-bottom: 0.15rem;
            scrollbar-width: thin;
            flex-wrap: nowrap;
          }

          .axis-command__modes button,
          .axis-suggestions button {
            white-space: nowrap;
          }

          .axis-command__send {
            justify-content: center;
            width: 100%;
          }

          .axis-capabilities__grid,
          .axis-recent__grid,
          .axis-activity-rail {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
