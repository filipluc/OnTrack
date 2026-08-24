import { Router } from "express";
import { requireAuth } from "../auth.js";

/**
 * Reads the Cupa Stelele Viitorului schedule straight from the organizer's own Google Sheets
 * (linked from steleleviitorului.ro/livescore/) via Google's legacy "gviz" query endpoint.
 * That endpoint stays public for anyone with view access even though the sheet has
 * downloading/copying disabled for viewers in the Sheets UI -- this reads the same match data
 * any visitor with the link can already see, just without the manual copy/paste that used to
 * live in frontend/src/data/cupaSteleleViitorului*.ts.
 *
 * Doc IDs and tab gids were found by inspecting the links on steleleviitorului.ro/livescore/
 * and each doc's htmlview page; they'll need updating if the organizer replaces the sheets
 * for a future tournament edition.
 */
const GVIZ_BASE = "https://docs.google.com/spreadsheets/d";

interface BlockLayout {
  offset: number;
  time: number;
  field: number | null;
  group: number;
  team1: number;
  score: number;
  team2: number;
  width: number;
}

interface SheetConfig {
  docId: string;
  gid: string;
  dayLabels: string[];
  blocks: BlockLayout[];
}

// 2014-2015 doc: one match per row, single field (whole age group plays on "Teren 4").
const SINGLE_BLOCK: BlockLayout = { offset: 0, time: 0, field: null, group: 1, team1: 3, score: 4, team2: 6, width: 7 };
// 2016-2017 doc: Coerver fields two squads (Verde/Negru), and the sheet runs two courts in
// parallel per row -- a second identically-shaped block starting 10 columns over.
const TWIN_BLOCK: BlockLayout[] = [
  { offset: 0, time: 0, field: 1, group: 2, team1: 4, score: 5, team2: 7, width: 10 },
  { offset: 10, time: 0, field: 1, group: 2, team1: 4, score: 5, team2: 7, width: 10 },
];

// Day/date text isn't present as row data in either doc (only as a one-off banner Google's
// endpoint discards) -- these are matched positionally to each recurring "GRUPA" header
// row block, in order. Update once per tournament edition, not per score change.
const DAY_LABELS = ["Friday, Aug 28 — Group stage", "Saturday, Aug 29 — Group stage", "Sunday, Aug 30 — Knockout stage"];

const SHEETS: Record<string, SheetConfig> = {
  "2014-2015": {
    docId: "1r0cwX6fuQEg-sBrWRjA9hOi1dc8ginJP",
    gid: "706004893",
    dayLabels: DAY_LABELS,
    blocks: [SINGLE_BLOCK],
  },
  "2016-2017": {
    docId: "1qhJojfQwXmmR3Abn3qpefQfNYv0PjnI3",
    gid: "1960604397",
    dayLabels: DAY_LABELS,
    blocks: TWIN_BLOCK,
  },
};

// CLASAMENT tabs (standings), keyed by year -- same docs as the schedules above.
const STANDINGS: Record<string, { docId: string; gid: string }> = {
  "2014": { docId: "1r0cwX6fuQEg-sBrWRjA9hOi1dc8ginJP", gid: "1922573661" },
  "2015": { docId: "1r0cwX6fuQEg-sBrWRjA9hOi1dc8ginJP", gid: "59674486" },
  "2016": { docId: "1qhJojfQwXmmR3Abn3qpefQfNYv0PjnI3", gid: "1528978073" },
  "2017": { docId: "1qhJojfQwXmmR3Abn3qpefQfNYv0PjnI3", gid: "1058188824" },
};

export interface CupaMatch {
  time: string;
  field?: string;
  group: string;
  home: string;
  away: string;
  score?: string;
}
export interface CupaDay {
  label: string;
  matches: CupaMatch[];
}
export interface CupaStandingsRow {
  rank: number;
  team: string;
  played: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  diff: number;
}
export interface CupaStandingsGroup {
  group: string;
  rows: CupaStandingsRow[];
}
export interface CupaScheduleResponse {
  updatedAt: string;
  sheets: Record<string, CupaDay[]>;
  standings: Record<string, CupaStandingsGroup[]>;
  /** True if this is the last successful fetch being served because the live one just failed. */
  stale: boolean;
}

