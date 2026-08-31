"use client";

import * as React from "react";
import * as THREE from "three";
import { buildCar, buildBike, type VehicleRig } from "./vehicles";
import type { VehicleSpec } from "@playora/game-engine";

interface VehicleShowroom3DProps {
  vehicle: VehicleSpec;
  isBike: boolean;
}

/**
 * AAA-Grade 360° Interactive 3D Vehicle Turntable Showroom.
 *
 * Features:
 * - Rotating circular ramp/pedestal with glowing neon rim and studio floor reflections.
 * - Smooth 360° auto-rotation with manual mouse/touch drag interaction.
 * - Studio PBR lighting with rim lights, key spots, and soft contact drop shadow.
 */
export function VehicleShowroom3D({ vehicle, isBike }: VehicleShowroom3DProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = React.useRef(false);
  const lastMouseXRef = React.useRef(0);
  const rotationAngleRef = React.useRef(0);
  const autoRotateSpeedRef = React.useRef(0.008);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.clientWidth || 500;
    const height = canvas.clientHeight || 280;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(width, height, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(1.8, 1.85, isBike ? 4.3 : 4.75);
    camera.lookAt(0, 0.4, 0);

    // Studio Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 2.0);
    scene.add(ambient);

    // Bright Front Key Light
    const frontKey = new THREE.DirectionalLight(0xffffff, 4.2);
    frontKey.position.set(3, 5, 5);
    scene.add(frontKey);

    // Top Studio Overhead Softbox
    const topKey = new THREE.DirectionalLight(0xffffff, 3.0);
    topKey.position.set(0, 8, 0);
    scene.add(topKey);

    // Dynamic Cyan & Purple Rim Lights
    const rimLight1 = new THREE.DirectionalLight(0x38bdf8, 3.8);
    rimLight1.position.set(-5, 4, -4);
    scene.add(rimLight1);

    const rimLight2 = new THREE.DirectionalLight(0xa855f7, 3.2);
    rimLight2.position.set(5, 3, -4);
    scene.add(rimLight2);

    // 360° Circular Pedestal Turntable Ramp
    const turntable = new THREE.Group();
    scene.add(turntable);

    // 1. Pedestal Base Disc
    const baseGeo = new THREE.CylinderGeometry(2.8, 2.9, 0.14, 48);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0c0e18,
      roughness: 0.2,
      metalness: 0.9,
    });
    const pedestal = new THREE.Mesh(baseGeo, baseMat);
    pedestal.position.y = -0.07;
    turntable.add(pedestal);

    // 2. Glowing Neon Platform Ring
    const ringGeo = new THREE.TorusGeometry(2.82, 0.04, 16, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x7c3aed,
      emissive: new THREE.Color(0x9333ea),
      emissiveIntensity: 4.0,
      roughness: 0.1,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.01;
    turntable.add(ring);

    // 3. Inner Radial Tech Pattern Grid
    const innerRingGeo = new THREE.RingGeometry(1.6, 1.64, 48);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.005;
    turntable.add(innerRing);

    // 4. Soft Contact Shadow Plane
    const shadowGeo = new THREE.PlaneGeometry(5.0, 5.0);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    turntable.add(shadow);

    // 5. Mount Real 3D Vehicle Model on the Turntable
    const rig: VehicleRig = isBike ? buildBike(vehicle.colour, vehicle.id) : buildCar(vehicle.colour, vehicle.id);
    // Remove in-game dynamic beams from showroom
    if (rig.headlightBeams) rig.headlightBeams.visible = false;
    rig.chassis.position.y = 0;
    turntable.add(rig.group);

    // Animation Loop
    let animId = 0;
    const render = () => {
      if (!isDraggingRef.current) {
        rotationAngleRef.current += autoRotateSpeedRef.current;
      }
      turntable.rotation.y = rotationAngleRef.current;

      // Slowly spin wheels
      for (const w of rig.wheels) {
        w.rotation.x -= 0.015;
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(render);
    };
    render();

    // Resize Handler
    const handleResize = () => {
      if (!canvas) return;
      const w = canvas.clientWidth || 500;
      const h = canvas.clientHeight || 280;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, [vehicle, isBike]);

  // Pointer Drag Handlers for 360° Rotation
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastMouseXRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - lastMouseXRef.current;
    lastMouseXRef.current = e.clientX;
    rotationAngleRef.current += deltaX * 0.012;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative flex h-60 sm:h-72 w-full items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-b from-[#18112e] via-[#0f0c1d] to-[#07080e] shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing select-none group">
      {/* 360° Drag Hint Badge */}
      <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-black/60 border border-white/15 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white/80 backdrop-blur-md">
        <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
        <span>360° DRAG TO ROTATE</span>
      </div>

      {/* Ambient Lighting Gradients */}
      <div className="pointer-events-none absolute -top-12 -left-12 h-36 w-36 rounded-full bg-[#7c3aed]/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -right-12 h-36 w-36 rounded-full bg-[#06b6d4]/20 blur-2xl" />

      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="h-full w-full touch-none"
      />
    </div>
  );
}
