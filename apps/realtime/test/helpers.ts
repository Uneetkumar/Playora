import { SELF } from "cloudflare:test";
import { SignJWT } from "jose";
import type { ServerMessage } from "@playora/protocol";

export const TEST_SECRET = "test-jwt-secret-that-is-long-enough-for-hs256";
export const ATTACKER_SECRET = "attacker-secret-which-is-also-long-enough-ok";

export async function mintToken(
  sub: string,
  opts: { name?: string; secret?: string; anonymous?: boolean; expiresIn?: string } = {},
): Promise<string> {
  const claims: Record<string, unknown> = {
    sub,
    role: "authenticated",
    ...(opts.anonymous ? { is_anonymous: true } : {}),
    ...(opts.name ? { user_metadata: { full_name: opts.name } } : {}),
  };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience("authenticated")
    .setExpirationTime(opts.expiresIn ?? "1h")
    .sign(new TextEncoder().encode(opts.secret ?? TEST_SECRET));
}

/** A connected test client with a message queue you can await against. */
export class TestClient {
  private received: ServerMessage[] = [];
  private waiters: Array<{
    predicate: (m: ServerMessage) => boolean;
    resolve: (m: ServerMessage) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  /** Every client opened in the current test, so they can all be torn down. */
  private static live = new Set<TestClient>();
  closed = false;
  closeCode: number | null = null;

  private constructor(readonly ws: WebSocket) {
    ws.addEventListener("message", (event: MessageEvent) => {
      const msg = JSON.parse(String(event.data)) as ServerMessage;
      this.received.push(msg);
      const idx = this.waiters.findIndex((w) => w.predicate(msg));
      if (idx >= 0) {
        const [waiter] = this.waiters.splice(idx, 1);
        waiter?.resolve(msg);
      }
    });
    ws.addEventListener("close", (event: CloseEvent) => {
      this.closed = true;
      this.closeCode = event.code;
    });
  }

  static async connect(roomId: string, query = ""): Promise<TestClient> {
    const res = await SELF.fetch(`https://playora.test/rooms/${roomId}/ws${query}`, {
      headers: { Upgrade: "websocket" },
    });
    const ws = res.webSocket;
    if (!ws) throw new Error(`Expected a WebSocket upgrade, got ${res.status}`);
    ws.accept();
    const client = new TestClient(ws as unknown as WebSocket);
    TestClient.live.add(client);
    return client;
  }

  send(msg: unknown): void {
    this.ws.send(JSON.stringify(msg));
  }

  /** Resolves with the first message matching `type` (already-received included). */
  async waitFor<T extends ServerMessage["type"]>(
    type: T,
    timeoutMs = 2000,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    return this.waitWhere((m) => m.type === type, timeoutMs) as Promise<
      Extract<ServerMessage, { type: T }>
    >;
  }

  async waitWhere(
    predicate: (m: ServerMessage) => boolean,
    timeoutMs = 2000,
  ): Promise<ServerMessage> {
    const existing = this.received.find(predicate);
    if (existing) return existing;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `Timed out. Received: ${this.received.map((m) => m.type).join(", ") || "(nothing)"}`,
          ),
        );
      }, timeoutMs);
      this.waiters.push({
        predicate,
        timer,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m);
        },
      });
    });
  }

  /** Authenticates and resolves once the server confirms identity. */
  async authenticate(token: string) {
    this.send({ type: "AUTH", token, isGuest: false });
    return this.waitFor("CONNECTED");
  }

  messagesOfType(type: ServerMessage["type"]): ServerMessage[] {
    return this.received.filter((m) => m.type === type);
  }

  close(): void {
    // Dangling timers keep the worker's event loop alive and produce a
    // teardown race at the end of the run.
    for (const waiter of this.waiters) clearTimeout(waiter.timer);
    this.waiters = [];
    TestClient.live.delete(this);
    try {
      this.ws.close();
    } catch {
      /* already closed */
    }
  }

  /** Tears down every client a test opened, including on failure paths. */
  static closeAll(): void {
    for (const client of [...TestClient.live]) client.close();
    TestClient.live.clear();
  }
}

/**
 * Readies a seated player and waits until `observer` has seen it, so a
 * START_GAME sent next cannot overtake the ready on its way to the room.
 */
export async function readyUp(player: TestClient, observer: TestClient, roomId: string, userId: string) {
  player.send({ type: "SET_READY", roomId, ready: true });
  await observer.waitWhere(
    (m) => m.type === "PLAYER_READY" && m.playerId === userId && m.isReady,
  );
}

export const uuid = (n: number) => `0000000${n}-0000-4000-8000-00000000000${n}`;
