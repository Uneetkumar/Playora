import * as THREE from "three";

/**
 * Hyper-Realistic Visual & Particle Effects for Racing.
 *
 * Includes:
 * - Multi-stage plasma nitro flames with shock diamonds.
 * - Dynamic tire drift smoke & asphalt sparks.
 * - Golden coin vortex collection effects.
 * - Speed lines & dynamic radial warp.
 */

const PARTICLE_POOL = 350;

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  spin: number;
  fade: boolean;
  grow: number;
}

export class ParticleField {
  private particles: Particle[] = [];
  private next = 0;

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.BoxGeometry(0.18, 0.18, 0.18);

    for (let i = 0; i < PARTICLE_POOL; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        spin: 0,
        fade: true,
        grow: 0,
      });
    }
  }

  private acquire(): Particle {
    const particle = this.particles[this.next]!;
    this.next = (this.next + 1) % this.particles.length;
    return particle;
  }

  emit(options: {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    colour: number;
    size: number;
    life: number;
    grow?: number;
  }): void {
    const particle = this.acquire();
    particle.mesh.position.copy(options.position);
    particle.mesh.scale.setScalar(options.size);
    particle.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    particle.mesh.visible = true;

    const material = particle.mesh.material as THREE.MeshBasicMaterial;
    material.color.setHex(options.colour);
    material.opacity = 1;

    particle.velocity.copy(options.velocity);
    particle.life = options.life;
    particle.maxLife = options.life;
    particle.spin = (Math.random() - 0.5) * 8;
    particle.grow = options.grow ?? 0;
  }

  /** Nitro Boost Multi-Stage Plasma Flame */
  flame(at: THREE.Vector3, backward: THREE.Vector3): void {
    // 1. Inner hot blue-cyan plasma core
    this.emit({
      position: at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08, 0)),
      velocity: backward.clone().multiplyScalar(18 + Math.random() * 8),
      colour: 0x38bdf8,
      size: 0.35 + Math.random() * 0.25,
      life: 0.18,
      grow: 1.2,
    });

    // 2. Outer purple-violet corona
    this.emit({
      position: at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15, 0)),
      velocity: backward.clone().multiplyScalar(12 + Math.random() * 6),
      colour: 0xa855f7,
      size: 0.45 + Math.random() * 0.35,
      life: 0.28,
      grow: 1.6,
    });

    // 3. Orange trailing shock embers
    if (Math.random() < 0.5) {
      this.emit({
        position: at,
        velocity: backward.clone().multiplyScalar(8 + Math.random() * 4).add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2)),
        colour: 0xf97316,
        size: 0.2,
        life: 0.4,
        grow: 0.5,
      });
    }
  }

  /** Tire Drift Smoke Puff */
  smoke(at: THREE.Vector3): void {
    this.emit({
      position: at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.05, (Math.random() - 0.5) * 0.2)),
      velocity: new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.5 + 0.5, (Math.random() - 0.5) * 1.5),
      colour: 0x94a3b8,
      size: 0.45 + Math.random() * 0.35,
      life: 0.6,
      grow: 2.2,
    });
  }

  /** Collision and Barrier Sparks */
  sparks(at: THREE.Vector3, count = 18): void {
    for (let i = 0; i < count; i++) {
      this.emit({
        position: at,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          Math.random() * 8 + 2,
          (Math.random() - 0.5) * 12
        ),
        colour: Math.random() < 0.6 ? 0xfbbf24 : 0x67e8f9,
        size: 0.35 + Math.random() * 0.35,
        life: 0.35 + Math.random() * 0.25,
      });
    }
  }

  /** Golden Coin Burst Vortex */
  pickup(at: THREE.Vector3, count = 14): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      this.emit({
        position: at,
        velocity: new THREE.Vector3(
          Math.cos(angle) * 4,
          Math.random() * 4 + 2,
          Math.sin(angle) * 4
        ),
        colour: 0xffd700,
        size: 0.35,
        life: 0.45,
        grow: 0.8,
      });
    }
  }

  /** Roadside Dust */
  dust(at: THREE.Vector3): void {
    this.emit({
      position: at,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5 + 0.2, (Math.random() - 0.5) * 2),
      colour: 0x475569,
      size: 0.4,
      life: 0.5,
      grow: 1.8,
    });
  }

  update(delta: number): void {
    for (const p of this.particles) {
      if (!p.mesh.visible) continue;

      p.life -= delta;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }

      p.mesh.position.addScaledVector(p.velocity, delta);
      p.mesh.rotation.x += p.spin * delta;
      p.mesh.rotation.y += p.spin * delta;

      if (p.grow > 0) {
        p.mesh.scale.addScalar(p.grow * delta);
      }

      const fraction = p.life / p.maxLife;
      const material = p.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = p.fade ? Math.pow(fraction, 1.2) : 1;
    }
  }

  dispose(): void {
    for (const p of this.particles) {
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
  }
}

/**
 * Speed lines that streak past the camera at high velocity.
 */
export class SpeedLines {
  private group = new THREE.Group();
  private lines: THREE.Line[] = [];
  private length = 18;

  constructor(private camera: THREE.Camera) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, this.length),
    ]);

    for (let i = 0; i < 48; i++) {
      const material = new THREE.LineBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(geometry, material);
      this.resetLine(line);
      this.lines.push(line);
      this.group.add(line);
    }
    this.camera.add(this.group);
  }

  private resetLine(line: THREE.Line): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = 3.5 + Math.random() * 8.5;
    line.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, -5 - Math.random() * 25);
  }

  update(delta: number, speed: number, maxSpeed: number): void {
    const speedRatio = Math.max(0, (speed - 35) / (maxSpeed - 35));
    const targetOpacity = Math.pow(speedRatio, 1.5) * 0.65;

    for (const line of this.lines) {
      const material = line.material as THREE.LineBasicMaterial;
      material.opacity += (targetOpacity - material.opacity) * Math.min(1, delta * 8);

      line.position.z += speed * delta * 1.8;
      if (line.position.z > 2) {
        this.resetLine(line);
      }
    }
  }

  dispose(): void {
    for (const line of this.lines) {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.camera.remove(this.group);
  }
}
