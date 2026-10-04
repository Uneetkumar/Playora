"use client";

import * as React from "react";
import { FlaskConical, Gamepad2, Keyboard, MousePointer2, Play, Hand, Volume2, VolumeX } from "lucide-react";
import { effectiveVolume } from "@playora/audio";
import { BIKES, CARS, type VehicleSpec } from "@playora/game-engine";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Slider,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
} from "@playora/ui";
import { useAudioStore } from "../../../lib/store/audio-store";
import { RACE_AUDIO_EVENTS, type RaceAudioEvent, type RaceAudioFrame, type RaceAudioOpponent } from "../../../games/racing/audio/race-audio";
import { useRaceAudio } from "../../../games/racing/audio/use-race-audio";
import { engineProfileFor } from "../../../games/racing/audio/engine-profiles";
import { runRaceAudioSelfTest, type SelfTestResult } from "../../../games/racing/audio/self-test";
import { useRaceInput, type AnalogInput, type InputSource } from "../../../games/racing/input/race-input";
import { useTouchCapable } from "../../../games/racing/touch-controls";

const VEHICLES: VehicleSpec[] = [...CARS, ...BIKES];

const EVENT_LABELS: Record<RaceAudioEvent, string> = {
  "countdown-beep": "Start light",
  go: "Go",
  "gear-up": "Upshift",
  "gear-down": "Downshift",
  nitro: "Nitro",
  collision: "Collision",
  "skid-start": "Skid",
  lap: "Lap",
  "final-lap": "Final lap",
  finish: "Finish",
  coin: "Coin",
  "boost-pad": "Boost pad",
  "mini-turbo": "Mini-turbo",
};

const SOURCE_ICON: Record<InputSource, React.ComponentType<{ className?: string }>> = {
  keyboard: Keyboard,
  gamepad: Gamepad2,
  pointer: MousePointer2,
  touch: Hand,
};

interface Controls {
  rpm: number;
  throttle: number;
  speed: number;
  slip: number;
  nitro: boolean;
  offRoad: boolean;
  drive: boolean;
  flyBy: boolean;
  pack: boolean;
}

interface Sim {
  speed: number;
  gear: number;
  rpm: number;
  slip: number;
}

