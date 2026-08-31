export type GameId =
  | "chess"
  | "uno"
  | "uno-no-mercy"
  | "car-race"
  | "bike-race"
  | "rope-rescue"
  | "ant-attack"
  | "bomb-pass"
  | "color-rush"
  | "falling-floor"
  | "pin-puzzle"
  | "target-rush"
  | "hot-potato"
  | "bridge-builder"
  | "ice-breaker";

export type GameCategory =
  | "board"
  | "card"
  | "racing"
  | "casual"
  | "puzzle"
  | "action"
  | "party"
  | "physics";

export type GameMode = "casual" | "ranked" | "custom";

export interface GameMetadata {
  id: GameId;
  name: string;
  slug: string;
  description: string;
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  supportsSpectators: boolean;
  estimatedDurationMinutes: number;
  thumbnailUrl: string;
  isAvailable: boolean;
}

export interface GameRuleOption {
  key: string;
  label: string;
  description: string;
  type: "boolean" | "number" | "select";
  defaultValue: unknown;
  options?: { label: string; value: unknown }[];
}
