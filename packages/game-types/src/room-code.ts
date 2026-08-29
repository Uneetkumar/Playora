/**
 * Human-readable room codes.
 *
 * Players read these aloud and type them from memory, so the alphabet excludes
 * characters that are easily confused: O/0, I/1/L, and the vowels that let the
 * generator spell words by accident.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

/** Characters that users commonly substitute, normalised on input. */
const CONFUSABLES: Record<string, string> = {
  O: "0",
  Q: "Q",
  I: "1",
  L: "1",
  "0": "0",
  "1": "1",
};

export function generateRoomCode(
  randomValues: (length: number) => Uint8Array = defaultRandom,
): string {
  const bytes = randomValues(ROOM_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length];
  }
  return code;
}

function defaultRandom(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Normalises user input into canonical form.
 *
 * Accepts lowercase, surrounding whitespace and separators so that "ches-ab12",
 * "CHES AB12" and "CHESAB12" all resolve to the same room.
 */
export function normalizeRoomCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[\s-_]/g, "")
    .slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(input: string): boolean {
  const normalized = normalizeRoomCode(input);
  if (normalized.length !== ROOM_CODE_LENGTH) return false;
  return [...normalized].every((char) => ALPHABET.includes(char));
}

/**
 * True when two codes refer to the same room despite confusable characters.
 * Used to give a helpful "did you mean" rather than a blunt "not found".
 */
export function looksLikeTypo(a: string, b: string): boolean {
  const fold = (s: string) =>
    [...normalizeRoomCode(s)].map((c) => CONFUSABLES[c] ?? c).join("");
  return fold(a) === fold(b) && normalizeRoomCode(a) !== normalizeRoomCode(b);
}
