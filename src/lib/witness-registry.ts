import type { Modality, WitnessDimension } from "./axis-core";

interface WitnessAdapter {
  modality: Modality;
  dimensions: WitnessDimension[]; // ["*"] = can witness any dimension
  observe(): void;
}

const adapters: WitnessAdapter[] = [
  {
    modality: "camera",
    dimensions: ["gaze", "body_position", "footwork", "spacing", "dribble_count"],
    observe() {},
  },
  {
    modality: "coach",
    dimensions: ["*"],
    observe() {},
  },
  {
    modality: "voice",
    dimensions: ["intent", "observation", "report"],
    observe() {},
  },
  {
    modality: "wearable",
    dimensions: ["heart_rate", "speed", "acceleration", "contact"],
    observe() {},
  },
  {
    modality: "surface",
    dimensions: ["touch", "pressure", "position"],
    observe() {},
  },
  {
    modality: "file",
    dimensions: ["frame", "video", "audio"],
    observe() {},
  },
  {
    modality: "research",
    dimensions: ["*"],
    observe() {},
  },
];

export function canWitness(modality: Modality, dimension: WitnessDimension): boolean {
  const adapter = adapters.find((a) => a.modality === modality);
  if (!adapter) return false;
  if (adapter.dimensions.includes("*")) return true;
  return adapter.dimensions.includes(dimension);
}
