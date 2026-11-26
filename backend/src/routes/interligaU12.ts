import { Router } from "express";
import { requireAuth } from "../auth.js";
import { addMinutes, syncAlbertCalendar } from "../albertCalendar.js";
import { getToken, frfPost, type FrfTourRound, type FrfMatch } from "../frfApi.js";

// Interliga de iarnă U12 (winter indoor league), 2026-2027, Sezon Regular, Seria 1 -- fixed IDs
// found the same way as Elite U13's (see frfApi.ts): calling GetCompetitions/GetCompetitionStages/
// GetCompetitionstageSeries directly and scanning each series' first round for a Workit match,
// since the site has no generic lookup by team name. If FRF starts a new season/series, these
// will need updating.
const SEASON_ID = 11;
const COMPETITION_ID = "f63960a9-dd33-4852-9359-31f22dfea18d";
const STAGE_ID = "1246bcae-7d5a-4643-b851-6673735c01a6";
const SERIES_ID = "68a64456-535f-4bf6-8233-0eb33549212f";
const TEAM_NAME = "Workit Sports";

export interface InterligaU12Match {
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

// This is an indoor 5-a-side winter league -- games run shorter than an outdoor U13 match.
const MATCH_DURATION_MINUTES = 60;

function matchTaskTitle(match: InterligaU12Match): string {
  const isHome = match.home === TEAM_NAME;
  const opponent = isHome ? match.away : match.home;
  return `⚽ Interliga vs ${opponent} (${isHome ? "home" : "away"})`;
}

function toAlbertCalendarMatches(matches: InterligaU12Match[]) {
  return matches.map((m) => {
    const startTime = m.date.slice(11, 16);
    return {
      date: m.date.slice(0, 10),
      startTime,
      endTime: addMinutes(startTime, MATCH_DURATION_MINUTES),
      title: matchTaskTitle(m),
    };
  });
}

let cachedSchedule: { data: InterligaU12Match[]; fetchedAt: number } | null = null;
const SCHEDULE_TTL_MS = 60 * 60 * 1000;

async function fetchInterligaU12Schedule(): Promise<InterligaU12Match[]> {
  if (cachedSchedule && Date.now() - cachedSchedule.fetchedAt < SCHEDULE_TTL_MS) return cachedSchedule.data;

  // Get a token up front rather than letting every parallel round request race to fetch its
  // own -- getToken() already caches, but a herd of simultaneous first calls would otherwise
  // all miss the cache at once and hit FRF's auth endpoint N times over.
  await getToken();

  const allRounds = await frfPost<FrfTourRound[]>("GetCompetitionStageSeriesTourRounds", {});
  const ourRounds = allRounds.filter((r) => r.seriesId === SERIES_ID && r.stageId === STAGE_ID);

  // One round's fetch doesn't depend on another's -- run them concurrently instead of one at a
  // time.
  const perRound = await Promise.all(
    ourRounds.map(async (round) => {
      const data = await frfPost<{ matches: { list: FrfMatch[] }[] }>("GetMatches", {
        SeasonId: SEASON_ID,
        CompetitionId: COMPETITION_ID,
        StageId: STAGE_ID,
        SeriesId: SERIES_ID,
        TourRoundId: round.tourRoundId,
      });
      const found: InterligaU12Match[] = [];
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

  try {
    await syncAlbertCalendar(toAlbertCalendarMatches(matches));
  } catch (err) {
    console.error("Failed to sync Interliga U12 matches into Albert's calendar", err);
  }

  cachedSchedule = { data: matches, fetchedAt: Date.now() };
  return matches;
}

export const interligaU12Router = Router();
interligaU12Router.use(requireAuth);

interligaU12Router.get("/schedule", async (_req, res) => {
  try {
    const matches = await fetchInterligaU12Schedule();
    res.json({ team: TEAM_NAME, matches });
  } catch (err) {
    console.error("Failed to fetch Interliga U12 schedule from hailafotbal.ro", err);
    res.status(502).json({ error: "Could not fetch the schedule from hailafotbal.ro right now" });
  }
});
