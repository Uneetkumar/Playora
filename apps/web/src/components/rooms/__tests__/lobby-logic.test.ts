import { describe, expect, it } from "vitest";
import type { Player } from "@playora/game-types";
import {
  MAX_VISIBLE_SEATS,
  actionHint,
  arrangeSeats,
  countUnread,
  formatUnread,
  lobbyReadiness,
  minPlayersFor,
  rematchBlocker,
  seatCountFor,
  seatedPlayers,
  spectatorsOf,
  viewerRole,
} from "../lobby-logic";

function player(userId: string, over: Partial<Player> = {}): Player {
  return {
    id: userId,
    userId,
    username: userId,
    displayName: userId,
    avatarUrl: null,
    role: "player",
    isReady: false,
    seatIndex: 0,
    status: "connected",
    joinedAt: 0,
    lastPingAt: 0,
    isGuest: false,
    ...over,
  };
}

describe("seats", () => {
  it("draws one seat per player the game takes, capped for the grid", () => {
    expect(seatCountFor(2)).toBe(2);
    expect(seatCountFor(6)).toBe(6);
    expect(seatCountFor(16)).toBe(MAX_VISIBLE_SEATS);
    expect(seatCountFor(0)).toBe(1);
  });

  it("keeps each player in their server seat, leaving gaps where people left", () => {
    const seats = arrangeSeats([player("a", { seatIndex: 0 }), player("c", { seatIndex: 2 })], 4);
    expect(seats.map((s) => s?.userId ?? null)).toEqual(["a", null, "c", null]);
  });

  it("finds a free seat for a clash or an out-of-range index, and never drops anyone", () => {
    const seats = arrangeSeats(
      [
        player("a", { seatIndex: 0, joinedAt: 1 }),
        player("b", { seatIndex: 0, joinedAt: 2 }),
        player("c", { seatIndex: 9 }),
        player("d", { seatIndex: -1 }),
      ],
      3,
    );
    // The displaced fill free seats in seat-index order; the grid grows for the last.
    expect(seats.map((s) => s?.userId)).toEqual(["a", "d", "b", "c"]);
  });

  it("uses the engine's minimum where there is one", () => {
    expect(minPlayersFor("chess")).toBe(2);
    expect(minPlayersFor("car-race")).toBe(1);
  });
});

describe("who is where", () => {
  const room = {
    hostId: "h",
    players: {
      h: player("h", { role: "host" }),
      g: player("g"),
      // A spectator that arrived through PLAYER_JOINED and was filed as a player.
      s: player("s", { role: "spectator" }),
    },
    spectators: { w: player("w", { role: "spectator" }) },
  };

  it("keeps spectators out of the seats, wherever they were filed", () => {
    expect(seatedPlayers(room).map((p) => p.userId)).toEqual(["h", "g"]);
    expect(spectatorsOf(room).map((p) => p.userId).sort()).toEqual(["s", "w"]);
  });

  it("works out the viewer's role", () => {
    expect(viewerRole(room, "h")).toBe("host");
    expect(viewerRole(room, "g")).toBe("player");
    expect(viewerRole(room, "s")).toBe("spectator");
    expect(viewerRole(room, "w")).toBe("spectator");
    expect(viewerRole(null, "g")).toBe("spectator");
  });
});

describe("rematch", () => {
  const alone = { h: player("h", { role: "host" }) };
  const pair = { ...alone, g: player("g") };

  it("is blocked once a two-player game is a seat short after the match", () => {
    expect(rematchBlocker({ status: "finished", players: alone }, "chess")).toBe("Not enough players");
    expect(rematchBlocker({ status: "finished", players: pair }, "chess")).toBeNull();
  });

  it("does not count a spectator filed under players as a seat", () => {
    const withWatcher = { ...alone, s: player("s", { role: "spectator" }) };
    expect(rematchBlocker({ status: "finished", players: withWatcher }, "chess")).toBe("Not enough players");
  });

  it("allows a solo rematch where the game deals for one, and says nothing mid-match", () => {
    expect(rematchBlocker({ status: "finished", players: alone }, "car-race")).toBeNull();
    expect(rematchBlocker({ status: "in_game", players: alone }, "chess")).toBeNull();
  });
});

describe("readiness", () => {
  const host = player("h", { role: "host" });

  it("blocks Start on the server's rule and says why", () => {
    const r = lobbyReadiness({
      seated: [host, player("g1"), player("g2"), player("b", { isBot: true })],
      hostId: "h",
      minPlayers: 2,
    });
    expect(r.reason).toBe("Waiting for 2 players to ready up");
    // The host and the bot count as ready; the two guests do not.
    expect(r.readyCount).toBe(2);
    expect(r.seatedCount).toBe(4);
  });

  it("asks for more players before asking anyone to ready up", () => {
    const r = lobbyReadiness({ seated: [host], hostId: "h", minPlayers: 2 });
    expect(r.reason).toBe("Waiting for 1 more player to join");
  });

  it("clears once everyone is ready", () => {
    const r = lobbyReadiness({ seated: [host, player("g", { isReady: true })], hostId: "h", minPlayers: 2 });
    expect(r.blocker).toBeNull();
    expect(actionHint("host", r, false)).toMatch(/Start when you are/);
  });

  it("tells a guest what they are waiting on", () => {
    const r = lobbyReadiness({ seated: [host, player("g")], hostId: "h", minPlayers: 2 });
    expect(actionHint("player", r, false)).toMatch(/Ready up/);
    expect(actionHint("player", r, true)).toMatch(/host starts/);
    expect(actionHint("spectator", r, false)).toMatch(/watching/);
  });
});

describe("unread chat", () => {
  const msgs = [
    { id: "1", senderId: "a" },
    { id: "2", senderId: "me" },
    { id: "3", senderId: "b" },
    { id: "4", senderId: "a" },
  ];

  it("counts other people's messages after the last one seen", () => {
    expect(countUnread(msgs, "2", "me")).toBe(2);
    expect(countUnread(msgs, "4", "me")).toBe(0);
  });

  it("counts everything from others when nothing has been seen", () => {
    expect(countUnread(msgs, null, "me")).toBe(3);
  });

  it("caps the badge text", () => {
    expect(formatUnread(3)).toBe("3");
    expect(formatUnread(12)).toBe("9+");
  });
});
