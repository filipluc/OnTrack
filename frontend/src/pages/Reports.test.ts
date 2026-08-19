import { describe, expect, it } from "vitest";
import { aggregate, computeStreaks, formatHours, getRange, shiftPeriod, toMinutes } from "./Reports";
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

describe("toMinutes / formatHours", () => {
  it("toMinutes converts HH:MM to minutes since midnight", () => {
    expect(toMinutes("10:00")).toBe(600);
    expect(toMinutes("00:30")).toBe(30);
  });

  it("formatHours renders whole hours, whole minutes, and mixed durations", () => {
    expect(formatHours(0)).toBe("0h");
    expect(formatHours(-15)).toBe("0h");
    expect(formatHours(120)).toBe("2h");
    expect(formatHours(45)).toBe("45m");
    expect(formatHours(90)).toBe("1h 30m");
  });
});

describe("getRange", () => {
  it("day: from and to are the same date", () => {
    const range = getRange("day", "2026-08-19", "2026-08-01", "2026-08-01");
    expect(range.from).toBe("2026-08-19");
    expect(range.to).toBe("2026-08-19");
  });

  it("week: spans Monday through Sunday", () => {
    const range = getRange("week", "2026-08-19", "2026-08-01", "2026-08-01");
    expect(range.from).toBe("2026-08-17");
    expect(range.to).toBe("2026-08-23");
  });

  it("month: spans the 1st through the last day of the month", () => {
    const range = getRange("month", "2026-08-19", "2026-08-01", "2026-08-01");
    expect(range.from).toBe("2026-08-01");
    expect(range.to).toBe("2026-08-31");
  });

  it("year: spans Jan 1 through Dec 31", () => {
    const range = getRange("year", "2026-08-19", "2026-08-01", "2026-08-01");
    expect(range.from).toBe("2026-01-01");
    expect(range.to).toBe("2026-12-31");
  });

  it("custom: passes the given from/to through untouched", () => {
    const range = getRange("custom", "2026-08-19", "2026-05-01", "2026-05-15");
    expect(range.from).toBe("2026-05-01");
    expect(range.to).toBe("2026-05-15");
  });
});

describe("shiftPeriod", () => {
  it("day moves by one day", () => {
    expect(shiftPeriod("day", "2026-08-19", 1)).toBe("2026-08-20");
    expect(shiftPeriod("day", "2026-08-19", -1)).toBe("2026-08-18");
  });

  it("week moves by seven days", () => {
    expect(shiftPeriod("week", "2026-08-19", 1)).toBe("2026-08-26");
  });

  it("month moves by one calendar month", () => {
    expect(shiftPeriod("month", "2026-08-19", 1)).toBe("2026-09-19");
  });

  it("year moves by one calendar year", () => {
    expect(shiftPeriod("year", "2026-08-19", 1)).toBe("2027-08-19");
  });

  it("custom never shifts (no single 'period' to move)", () => {
    expect(shiftPeriod("custom", "2026-08-19", 1)).toBe("2026-08-19");
  });
});

describe("aggregate", () => {
  it("sums scheduled and done minutes per task and rolls up per category", () => {
    const { categories, untimedCount } = aggregate([
      occ({ category: "school", title: "Mate", startTime: "10:00", endTime: "11:00", status: "done" }),
      occ({ category: "school", title: "Mate", startTime: "10:00", endTime: "11:30", status: "not_done" }),
      occ({ category: "sport", title: "Fotbal", startTime: "17:00", endTime: "18:00", status: "done" }),
    ]);

    expect(untimedCount).toBe(0);
    expect(categories).toHaveLength(2);

    const school = categories.find((c) => c.category === "school")!;
    expect(school.scheduledMin).toBe(60 + 90);
    expect(school.doneMin).toBe(60);
    expect(school.tasks).toEqual([{ title: "Mate", scheduledMin: 150, doneMin: 60 }]);

    const sport = categories.find((c) => c.category === "sport")!;
    expect(sport.scheduledMin).toBe(60);
    expect(sport.doneMin).toBe(60);
  });

  it("counts occurrences with no time separately instead of dropping them silently", () => {
    const { categories, untimedCount } = aggregate([occ({ startTime: null, endTime: null })]);
    expect(untimedCount).toBe(1);
    expect(categories).toHaveLength(0);
  });

  it("skips a non-positive duration (end not after start)", () => {
    const { categories } = aggregate([occ({ startTime: "10:00", endTime: "10:00" })]);
    expect(categories).toHaveLength(0);
  });

  it("orders categories and tasks by scheduled time, largest first", () => {
    const { categories } = aggregate([
      occ({ category: "sport", title: "Fotbal", startTime: "10:00", endTime: "10:30" }),
      occ({ category: "school", title: "Mate", startTime: "10:00", endTime: "12:00" }),
    ]);
    expect(categories.map((c) => c.category)).toEqual(["school", "sport"]);
  });
});

describe("computeStreaks", () => {
  const TODAY = "2026-08-19";

  it("counts consecutive done occurrences going backward from today", () => {
    const streaks = computeStreaks(
      [
        occ({ id: 1, recurrence: "daily", date: "2026-08-19", status: "not_done" }), // today, not done yet -- skipped, not a break
        occ({ id: 1, recurrence: "daily", date: "2026-08-18", status: "done" }),
        occ({ id: 1, recurrence: "daily", date: "2026-08-17", status: "done" }),
        occ({ id: 1, recurrence: "daily", date: "2026-08-16", status: "not_done" }), // breaks the streak
        occ({ id: 1, recurrence: "daily", date: "2026-08-15", status: "done" }),
      ],
      TODAY
    );
    expect(streaks).toEqual([{ id: 1, title: "Mate", category: "school", streak: 2 }]);
  });

  it("today counting as a miss still breaks the streak once it's in the past", () => {
    const streaks = computeStreaks(
      [
        occ({ id: 1, recurrence: "daily", date: "2026-08-18", status: "not_done" }),
        occ({ id: 1, recurrence: "daily", date: "2026-08-17", status: "done" }),
      ],
      TODAY
    );
    expect(streaks).toEqual([]);
  });

  it("excludes one-off tasks entirely", () => {
    const streaks = computeStreaks([occ({ id: 1, recurrence: "none", date: "2026-08-18", status: "done" })], TODAY);
    expect(streaks).toEqual([]);
  });

  it("sorts multiple tasks longest streak first", () => {
    const streaks = computeStreaks(
      [
        occ({ id: 1, title: "A", recurrence: "daily", date: "2026-08-18", status: "done" }),
        occ({ id: 2, title: "B", recurrence: "daily", date: "2026-08-18", status: "done" }),
        occ({ id: 2, title: "B", recurrence: "daily", date: "2026-08-17", status: "done" }),
      ],
      TODAY
    );
    expect(streaks.map((s) => s.id)).toEqual([2, 1]);
  });
});
