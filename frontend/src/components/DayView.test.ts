import { describe, expect, it } from "vitest";
import { layoutDay, minutesToTime, toMinutes } from "./DayView";
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

  it("treats a short task as occupying its visual minimum height for overlap purposes", () => {
    // A 15-minute task is shorter than the block's 45-minute visual minimum, so a second
    // task starting at 10:20 -- after the real end (10:15) but before the enforced minimum
    // end (10:45) -- should still be pushed into its own column.
    const { blocks, columns } = layoutDay([
      occ({ id: 1, startTime: "10:00", endTime: "10:15" }),
      occ({ id: 2, startTime: "10:20", endTime: "10:40" }),
    ]);
    expect(columns).toBe(2);
    expect(blocks.map((b) => b.col)).toEqual([0, 1]);
  });

  it("sorts blocks by start time regardless of input order", () => {
    const { blocks } = layoutDay([
      occ({ id: 2, startTime: "14:00", endTime: "15:00" }),
      occ({ id: 1, startTime: "09:00", endTime: "10:00" }),
    ]);
    expect(blocks.map((b) => b.occ.id)).toEqual([1, 2]);
  });
});
