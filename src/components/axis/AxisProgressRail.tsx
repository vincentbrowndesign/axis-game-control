import type { AxisBuildOrderItem } from "../../lib/axis/types";
import { AxisBuildStep } from "./AxisBuildStep";

export function AxisProgressRail({ items }: { items: AxisBuildOrderItem[] }) {
  return (
    <section className="axis-map-section" aria-labelledby="axis-build-order-title">
      <div className="axis-map-section__heading">
        <p>Section 5</p>
        <h2 id="axis-build-order-title">Build Order</h2>
      </div>
      <div className="axis-progress-rail">
        {items.map((item) => (
          <AxisBuildStep item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}
