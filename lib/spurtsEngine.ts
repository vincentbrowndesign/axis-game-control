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

export type GameState =
  | "FEELING_OUT"
  | "PRESSURE_BUILDING"
  | "SURGING"
  | "TAKING_CONTROL"
  | "DOMINATING"
  | "BREAKING_GAME"
  | "CONTROLLED_GAME"
  | "TENSION_RISING";

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
  return team === "HOME"
    ? "AWAY"
    : "HOME";
}

export function calculateSpurt(
  possessions: Possession[]
): Spurt | null {
  if (possessions.length === 0) {
    return null;
  }

  const recent = [...possessions].reverse();

  let activeTeam: Team | null = null;

  let teamPoints = 0;

  let opponentPoints = 0;

  for (const possession of recent) {
    if (possession.points === 0) {
      continue;
    }

    if (!activeTeam) {
      activeTeam = possession.team;
    }

    if (possession.team === activeTeam) {
      teamPoints += possession.points;
    } else {
      opponentPoints += possession.points;

      if (opponentPoints >= 4) {
        break;
      }
    }
  }

  if (!activeTeam) {
    return null;
  }

  if (teamPoints < 6) {
    return null;
  }

  return {
    team: activeTeam,
    points: teamPoints,
    opponentPoints,
  };
}

export function getStateLabel(
  state: GameState,
  spurt: Spurt | null
) {
  switch (state) {
    case "FEELING_OUT":
      return "FEELING OUT";

    case "PRESSURE_BUILDING":
      return "PRESSURE BUILDING";

    case "SURGING":
      return `${spurt?.team} SURGING`;

    case "TAKING_CONTROL":
      return `${spurt?.team} TAKING CONTROL`;

    case "DOMINATING":
      return `${spurt?.team} DOMINATING`;

    case "BREAKING_GAME":
      return `${spurt?.team} BREAKING GAME`;

    case "CONTROLLED_GAME":
      return "CONTROLLED GAME";

    case "TENSION_RISING":
      return "TENSION RISING";

    default:
      return "NO ACTIVE SPURT";
  }
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
}): GameState {
  const diff = Math.abs(
    homeScore - awayScore
  );

  const total = homeScore + awayScore;

  if (possessions.length <= 6) {
    return "FEELING_OUT";
  }

  if (spurt) {
    if (spurt.points >= 14) {
      return "BREAKING_GAME";
    }

    if (spurt.points >= 11) {
      return "DOMINATING";
    }

    if (spurt.points >= 8) {
      return "TAKING_CONTROL";
    }

    if (spurt.points >= 6) {
      return "SURGING";
    }
  }

  if (diff <= 2 && total >= 40) {
    return "PRESSURE_BUILDING";
  }

  if (diff <= 5 && total >= 55) {
    return "TENSION_RISING";
  }

  if (diff >= 18 && total >= 45) {
    return "CONTROLLED_GAME";
  }

  return "TENSION_RISING";
}

export function getAtmosphere({
  spurt,
  state,
}: {
  spurt: Spurt | null;
  state: GameState;
}) {
  return {
    dominant:
      state === "DOMINATING" ||
      state === "BREAKING_GAME",

    pressure:
      state === "PRESSURE_BUILDING",

    takingControl:
      state === "TAKING_CONTROL",

    surging:
      state === "SURGING",

    controlled:
      state === "CONTROLLED_GAME",

    gameBreaking:
      state === "BREAKING_GAME",

    activeTeam: spurt?.team ?? null,
  };
}

export function getGameMemory(
  possessions: Possession[],
  spurt: Spurt | null
) {
  const lastFive = possessions
    .slice(-5)
    .map((possession) => possession.outcome);

  const emptyCount = lastFive.filter(
    (outcome) =>
      outcome === "EMPTY" ||
      outcome === "TURNOVER"
  ).length;

  if (emptyCount >= 4) {
    return "OFFENSE COLLAPSING";
  }

  if (spurt?.points && spurt.points >= 12) {
    return `${spurt.team} CONTROLLING FLOW`;
  }

  if (spurt?.points && spurt.points >= 8) {
    return `${spurt.team} APPLYING PRESSURE`;
  }

  return "GAME STABLE";
}