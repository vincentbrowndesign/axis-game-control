import type { Modality, WitnessDimension } from "./axis-core";
import { canWitness } from "./witness-registry";

const MODALITIES: Modality[] = ["camera", "coach", "voice", "surface", "wearable", "file", "research"];

export interface Experiment {
  id: string;
  constraint: string;
  hypothesis: string;
  dimensions: WitnessDimension[];
  duration_seconds: number;
}

const registry = new Map<string, Experiment>();

export function register(experiment: Experiment): void {
  registry.set(experiment.id, experiment);
}

export function get(id: string): Experiment | undefined {
  return registry.get(id);
}

export function canRun(id: string): boolean {
  const experiment = registry.get(id);
  if (!experiment) return false;
  return experiment.dimensions.every((dimension) =>
    MODALITIES.some((modality) => canWitness(modality, dimension))
  );
}
