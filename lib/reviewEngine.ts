// lib/reviewEngine.ts

import type { AxisEvent, AxisRead, AxisTeam } from "./engine/types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function opponent(team: AxisTeam): AxisTeam {
  return team === "HOME" ? "AWAY" : "HOME";
}

function teamLabel(team: AxisTeam) {
  return team;
}

export function buildReview(events: AxisEvent[]): AxisRead {
  const recent = events.slice(-8);
  const lastFour = events.slice(-4);
  const lastSix = events.slice(-6);

  let homeStress = 0;
  let awayStress = 0;

  recent.forEach((event, index) => {
    const age = recent.length - index - 1;
    const weight = Math.pow(0.92, age);

    if (event.value === 0) {
      if (event.team === "HOME") {
        homeStress += 14 * weight;
        awayStress -= 3 * weight;
      } else {
        awayStress += 14 * weight;
        homeStress -= 3 * weight;
      }
    } else {
      const other = opponent(event.team);
      const impact = event.value * 6 * weight;

      if (other === "HOME") {
        homeStress += impact;
        awayStress -= event.value * 3 * weight;
      } else {
        awayStress += impact;
        homeStress -= event.value * 3 * weight;
      }
    }
  });

  const pressure = {
    HOME: clamp(Math.round(homeStress), 0, 100),
    AWAY: clamp(Math.round(awayStress), 0, 100),
  };

  const control = {
    HOME: clamp(100 - pressure.HOME, 0, 100),
    AWAY: clamp(100 - pressure.AWAY, 0, 100),
  };

  const homeScores = lastFour.filter(
    (event) => event.team === "HOME" && event.value > 0
  ).length;

  const awayScores = lastFour.filter(
    (event) => event.team === "AWAY" && event.value > 0
  ).length;

  const homeEmpty = lastFour.filter(
    (event) => event.team === "HOME" && event.value === 0
  ).length;

  const awayEmpty = lastFour.filter(
    (event) => event.team === "AWAY" && event.value === 0
  ).length;

  const homePoints = lastSix
    .filter((event) => event.team === "HOME")
    .reduce((sum, event) => sum + event.value, 0);

  const awayPoints = lastSix
    .filter((event) => event.team === "AWAY")
    .reduce((sum, event) => sum + event.value, 0);

  const homePossessions = lastSix.filter((event) => event.team === "HOME").length;
  const awayPossessions = lastSix.filter((event) => event.team === "AWAY").length;

  const homeScoringRate =
    homePossessions === 0 ? 0 : Math.round((homeScores / homePossessions) * 100);

  const awayScoringRate =
    awayPossessions === 0 ? 0 : Math.round((awayScores / awayPossessions) * 100);

  const evidence: string[] = [];
  const memory: string[] = [];

  let headline = "GAME FLOW STABLE";
  let state = "STABLE";

  const stressedTeam: AxisTeam =
    pressure.HOME >= pressure.AWAY ? "HOME" : "AWAY";

  const controllingTeam: AxisTeam = opponent(stressedTeam);

  if (pressure[stressedTeam] >= 75) {
    state = "COLLAPSING";
    headline = `${teamLabel(stressedTeam)} LOSING CONTROL`;
  } else if (pressure[stressedTeam] >= 55) {
    state = "UNSTABLE";
    headline = `${teamLabel(stressedTeam)} STRUGGLING TO STABILIZE`;
  } else if (pressure[stressedTeam] >= 35) {
    state = "BUILDING";
    headline = `${teamLabel(controllingTeam)} CONTROL RISING`;
  }

  if (homePoints > awayPoints) {
    evidence.push(`HOME ${homePoints}-${awayPoints} EDGE LAST 6`);
  }

  if (awayPoints > homePoints) {
    evidence.push(`AWAY ${awayPoints}-${homePoints} EDGE LAST 6`);
  }

  if (homeScores >= 3) {
    evidence.push("HOME SCORED 3 OF LAST 4");
    memory.push("HOME CONTROLLING RHYTHM");
  }

  if (awayScores >= 3) {
    evidence.push("AWAY SCORED 3 OF LAST 4");
    memory.push("AWAY CONTROLLING RHYTHM");
  }

  if (homeEmpty >= 2) {
    evidence.push("HOME EMPTY ON 2+ RECENT TRIPS");
    memory.push("HOME LOSING STABILITY");
  }

  if (awayEmpty >= 2) {
    evidence.push("AWAY EMPTY ON 2+ RECENT TRIPS");
    memory.push("AWAY LOSING STABILITY");
  }

  if (homeScoringRate > 0) {
    evidence.push(`HOME ${homeScoringRate}% SCORE RATE`);
  }

  if (awayScoringRate > 0) {
    evidence.push(`AWAY ${awayScoringRate}% SCORE RATE`);
  }

  if (evidence.length === 0) {
    evidence.push("NO CLEAR SEPARATION YET");
  }

  if (memory.length === 0) {
    memory.push("GAME FLOW STABLE");
  }

  return {
    state,
    headline,
    evidence: evidence.slice(0, 3),
    pressure,
    control,
    memory,
  };
}