import { AXIS_UI_V2_ENABLED } from "../../lib/axis/client";
import Link from "next/link";
import { AxisCommandComposer } from "./AxisCommandComposer";
import { AxisOutputSurface } from "./AxisOutputSurface";
import { AxisSidebar } from "./AxisSidebar";
import { AxisStatus } from "./AxisStatus";

export function AxisShell() {
  return (
    <main className="axis-blank" data-axis-ui-v2={AXIS_UI_V2_ENABLED ? "true" : "false"}>
      <AxisSidebar />
      <AxisStatus />
      <AxisOutputSurface />
      <AxisCommandComposer />
      <section className="axis-blank__identity" aria-label="Axis entry">
        <h1>AXIS <span>9</span></h1>
        <Link href="/axis/build-map">Open Build Map</Link>
      </section>
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

        .axis-blank,
        .axis-blank * {
          box-sizing: border-box;
        }

        .axis-blank {
          align-items: center;
          background: #050608;
          color: #f4f1ea;
          display: flex;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          justify-content: center;
          min-height: 100dvh;
          width: 100%;
        }

        .axis-blank__identity {
          display: grid;
          gap: 1rem;
          justify-items: center;
        }

        .axis-blank h1 {
          font-size: clamp(1.8rem, 5vw, 3.5rem);
          font-weight: 850;
          letter-spacing: -0.04em;
          margin: 0;
        }

        .axis-blank h1 span {
          color: #8d42ff;
        }

        .axis-blank a {
          border: 1px solid rgba(141, 66, 255, 0.55);
          border-radius: 999px;
          color: #f4f1ea;
          font-size: 0.88rem;
          padding: 0.7rem 1rem;
          text-decoration: none;
        }
      `}</style>
    </main>
  );
}
