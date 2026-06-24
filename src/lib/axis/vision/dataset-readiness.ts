import type { AxisVisionDataset, AxisVisionDatasetStatus } from "./types";

export const axisDatasetReadinessWarning =
  "Do not mark a dataset active just because it improves raw detection. Axis needs session memory value.";

export const axisDatasetReadinessLevels: Record<AxisVisionDatasetStatus, string> = {
  active: "dataset contributes to an active Axis Vision capability.",
  candidate: "dataset might be useful, but not added to the pipeline yet.",
  mapped: "labels are mapped to Axis label groups.",
  prepared: "data is ready for training or testing.",
  raw: "dataset is registered but not mapped to Axis labels.",
  retired: "dataset is no longer useful.",
  sampled: "a small sample was reviewed.",
  tested: "output was tested against Axis memory needs.",
  trained: "a model was trained using this dataset.",
};

const activeMemorySignals = ["searchable memory", "useful evidence", "correction learning", "next-session planning"];

export function getDatasetReadinessSummary(dataset: AxisVisionDataset) {
  const helpsMemoryValue = activeMemorySignals.some((signal) => dataset.axisUse.toLowerCase().includes(signal));
  const activeAllowed = dataset.status !== "active" || helpsMemoryValue;

  return {
    activeAllowed,
    isReady: dataset.status === "prepared"
      || dataset.status === "trained"
      || dataset.status === "tested"
      || dataset.status === "active",
    level: dataset.status,
    meaning: axisDatasetReadinessLevels[dataset.status],
    warning: dataset.status === "active" && !helpsMemoryValue ? axisDatasetReadinessWarning : undefined,
  };
}
