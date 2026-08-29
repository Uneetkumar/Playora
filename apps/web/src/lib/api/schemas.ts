import { z } from "zod";
import { ROOM_CODE_LENGTH } from "@playden/game-types";

/**
 * Request shapes for the room API.
 *
 * Everything crossing the network boundary is validated here. Note what is
 * deliberately absent: `hostId`. The host is taken from the authenticated
 * session, never from the request body (spec section 83).
 */
export const CreateRoomSchema = z.object({
  gameSlug: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(64).optional(),
  isPrivate: z.boolean().default(false),
  maxPlayers: z.number().int().min(2).max(8).optional(),
});

export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;

export const RoomCodeSchema = z
  .string()
  .trim()
  .min(ROOM_CODE_LENGTH)
  .max(ROOM_CODE_LENGTH + 4);

export const ListRoomsQuerySchema = z.object({
  game: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
