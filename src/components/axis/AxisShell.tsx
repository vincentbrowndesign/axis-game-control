import { AXIS_UI_V2_ENABLED } from "../../lib/axis/client";
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
      <h1>Axis</h1>
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

        .axis-blank h1 {
          font-size: clamp(1.8rem, 5vw, 3.5rem);
          font-weight: 650;
          letter-spacing: -0.04em;
          margin: 0;
        }
      `}</style>
    </main>
  );
}
