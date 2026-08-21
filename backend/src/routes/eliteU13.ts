import { Router } from "express";
import { requireAuth } from "../auth.js";

/**
 * hailafotbal.ro (the Romanian Football Federation's youth-league site) is a client-side
 * Angular app with no public API docs -- this reverse-engineers the same calls its own
 * frontend makes (found by inspecting its network traffic) to read the same public match
 * data any visitor's browser already sees. The credentials below are the app's own public
 * read-only service account, embedded in its shipped JS bundle -- not a private secret.
 */
const FRF_API = "https://api.datalake.frf.ro";
const FRF_USER = "HaiLaFotbal";
const FRF_PASSWORD = "g2NmJb'{C/x#DqU[8cn57u";

// Liga Elitelor U13, 2026-2027, Sezon Regular, Seria 1 -- fixed IDs found by inspecting the
// site while browsing to this team's series. If FRF starts a new season/series, these will
// need updating (there's no way to look them up generically without the site's own filters).
const SEASON_ID = 11;
const COMPETITION_ID = "7768a9cf-beb2-4a1b-8b85-28f5a913a941";
const STAGE_ID = "48ba137b-b825-4822-a0bf-bbce1d49f0d9";
const SERIES_ID = "ec1c50ea-97f5-4d85-9f1c-facf1d959b5e";
const TEAM_NAME = "Workit Sports";

interface FrfTourRound {
  tourRoundId: string;
  seriesId: string;
  stageId: string;
  // tourNo is which "circuit" through every opponent this is (1st time round, 2nd, ...) --
  // NOT the sequential round/week number a human means by "round 7". That's orderdisplay.
  orderdisplay: number;
}

interface FrfClub {
  name: string;
}

interface FrfStadium {
  name: string;
  town: string;
}

interface FrfMatch {
  matchId: string;
  startDate: string;
  homeGoals: number | null;
  awayGoals: number | null;
  sysCompetitionMatchStatusId: number | null;
  homeClub: FrfClub | null;
  awayClub: FrfClub | null;
  stadium: FrfStadium | null;
}

export interface EliteU13Match {
  matchId: string;
  round: number;
  date: string;
  home: string;
  away: string;
  homeGoals: number | null;
  awayGoals: number | null;
  played: boolean;
  stadium: string | null;
  town: string | null;
}

// GetMatchSheets returns per-match lineup/staff sheets, keyed by matchId. Unlike every other
// FRF endpoint here, its response is the raw object itself (no {hasErrors, responseData}
// wrapper), and it 500s with a plain-text body -- not JSON -- until 75 minutes before kickoff.
interface FrfPlayer {
  firstName: string;
  lastName: string;
  shirtNo: number;
  isTeamCaptainYn: boolean;
  playerPosition: string;
}
interface FrfStaffPerson {
  name: string;
  category: string;
}
interface FrfMatchSheetClub {
  club: { name: string } | null;
  players: { players: { player: FrfPlayer }[] } | null;
  reserves: { players: { player: FrfPlayer }[] } | null;
  reservesExtra: { players: { player: FrfPlayer }[] } | null;
  staff: { staffPersons: { staffPerson: FrfStaffPerson }[] } | null;
  extraStaff: { staffPersons: { staffPerson: FrfStaffPerson }[] } | null;
}
interface FrfMatchSheet {
  homeClub: FrfMatchSheetClub;
  awayClub: FrfMatchSheetClub;
}

export interface MatchSheetPlayer {
  name: string;
  shirtNo: number;
  captain: boolean;
  position: string;
}
export interface MatchSheetStaff {
  name: string;
  role: string;
}
export interface MatchSheetClub {
  name: string;
  starters: MatchSheetPlayer[];
  reserves: MatchSheetPlayer[];
  staff: MatchSheetStaff[];
}
export interface EliteU13MatchSheet {
  home: MatchSheetClub;
  away: MatchSheetClub;
}

