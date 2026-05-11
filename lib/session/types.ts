import { SpurtsEvent } from "../events/eventTypes";

export type SpurtsSession = {
  id: string;

  homeTeam: string;
  awayTeam: string;

  createdAt: number;

  events: SpurtsEvent[];
};