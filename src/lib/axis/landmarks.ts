export type AxisLandmarkStatus = "required" | "optional" | "detected" | "missing" | "low-confidence";

export type AxisLandmarkRequirement = {
  id: string;
  label: string;
  status: AxisLandmarkStatus;
  confidence?: number;
};

export const axisLandmarkLabels: Record<string, string> = {
  hips: "Hips",
  knees: "Knees",
  ankles: "Ankles",
  feet: "Feet",
  toes: "Toes",
  heels: "Heels",
  shoulders: "Shoulders",
  elbows: "Elbows",
  wrists: "Wrists",
  arms: "Arms",
  ball: "Ball",
};

export function buildLandmarkRequirements(
  required: string[],
  optional: string[],
  detected: string[] = [],
  confidence: Record<string, number> = {},
): AxisLandmarkRequirement[] {
  const all = [...required, ...optional.filter((o) => !required.includes(o))];

  return all.map((id) => {
    const isRequired = required.includes(id);
    const isDetected = detected.includes(id);
    const conf = confidence[id];
    let status: AxisLandmarkStatus;

    if (!isDetected && isRequired) {
      status = "missing";
    } else if (!isDetected) {
      status = "optional";
    } else if (conf !== undefined && conf < 0.4) {
      status = "low-confidence";
    } else if (isDetected) {
      status = "detected";
    } else {
      status = isRequired ? "required" : "optional";
    }

    return {
      id,
      label: axisLandmarkLabels[id] ?? id,
      status,
      confidence: conf,
    };
  });
}
