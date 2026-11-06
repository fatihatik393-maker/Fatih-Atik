import * as THREE from 'three';

const POOL_SIZE = 48;
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  isDarkSmoke: boolean;
}

export class EffectsManager {
  readonly instancedMesh: THREE.InstancedMesh;
  private slots: ParticleSlot[] = [];
  private nextIdx = 0;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.IcosahedronGeometry(0.065, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xe7e5e4,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
    });

    this.instancedMesh = new THREE.InstancedMesh(geo, mat, POOL_SIZE);
    this.instancedMesh.frustumCulled = false;

    for (let i = 0; i < POOL_SIZE; i++) {
      this.slots.push({
        active: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        scale: 0.001,
        isDarkSmoke: false,
      });
      _dummy.position.set(0, -10, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, _dummy.matrix);
      this.instancedMesh.setColorAt(i, _color.setHex(0xffffff));
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    scene.add(this.instancedMesh);
  }

  spawnSmoke(x: number, y: number, z: number, isDarkSmoke = false): void {
    const slot = this.slots[this.nextIdx];
    this.nextIdx = (this.nextIdx + 1) % POOL_SIZE;

    slot.active = true;
    slot.x = x + (Math.random() - 0.5) * 0.18;
    slot.y = y + 0.05;
    slot.z = z + (Math.random() - 0.5) * 0.18;
    slot.vx = (Math.random() - 0.5) * 0.12;
    slot.vy = 0.36 + Math.random() * 0.22;
    slot.vz = (Math.random() - 0.5) * 0.12;
    slot.life = 0;
    slot.maxLife = 0.85 + Math.random() * 0.4;
    slot.scale = 0.75;
    slot.isDarkSmoke = isDarkSmoke;
  }

  spawnCelebrationBurst(x: number, y: number, z: number): void {
    for (let i = 0; i < 10; i++) {
      const slot = this.slots[this.nextIdx];
      this.nextIdx = (this.nextIdx + 1) % POOL_SIZE;
      slot.active = true;
      slot.x = x;
      slot.y = y + 0.2;
      slot.z = z;
      const angle = (i / 10) * Math.PI * 2;
      slot.vx = Math.cos(angle) * 0.45;
      slot.vy = 0.65 + Math.random() * 0.3;
      slot.vz = Math.sin(angle) * 0.45;
      slot.life = 0;
      slot.maxLife = 0.65;
      slot.scale = 0.6;
      slot.isDarkSmoke = false;
    }
  }

  update(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < POOL_SIZE; i++) {
      const s = this.slots[i];
      if (!s.active) continue;

      anyChanged = true;
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.active = false;
        _dummy.position.set(0, -10, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      const t = s.life / s.maxLife;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;

      const curScale = Math.max(0.01, s.scale * (0.8 + t * 1.8) * (1 - t * 0.72));
      _dummy.position.set(s.x, s.y, s.z);
      _dummy.rotation.set(t * 1.5, i * 0.7 + t, t * 0.9);
      _dummy.scale.set(curScale * 1.35, curScale * 0.75, curScale * 1.35);
      _dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, _dummy.matrix);

      if (s.isDarkSmoke) {
        _color.setHex(0x282422);
      } else {
        _color.setHex(0xd6d3d1);
      }
      this.instancedMesh.setColorAt(i, _color);
    }

    if (anyChanged) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      if (this.instancedMesh.instanceColor) {
        this.instancedMesh.instanceColor.needsUpdate = true;
      }
    }
  }
}
