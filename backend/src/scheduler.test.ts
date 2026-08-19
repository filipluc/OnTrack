import { describe, expect, it } from "vitest";
import { toMinutes } from "./scheduler.js";

describe("toMinutes", () => {
  it("converts HH:MM to minutes since midnight", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("06:00")).toBe(360);
    expect(toMinutes("18:00")).toBe(1080);
    expect(toMinutes("23:59")).toBe(1439);
  });

  it("handles single-digit-looking minutes correctly", () => {
    expect(toMinutes("09:05")).toBe(545);
  });
});