// The source sheet writes team names in ALL CAPS; these stay uppercase instead of being
// title-cased like a normal word. Extend as new acronym-style names show up in the sheet.
const ACRONYMS = new Set(["FC", "CSS", "IFA", "SCM", "ACS", "ȘCF", "SCF", "CSF"]);

function normalizeTeamName(raw: string): string {
  const cleaned = raw.trim().replace(/[.:]+$/, "").trim();
  if (!cleaned) return cleaned;
  return cleaned
    .split(/\s+/)
    .map((word) => {
      const upper = word.toLocaleUpperCase("ro");
      if (ACRONYMS.has(upper)) return upper;
      if (/^[0-9]+[A-Za-z]?\.?$/.test(word)) return upper;
      return word.charAt(0).toLocaleUpperCase("ro") + word.slice(1).toLocaleLowerCase("ro");
    })
    .join(" ");
}

function normalizeField(raw: string): string {
  return raw.trim().replace(/^TEREN\s*/i, "Field ");
}

// "ECHIPA 2014B" (a group-separator row/column-label) -> "2014-B".
function normalizeGroupLabel(raw: string): string {
  const cleaned = raw.trim().replace(/^ECHIPA\s*/i, "").trim();
  const m = cleaned.match(/^(\d{4})([A-Za-z])$/);
  return m ? `${m[1]}-${m[2].toUpperCase()}` : cleaned;
}

interface GvizCell {
  v: string | number | null;
  f?: string;
}
interface GvizRow {
  c: (GvizCell | null)[];
}
interface GvizCol {
  label: string;
}
interface GvizResponse {
  table: { cols: GvizCol[]; rows: GvizRow[] };
}

function isHeaderRow(cells: (GvizCell | null)[], block: BlockLayout): boolean {
  for (let i = 0; i < block.width; i++) {
    const v = cells[block.offset + i]?.v;
    if (typeof v === "string" && v.trim().toUpperCase() === "GRUPA") return true;
  }
  return false;
}

function extractMatch(cells: (GvizCell | null)[], block: BlockLayout): CupaMatch | null {
  const at = (i: number) => cells[block.offset + i] ?? null;
  const timeStr = at(block.time)?.f ?? null;
  if (!timeStr) return null; // header/blank rows have no formatted time
  const team1 = at(block.team1)?.v;
  const team2 = at(block.team2)?.v;
  if (!team1 && !team2) return null;
  const groupVal = at(block.group)?.v;
  const scoreVal = at(block.score)?.v;
  const fieldVal = block.field != null ? at(block.field)?.v : null;
  return {
    time: timeStr,
    group: groupVal ? String(groupVal).trim() : "",
    home: normalizeTeamName(String(team1 ?? "")),
    away: normalizeTeamName(String(team2 ?? "")),
    ...(scoreVal ? { score: String(scoreVal).trim() } : {}),
    ...(fieldVal ? { field: normalizeField(String(fieldVal)) } : {}),
  };
}

function parseSheet(rows: GvizRow[], config: SheetConfig): CupaDay[] {
  const days: CupaDay[] = [];
  let current: CupaDay | null = null;

  for (const row of rows) {
    const cells = row.c;
    if (isHeaderRow(cells, config.blocks[0])) {
      current = { label: config.dayLabels[days.length] ?? `Day ${days.length + 1}`, matches: [] };
      days.push(current);
      continue;
    }
    if (!current) continue;
    for (const block of config.blocks) {
      const match = extractMatch(cells, block);
      if (match) current.matches.push(match);
    }
  }

  return days;
}

/**
 * Reads a CLASAMENT tab: rank/team/M/P/GM/GP/+-, split into per-letter groups (A/B, or A-E for
 * 2016-2017). The first group's label is only present as the sheet's own column header (gviz
 * swallows the top rows of a range into column metadata) -- later groups start with a
 * label-only separator row instead.
 */
