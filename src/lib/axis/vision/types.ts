export type AxisVisionDatasetGroup =
  | "Public Baselines"
  | "Tracking / Pose"
  | "Basketball-Specific Vision"
  | "Axis Private Datasets"
  | "Memory / Correction Datasets";

export type AxisVisionDatasetSource = "axis-private" | "huggingface" | "manual-review" | "public";

export type AxisVisionDatasetSourceType = "public" | "private";

export type AxisVisionDatasetStatus =
  | "candidate"
  | "raw"
  | "sampled"
  | "mapped"
  | "prepared"
  | "trained"
  | "tested"
  | "active"
  | "retired";

export type AxisVisionDatasetPriority = "low" | "medium" | "high";

export type AxisVisionDatasetTag = "vision" | "tracking" | "pose" | "memory";

export type AxisVisionDataset = {
  id: string;
  name: string;
  group: AxisVisionDatasetGroup;
  source: AxisVisionDatasetSource;
  sourceType: AxisVisionDatasetSourceType;
  datasetId: string;
  purpose: string;
  usefulFor: string[];
  axisUse: string;
  status: AxisVisionDatasetStatus;
  priority: AxisVisionDatasetPriority;
  tags: AxisVisionDatasetTag[];
};
