import type { AxisBuildOrderItem, AxisBuildScreen } from "../../lib/axis/types";

export function AxisBuildStep({
  item,
}: {
  item: AxisBuildOrderItem | AxisBuildScreen;
}) {
  const isOrderItem = "id" in item && typeof item.id === "number";

  return (
    <article className="axis-build-step">
      <span>{isOrderItem ? item.id : String(item.id).toUpperCase()}</span>
      <div>
        <h3>{item.title}</h3>
        {"items" in item && (
          <ul>
            {item.items.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
