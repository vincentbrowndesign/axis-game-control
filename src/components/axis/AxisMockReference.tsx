import type { AxisBuildScreen } from "../../lib/axis/types";
import { AxisBuildStep } from "./AxisBuildStep";

export function AxisMockReference({ screens }: { screens: AxisBuildScreen[] }) {
  return (
    <section className="axis-map-section" aria-labelledby="axis-screens-title">
      <div className="axis-map-section__heading">
        <p>Section 3</p>
        <h2 id="axis-screens-title">Screens To Build From The Mock</h2>
      </div>
      <div className="axis-screen-grid">
        {screens.map((screen) => (
          <AxisBuildStep item={screen} key={screen.id} />
        ))}
      </div>
    </section>
  );
}