// Cached separately from the schedule itself since a token's own lifetime is much shorter
// than how often the match schedule realistically changes.
let cachedToken: { value: string; fetchedAt: number } | null = null;
const TOKEN_TTL_MS = 20 * 60 * 1000;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() - cachedToken.fetchedAt < TOKEN_TTL_MS) return cachedToken.value;
  const res = await fetch(`${FRF_API}/Auth/GetToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiUser: FRF_USER, apiPassword: FRF_PASSWORD }),
  });
  if (!res.ok) throw new Error(`FRF auth failed: ${res.status}`);
  const data = (await res.json()) as { token: string };
  cachedToken = { value: data.token, fetchedAt: Date.now() };
  return data.token;
}

async function frfPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${FRF_API}/HaiLaFotbal/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`FRF API ${path} failed: ${res.status}`);
  const json = (await res.json()) as { hasErrors: boolean; erorrMessages: string[]; responseData: T };
  if (json.hasErrors) throw new Error(`FRF API ${path} returned errors: ${JSON.stringify(json.erorrMessages)}`);
  return json.responseData;
}

let cachedSchedule: { data: EliteU13Match[]; fetchedAt: number } | null = null;
const SCHEDULE_TTL_MS = 60 * 60 * 1000;

async function fetchEliteU13Schedule(): Promise<EliteU13Match[]> {
  if (cachedSchedule && Date.now() - cachedSchedule.fetchedAt < SCHEDULE_TTL_MS) return cachedSchedule.data;

  // Get a token up front rather than letting every parallel round request race to fetch its
  // own -- getToken() already caches, but a herd of simultaneous first calls would otherwise
  // all miss the cache at once and hit FRF's auth endpoint N times over.
  await getToken();

  const allRounds = await frfPost<FrfTourRound[]>("GetCompetitionStageSeriesTourRounds", {});
  const ourRounds = allRounds.filter((r) => r.seriesId === SERIES_ID && r.stageId === STAGE_ID);

  // One round's fetch doesn't depend on another's -- run them concurrently instead of one
  // at a time, since sequential awaits over ~25+ rounds made this take well over a minute.
  const perRound = await Promise.all(
    ourRounds.map(async (round) => {
      const data = await frfPost<{ matches: { list: FrfMatch[] }[] }>("GetMatches", {
        SeasonId: SEASON_ID,
        CompetitionId: COMPETITION_ID,
        StageId: STAGE_ID,
        SeriesId: SERIES_ID,
        TourRoundId: round.tourRoundId,
      });
      const found: EliteU13Match[] = [];
      for (const day of data.matches ?? []) {
        for (const m of day.list ?? []) {
          const home = m.homeClub?.name ?? "";
          const away = m.awayClub?.name ?? "";
          if (home.includes(TEAM_NAME) || away.includes(TEAM_NAME)) {
            found.push({
              matchId: m.matchId,
              round: round.orderdisplay,
              date: m.startDate,
              home,
              away,
              homeGoals: m.homeGoals,
              awayGoals: m.awayGoals,
              played: m.sysCompetitionMatchStatusId === 3,
              stadium: m.stadium?.name ?? null,
              town: m.stadium?.town ?? null,
            });
          }
        }
      }
      return found;
    })
  );

  const matches = perRound.flat();
  matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  cachedSchedule = { data: matches, fetchedAt: Date.now() };
  return matches;
}

function cleanPlayers(list: { player: FrfPlayer }[] | undefined): MatchSheetPlayer[] {
  return (list ?? []).map(({ player }) => ({
    name: `${player.firstName} ${player.lastName}`.trim(),
    shirtNo: player.shirtNo,
    captain: player.isTeamCaptainYn,
    position: player.playerPosition,
  }));
}

function cleanStaff(list: { staffPerson: FrfStaffPerson }[] | undefined): MatchSheetStaff[] {
  return (list ?? []).map(({ staffPerson }) => ({ name: staffPerson.name, role: staffPerson.category }));
}

function cleanClub(club: FrfMatchSheetClub): MatchSheetClub {
  return {
    name: club.club?.name ?? "",
    starters: cleanPlayers(club.players?.players),
    reserves: [...cleanPlayers(club.reserves?.players), ...cleanPlayers(club.reservesExtra?.players)],
    staff: [...cleanStaff(club.staff?.staffPersons), ...cleanStaff(club.extraStaff?.staffPersons)],
  };
}

// Sheets for played matches never change, and unplayed ones simply aren't available until
// shortly before kickoff (see the 500 handling below) -- either way there's no reason to
// re-fetch a successfully-retrieved sheet, so unlike the schedule cache this one has no TTL.
const sheetCache = new Map<string, EliteU13MatchSheet>();

async function fetchMatchSheet(matchId: string): Promise<EliteU13MatchSheet> {
  const cached = sheetCache.get(matchId);
  if (cached) return cached;

  const token = await getToken();
  const res = await fetch(`${FRF_API}/HaiLaFotbal/GetMatchSheets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ MatchId: matchId }),
  });
  if (!res.ok) {
    throw new Error(`Match sheet not available for ${matchId}: ${res.status}`);
  }
  const sheet = (await res.json()) as FrfMatchSheet;
  const cleaned: EliteU13MatchSheet = { home: cleanClub(sheet.homeClub), away: cleanClub(sheet.awayClub) };
  sheetCache.set(matchId, cleaned);
  return cleaned;
}

export const eliteU13Router = Router();
eliteU13Router.use(requireAuth);

eliteU13Router.get("/schedule", async (_req, res) => {
  try {
    const matches = await fetchEliteU13Schedule();
    res.json({ team: TEAM_NAME, matches });
  } catch (err) {
    console.error("Failed to fetch Elite U13 schedule from hailafotbal.ro", err);
    res.status(502).json({ error: "Could not fetch the schedule from hailafotbal.ro right now" });
  }
});

eliteU13Router.get("/match/:matchId/sheet", async (req, res) => {
  try {
    const sheet = await fetchMatchSheet(req.params.matchId);
    res.json(sheet);
  } catch {
    res.status(502).json({ error: "Lineup not available for this match yet" });
  }
});
