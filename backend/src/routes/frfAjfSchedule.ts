import { Router } from "express";
import { requireAuth } from "../auth.js";

/**
 * Reads CS Workit Sports Iași's U12 (2015) county-league schedule straight from AJF Iași's
 * own site (frf-ajf.ro). Unlike hailafotbal.ro or the Cupa Google Sheets used elsewhere in
 * this app, frf-ajf.ro is plain server-rendered HTML with no JSON API -- the competition's
 * "program" page lists every round's fixtures in one table (teams, round, date, a link to
 * that match's own page), and each match's own page additionally carries kickoff time and
 * venue once the federation sets them (both start as a placeholder "hh:mm" / blank).
 *
 * frf-ajf.ro sits behind Cloudflare, which 403s requests from Render's datacenter IPs outright
 * (works fine from a residential IP, e.g. local dev) -- so fetches go through r.jina.ai, a free
 * "read this URL" reader proxy, instead of hitting frf-ajf.ro directly. It fetches the page
 * server-side from its own IPs and returns the content as Markdown rather than raw HTML, so the
 * parsing below matches that Markdown shape, not frf-ajf.ro's actual markup.
 */
const COMPETITION_URL = "https://www.frf-ajf.ro/iasi/competitii-fotbal/juniori-u12-2015-16853/program";
const TEAM_NAME = "CS Workit Sports Iași";
// The county fixture generator seeds a placeholder opponent literally named "stă" for a bye
// round in a group with an odd number of teams -- not a real club, just "sits this round out".
const BYE_TEAM = "stă";

const READER_PROXY = "https://r.jina.ai/";

async function fetchViaReader(url: string): Promise<string> {
  const res = await fetch(`${READER_PROXY}${url}`);
  if (!res.ok) throw new Error(`Reader proxy fetch failed for ${url}: ${res.status}`);
  return res.text();
}

export interface FrfAjfMatch {
  round: number;
  date: string; // "2026-09-19"
  time: string | null; // "11:00", null while the federation hasn't set a kickoff time yet
  venue: string | null;
  home: string;
  away: string;
  homeGoals: number | null;
  awayGoals: number | null;
  played: boolean;
  bye: boolean;
  matchUrl: string;
}
export interface FrfAjfScheduleResponse {
  team: string;
  updatedAt: string;
  matches: FrfAjfMatch[];
  /** True if this is the last successful fetch being served because the live one just failed. */
  stale: boolean;
}

interface ScheduleRow {
  home: string;
  away: string;
  round: number;
  date: string;
  matchUrl: string;
}

// Matches one row of the program table as the reader proxy renders it, e.g.:
// **Home - Away**1 2026-09-19-[Detalii](https://www.frf-ajf.ro/iasi/meciuri/....html)
// The bit between the date and "[Detalii](" is the score column ("-" until played, "X - Y"
// once it is) -- skipped rather than captured, since match details are read from each match's
// own page instead.
const ROW_RE = /\*\*([^*]+)\*\*(\d+)\s+(\d{4}-\d{2}-\d{2})[^[]*\[Detalii\]\(([^)]+)\)/g;

function parseProgramRows(markdown: string): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  for (const m of markdown.matchAll(ROW_RE)) {
    const [, teams, roundStr, date, matchUrl] = m;
    if (!teams.includes(TEAM_NAME)) continue;
    const sepIdx = teams.indexOf(" - ");
    if (sepIdx === -1) continue;
    rows.push({
      home: teams.slice(0, sepIdx).trim(),
      away: teams.slice(sepIdx + 3).trim(),
      round: Number(roundStr),
      date: date.trim(),
      matchUrl,
    });
  }
  return rows;
}

interface MatchDetails {
  time: string | null;
  venue: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  played: boolean;
}

async function fetchMatchDetails(url: string): Promise<MatchDetails> {
  const markdown = await fetchViaReader(url);

  // The match's own score is the only "## X - Y" heading on the page (the round's other
  // fixtures, listed further down, render as plain text instead of headings).
  const scoreText = markdown.match(/^## (.+)$/m)?.[1]?.trim() ?? "";
  const goals = scoreText.match(/(\d+)\s*-\s*(\d+)/);

  // Date/time/venue are the next three non-blank lines after the "Detalii meci" marker --
  // date is discarded (we already have it, cleanly formatted, from the program page row).
  const afterLabel = markdown.split("Detalii meci")[1] ?? "";
  const [, timeLine, venueLine] = afterLabel
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const timeText = timeLine?.trim() ?? "";
  const venueText = venueLine?.trim() ?? "";

  return {
    time: timeText && timeText.toLowerCase() !== "hh:mm" ? timeText : null,
    venue: venueText || null,
    homeGoals: goals ? Number(goals[1]) : null,
    awayGoals: goals ? Number(goals[2]) : null,
    played: Boolean(goals),
  };
}

// The competition schedule (and each match's time/venue) only changes when AJF Iași edits it
// by hand -- this just bounds how often we scrape their site rather than reflecting any real
// freshness requirement.
let cachedSchedule: { data: FrfAjfScheduleResponse; fetchedAt: number } | null = null;
const SCHEDULE_TTL_MS = 60 * 60 * 1000;

async function fetchWorkitSchedule(): Promise<FrfAjfScheduleResponse> {
  if (cachedSchedule && Date.now() - cachedSchedule.fetchedAt < SCHEDULE_TTL_MS) return cachedSchedule.data;

  try {
    const rows = parseProgramRows(await fetchViaReader(COMPETITION_URL));

    const matches = await Promise.all(
      rows.map(async (row): Promise<FrfAjfMatch> => {
        const bye = row.home === BYE_TEAM || row.away === BYE_TEAM;
        const base = { round: row.round, date: row.date, home: row.home, away: row.away, matchUrl: row.matchUrl, bye };
        if (bye) return { ...base, time: null, venue: null, homeGoals: null, awayGoals: null, played: false };

        try {
          const details = await fetchMatchDetails(row.matchUrl);
          return { ...base, ...details };
        } catch (err) {
          console.error(`Failed to fetch match details for ${row.matchUrl}`, err);
          return { ...base, time: null, venue: null, homeGoals: null, awayGoals: null, played: false };
        }
      })
    );

    matches.sort((a, b) => a.round - b.round);
    const data: FrfAjfScheduleResponse = { team: TEAM_NAME, updatedAt: new Date().toISOString(), matches, stale: false };
    cachedSchedule = { data, fetchedAt: Date.now() };
    return data;
  } catch (err) {
    // frf-ajf.ro is unreachable, its markup changed, etc. -- if we have any previously
    // successful fetch, serve that (marked stale) instead of a bare error. Don't touch
    // cachedSchedule.fetchedAt: the next request retries the live fetch instead of getting
    // stuck serving stale data once the source recovers.
    if (cachedSchedule) {
      console.error("Live frf-ajf.ro fetch failed, serving last known good data", err);
      return { ...cachedSchedule.data, stale: true };
    }
    throw err;
  }
}

export const frfAjfScheduleRouter = Router();
frfAjfScheduleRouter.use(requireAuth);

frfAjfScheduleRouter.get("/schedule", async (_req, res) => {
  try {
    const data = await fetchWorkitSchedule();
    res.json(data);
  } catch (err) {
    console.error("Failed to fetch Workit U12 schedule from frf-ajf.ro", err);
    res.status(502).json({ error: "Could not fetch the schedule from frf-ajf.ro right now" });
  }
});
