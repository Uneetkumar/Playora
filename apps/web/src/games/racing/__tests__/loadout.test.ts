import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The loadout store, outside React.
 *
 * Storage is faked on a stand-in `window` and the module is re-imported per
 * test, because the store caches what it read: each test is a fresh page load.
 */

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

let storage: MemoryStorage;

async function load() {
  vi.resetModules();
  return import("../loadout");
}

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("window", {
    localStorage: storage,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("race loadout", () => {
  it("starts on the roster's first car in its factory paint", async () => {
    const { readRaceLoadout } = await load();
    expect(readRaceLoadout("car-race")).toEqual({ vehicleId: "car-gt", paint: "#b3122e" });
    expect(readRaceLoadout("bike-race").vehicleId).toBe("bike-balanced");
  });

  it("persists the car and a paint per car under the versioned key", async () => {
    const { readRaceLoadout, setRaceVehicle, setRacePaint, loadoutStorageKey } = await load();
    setRaceVehicle("car-race", "car-rally");
    setRacePaint("car-race", "#1F6FD1");
    setRaceVehicle("car-race", "car-gt");
    expect(readRaceLoadout("car-race")).toEqual({ vehicleId: "car-gt", paint: "#b3122e" });
    setRaceVehicle("car-race", "car-rally");
    expect(readRaceLoadout("car-race")).toEqual({ vehicleId: "car-rally", paint: "#1f6fd1" });

    expect(loadoutStorageKey("car-race")).toBe("playora:race-loadout:v1:car-race");
    const reloaded = await load();
    expect(reloaded.readRaceLoadout("car-race")).toEqual({ vehicleId: "car-rally", paint: "#1f6fd1" });
  });

  it("migrates the old single-vehicle key, translating legacy ids", async () => {
    storage.setItem("playora:vehicle:car-race", "car-grip");
    const { readRaceLoadout } = await load();
    expect(readRaceLoadout("car-race").vehicleId).toBe("car-formula");
    expect(JSON.parse(storage.getItem("playora:race-loadout:v1:car-race")!)).toMatchObject({ vehicleId: "car-formula" });
  });

  it("refuses anything storage holds that the engine would not accept", async () => {
    storage.setItem(
      "playora:race-loadout:v1:car-race",
      JSON.stringify({ vehicleId: "warp-drive", paints: { "car-gt": "url(evil)", "car-speed": "#ffffff", "car-gt ": "#000000" } }),
    );
    const { readRaceLoadout, setRacePaint } = await load();
    expect(readRaceLoadout("car-race")).toEqual({ vehicleId: "car-gt", paint: "#b3122e" });
    setRacePaint("car-race", "red");
    expect(readRaceLoadout("car-race").paint).toBe("#b3122e");
  });

  it("survives corrupt storage and storage that throws", async () => {
    storage.setItem("playora:race-loadout:v1:car-race", "{not json");
    let mod = await load();
    expect(mod.readRaceLoadout("car-race").vehicleId).toBe("car-gt");

    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("denied");
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    mod = await load();
    mod.setRaceVehicle("car-race", "car-super");
    expect(mod.readRaceLoadout("car-race").vehicleId).toBe("car-super");
  });
});
