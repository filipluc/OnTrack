import { describe, expect, it } from "vitest";
import { computeBlockRows, layoutDay, minutesToTime, toMinutes } from "./dayLayout";
import type { Occurrence } from "../api";

function occ(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    id: 1,
    title: "Mate",
    category: "school",
    recurrence: "none",
    startTime: "10:00",
    endTime: "11:00",
    date: "2026-08-19",
    status: "not_done",
    homeworkAssigned: false,
    homeworkDue: false,
    homeworkDone: false,
    note: null,
    overridden: false,
    endsOn: null,
    remindMinutesBefore: null,
    ...overrides,
  };
}

describe("toMinutes / minutesToTime", () => {
  it("round-trip HH:MM through minutes-since-midnight", () => {
    for (const t of ["00:00", "06:30", "18:00", "23:59"]) {
      expect(minutesToTime(toMinutes(t))).toBe(t);
    }
  });
});

describe("layoutDay", () => {
  it("returns default hours and no blocks when nothing has a time", () => {
    const untimed = [occ({ startTime: null, endTime: null })];
    const { blocks, untimed: returnedUntimed, startHour, endHour, columns } = layoutDay(untimed);
    expect(blocks).toEqual([]);
    expect(returnedUntimed).toEqual(untimed);
    expect(startHour).toBe(6);
    expect(endHour).toBe(22);
    expect(columns).toBe(1);
  });

  it("places a single timed occurrence in column 0", () => {
    const { blocks, columns } = layoutDay([occ({ startTime: "10:00", endTime: "11:00" })]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].col).toBe(0);
    expect(columns).toBe(1);
  });

  it("expands the default hour range to fit an earlier/later task", () => {
    const { startHour, endHour } = layoutDay([occ({ startTime: "05:00", endTime: "23:30" })]);
    expect(startHour).toBe(5);
    expect(endHour).toBe(24);
  });

  it("keeps sequential non-overlapping tasks in the same column", () => {
    const { blocks, columns } = layoutDay([
      occ({ id: 1, startTime: "10:00", endTime: "11:00" }),
      occ({ id: 2, startTime: "11:00", endTime: "12:00" }),
    ]);
    expect(columns).toBe(1);
    expect(blocks.map((b) => b.col)).toEqual([0, 0]);
  });

  it("puts genuinely overlapping tasks in separate columns", () => {
    const { blocks, columns } = layoutDay([
      occ({ id: 1, startTime: "10:00", endTime: "11:00" }),
      occ({ id: 2, startTime: "10:30", endTime: "11:30" }),
    ]);
    expect(columns).toBe(2);
    expect(blocks.map((b) => b.col)).toEqual([0, 1]);
  });

  it("reuses a freed column once its previous occupant has ended", () => {
    const { blocks, columns } = layoutDay([
      occ({ id: 1, startTime: "10:00", endTime: "11:00" }),
      occ({ id: 2, startTime: "10:30", endTime: "11:30" }), // overlaps #1 -> column 1
      occ({ id: 3, startTime: "11:00", endTime: "12:00" }), // #1 has ended -> reuses column 0
    ]);
    expect(columns).toBe(2);
    expect(blocks.map((b) => b.col)).toEqual([0, 1, 0]);
  });

  it("splits two short back-to-back tasks into separate columns when stacking would leave one illegibly short", () => {
    // 10:00-10:15 and 10:15-10:30 touch exactly -- no real overlap -- but the gap from #1's
    // own start to #2's start is only 15 minutes, under the 30-minute (2-row) legibility
    // buffer, so stacking them would squeeze #1 down to an unreadable sliver. Split instead.
    const { blocks, columns } = layoutDay([
      occ({ id: 1, startTime: "10:00", endTime: "10:15" }),
      occ({ id: 2, startTime: "10:15", endTime: "10:30" }),
    ]);
    expect(columns).toBe(2);
    expect(blocks.map((b) => b.col)).toEqual([0, 1]);
    expect(blocks.map((b) => b.spansFull)).toEqual([false, false]);
  });

  it("still stacks two back-to-back tasks in one column when the gap leaves enough room to be legible", () => {
    // #1 is short (15 min) but the gap from its own start to #2's start is 45 minutes --
    // comfortably over the 30-minute buffer -- so they share a column instead of splitting.
    const { blocks, columns } = layoutDay([
      occ({ id: 1, startTime: "10:00", endTime: "10:15" }),
      occ({ id: 2, startTime: "10:45", endTime: "11:00" }),
    ]);
    expect(columns).toBe(1);
    expect(blocks.map((b) => b.col)).toEqual([0, 0]);
  });

  it("caps a block's maxEnd at the real start of the next task sharing its column", () => {
    const { blocks } = layoutDay([
      occ({ id: 1, startTime: "10:00", endTime: "10:15" }),
      occ({ id: 2, startTime: "10:45", endTime: "11:00" }),
    ]);
    expect(blocks[0].maxEnd).toBe(toMinutes("10:45")); // capped so it can't bleed into #2
    expect(blocks[1].maxEnd).toBe(Infinity); // nothing follows #2 in its column
  });

  it("marks a block spansFull only when it doesn't genuinely overlap anything else that day", () => {
    const { blocks } = layoutDay([
      occ({ id: 1, startTime: "08:00", endTime: "08:30" }), // overlaps #2 -> not full width
      occ({ id: 2, startTime: "08:15", endTime: "08:45" }), // overlaps #1 -> not full width
      occ({ id: 3, startTime: "09:00", endTime: "09:30" }), // overlaps nobody -> full width
    ]);
    const byId = new Map(blocks.map((b) => [b.occ.id, b]));
    expect(byId.get(1)!.spansFull).toBe(false);
    expect(byId.get(2)!.spansFull).toBe(false);
    expect(byId.get(3)!.spansFull).toBe(true);
  });

  it("an isolated task stays full-width even when an unrelated pair elsewhere that day gets split into columns", () => {
    // Regression case: a Routine task early in the day with nothing near it shouldn't get
    // squeezed just because two Study tasks later that day (touching, too close to stack)
    // pushed the day's overall column count to 2.
    const { blocks, columns } = layoutDay([
      occ({ id: 1, title: "Spalat pe dinti", category: "routine", startTime: "07:30", endTime: "07:45" }),
      occ({ id: 2, title: "Duolingo", category: "study", startTime: "15:00", endTime: "15:15" }),
      occ({ id: 3, title: "Citit", category: "study", startTime: "15:15", endTime: "15:45" }),
    ]);
    expect(columns).toBe(2);
    const byId = new Map(blocks.map((b) => [b.occ.id, b]));
    expect(byId.get(1)!.spansFull).toBe(true);
    expect(byId.get(2)!.spansFull).toBe(false);
    expect(byId.get(3)!.spansFull).toBe(false);
  });

  it("sorts blocks by start time regardless of input order", () => {
    const { blocks } = layoutDay([
      occ({ id: 2, startTime: "14:00", endTime: "15:00" }),
      occ({ id: 1, startTime: "09:00", endTime: "10:00" }),
    ]);
    expect(blocks.map((b) => b.occ.id)).toEqual([1, 2]);
  });
});

