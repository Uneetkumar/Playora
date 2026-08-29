import { describe, it, expect, afterEach } from "vitest";
import { TestClient, mintToken, ATTACKER_SECRET, uuid } from "./helpers.js";

// Closing a socket kicks off disconnect handling inside the Durable Object
// (persist, alarm scheduling). Give that a tick to drain, or it races the
// environment teardown and surfaces as an unhandled RPC rejection.
afterEach(async () => {
  TestClient.closeAll();
  await new Promise((resolve) => setTimeout(resolve, 50));
});

let roomSeq = 0;
const nextRoom = (label: string) => `auth-${label}-${roomSeq++}`;

describe("RoomDurableObject: authentication", () => {
  it("refuses every action until AUTH succeeds", async () => {
    const client = await TestClient.connect(nextRoom("gate"));

    client.send({ type: "READY", roomId: "whatever" });
    const error = await client.waitFor("ERROR");

    expect(error.code).toBe("UNAUTHENTICATED");
    client.close();
  });

  it("refuses a token signed by someone else", async () => {
    const client = await TestClient.connect(nextRoom("forged"));
    const forged = await mintToken(uuid(1), { secret: ATTACKER_SECRET });

    client.send({ type: "AUTH", token: forged, isGuest: false });
    const error = await client.waitFor("ERROR");

    expect(error.code).toBe("TOKEN_INVALID_SIGNATURE");
    expect(client.messagesOfType("CONNECTED")).toHaveLength(0);
    client.close();
  });

  it("refuses an expired token", async () => {
    const client = await TestClient.connect(nextRoom("expired"));
    const stale = await mintToken(uuid(1), { expiresIn: "-5m" });

    client.send({ type: "AUTH", token: stale, isGuest: false });

    expect((await client.waitFor("ERROR")).code).toBe("TOKEN_EXPIRED");
    client.close();
  });

  it("derives identity from verified claims, never from the query string", async () => {
    const victim = uuid(9);
    const attacker = uuid(2);

    // The attacker asks to be seated as the victim via the URL, then presents
    // a token that is valid but belongs to themselves.
    const client = await TestClient.connect(
      nextRoom("impersonate"),
      `?userId=${victim}&username=Victim`,
    );
    const connected = await client.authenticate(
      await mintToken(attacker, { name: "Attacker" }),
    );

    expect(connected.userId).toBe(attacker);
    expect(connected.userId).not.toBe(victim);

    const state = await client.waitFor("ROOM_STATE");
    expect(Object.keys(state.room.players)).toEqual([attacker]);
    expect(state.room.players[attacker]?.displayName).toBe("Attacker");
    client.close();
  });

  it("uses the token's display name, ignoring any client-supplied one", async () => {
    const client = await TestClient.connect(nextRoom("name"), "?username=NotMyRealName");
    await client.authenticate(await mintToken(uuid(3), { name: "Verified Name" }));

    const state = await client.waitFor("ROOM_STATE");
    expect(state.room.players[uuid(3)]?.displayName).toBe("Verified Name");
    client.close();
  });

  it("marks anonymous sessions as guests", async () => {
    const client = await TestClient.connect(nextRoom("guest"));
    await client.authenticate(await mintToken(uuid(4), { anonymous: true }));

    const state = await client.waitFor("ROOM_STATE");
    expect(state.room.players[uuid(4)]?.isGuest).toBe(true);
    client.close();
  });

  it("rejects a second AUTH on an already-authenticated connection", async () => {
    const client = await TestClient.connect(nextRoom("double"));
    await client.authenticate(await mintToken(uuid(5)));

    client.send({ type: "AUTH", token: await mintToken(uuid(6)), isGuest: false });

    expect((await client.waitFor("ERROR")).code).toBe("ALREADY_AUTHENTICATED");
    client.close();
  });
});
