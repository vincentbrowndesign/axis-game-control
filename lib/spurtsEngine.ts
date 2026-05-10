export type Team = "HOME" | "AWAY";

export type Outcome =
  | "1PT"
  | "2PT"
  | "3PT"
  | "EMPTY"
  | "TURNOVER"
  | "FOUL";

export type Possession = {
  id: number;
  quarter: number;
  team: Team;
  outcome: Outcome;
  points: number;
  homeScore: number;
  awayScore: number;
};

export type Spurt = {
  team: Team;
  points: number;
  opponentPoints: number;
};

export function outcomePoints(outcome: Outcome) {
  switch (outcome) {
    case "1PT":
      return 1;
    case "2PT":
      return 2;
    case "3PT":
      return 3;
    default:
      return 0;
  }
}

export function nextTeam(team: Team): Team {
  return team === "HOME" ? "AWAY" : "HOME";
}

export function calculateSpurt(
  possessions: Possession[]
): Spurt | null {
  if (possessions.length === 0) return null;

  const recent = [...possessions].reverse();

  let activeTeam: Team | null = null;
  let teamPoints = 0;
  let opponentPoints = 0;

  for (const possession of recent) {
    if (possession.points === 0) continue;

    if (!activeTeam) {
      activeTeam = possession.team;
    }

    if (possession.team === activeTeam) {
      teamPoints += possession.points;
    } else {
      opponentPoints += possession.points;

      if (opponentPoints >= 4) break;
    }
  }

  if (!activeTeam) return null;

  if (teamPoints < 6) return null;

  return {
    team: activeTeam,
    points: teamPoints,
    opponentPoints,
  };
}

export function getGameState({
  homeScore,
  awayScore,
  possessions,
  spurt,
}: {
  homeScore: number;
  awayScore: number;
  possessions: Possession[];
  spurt: Spurt | null;
}) {
  const diff = Math.abs(homeScore - awayScore);

  const total = homeScore + awayScore;

  if (spurt && spurt.points >= 14) {
    return `${spurt.team} BREAKING GAME`;
  }

  if (spurt && spurt.points >= 10) {
    return `${spurt.team} DOMINATING`;
  }

  if (spurt && spurt.points >= 7) {
    return `${spurt.team} SURGING`;
  }

  if (diff <= 3 && total >= 30) {
    return "PRESSURE BUILDING";
  }

  if (diff <= 6 && total >= 45) {
    return "TENSION RISING";
  }

  if (diff >= 18 && total >= 40) {
    return "CONTROLLED GAME";
  }

  if (possessions.length <= 6) {
    return "FEELING OUT";
  }

  return "NO ACTIVE SPURT";
}

export function getAtmosphere({
  homeScore,
  awayScore,
  spurt,
}: {
  homeScore: number;
  awayScore: number;
  spurt: Spurt | null;
}) {
  const diff = Math.abs(homeScore - awayScore);

  const total = homeScore + awayScore;

  const closeGame =
    diff <= 4 && total >= 24;

  const pressureGame =
    diff <= 2 && total >= 40;

  const dominant =
    !!spurt && spurt.points >= 10;

  const gameBreaking =
    !!spurt && spurt.points >= 14;

  return {
    closeGame,
    pressureGame,
    dominant,
    gameBreaking,
  };
}