function parseStandings(gviz: GvizResponse): CupaStandingsGroup[] {
  const firstLabel = normalizeGroupLabel(gviz.table.cols[1]?.label ?? "");
  const groups: CupaStandingsGroup[] = [];
  let current: CupaStandingsGroup | null = null;

  for (const row of gviz.table.rows) {
    const cells = row.c;
    const rank = cells[0]?.v;
    const teamVal = cells[1]?.v;
    if (rank == null) {
      if (typeof teamVal === "string" && teamVal.trim()) {
        current = { group: normalizeGroupLabel(teamVal), rows: [] };
        groups.push(current);
      }
      continue;
    }
    if (!current) {
      current = { group: firstLabel, rows: [] };
      groups.push(current);
    }
    if (typeof teamVal !== "string" || !teamVal.trim()) continue;
    current.rows.push({
      rank: Number(rank),
      team: normalizeTeamName(teamVal),
      played: Number(cells[2]?.v ?? 0),
      points: Number(cells[3]?.v ?? 0),
      goalsFor: Number(cells[4]?.v ?? 0),
      goalsAgainst: Number(cells[5]?.v ?? 0),
      diff: Number(cells[6]?.v ?? 0),
    });
  }

  return groups;
}

async function fetchStandings(config: { docId: string; gid: string }): Promise<CupaStandingsGroup[]> {
  const url = `${GVIZ_BASE}/${config.docId}/gviz/tq?tqx=out:json&gid=${config.gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Cupa standings fetch failed for ${config.docId}/${config.gid}: ${res.status}`);
  const gviz = parseGvizResponse(await res.text());
  return parseStandings(gviz);
}

// gviz wraps its JSON in a JS callback: /*O_o*/\ngoogle.visualization.Query.setResponse({...});
function parseGvizResponse(text: string): GvizResponse {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return JSON.parse(text.slice(start, end + 1));
}

async function fetchSheet(config: SheetConfig): Promise<CupaDay[]> {
  const url = `${GVIZ_BASE}/${config.docId}/gviz/tq?tqx=out:json&gid=${config.gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Cupa sheet fetch failed for ${config.docId}: ${res.status}`);
  const gviz = parseGvizResponse(await res.text());
  return parseSheet(gviz.table.rows, config);
}

// The sheet only changes when the organizer edits it by hand -- this just bounds how often
// we hit Google's endpoint rather than reflecting any real freshness requirement.
let cachedSchedule: { data: CupaScheduleResponse; fetchedAt: number } | null = null;
const SCHEDULE_TTL_MS = 5 * 60 * 1000;

async function fetchCupaSchedule(): Promise<CupaScheduleResponse> {
  if (cachedSchedule && Date.now() - cachedSchedule.fetchedAt < SCHEDULE_TTL_MS) return cachedSchedule.data;

  try {
    const [scheduleEntries, standingsEntries] = await Promise.all([
      Promise.all(Object.entries(SHEETS).map(async ([name, config]) => [name, await fetchSheet(config)] as const)),
      Promise.all(Object.entries(STANDINGS).map(async ([year, config]) => [year, await fetchStandings(config)] as const)),
    ]);

    const data: CupaScheduleResponse = {
      updatedAt: new Date().toISOString(),
      sheets: Object.fromEntries(scheduleEntries),
      standings: Object.fromEntries(standingsEntries),
      stale: false,
    };
    cachedSchedule = { data, fetchedAt: Date.now() };
    return data;
  } catch (err) {
    // Google's endpoint is unreachable, the organizer's sheet moved, etc. -- if we have any
    // previously successful fetch, serve that (marked stale) instead of a bare error. Don't
    // touch cachedSchedule.fetchedAt: the next request retries the live fetch again rather
    // than getting stuck serving stale data once the source recovers.
    if (cachedSchedule) {
      console.error("Live Cupa fetch failed, serving last known good data", err);
      return { ...cachedSchedule.data, stale: true };
    }
    throw err;
  }
}

export const cupaScheduleRouter = Router();
cupaScheduleRouter.use(requireAuth);

cupaScheduleRouter.get("/schedule", async (_req, res) => {
  try {
    const data = await fetchCupaSchedule();
    res.json(data);
  } catch (err) {
    console.error("Failed to fetch Cupa Stelele Viitorului schedule", err);
    res.status(502).json({ error: "Could not fetch the schedule from Google Sheets right now" });
  }
});
