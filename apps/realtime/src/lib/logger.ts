/**
 * Minimal structured logging. Cloudflare's observability pipeline ingests
 * console output, so a single JSON line per event keeps logs queryable.
 *
 * Never pass tokens, secrets or raw message bodies through here (spec §99).
 */
type LogFields = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};

/** Reduces an unknown thrown value to something safe to log. */
export function errorFields(err: unknown): LogFields {
  if (err instanceof Error) return { errorName: err.name, errorMessage: err.message };
  return { errorMessage: String(err) };
}