interface Live {
  input: AnalogInput;
  frame: RaceAudioFrame;
  gear: number;
  source: InputSource | null;
  cameraPresses: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * One step of a toy drivetrain, enough to hear gear changes and the overrun:
 * speed from throttle, revs from speed through the real gear ratios, and a
 * shift at the limiter. The real physics lives in the engine package; this
 * only has to be believable for the ears.
 */
function stepSim(sim: Sim, v: VehicleSpec, input: AnalogInput, dt: number): RaceAudioEvent[] {
  const p = v.physics;
  const events: RaceAudioEvent[] = [];
  const ratios = p.gearRatios;
  const top = p.topSpeedKmh / 3.6;
  const circumference = 2 * Math.PI * p.wheelRadiusM;
  const last = ratios[ratios.length - 1] ?? 1;
  // The final drive that puts top speed at the redline in top gear.
  const final = (p.redlineRpm * circumference) / (60 * top * last);
  const ratio = (ratios[sim.gear - 1] ?? last) * final;
  const first = ratios[0] ?? 1;

  const pull =
    input.throttle * (v.kind === "bike" ? 9.5 : 8.5) * Math.sqrt(first / (ratios[sim.gear - 1] ?? last)) * (1 - (sim.speed / top) ** 2) * (input.nitro ? 1.3 : 1);
  const accel = pull - input.brake * 11 - 0.25 - 0.0004 * sim.speed * sim.speed;
  sim.speed = Math.max(0, sim.speed + accel * dt);

  const wheelRpm = (sim.speed / circumference) * 60 * ratio;
  // In first, the clutch slips: revs follow the throttle until the wheels catch up.
  const launch = sim.gear === 1 ? p.idleRpm + input.throttle * (p.redlineRpm * 0.55 - p.idleRpm) : p.idleRpm;
  sim.rpm = Math.min(p.redlineRpm * 1.02, Math.max(p.idleRpm, wheelRpm, launch));

  if (sim.rpm >= p.redlineRpm * 0.96 && sim.gear < ratios.length && input.throttle > 0.3) {
    sim.gear += 1;
    events.push("gear-up");
  } else if (sim.gear > 1 && sim.rpm < p.redlineRpm * 0.42) {
    sim.gear -= 1;
    events.push("gear-down");
  }

  const slip = clamp01(Math.abs(input.steer) * (sim.speed / 35) - 0.25 + (input.handbrake && sim.speed > 8 ? 0.7 : 0));
  if (slip > 0.35 && sim.slip <= 0.35) events.push("skid-start");
  sim.slip = slip;
  return events;
}

/** Opponents for the fly-by and pack demos, around a listener at the origin facing -z. */
function demoOpponents(controls: Controls, seconds: number): RaceAudioOpponent[] {
  const list: RaceAudioOpponent[] = [];
  if (controls.flyBy) {
    // One car past the right shoulder at 200 km/h, every eight seconds.
    const travelled = (seconds * 55) % 440;
    list.push({ id: "fly-by", x: 4, y: 0.5, z: -220 + travelled, rpm: 7200 });
  }
  if (controls.pack) {
    const wobble = (phase: number) => Math.sin(seconds * 0.7 + phase);
    list.push(
      { id: "pack-1", x: -3.5, y: 0.5, z: -9 + 3 * wobble(0), rpm: 5200 + 900 * wobble(1) },
      { id: "pack-2", x: 3.2, y: 0.5, z: -18 + 4 * wobble(2), rpm: 6100 + 700 * wobble(3) },
      { id: "pack-3", x: -4, y: 0.5, z: 11 + 3 * wobble(4), rpm: 5600 + 800 * wobble(5) },
      { id: "pack-4", x: 4.5, y: 0.5, z: 26 + 5 * wobble(6), rpm: 6600 + 600 * wobble(7) },
    );
  }
  return list;
}

const LISTENER = { x: 0, y: 1.2, z: 0, fx: 0, fy: 0, fz: -1 };

export function RaceAudioBench() {
  const [vehicleId, setVehicleId] = React.useState<string>(VEHICLES[0]?.id ?? "car-gt");
  const vehicle = VEHICLES.find((v) => v.id === vehicleId) ?? VEHICLES[0]!;
  const audio = useRaceAudio({ vehicle: vehicle.modelId });
  const input = useRaceInput();
  const touchCapable = useTouchCapable();
  const mixer = useAudioStore((s) => s.mixer);
  const gameSoundsOn = effectiveVolume(mixer, "sfx") > 0;

  const [controls, setControls] = React.useState<Controls>({
    rpm: vehicle.physics.idleRpm,
    throttle: 0,
    speed: 0,
    slip: 0,
    nitro: false,
    offRoad: false,
    drive: false,
    flyBy: false,
    pack: false,
  });
  const [muted, setMuted] = React.useState(false);
  const [strength, setStrength] = React.useState(0.7);
  const [live, setLive] = React.useState<Live | null>(null);
  const [selfTest, setSelfTest] = React.useState<SelfTestResult | null>(null);
  const [selfTestError, setSelfTestError] = React.useState<string | null>(null);
  const [testing, setTesting] = React.useState(false);

  const controlsRef = React.useRef(controls);
  const vehicleRef = React.useRef(vehicle);
  React.useEffect(() => {
    controlsRef.current = controls;
    vehicleRef.current = vehicle;
  }, [controls, vehicle]);

  const padRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    input.attach(padRef.current);
    return () => input.dispose();
  }, [input]);

  React.useEffect(() => {
    audio.setMuted(muted);
  }, [audio, muted]);

  // The frame loop: read the controls, step the toy car, feed the audio.
  React.useEffect(() => {
    const sim: Sim = { speed: 0, gear: 1, rpm: 0, slip: 0 };
    let raf = 0;
    let last = performance.now();
    const began = last;
    let count = 0;
    let cameraPresses = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const c = controlsRef.current;
      const v = vehicleRef.current;
      const read = input.read();
      if (read.cameraNext) cameraPresses++;

      let frame: RaceAudioFrame;
      if (c.drive) {
        for (const e of stepSim(sim, v, read, dt)) audio.event(e, 0.8);
        frame = {
          rpm: sim.rpm,
          rpmMax: v.physics.redlineRpm,
          throttle: read.throttle,
          speed: sim.speed,
          slip: sim.slip,
          nitro: read.nitro,
          offRoad: c.offRoad,
          kind: v.kind,
        };
      } else {
        sim.speed = c.speed;
        sim.rpm = c.rpm;
        frame = {
          rpm: c.rpm,
          rpmMax: v.physics.redlineRpm,
          throttle: c.throttle,
          speed: c.speed,
          slip: c.slip,
          nitro: c.nitro,
          offRoad: c.offRoad,
          kind: v.kind,
        };
      }
      audio.frame(frame, dt);
      audio.setOpponents(demoOpponents(c, (now - began) / 1000), LISTENER);

      // The readout is for eyes, which do not need sixty updates a second.
      if (++count % 4 === 0) {
        setLive({ input: read, frame, gear: c.drive ? sim.gear : 0, source: input.lastSource, cameraPresses });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audio, input]);

  const set = <K extends keyof Controls>(key: K, value: Controls[K]) => setControls((c) => ({ ...c, [key]: value }));

  const selectVehicle = (id: string) => {
    const next = VEHICLES.find((v) => v.id === id);
    if (!next) return;
    setVehicleId(id);
    setControls((c) => ({ ...c, rpm: Math.min(Math.max(c.rpm, next.physics.idleRpm), next.physics.redlineRpm) }));
  };

  const fire = (event: RaceAudioEvent, value = strength) => {
    audio.start();
    audio.event(event, value);
  };

  const countdown = () => {
    audio.start();
    for (let i = 0; i < 5; i++) window.setTimeout(() => audio.event("countdown-beep"), i * 1000);
    window.setTimeout(() => audio.event("go"), 5000 + 400);
  };

  const runSelfTest = async () => {
    setTesting(true);
    setSelfTestError(null);
    try {
      const result = await runRaceAudioSelfTest(vehicle.modelId, vehicle.kind, vehicle.physics.idleRpm, vehicle.physics.redlineRpm);
      setSelfTest(result);
      (window as unknown as { __raceAudioSelfTest?: SelfTestResult }).__raceAudioSelfTest = result;
    } catch (error) {
      setSelfTestError(error instanceof Error ? error.message : String(error));
    } finally {
      setTesting(false);
    }
  };

  const profile = engineProfileFor(vehicle.modelId, vehicle.kind);
  const shown = live?.frame;
  const SourceIcon = live?.source ? SOURCE_ICON[live.source] : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-foreground">Race audio bench</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Every engine, cue and control the race uses, outside a race. Audio starts on the first click or key;
            drive the engine with the keyboard or a gamepad once Drive is on.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => audio.start()} className="gap-2">
            <Play className="h-4 w-4" aria-hidden />
            Start audio
          </Button>
          <Button variant="outline" className="gap-2" aria-pressed={muted} onClick={() => setMuted((m) => !m)}>
            {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
            {muted ? "Unmute race" : "Mute race"}
          </Button>
        </div>
      </header>

      {!gameSoundsOn && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/15 px-4 py-3 text-sm text-warning-ink">
          <span>Game sounds are muted in Settings, so the bench is silent.</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const store = useAudioStore.getState();
              if (store.mixer.muted) store.setMuted(false);
              if (store.mixer.mutedBuses.includes("sfx")) store.toggleBusMuted("sfx");
              if (store.mixer.master <= 0) store.setMaster(0.7);
              if ((store.mixer.volumes.sfx ?? 0) <= 0) store.setVolume("sfx", 0.8);
            }}
          >
            Turn game sounds on
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Two columns that stack independently, so a short card never stretches to match a tall one. */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Engine</CardTitle>
              <CardDescription>
                {vehicle.name} · {profile.label} · {profile.voice.cylinders} cylinders, redline{" "}
                {vehicle.physics.redlineRpm.toLocaleString()} rpm
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={vehicleId}
                onValueChange={(v) => v && selectVehicle(v)}
                className="flex flex-wrap justify-start"
                aria-label="Vehicle"
              >
                {VEHICLES.map((v) => (
                  <ToggleGroupItem key={v.id} value={v.id}>
                    {v.name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2">
                <Label htmlFor="bench-drive" className="text-sm">
                  Drive with keyboard or gamepad
                  <span className="block text-xs font-normal text-muted-foreground">
                    W / RT throttle, S / LT brake, Shift / A nitro, Space / X handbrake
                  </span>
                </Label>
                <Switch id="bench-drive" checked={controls.drive} onCheckedChange={(on) => set("drive", on)} />
              </div>

              <BenchSlider
                id="bench-rpm"
                label="Revs"
                value={controls.drive && shown ? shown.rpm : controls.rpm}
                display={`${Math.round(controls.drive && shown ? shown.rpm : controls.rpm).toLocaleString()} rpm${
                  live && live.gear > 0 ? ` · gear ${live.gear}` : ""
                }`}
                min={vehicle.physics.idleRpm}
                max={vehicle.physics.redlineRpm}
                step={50}
                disabled={controls.drive}
                onChange={(v) => set("rpm", v)}
              />
              <BenchSlider
                id="bench-throttle"
                label="Throttle"
                value={controls.drive && shown ? shown.throttle : controls.throttle}
                display={`${Math.round((controls.drive && shown ? shown.throttle : controls.throttle) * 100)}%`}
                min={0}
                max={1}
                step={0.01}
                disabled={controls.drive}
                onChange={(v) => set("throttle", v)}
              />
              <BenchSlider
                id="bench-speed"
                label="Speed"
                value={controls.drive && shown ? shown.speed : controls.speed}
                display={`${Math.round((controls.drive && shown ? shown.speed : controls.speed) * 3.6)} km/h`}
                min={0}
                max={95}
                step={0.5}
                disabled={controls.drive}
                onChange={(v) => set("speed", v)}
              />
              <BenchSlider
                id="bench-slip"
                label="Tyre slip"
                value={controls.drive && shown ? shown.slip : controls.slip}
                display={`${Math.round((controls.drive && shown ? shown.slip : controls.slip) * 100)}%`}
                min={0}
                max={1}
                step={0.01}
                disabled={controls.drive}
                onChange={(v) => set("slip", v)}
              />
              <div className="flex flex-wrap gap-6">
                <SwitchRow id="bench-nitro" label="Nitro" checked={controls.nitro} disabled={controls.drive} onChange={(on) => set("nitro", on)} />
                <SwitchRow id="bench-offroad" label="Off road" checked={controls.offRoad} onChange={(on) => set("offRoad", on)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Opponents</CardTitle>
              <CardDescription>
                Placed around a listener facing down the track. Headphones make the panning obvious; the fly-by is
                where the Doppler shift is easiest to hear.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6">
              <SwitchRow id="bench-flyby" label="Fly-by at 200 km/h" checked={controls.flyBy} onChange={(on) => set("flyBy", on)} />
              <SwitchRow id="bench-pack" label="Pack of four" checked={controls.pack} onChange={(on) => set("pack", on)} />
            </CardContent>
          </Card>

        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cues</CardTitle>
              <CardDescription>One-shots. Strength scales collisions and skids; mini-turbo has three tiers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {RACE_AUDIO_EVENTS.filter((e) => e !== "mini-turbo").map((event) => (
                  <Button key={event} variant="outline" size="sm" onClick={() => fire(event)}>
                    {EVENT_LABELS[event]}
                  </Button>
                ))}
                {[1, 2, 3].map((tier) => (
                  <Button key={tier} variant="outline" size="sm" onClick={() => fire("mini-turbo", tier)}>
                    Mini-turbo {tier}
                  </Button>
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={countdown}>
                Five lights and go
              </Button>
              <BenchSlider
                id="bench-strength"
                label="Strength"
                value={strength}
                display={strength.toFixed(2)}
                min={0}
                max={1}
                step={0.05}
                onChange={setStrength}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Input</CardTitle>
              <CardDescription>
                What RaceInput.read() returns, live. Hold the mouse on the pad below to steer with the pointer.
                Touch controls would show here: {touchCapable ? "yes" : "no"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SteerMeter value={live?.input.steer ?? 0} />
              <Meter label="Throttle" value={live?.input.throttle ?? 0} />
              <Meter label="Brake" value={live?.input.brake ?? 0} />
              <div className="flex flex-wrap items-center gap-2" aria-label="Buttons held">
                {(["handbrake", "nitro", "lookBack"] as const).map((b) => (
                  <Badge key={b} variant={live?.input[b] ? "default" : "outline"}>
                    {b === "lookBack" ? "Look back" : b === "handbrake" ? "Handbrake" : "Nitro"}
                  </Badge>
                ))}
                <Badge variant="secondary">Camera presses: {live?.cameraPresses ?? 0}</Badge>
                <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  {SourceIcon && <SourceIcon className="h-4 w-4" aria-hidden />}
                  {live?.source ? `Last used: ${live.source}` : "No input yet"}
                </span>
              </div>
              <div
                ref={padRef}
                tabIndex={0}
                aria-label="Pointer steering pad: hold the left button to accelerate and steer, the right button to brake"
                className="flex h-28 touch-none select-none items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Pointer steering pad
              </div>
            </CardContent>
          </Card>

        </div>

        <Card className="lg:col-span-2" data-selftest={selfTest ? (selfTest.passed ? "pass" : "fail") : selfTestError ? "error" : "idle"}>
          <CardHeader>
            <CardTitle>Self-test</CardTitle>
            <CardDescription>
              Renders the selected engine and every cue offline and measures them: not silent, pitch rising with the
              revs, an opponent on the right louder on the right.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="secondary" className="gap-2" onClick={runSelfTest} disabled={testing}>
              <FlaskConical className="h-4 w-4" aria-hidden />
              {testing ? "Rendering…" : "Run offline self-test"}
            </Button>
            {selfTestError && <p className="text-sm text-destructive-ink">Could not run: {selfTestError}</p>}
            {selfTest && <SelfTestReport result={selfTest} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BenchSlider({
  id,
  label,
  value,
  display,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <Label id={`${id}-label`} className="text-sm">
          {label}
        </Label>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{display}</span>
      </div>
      <Slider
        aria-labelledby={`${id}-label`}
        value={[Math.min(max, Math.max(min, value))]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([v]) => v !== undefined && onChange(v)}
      />
    </div>
  );
}

function SwitchRow({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const pct = Math.round(clamp01(value) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SteerMeter({ value }: { value: number }) {
  const v = Math.max(-1, Math.min(1, value));
  const half = Math.abs(v) * 50;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Steering</span>
        <span className="font-mono tabular-nums">{v.toFixed(2)}</span>
      </div>
      <div
        className="relative h-2 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label="Steering"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={Math.round(v * 100)}
      >
        <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/30" />
        <div
          className="absolute inset-y-0 rounded-full bg-primary"
          style={v >= 0 ? { left: "50%", width: `${half}%` } : { right: "50%", width: `${half}%` }}
        />
      </div>
    </div>
  );
}

function SelfTestReport({ result }: { result: SelfTestResult }) {
  return (
    <div className="space-y-4 text-sm">
      <p className={result.passed ? "font-semibold text-success-ink" : "font-semibold text-destructive-ink"}>
        {result.passed ? "Passed" : `Failed: ${result.failures.join("; ")}`}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-xs">
          <caption className="sr-only">Engine renders at full throttle</caption>
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 pr-4 font-medium">Revs</th>
              <th scope="col" className="py-1 pr-4 font-medium">Firing frequency</th>
              <th scope="col" className="py-1 pr-4 font-medium">Measured (zero crossings)</th>
              <th scope="col" className="py-1 font-medium">Level (RMS)</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums text-foreground">
            {result.engine.map((p) => (
              <tr key={p.rpm} className="border-t border-border">
                <td className="py-1 pr-4">{p.rpm.toLocaleString()} rpm</td>
                <td className="py-1 pr-4">{p.firingHz.toFixed(0)} Hz</td>
                <td className="py-1 pr-4">{p.zcrHz.toFixed(0)} Hz</td>
                <td className="py-1">{p.rms.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        {result.events.map((e) => (
          <Badge key={e.event} variant={e.peak > 0.01 ? "success" : "destructive"}>
            {EVENT_LABELS[e.event]} {e.peak.toFixed(2)}
          </Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Opponent 10 m right: L {result.panning.rightOfListener[0].toFixed(3)} / R{" "}
        {result.panning.rightOfListener[1].toFixed(3)} · 10 m left: L {result.panning.leftOfListener[0].toFixed(3)} / R{" "}
        {result.panning.leftOfListener[1].toFixed(3)}
      </p>
    </div>
  );
}
