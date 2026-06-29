type NbaResultSet = {
  name?: string;
  headers: string[];
  rowSet: unknown[][];
};

type NbaStatsResponse = {
  resultSets?: NbaResultSet[];
  resultSet?: NbaResultSet;
};

export type NbaPlayerSearchResult = {
  id: number;
  fullName: string;
  firstName?: string;
  lastName?: string;
  teamId?: number;
  teamCity?: string;
  teamName?: string;
  rosterStatus?: string;
};

export type NbaPlayerProfile = {
  id: number;
  fullName: string;
  birthdate?: string;
  school?: string;
  country?: string;
  height?: string;
  weight?: string;
  seasonExp?: number;
  position?: string;
  rosterStatus?: string;
  teamId?: number;
  teamName?: string;
};

export type NbaTeamInfo = {
  id: number;
  city?: string;
  name?: string;
  abbreviation?: string;
  conference?: string;
  division?: string;
};

export type NbaGameLog = {
  gameId: string;
  gameDate?: string;
  matchup?: string;
  result?: string;
  minutes?: number;
  points?: number;
  rebounds?: number;
  assists?: number;
};

export type NbaPlayerStats = {
  playerId: number;
  seasons: Record<string, unknown>[];
  careerTotals: Record<string, unknown>[];
};

const NBA_STATS_BASE_URL = "https://stats.nba.com/stats";

function currentNbaSeason() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const startYear = month >= 10 ? year : year - 1;
  const endYear = String(startYear + 1).slice(-2);
  return `${startYear}-${endYear}`;
}

async function fetchNbaStats(endpoint: string, params: Record<string, string | number>) {
  const url = new URL(`${NBA_STATS_BASE_URL}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      Connection: "keep-alive",
      Origin: "https://www.nba.com",
      Referer: "https://www.nba.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
      "x-nba-stats-origin": "stats",
      "x-nba-stats-token": "true",
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`NBA_STATS_REQUEST_FAILED_${response.status}`);
  }

  return (await response.json()) as NbaStatsResponse;
}

function resultSets(payload: NbaStatsResponse) {
  if (payload.resultSets) return payload.resultSets;
  if (payload.resultSet) return [payload.resultSet];
  return [];
}

function rowsToObjects(resultSet?: NbaResultSet) {
  if (!resultSet) return [];

  return resultSet.rowSet.map((row) => {
    const item: Record<string, unknown> = {};
    resultSet.headers.forEach((header, index) => {
      item[header] = row[index];
    });
    return item;
  });
}

function pickResultSet(payload: NbaStatsResponse, name: string) {
  return resultSets(payload).find((set) => set.name === name) || resultSets(payload)[0];
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export async function searchPlayers(query: string): Promise<NbaPlayerSearchResult[]> {
  const search = query.trim().toLowerCase();
  if (!search) return [];

  const payload = await fetchNbaStats("commonallplayers", {
    LeagueID: "00",
    Season: currentNbaSeason(),
    IsOnlyCurrentSeason: 0,
  });
  const rows = rowsToObjects(pickResultSet(payload, "CommonAllPlayers"));

  return rows
    .filter((row) => String(row.DISPLAY_FIRST_LAST || "").toLowerCase().includes(search))
    .slice(0, 12)
    .map((row) => ({
      id: Number(row.PERSON_ID),
      fullName: String(row.DISPLAY_FIRST_LAST || ""),
      firstName: stringValue(row.DISPLAY_FIRST_LAST)?.split(" ")[0],
      lastName: stringValue(row.DISPLAY_LAST_COMMA_FIRST),
      teamId: numberValue(row.TEAM_ID),
      teamCity: stringValue(row.TEAM_CITY),
      teamName: stringValue(row.TEAM_NAME),
      rosterStatus: stringValue(row.ROSTERSTATUS),
    }));
}

export async function getPlayerProfile(playerId: string | number): Promise<NbaPlayerProfile | null> {
  const payload = await fetchNbaStats("commonplayerinfo", {
    PlayerID: playerId,
  });
  const [row] = rowsToObjects(pickResultSet(payload, "CommonPlayerInfo"));
  if (!row) return null;

  return {
    id: Number(row.PERSON_ID),
    fullName: String(row.DISPLAY_FIRST_LAST || ""),
    birthdate: stringValue(row.BIRTHDATE),
    school: stringValue(row.SCHOOL),
    country: stringValue(row.COUNTRY),
    height: stringValue(row.HEIGHT),
    weight: stringValue(row.WEIGHT),
    seasonExp: numberValue(row.SEASON_EXP),
    position: stringValue(row.POSITION),
    rosterStatus: stringValue(row.ROSTERSTATUS),
    teamId: numberValue(row.TEAM_ID),
    teamName: stringValue(row.TEAM_NAME),
  };
}

export async function getTeamInfo(teamId: string | number): Promise<NbaTeamInfo | null> {
  const payload = await fetchNbaStats("teaminfocommon", {
    TeamID: teamId,
    LeagueID: "00",
    SeasonType: "Regular Season",
    Season: currentNbaSeason(),
  });
  const [row] = rowsToObjects(pickResultSet(payload, "TeamInfoCommon"));
  if (!row) return null;

  return {
    id: Number(row.TEAM_ID),
    city: stringValue(row.TEAM_CITY),
    name: stringValue(row.TEAM_NAME),
    abbreviation: stringValue(row.TEAM_ABBREVIATION),
    conference: stringValue(row.TEAM_CONFERENCE),
    division: stringValue(row.TEAM_DIVISION),
  };
}

export async function getRecentGames(playerId: string | number): Promise<NbaGameLog[]> {
  const payload = await fetchNbaStats("playergamelog", {
    PlayerID: playerId,
    Season: currentNbaSeason(),
    SeasonType: "Regular Season",
  });
  const rows = rowsToObjects(pickResultSet(payload, "PlayerGameLog"));

  return rows.slice(0, 8).map((row) => ({
    gameId: String(row.Game_ID || row.GAME_ID || ""),
    gameDate: stringValue(row.GAME_DATE),
    matchup: stringValue(row.MATCHUP),
    result: stringValue(row.WL),
    minutes: numberValue(row.MIN),
    points: numberValue(row.PTS),
    rebounds: numberValue(row.REB),
    assists: numberValue(row.AST),
  }));
}

export async function getPlayerStats(playerId: string | number): Promise<NbaPlayerStats> {
  const payload = await fetchNbaStats("playercareerstats", {
    PlayerID: playerId,
    PerMode: "PerGame",
  });

  return {
    playerId: Number(playerId),
    seasons: rowsToObjects(pickResultSet(payload, "SeasonTotalsRegularSeason")),
    careerTotals: rowsToObjects(pickResultSet(payload, "CareerTotalsRegularSeason")),
  };
}
