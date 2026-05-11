import { ParsedScoreboard } from "./scoreboardTypes";

export async function parseScoreboard(): Promise<ParsedScoreboard> {
  return {
    period: "Q2",
    clock: "4:11",
    homeScore: 42,
    awayScore: 38,
    confidence: 0.91,
  };
}