describe("computeBlockRows", () => {
  it("floors the start row and ceils the (uncapped) end row", () => {
    // A 53-minute span is longer than MIN_BLOCK_MINUTES, so no inflation kicks in here --
    // isolates the floor/ceil rounding from the minimum-height behavior tested separately below.
    const { startRow, endRow } = computeBlockRows(toMinutes("10:07"), toMinutes("11:00"), 0);
    expect(startRow).toBe(Math.floor(607 / 15) + 1);
    expect(endRow).toBe(Math.ceil(660 / 15) + 1);
  });

  it("a capped block's endRow exactly matches the next block's own startRow when there's room", () => {
    // The bug this guards against: 14:00-14:15 and 15:00-... touch/gap at a boundary that
    // isn't a multiple of 15 minutes. Rounding each end independently (ceil) and each start
    // independently (floor) used to let the first block's row creep past the second's. Here
    // the gap (45 min) is comfortably more than MIN_LEGIBLE_ROWS, so the cap alone decides it.
    const first = computeBlockRows(toMinutes("14:07"), toMinutes("14:15"), 0, toMinutes("15:00"));
    const second = computeBlockRows(toMinutes("15:00"), toMinutes("15:20"), 0);
    expect(first.endRow).toBe(second.startRow);
  });

  it("guarantees a legible minimum height even when that overlaps a tightly-touching next block", () => {
    // Two 15-minute tasks touching exactly (one ends when the next starts) don't leave room
    // for both the next block's cap AND a legible minimum -- legibility wins, deliberately,
    // over a hairline-thin unreadable sliver. The next (later, later-in-DOM) block still
    // paints on top, so its own content stays fully visible.
    const { startRow, endRow } = computeBlockRows(toMinutes("15:00"), toMinutes("15:15"), 0, toMinutes("15:15"));
    expect(endRow).toBe(startRow + 2);
  });

  it("never produces a zero-or-negative-height row even when capped very tightly", () => {
    const { startRow, endRow } = computeBlockRows(toMinutes("10:00"), toMinutes("10:05"), 0, toMinutes("10:00"));
    expect(endRow).toBeGreaterThan(startRow);
  });

  it("uncapped (no maxEnd) inflates a short task up to MIN_BLOCK_MINUTES", () => {
    const capped = computeBlockRows(toMinutes("10:00"), toMinutes("10:05"), 0);
    const full = computeBlockRows(toMinutes("10:00"), toMinutes("10:45"), 0);
    expect(capped.endRow).toBe(full.endRow); // 5-minute task still gets the full 45-minute height
  });
});
