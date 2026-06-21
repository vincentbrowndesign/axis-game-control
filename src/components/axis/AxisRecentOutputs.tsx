import type { AxisOutput } from "../../lib/axis/types";
import { AxisOutputCard } from "./AxisOutputCard";

export function AxisRecentOutputs({ outputs }: { outputs: AxisOutput[] }) {
  return (
    <section className="axis-recent" aria-labelledby="axis-recent-title">
      <div className="axis-section-heading">
        <p>Recent Outputs</p>
        <h2 id="axis-recent-title">Everything Axis returns lands here</h2>
      </div>
      <div className="axis-recent__grid">
        {outputs.map((output) => (
          <AxisOutputCard output={output} key={output.id} />
        ))}
      </div>
    </section>
  );
}
