import { describe, expect, it } from "vitest";
import { matchesFilter } from "./Agenda";
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

describe("matchesFilter", () => {
  it("'all' matches every category", () => {
    expect(matchesFilter(occ({ category: "school" }), "all")).toBe(true);
    expect(matchesFilter(occ({ category: "sport" }), "all")).toBe(true);
    expect(matchesFilter(occ({ category: "routine" }), "all")).toBe(true);
  });

  it("'sport' matches only Sport occurrences", () => {
    expect(matchesFilter(occ({ category: "sport" }), "sport")).toBe(true);
    expect(matchesFilter(occ({ category: "school" }), "sport")).toBe(false);
    expect(matchesFilter(occ({ category: "study" }), "sport")).toBe(false);
  });

  it("'homework' matches School only when homeworkDue is set", () => {
    expect(matchesFilter(occ({ category: "school", homeworkDue: true }), "homework")).toBe(true);
    expect(matchesFilter(occ({ category: "school", homeworkDue: false }), "homework")).toBe(false);
  });

  it("'homework' matches every Study task, regardless of homeworkDue", () => {
    expect(matchesFilter(occ({ category: "study", homeworkDue: false }), "homework")).toBe(true);
  });

  it("'homework' excludes other categories entirely", () => {
    expect(matchesFilter(occ({ category: "sport" }), "homework")).toBe(false);
    expect(matchesFilter(occ({ category: "routine" }), "homework")).toBe(false);
    expect(matchesFilter(occ({ category: "leisure" }), "homework")).toBe(false);
    expect(matchesFilter(occ({ category: "other" }), "homework")).toBe(false);
  });
});
