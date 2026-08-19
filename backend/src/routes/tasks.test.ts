import { describe, expect, it } from "vitest";
import { nextOccurrenceDate, parseRemindMinutesBefore } from "./tasks.js";
import type { TaskRow } from "../occurrences.js";

function baseTask(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: 1,
    owner_id: 1,
    title: "Mate",
    category: "school",
    recurrence: "weekly",
    days_of_week: "1", // Monday
    date: null,
    start_time: "10:00",
    end_time: "11:00",
    created_by: 1,
    starts_on: "2026-01-01",
    ends_on: "2026-12-31",
    remind_minutes_before: null,
    ...overrides,
  };
}

describe("nextOccurrenceDate", () => {
  it("one-off task: returns its own date only if still in the future", () => {
    const task = baseTask({ recurrence: "none", date: "2026-08-25", starts_on: null, ends_on: null });
    expect(nextOccurrenceDate(task, "2026-08-19")).toBe("2026-08-25");
    expect(nextOccurrenceDate(task, "2026-08-25")).toBeNull(); // not strictly after fromDate
    expect(nextOccurrenceDate(task, "2026-08-26")).toBeNull(); // already in the past
  });

  it("daily task: the very next day, if within the window", () => {
    const task = baseTask({ recurrence: "daily", days_of_week: null, starts_on: "2026-08-01", ends_on: "2026-11-01" });
    expect(nextOccurrenceDate(task, "2026-08-19")).toBe("2026-08-20");
  });

  it("daily task: null once the next day falls outside the window", () => {
    const task = baseTask({ recurrence: "daily", days_of_week: null, starts_on: "2026-08-01", ends_on: "2026-08-19" });
    expect(nextOccurrenceDate(task, "2026-08-19")).toBeNull();
  });

  it("weekly task: finds the next matching weekday within 7 days", () => {
    // 2026-08-19 is a Wednesday; days_of_week "1" = Monday -> next Monday is 2026-08-24.
    const task = baseTask({ recurrence: "weekly", days_of_week: "1" });
    expect(nextOccurrenceDate(task, "2026-08-19")).toBe("2026-08-24");
  });

  it("weekly task: same-week match takes priority over the following week", () => {
    // Wednesday=3, Friday=5 -> from a Monday, the next Wednesday should win over the next Friday.
    const task = baseTask({ recurrence: "weekly", days_of_week: "3,5" });
    expect(nextOccurrenceDate(task, "2026-08-17")).toBe("2026-08-19");
  });

  it("weekly task: null when the window has already expired", () => {
    const task = baseTask({ recurrence: "weekly", days_of_week: "1", starts_on: "2026-01-01", ends_on: "2026-08-01" });
    expect(nextOccurrenceDate(task, "2026-08-19")).toBeNull();
  });

  it("weekly task: null when no weekday is configured", () => {
    const task = baseTask({ recurrence: "weekly", days_of_week: "" });
    expect(nextOccurrenceDate(task, "2026-08-19")).toBeNull();
  });
});

describe("parseRemindMinutesBefore", () => {
  it("treats undefined and null as 'no reminder' (null)", () => {
    expect(parseRemindMinutesBefore(undefined)).toBeNull();
    expect(parseRemindMinutesBefore(null)).toBeNull();
  });

  it("accepts a positive integer as-is", () => {
    expect(parseRemindMinutesBefore(60)).toBe(60);
    expect(parseRemindMinutesBefore(1)).toBe(1);
  });

  it("rejects zero, negatives, and non-integers", () => {
    expect(parseRemindMinutesBefore(0)).toBeUndefined();
    expect(parseRemindMinutesBefore(-5)).toBeUndefined();
    expect(parseRemindMinutesBefore(15.5)).toBeUndefined();
  });

  it("rejects non-number types", () => {
    expect(parseRemindMinutesBefore("60")).toBeUndefined();
    expect(parseRemindMinutesBefore(true)).toBeUndefined();
    expect(parseRemindMinutesBefore({})).toBeUndefined();
  });
});
