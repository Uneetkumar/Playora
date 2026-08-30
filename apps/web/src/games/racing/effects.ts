import * as THREE from "three";

/**
 * Everything that makes speed *feel* like speed.
 *
 * A race with correct physics and no effects reads as a car sliding along a
 * texture. What sells it is the things that are strictly unnecessary: the flame
 * out of the exhaust, the streaks past the camera, the sparks off a barrier,
 * the dust when a wheel drops onto the runoff.
 *
 * All of it is pooled. Allocating a mesh per spark would allocate hundreds a
 * second and hand the garbage collector a stutter at exactly the moment the
 * player is being asked to react to something.
 */

const PARTICLE_POOL = 220;

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

  /** Takes the next slot, recycling the oldest when the pool is exhausted. */
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

  /** A burst of sparks, for hitting something. */
  sparks(at: THREE.Vector3, count = 14): void {
    for (let i = 0; i < count; i++) {
      this.emit({
        position: at,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 9,
          Math.random() * 6 + 1,
          (Math.random() - 0.5) * 9,
        ),
        colour: Math.random() < 0.5 ? 0xffb347 : 0xfff3c4,
        size: 0.5 + Math.random() * 0.5,
        life: 0.45 + Math.random() * 0.35,
      });
    }
  }

  /** Exhaust flame, emitted continuously while boosting. */
  flame(at: THREE.Vector3, backward: THREE.Vector3): void {
    this.emit({
      position: at,
      velocity: backward
        .clone()
        .multiplyScalar(7 + Math.random() * 5)
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 1.6,
            Math.random() * 1.2,
            (Math.random() - 0.5) * 1.6,
          ),
        ),
      colour: Math.random() < 0.35 ? 0x66e0ff : Math.random() < 0.6 ? 0xffb347 : 0xff5c3d,
      size: 1.0 + Math.random() * 0.9,
      life: 0.3 + Math.random() * 0.2,
      grow: -1.4,
    });
  }

  /** Dust thrown up by a wheel on the runoff. */
  dust(at: THREE.Vector3): void {
    this.emit({
      position: at,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 2.5 + 0.5,
        (Math.random() - 0.5) * 3,
      ),
      colour: 0x6b4fa0,
      size: 1.2 + Math.random(),
      life: 0.6 + Math.random() * 0.4,
      grow: 2.2,
    });
  }

  /** A bright pop where a coin was taken. */
  pickup(at: THREE.Vector3): void {
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      this.emit({
        position: at,
        velocity: new THREE.Vector3(Math.cos(angle) * 4, 2 + Math.random() * 2, Math.sin(angle) * 4),
        colour: 0xffc93c,
        size: 0.6,
        life: 0.5,
        grow: -0.8,
      });
    }
  }

  update(delta: number): void {
    for (const particle of this.particles) {
      if (particle.life <= 0) continue;

      particle.life -= delta;
      if (particle.life <= 0) {
        particle.mesh.visible = false;
        continue;
      }

      particle.mesh.position.addScaledVector(particle.velocity, delta);
      // Gravity, so sparks arc instead of flying away in straight lines.
      particle.velocity.y -= 9 * delta;
      particle.mesh.rotation.x += particle.spin * delta;
      particle.mesh.rotation.y += particle.spin * delta;

      const t = particle.life / particle.maxLife;
      (particle.mesh.material as THREE.MeshBasicMaterial).opacity = t;
      if (particle.grow !== 0) {
        particle.mesh.scale.multiplyScalar(1 + particle.grow * delta);
      }
    }
  }

  dispose(): void {
    for (const particle of this.particles) {
      (particle.mesh.material as THREE.Material).dispose();
    }
  }
}

/**
 * Streaks that fly past the camera at speed.
 *
 * Parented to the camera rather than the world, so they always surround the
 * viewer regardless of where the car is on the track, and recycled forward as
 * they pass behind. Fades in above a threshold so slow driving stays calm and
 * the effect means something when it appears.
 */
export class SpeedLines {
  private lines: THREE.Mesh[] = [];
  private material: THREE.MeshBasicMaterial;
  private group = new THREE.Group();

  constructor(camera: THREE.Camera, count = 60) {
    this.material = new THREE.MeshBasicMaterial({
      color: 0xd8b4ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    const geometry = new THREE.BoxGeometry(0.05, 0.05, 3.2);
    for (let i = 0; i < count; i++) {
      const line = new THREE.Mesh(geometry, this.material);
      this.reposition(line, true);
      this.group.add(line);
      this.lines.push(line);
    }
    camera.add(this.group);
  }

  private reposition(line: THREE.Mesh, initial = false): void {
    // A ring around the view axis, kept clear of the centre so the road ahead
    // is never obscured by the effect meant to describe it.
    const angle = Math.random() * Math.PI * 2;
    const radius = 3.5 + Math.random() * 9;
    line.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.55,
      initial ? -Math.random() * 60 : -55 - Math.random() * 10,
    );
    line.scale.z = 0.6 + Math.random() * 1.8;
  }

  update(delta: number, speed: number, maxSpeed: number): void {
    const fraction = Math.max(0, (speed / maxSpeed - 0.55) / 0.45);
    this.material.opacity = Math.min(0.5, fraction * 0.5);
    if (fraction <= 0) return;

    const travel = (40 + speed * 1.4) * delta;
    for (const line of this.lines) {
      line.position.z += travel;
      if (line.position.z > 6) this.reposition(line);
    }
  }

  dispose(): void {
    this.material.dispose();
    this.group.removeFromParent();
  }
}
