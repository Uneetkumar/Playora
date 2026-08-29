import { describe, it, expect } from "vitest";
import {
  ROOM_CODE_LENGTH,
  generateRoomCode,
  isValidRoomCode,
  looksLikeTypo,
  normalizeRoomCode,
} from "../room-code.js";

describe("generateRoomCode", () => {
  it("produces codes of the expected length", () => {
    expect(generateRoomCode()).toHaveLength(ROOM_CODE_LENGTH);
  });

  it("never emits characters that are easily misread", () => {
    // 400 codes is enough to hit every alphabet index many times over.
    const codes = Array.from({ length: 400 }, () => generateRoomCode()).join("");
    for (const confusable of ["O", "I", "L", "0", "1"]) {
      expect(codes).not.toContain(confusable);
    }
  });

  it("generates codes that pass its own validator", () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidRoomCode(generateRoomCode())).toBe(true);
    }
  });

  it("is deterministic given a fixed random source", () => {
    const fixed = () => new Uint8Array([0, 1, 2, 3, 4, 5]);
    expect(generateRoomCode(fixed)).toBe("ABCDEF");
  });

  it("spreads across the alphabet rather than clustering", () => {
    const seen = new Set(Array.from({ length: 300 }, () => generateRoomCode()));
    expect(seen.size).toBeGreaterThan(290); // collisions should be rare
  });
});

describe("normalizeRoomCode", () => {
  it.each([
    ["abcdef", "ABCDEF"],
    ["  ABCDEF  ", "ABCDEF"],
    ["ABC-DEF", "ABCDEF"],
    ["ABC DEF", "ABCDEF"],
    ["ABC_DEF", "ABCDEF"],
  ])("normalises %s to %s", (input, expected) => {
    expect(normalizeRoomCode(input)).toBe(expected);
  });

  it("truncates overlong input", () => {
    expect(normalizeRoomCode("ABCDEFGHJK")).toHaveLength(ROOM_CODE_LENGTH);
  });
});

describe("isValidRoomCode", () => {
  it("accepts a well-formed code in any casing", () => {
    expect(isValidRoomCode("ABCDEF")).toBe(true);
    expect(isValidRoomCode("abc-def")).toBe(true);
  });

  it.each([
    ["too short", "ABC"],
    ["empty", ""],
    ["confusable characters", "ABCDEO"],
    ["punctuation", "ABCD!F"],
  ])("rejects %s", (_label, input) => {
    expect(isValidRoomCode(input)).toBe(false);
  });
});

describe("looksLikeTypo", () => {
  it("does not flag identical codes", () => {
    expect(looksLikeTypo("ABCDEF", "ABCDEF")).toBe(false);
  });

  it("does not flag unrelated codes", () => {
    expect(looksLikeTypo("ABCDEF", "ZYXWVU")).toBe(false);
  });
});
