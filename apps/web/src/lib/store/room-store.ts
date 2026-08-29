import { create } from "zustand";
import type { Room, Player, ChatMessage, PlayerReaction } from "@playora/game-types";

interface RoomStoreState {
  currentRoom: Room | null;
  isConnected: boolean;
  isConnecting: boolean;
  messages: ChatMessage[];
  reactions: PlayerReaction[];
  error: string | null;
  setRoom: (room: Room | null) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  addMessage: (msg: ChatMessage) => void;
  addReaction: (reaction: PlayerReaction) => void;
  updatePlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  setError: (err: string | null) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomStoreState>((set) => ({
  currentRoom: null,
  isConnected: false,
  isConnecting: false,
  messages: [],
  reactions: [],
  error: null,

  setRoom: (room) => set({ currentRoom: room }),
  setConnected: (connected) => set({ isConnected: connected, isConnecting: false }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages.slice(-100), msg] })),
  addReaction: (reaction) =>
    set((state) => ({ reactions: [...state.reactions.slice(-20), reaction] })),
  updatePlayer: (player) =>
    set((state) => {
      if (!state.currentRoom) return state;
      return {
        currentRoom: {
          ...state.currentRoom,
          players: {
            ...state.currentRoom.players,
            [player.userId]: player,
          },
        },
      };
    }),
  removePlayer: (playerId) =>
    set((state) => {
      if (!state.currentRoom) return state;
      const { [playerId]: _, ...restPlayers } = state.currentRoom.players;
      return {
        currentRoom: {
          ...state.currentRoom,
          players: restPlayers,
        },
      };
    }),
  setError: (err) => set({ error: err }),
  reset: () =>
    set({
      currentRoom: null,
      isConnected: false,
      isConnecting: false,
      messages: [],
      reactions: [],
      error: null,
    }),
}));
