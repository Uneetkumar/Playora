/**
 * The events Playora records (spec v2 section 80).
 *
 * A closed union rather than free-form strings, because an analytics call that
 * compiles is an analytics call that will still parse in six months. Typos in
 * event names do not fail loudly — they quietly split a funnel in two and
 * nobody notices until a number looks wrong.
 *
 * Spec v2 section 80 also says: do not collect unnecessary sensitive data. No
 * property here carries a display name, an email, a chat message or an IP. Ids
 * are the platform's own opaque identifiers and nothing more.
 */

export type AnalyticsEvent =
  // Account
  | { name: "user_created"; properties: { method: "google" | "guest" } }
  | { name: "guest_started"; properties?: Record<string, never> }
  | { name: "google_login"; properties?: Record<string, never> }

  // Discovery
  | { name: "game_viewed"; properties: { gameId: string } }

  // Matchmaking
  | { name: "quick_play_started"; properties: { gameId: string } }
  | { name: "match_found"; properties: { gameId: string; waitSeconds: number } }
  | { name: "match_cancelled"; properties: { gameId: string; waitSeconds: number } }

  // Rooms
  | { name: "room_created"; properties: { gameId: string; isPrivate: boolean } }
  | { name: "room_joined"; properties: { gameId: string } }

  // Play
  | {
      name: "game_started";
      properties: { gameId: string; mode: string; players: number; withBots: boolean };
    }
  | {
      name: "game_finished";
      properties: {
        gameId: string;
        mode: string;
        durationSeconds: number;
        /** Never who won by name — only whether this player did. */
        won: boolean;
        rated: boolean;
      };
    }
  | { name: "game_abandoned"; properties: { gameId: string; durationSeconds: number } }
  | { name: "bot_game_started"; properties: { gameId: string; aiLevel: number } }
  | { name: "rematch_started"; properties: { gameId: string } }

  // Progression and social
  | { name: "achievement_unlocked"; properties: { achievementId: string } }
  | { name: "friend_added"; properties?: Record<string, never> }
  | { name: "invite_sent"; properties: { kind: "room" | "game" | "rematch" } }
  | { name: "invite_accepted"; properties: { kind: "room" | "game" | "rematch" } }

  // Racing
  | { name: "race_started"; properties: { gameId: string; trackSeed: number; laps: number } }
  | {
      name: "race_finished";
      properties: {
        gameId: string;
        place: number;
        totalPlayers: number;
        raceTimeSeconds: number;
        bestLapSeconds: number | null;
      };
    }
  | { name: "race_abandoned"; properties: { gameId: string; lapsCompleted: number } }
  | { name: "track_selected"; properties: { gameId: string; levelIndex: number } }
  | { name: "vehicle_selected"; properties: { gameId: string; vehicleId: string } }
  | { name: "quality_changed"; properties: { tier: "low" | "medium" | "high" } }
  | { name: "control_mode_changed"; properties: { scheme: string } };

export type AnalyticsEventName = AnalyticsEvent["name"];

/**
 * Properties attached to every event.
 *
 * Deliberately short. Anything identifying a person beyond their own account id
 * does not belong here.
 */
export interface AnalyticsContext {
  /** The platform's own user id, or null for a signed-out visitor. */
  userId: string | null;
  isGuest: boolean;
  /** Set once at startup so events can be grouped by release. */
  appVersion: string;
}
