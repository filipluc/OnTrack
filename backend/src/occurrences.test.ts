import { describe, expect, it } from "vitest";
import { addDays, addMonths, datesInRange, withinRecurrenceWindow, type TaskRow } from "./occurrences.js";

function baseTask(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: 1,
    owner_id: 1,
    title: "Mate",
    category: "school",
    recurrence: "weekly",
    days_of_week: "1",
    date: null,
    start_time: "10:00",
    end_time: "11:00",
    created_by: 1,
    starts_on: "2026-01-01",
    ends_on: "2026-04-01",
    remind_minutes_before: null,
    ...overrides,
  };
}

describe("datesInRange", () => {
  it("includes both endpoints", () => {
    expect(datesInRange("2026-08-17", "2026-08-19")).toEqual(["2026-08-17", "2026-08-18", "2026-08-19"]);
  });

  it("returns a single date when from equals to", () => {
    expect(datesInRange("2026-08-19", "2026-08-19")).toEqual(["2026-08-19"]);
  });

  it("crosses a month boundary correctly", () => {
    expect(datesInRange("2026-01-30", "2026-02-02")).toEqual(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    expect(addDays("2026-08-19", 3)).toBe("2026-08-22");
  });

  it("subtracts with a negative count", () => {
    expect(addDays("2026-08-19", -20)).toBe("2026-07-30");
  });

  it("rolls over a year boundary", () => {
    expect(addDays("2026-12-30", 5)).toBe("2027-01-04");
  });
});

describe("addMonths", () => {
  it("adds whole months", () => {
    expect(addMonths("2026-01-15", 3)).toBe("2026-04-15");
  });

  it("rolls over a year boundary", () => {
    expect(addMonths("2026-11-01", 3)).toBe("2027-02-01");
  });
});

describe("withinRecurrenceWindow", () => {
  it("is false for a one-off task with no window", () => {
    const task = baseTask({ recurrence: "none", starts_on: null, ends_on: null });
    expect(withinRecurrenceWindow(task, "2026-08-19")).toBe(false);
  });

  it("is true for a date inside the window", () => {
    const task = baseTask({ starts_on: "2026-08-01", ends_on: "2026-11-01" });
    expect(withinRecurrenceWindow(task, "2026-08-19")).toBe(true);
  });

  it("is true exactly on the boundary dates", () => {
    const task = baseTask({ starts_on: "2026-08-01", ends_on: "2026-11-01" });
    expect(withinRecurrenceWindow(task, "2026-08-01")).toBe(true);
    expect(withinRecurrenceWindow(task, "2026-11-01")).toBe(true);
  });

  it("is false before starts_on (no retroactive occurrences)", () => {
    const task = baseTask({ starts_on: "2026-08-01", ends_on: "2026-11-01" });
    expect(withinRecurrenceWindow(task, "2026-07-31")).toBe(false);
  });

  it("is false after ends_on (window expired)", () => {
    const task = baseTask({ starts_on: "2026-08-01", ends_on: "2026-11-01" });
    expect(withinRecurrenceWindow(task, "2026-11-02")).toBe(false);
  });

  it("has no upper bound when ends_on is null", () => {
    const task = baseTask({ starts_on: "2026-08-01", ends_on: null });
    expect(withinRecurrenceWindow(task, "2030-01-01")).toBe(true);
  });
});
