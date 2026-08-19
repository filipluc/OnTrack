import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  endOfYear,
  formatDayNumber,
  formatDisplay,
  formatMonthYear,
  formatShortDate,
  formatWeekdayShort,
  getWeekDates,
  startOfMonth,
  startOfWeek,
  startOfYear,
  toISODate,
} from "./date";

describe("toISODate", () => {
  it("formats a Date as YYYY-MM-DD in UTC", () => {
    expect(toISODate(new Date("2026-08-19T00:00:00Z"))).toBe("2026-08-19");
  });
});

describe("addDays", () => {
  it("adds and subtracts days", () => {
    expect(addDays("2026-08-19", 3)).toBe("2026-08-22");
    expect(addDays("2026-08-19", -19)).toBe("2026-07-31");
  });

  it("rolls over a year boundary", () => {
    expect(addDays("2026-12-30", 5)).toBe("2027-01-04");
  });
});

describe("startOfWeek / getWeekDates", () => {
  it("treats Monday as the start of the week", () => {
    // 2026-08-19 is a Wednesday.
    expect(startOfWeek("2026-08-19")).toBe("2026-08-17");
  });

  it("is a no-op when the date is already a Monday", () => {
    expect(startOfWeek("2026-08-17")).toBe("2026-08-17");
  });

  it("wraps Sunday back to the Monday that started its week", () => {
    // 2026-08-23 is a Sunday, part of the same week as 2026-08-17 (Mon) - 2026-08-23 (Sun).
    expect(startOfWeek("2026-08-23")).toBe("2026-08-17");
  });

  it("returns 7 consecutive days starting Monday", () => {
    expect(getWeekDates("2026-08-19")).toEqual([
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
    ]);
  });
});

describe("formatDayNumber", () => {
  it("extracts the day-of-month as a number", () => {
    expect(formatDayNumber("2026-08-05")).toBe(5);
    expect(formatDayNumber("2026-08-19")).toBe(19);
  });
});

describe("startOfMonth / endOfMonth", () => {
  it("finds the first day of the month", () => {
    expect(startOfMonth("2026-08-19")).toBe("2026-08-01");
  });

  it("finds the last day of a 31-day month", () => {
    expect(endOfMonth("2026-08-05")).toBe("2026-08-31");
  });

  it("finds the last day of February in a leap year", () => {
    expect(endOfMonth("2028-02-01")).toBe("2028-02-29");
  });

  it("finds the last day of February in a non-leap year", () => {
    expect(endOfMonth("2026-02-01")).toBe("2026-02-28");
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

describe("startOfYear / endOfYear / addYears", () => {
  it("finds January 1st and December 31st of the same year", () => {
    expect(startOfYear("2026-08-19")).toBe("2026-01-01");
    expect(endOfYear("2026-08-19")).toBe("2026-12-31");
  });

  it("adds and subtracts whole years", () => {
    expect(addYears("2026-08-19", 1)).toBe("2027-08-19");
    expect(addYears("2026-08-19", -2)).toBe("2024-08-19");
  });
});

// These rely on the runtime's default locale rendering English month/weekday names
// (true for this project's dev environment) -- if that ever changes, prefer checking
// formatDayNumber()-style structural properties over exact locale strings.
describe("locale-formatted display strings", () => {
  it("formatDisplay includes the weekday, month, and day", () => {
    expect(formatDisplay("2026-08-19")).toBe("Wednesday, August 19");
  });

  it("formatWeekdayShort abbreviates the weekday", () => {
    expect(formatWeekdayShort("2026-08-19")).toBe("Wed");
  });

  it("formatMonthYear spells out the month and year", () => {
    expect(formatMonthYear("2026-08-19")).toBe("August 2026");
  });

  it("formatShortDate abbreviates the month", () => {
    expect(formatShortDate("2026-08-19")).toBe("Aug 19");
  });
});
