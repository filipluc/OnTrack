import type { Occurrence } from "../api";

// 15-minute grid so drag/resize can snap to quarter/half/full hours.
export const SLOT_MINUTES = 15;
export const SLOT_PX = 18;
const MIN_BLOCK_MINUTES = 45; // visual minimum height (checkbox/badge/title row + resize handle), independent of a task's real (possibly shorter) duration
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Below this many rows, a block's checkbox/badge/title can't render without clipping --
// enforced as a hard floor even if that means slightly overlapping whatever's immediately
// next in its column (only happens for two very short, back-to-back tasks). The later task
// paints on top (default DOM/z-index stacking), so the earlier one's excess sits harmlessly
// underneath rather than covering the next task's own content.
const MIN_LEGIBLE_ROWS = 2;

/**
 * A block's grid-row span, in 15-minute slot lines. `maxEnd` (default: uncapped) is the real
 * start time of whatever comes next in the same column, if anything -- capping just the *end
 * minute* isn't enough on its own, because rounding it up to the nearest slot line (ceil) can
 * still land past where the next block's own start rounds *down* to (floor) whenever the
 * shared boundary isn't itself a multiple of SLOT_MINUTES. Capping the row directly, with the
 * same floor the next block uses for its own startRow, makes the two lines coincide exactly.
 */
export function computeBlockRows(
  start: number,
  end: number,
  rangeStartMin: number,
  maxEnd: number = Infinity
): { startRow: number; endRow: number } {
  const inflatedEnd = Math.max(end, start + MIN_BLOCK_MINUTES);
  const displayEnd = Math.min(inflatedEnd, maxEnd);
  const startRow = Math.floor((start - rangeStartMin) / SLOT_MINUTES) + 1;
  const rawEndRow = Math.ceil((displayEnd - rangeStartMin) / SLOT_MINUTES) + 1;
  const maxEndRow = Math.floor((maxEnd - rangeStartMin) / SLOT_MINUTES) + 1;
  const cappedEndRow = Math.min(rawEndRow, maxEndRow);
  const endRow = Math.max(cappedEndRow, startRow + MIN_LEGIBLE_ROWS);
  return { startRow, endRow };
}

export interface TimedBlock {
  occ: Occurrence;
  col: number;
  /** Caps this block's minimum-height inflation so it never visually bleeds into whatever
      comes right after it in the same column -- Infinity if nothing follows there. */
  maxEnd: number;
  /** True if this occurrence doesn't genuinely overlap anything else that day (by real
      start/end time) -- lets it span the full width even on a day where some other,
      unrelated pair of tasks overlaps and pushed the day's column count above 1. */
  spansFull: boolean;
}

function effectiveEndMinutes(o: Occurrence): number {
  const start = toMinutes(o.startTime!);
  return Math.max(toMinutes(o.endTime!), start + MIN_BLOCK_MINUTES);
}

// The buffer used to decide whether two tasks can share a column at all -- not just "do they
// literally overlap" but "would stacking them leave the earlier one at least legible". Two
// tasks touching (or with a small gap) still conflict if that gap is under this floor, since
// stacking them would force the earlier one below MIN_LEGIBLE_ROWS.
const PACKING_BUFFER_MINUTES = MIN_LEGIBLE_ROWS * SLOT_MINUTES;

function packingEndMinutes(o: Occurrence): number {
  const start = toMinutes(o.startTime!);
  return Math.max(toMinutes(o.endTime!), start + PACKING_BUFFER_MINUTES);
}

/** Same test drives both column assignment and `spansFull`, so a pair that gets split into
    separate columns for legibility never also both claim the full width -- see below. */
function conflicts(a: Occurrence, b: Occurrence): boolean {
  return toMinutes(a.startTime!) < packingEndMinutes(b) && toMinutes(b.startTime!) < packingEndMinutes(a);
}

export function layoutDay(occurrences: Occurrence[]) {
  const timed = occurrences.filter((o) => o.startTime && o.endTime);
  const untimed = occurrences.filter((o) => !o.startTime || !o.endTime);

  if (timed.length === 0) {
    return {
      blocks: [] as TimedBlock[],
      untimed,
      startHour: DEFAULT_START_HOUR,
      endHour: DEFAULT_END_HOUR,
      columns: 1,
    };
  }

  const starts = timed.map((o) => toMinutes(o.startTime!));
  const ends = timed.map((o) => effectiveEndMinutes(o));
  const startHour = Math.min(DEFAULT_START_HOUR, Math.floor(Math.min(...starts) / 60));
  const endHour = Math.max(DEFAULT_END_HOUR, Math.ceil(Math.max(...ends) / 60));

  const sorted = [...timed].sort((a, b) => toMinutes(a.startTime!) - toMinutes(b.startTime!));

  // Column packing uses each task's real end time plus the legibility buffer above, not its
  // full inflated minimum-height end -- two tasks with enough of a gap to both stay legible
  // stack in the same column; two tasks too close together for that split into columns instead.
  const columnEnds: number[] = [];
  const columnOf: number[] = [];
  for (const occ of sorted) {
    const start = toMinutes(occ.startTime!);
    const end = packingEndMinutes(occ);
    let col = columnEnds.findIndex((endMin) => endMin <= start);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[col] = end;
    }
    columnOf.push(col);
  }

  // Each block's inflated (minimum-height) end is capped at the real start of the next task
  // in the same column, so a short task never visually bleeds into whatever follows it there.
  const nextStartInColumn = new Map<number, number>();
  const blocks: TimedBlock[] = new Array(sorted.length);
  for (let i = sorted.length - 1; i >= 0; i--) {
    const occ = sorted[i];
    const col = columnOf[i];
    const maxEnd = nextStartInColumn.get(col) ?? Infinity;
    const spansFull = !sorted.some((other) => other !== occ && conflicts(occ, other));
    blocks[i] = { occ, col, maxEnd, spansFull };
    nextStartInColumn.set(col, toMinutes(occ.startTime!));
  }

  return { blocks, untimed, startHour, endHour, columns: Math.max(columnEnds.length, 1) };
}
