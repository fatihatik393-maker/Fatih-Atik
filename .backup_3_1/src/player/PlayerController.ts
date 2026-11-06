import * as THREE from 'three';
import { HeldItem } from '../core/GameConfig';
import { FirstPersonHandAnimator, HandActionType } from '../rendering/AnimationSystem';
import { AssetFactory } from '../rendering/AssetFactory';
import { PLAYER_SPAWN, RESTAURANT_BOUNDS, resolvePlayerMovement } from '../world/RestaurantLayout';
import { InteractableTarget } from '../world/RestaurantScene';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveVec = new THREE.Vector3();
const _rayCenter = new THREE.Vector2(0, 0);

export interface DroppedItemEntity {
  id: string;
  item: HeldItem;
  mesh: THREE.Group;
  vy: number;
}

export class PlayerController {
  readonly camera: THREE.PerspectiveCamera;
  readonly handAnchor: THREE.Group;
  readonly handAnimator = new FirstPersonHandAnimator();
  private heldVisual: THREE.Group | null = null;
  private handMeshGroup: THREE.Group;
  private cleaningClothMesh: THREE.Group;
  private raycaster = new THREE.Raycaster();

  position = new THREE.Vector3(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z);
  yaw = PLAYER_SPAWN.yaw;
  pitch = PLAYER_SPAWN.pitch;

  private walkDistance = 0;
  private stepAccum = 0;
  private velX = 0;
  private velZ = 0;

  // Input states
  keysPressed = new Set<string>();
  isPointerLocked = false;
  private isDraggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.camera = camera;
    this.raycaster.near = 0.1;
    this.raycaster.far = 3.35;

    this.handAnchor = new THREE.Group();
    this.handAnchor.position.set(0.32, -0.26, -0.58);
    this.camera.add(this.handAnchor);

    // Sculpted first-person chef hand & cuff so empty-hand and held-item interactions feel physical
    this.handMeshGroup = this.buildFirstPersonHandMesh();
    this.handAnchor.add(this.handMeshGroup);

    // Folded microfiber cleaning cloth shown in hand during table surface wiping
    this.cleaningClothMesh = this.buildCleaningClothMesh();
    this.cleaningClothMesh.visible = false;
    this.handAnchor.add(this.cleaningClothMesh);

    scene.add(this.camera);
    this.resetSpawn();
  }

  private buildCleaningClothMesh(): THREE.Group {
    const group = new THREE.Group();
    const clothMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.85,
      metalness: 0.02,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.78,
    });

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.024, 0.16),
      clothMat
    );
    pad.position.set(-0.01, -0.012, -0.055);
    pad.rotation.x = 0.22;
    group.add(pad);

    const fold = new THREE.Mesh(
      new THREE.BoxGeometry(0.135, 0.016, 0.14),
      trimMat
    );
    fold.position.set(-0.01, 0.004, -0.055);
    fold.rotation.set(0.22, 0.14, 0);
    group.add(fold);

    return group;
  }

  private currentHeldItem: HeldItem | null = null;
  private handPalmGroup = new THREE.Group();
  private fingerJoints: {
    thumbProx: THREE.Group;
    thumbDist: THREE.Group;
    indexProx: THREE.Group;
    indexDist: THREE.Group;
    middleProx: THREE.Group;
    middleDist: THREE.Group;
    ringProx: THREE.Group;
    ringDist: THREE.Group;
    pinkyProx: THREE.Group;
    pinkyDist: THREE.Group;
  } | null = null;

  private buildLoftedLimbGeometry(
    rings: { y: number; rx: number; rz: number; ox?: number; oz?: number }[],
    radialSegments = 20
  ): THREE.BufferGeometry {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const ringCount = rings.length;

    for (let r = 0; r < ringCount; r++) {
      const { y, rx, rz, ox = 0, oz = 0 } = rings[r];
      const v = r / Math.max(1, ringCount - 1);
      for (let s = 0; s <= radialSegments; s++) {
        const u = s / radialSegments;
        const theta = u * Math.PI * 2;
        positions.push(
          ox + Math.cos(theta) * rx,
          y,
          oz + Math.sin(theta) * rz
        );
        uvs.push(u, v);
      }
    }

    const stride = radialSegments + 1;
    for (let r = 0; r < ringCount - 1; r++) {
      for (let s = 0; s < radialSegments; s++) {
        const a = r * stride + s;
        const b = a + 1;
        const c = (r + 1) * stride + s + 1;
        const d = (r + 1) * stride + s;
        indices.push(a, d, c, a, c, b);
      }
    }

    const botCenter = positions.length / 3;
    positions.push(rings[0].ox ?? 0, rings[0].y, rings[0].oz ?? 0);
    uvs.push(0.5, 0.5);
    for (let s = 0; s < radialSegments; s++) {
      indices.push(botCenter, s + 1, s);
    }

    const topRingStart = (ringCount - 1) * stride;
    const topCenter = positions.length / 3;
    const last = rings[ringCount - 1];
    positions.push(last.ox ?? 0, last.y, last.oz ?? 0);
    uvs.push(0.5, 0.5);
    for (let s = 0; s < radialSegments; s++) {
      indices.push(topCenter, topRingStart + s, topRingStart + s + 1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  private buildFirstPersonHandMesh(): THREE.Group {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshPhysicalMaterial({
      color: 0xeab688,
      roughness: 0.42,
      metalness: 0.02,
      clearcoat: 0.08,
      clearcoatRoughness: 0.45,
    });
    const nailMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8dcc8,
      roughness: 0.24,
      metalness: 0.02,
      clearcoat: 0.35,
    });
    const cuffTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.48,
    });
    const cuffPipingMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.3,
      metalness: 0.8,
    });
    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.05,
    });
    const watchMetalMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.2,
      metalness: 0.88,
    });
    const watchDialMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.16,
      metalness: 0.4,
    });

    // Connected arm axis group angled from bottom-right corner toward the held item
    const armAxis = new THREE.Group();
    armAxis.position.set(0.02, -0.032, 0.04);
    armAxis.rotation.order = 'YXZ';
    armAxis.rotation.x = 0.46;
    armAxis.rotation.y = 0.24;
    group.add(armAxis);

    // 1. Articulated Palm Group (rotates at wrist for tray under-support vs cylindrical cup grip)
    this.handPalmGroup = new THREE.Group();
    armAxis.add(this.handPalmGroup);

    // Sculpted Lofted Palm & Metacarpal Arch
    const palmGeo = this.buildLoftedLimbGeometry(
      [
        { y: -0.045, rx: 0.038, rz: 0.021, ox: 0.0, oz: 0.0 },
        { y: -0.015, rx: 0.047, rz: 0.024, ox: -0.003, oz: 0.002 },
        { y: 0.018, rx: 0.050, rz: 0.023, ox: -0.002, oz: 0.002 },
        { y: 0.044, rx: 0.047, rz: 0.019, ox: 0.0, oz: 0.001 },
        { y: 0.055, rx: 0.042, rz: 0.015, ox: 0.0, oz: 0.0 },
      ],
      22
    );
    palmGeo.rotateX(-Math.PI / 2);
    const palm = new THREE.Mesh(palmGeo, skinMat);
    palm.castShadow = true;
    this.handPalmGroup.add(palm);

    // Thenar Muscle (Thumb Base Webbing)
    const thenar = new THREE.Mesh(
      new THREE.SphereGeometry(0.027, 14, 12),
      skinMat
    );
    thenar.scale.set(0.96, 0.72, 1.35);
    thenar.position.set(-0.034, -0.004, 0.008);
    thenar.rotation.y = 0.32;
    this.handPalmGroup.add(thenar);

    // Dorsal Knuckle Contours
    const knuckleGeo = new THREE.SphereGeometry(0.0115, 10, 10);
    for (const [kx, kz] of [
      [-0.031, -0.048],
      [-0.010, -0.052],
      [0.011, -0.050],
      [0.031, -0.045],
    ]) {
      const k = new THREE.Mesh(knuckleGeo, skinMat);
      k.scale.set(1.0, 0.7, 1.05);
      k.position.set(kx, 0.006, kz);
      this.handPalmGroup.add(k);
    }

    // Helper for 2-segment articulated finger with sculpted phalanges and fingernail plate
    const buildFinger = (
      x: number,
      y: number,
      z: number,
      proxLen: number,
      distLen: number,
      rad: number,
      spreadY: number
    ) => {
      const proxGroup = new THREE.Group();
      proxGroup.position.set(x, y, z);
      proxGroup.rotation.y = spreadY;

      const proxGeo = this.buildLoftedLimbGeometry(
        [
          { y: 0, rx: rad * 1.05, rz: rad * 0.95 },
          { y: proxLen * 0.5, rx: rad * 0.98, rz: rad * 0.90 },
          { y: proxLen, rx: rad * 0.88, rz: rad * 0.84 },
        ],
        14
      );
      proxGeo.rotateX(-Math.PI / 2);
      const proxMesh = new THREE.Mesh(proxGeo, skinMat);
      proxGroup.add(proxMesh);

      const midJoint = new THREE.Mesh(
        new THREE.SphereGeometry(rad * 0.86, 10, 8),
        skinMat
      );
      midJoint.position.set(0, 0, -proxLen);
      proxGroup.add(midJoint);

      const distGroup = new THREE.Group();
      distGroup.position.set(0, 0, -proxLen);
      proxGroup.add(distGroup);

      const distGeo = this.buildLoftedLimbGeometry(
        [
          { y: 0, rx: rad * 0.88, rz: rad * 0.84 },
          { y: distLen * 0.65, rx: rad * 0.80, rz: rad * 0.74 },
          { y: distLen, rx: rad * 0.60, rz: rad * 0.54 },
        ],
        14
      );
      distGeo.rotateX(-Math.PI / 2);
      const distMesh = new THREE.Mesh(distGeo, skinMat);
      distGroup.add(distMesh);

      const nail = new THREE.Mesh(
        new THREE.BoxGeometry(rad * 1.12, 0.0024, distLen * 0.36),
        nailMat
      );
      nail.position.set(0, rad * 0.66, -distLen * 0.74);
      nail.rotation.x = 0.08;
      distGroup.add(nail);

      this.handPalmGroup.add(proxGroup);
      return { proxGroup, distGroup };
    };

    const thumbBuilt = buildFinger(-0.044, -0.003, -0.006, 0.036, 0.032, 0.0122, 0.54);
    const indexBuilt = buildFinger(-0.031, -0.002, -0.050, 0.042, 0.036, 0.0106, 0.06);
    const middleBuilt = buildFinger(-0.010, -0.001, -0.054, 0.046, 0.039, 0.0110, 0.01);
    const ringBuilt = buildFinger(0.011, -0.002, -0.051, 0.043, 0.036, 0.0104, -0.04);
    const pinkyBuilt = buildFinger(0.031, -0.004, -0.046, 0.035, 0.029, 0.0092, -0.10);

    this.fingerJoints = {
      thumbProx: thumbBuilt.proxGroup,
      thumbDist: thumbBuilt.distGroup,
      indexProx: indexBuilt.proxGroup,
      indexDist: indexBuilt.distGroup,
      middleProx: middleBuilt.proxGroup,
      middleDist: middleBuilt.distGroup,
      ringProx: ringBuilt.proxGroup,
      ringDist: ringBuilt.distGroup,
      pinkyProx: pinkyBuilt.proxGroup,
      pinkyDist: pinkyBuilt.distGroup,
    };

    // 2. Sculpted Wrist Bridge, Chronograph Watch, Rolled White Chef Cuff & Tailored Forearm Sleeve
    const wristGeo = this.buildLoftedLimbGeometry(
      [
        { y: 0.038, rx: 0.038, rz: 0.024 },
        { y: 0.072, rx: 0.037, rz: 0.026 },
        { y: 0.102, rx: 0.039, rz: 0.029 },
      ],
      18
    );
    wristGeo.rotateX(Math.PI / 2);
    const wrist = new THREE.Mesh(wristGeo, skinMat);
    armAxis.add(wrist);

    // Chef Chronograph Wristwatch on Wrist
    const watchStrap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.039, 0.039, 0.018, 18),
      new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.38 })
    );
    watchStrap.rotation.x = Math.PI / 2;
    watchStrap.scale.set(1.02, 1.0, 0.74);
    watchStrap.position.set(0, -0.002, 0.072);
    armAxis.add(watchStrap);

    const watchBezel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.021, 0.008, 18),
      watchMetalMat
    );
    watchBezel.position.set(0.002, 0.027, 0.072);
    armAxis.add(watchBezel);

    const watchDial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.009, 16),
      watchDialMat
    );
    watchDial.position.set(0.002, 0.0275, 0.072);
    armAxis.add(watchDial);

    const watchHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.002, 0.002),
      watchMetalMat
    );
    watchHand.position.set(0.005, 0.0325, 0.072);
    armAxis.add(watchHand);

    // White chef cuff band with brass piping wrapping the wrist
    const cuffTrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.043, 0.045, 0.038, 18),
      cuffTrimMat
    );
    cuffTrim.rotation.x = Math.PI / 2;
    cuffTrim.scale.set(1.02, 1.0, 0.86);
    cuffTrim.position.set(0, -0.005, 0.106);
    armAxis.add(cuffTrim);

    const cuffPiping = new THREE.Mesh(
      new THREE.TorusGeometry(0.043, 0.0032, 8, 22),
      cuffPipingMat
    );
    cuffPiping.scale.set(1.02, 0.86, 1.0);
    cuffPiping.position.set(0, -0.005, 0.088);
    armAxis.add(cuffPiping);

    // Forearm chef sleeve connected seamlessly behind the white cuff
    const forearmGeo = this.buildLoftedLimbGeometry(
      [
        { y: 0.118, rx: 0.045, rz: 0.039 },
        { y: 0.185, rx: 0.049, rz: 0.044 },
        { y: 0.275, rx: 0.054, rz: 0.048 },
        { y: 0.355, rx: 0.058, rz: 0.052 },
      ],
      20
    );
    forearmGeo.rotateX(Math.PI / 2);
    const forearm = new THREE.Mesh(forearmGeo, sleeveMat);
    forearm.position.set(0, -0.006, 0.0);
    armAxis.add(forearm);

    this.applyGripPoseForItem(null, null);
    return group;
  }

  private applyGripPoseForItem(
    item: HeldItem | null,
    activeAction: HandActionType | null
  ): void {
    const fj = this.fingerJoints;
    if (!fj) return;

    if (activeAction === 'wipe') {
      // Pressing flat down atop the microfiber cloth
      this.handPalmGroup.rotation.set(-0.22, -0.08, 0.05);
      fj.thumbProx.rotation.set(0.05, 0.45, -0.15);
      fj.thumbDist.rotation.set(0.08, 0, 0);
      fj.indexProx.rotation.set(0.06, 0.08, 0);
      fj.indexDist.rotation.set(0.10, 0, 0);
      fj.middleProx.rotation.set(0.05, 0.01, 0);
      fj.middleDist.rotation.set(0.08, 0, 0);
      fj.ringProx.rotation.set(0.06, -0.05, 0);
      fj.ringDist.rotation.set(0.10, 0, 0);
      fj.pinkyProx.rotation.set(0.08, -0.12, 0);
      fj.pinkyDist.rotation.set(0.12, 0, 0);
      return;
    }

    if (!item) {
      // Relaxed, natural open culinary hand posture
      this.handPalmGroup.rotation.set(-0.18, -0.06, 0.08);
      fj.thumbProx.rotation.set(0.22, 0.48, -0.25);
      fj.thumbDist.rotation.set(0.28, 0.14, 0);
      fj.indexProx.rotation.set(0.26, 0.06, 0);
      fj.indexDist.rotation.set(0.32, 0, 0);
      fj.middleProx.rotation.set(0.32, 0.01, 0);
      fj.middleDist.rotation.set(0.38, 0, 0);
      fj.ringProx.rotation.set(0.36, -0.04, 0);
      fj.ringDist.rotation.set(0.42, 0, 0);
      fj.pinkyProx.rotation.set(0.42, -0.10, 0);
      fj.pinkyDist.rotation.set(0.46, 0, 0);
      return;
    }

    if (
      item.type === 'service_tray' ||
      item.type === 'dirty_tray' ||
      item.type === 'order_tray'
    ) {
      // Flat waiter/chef under-tray support grip: palm leveled underneath tray base, fingers spread wide
      this.handPalmGroup.rotation.set(-0.46, -0.14, 0.04);
      fj.thumbProx.rotation.set(-0.04, 0.68, -0.10);
      fj.thumbDist.rotation.set(-0.02, 0, 0);
      fj.indexProx.rotation.set(-0.04, 0.14, 0);
      fj.indexDist.rotation.set(-0.02, 0, 0);
      fj.middleProx.rotation.set(-0.04, 0.02, 0);
      fj.middleDist.rotation.set(-0.02, 0, 0);
      fj.ringProx.rotation.set(-0.04, -0.09, 0);
      fj.ringDist.rotation.set(-0.02, 0, 0);
      fj.pinkyProx.rotation.set(-0.04, -0.20, 0);
      fj.pinkyDist.rotation.set(-0.02, 0, 0);
      return;
    }

    if (item.type === 'soda_cup') {
      // Cylindrical side-wrap grip around the District Cola cup
      this.handPalmGroup.rotation.set(-0.15, -0.22, 0.42);
      fj.thumbProx.rotation.set(0.38, 0.78, -0.32);
      fj.thumbDist.rotation.set(0.46, 0.22, 0);
      fj.indexProx.rotation.set(0.58, 0.05, 0);
      fj.indexDist.rotation.set(0.68, 0, 0);
      fj.middleProx.rotation.set(0.64, 0.01, 0);
      fj.middleDist.rotation.set(0.72, 0, 0);
      fj.ringProx.rotation.set(0.68, -0.04, 0);
      fj.ringDist.rotation.set(0.75, 0, 0);
      fj.pinkyProx.rotation.set(0.72, -0.09, 0);
      fj.pinkyDist.rotation.set(0.78, 0, 0);
      return;
    }

    // Burger or Ingredient: natural cupped/cradled grip supporting bottom & sides without clipping top
    this.handPalmGroup.rotation.set(-0.34, -0.12, 0.12);
    fj.thumbProx.rotation.set(0.18, 0.62, -0.18);
    fj.thumbDist.rotation.set(0.30, 0.14, 0);
    fj.indexProx.rotation.set(0.20, 0.10, 0);
    fj.indexDist.rotation.set(0.36, 0, 0);
    fj.middleProx.rotation.set(0.24, 0.02, 0);
    fj.middleDist.rotation.set(0.40, 0, 0);
    fj.ringProx.rotation.set(0.26, -0.05, 0);
    fj.ringDist.rotation.set(0.42, 0, 0);
    fj.pinkyProx.rotation.set(0.30, -0.12, 0);
    fj.pinkyDist.rotation.set(0.44, 0, 0);
  }

  resetSpawn(): void {
    this.position.set(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z);
    this.yaw = PLAYER_SPAWN.yaw;
    this.pitch = PLAYER_SPAWN.pitch;
    this.velX = 0;
    this.velZ = 0;
    this.keysPressed.clear();
    this.syncCameraTransform(0, true);
  }

  lookAtPoint(targetX: number, targetY: number, targetZ: number): void {
    const eyeY = RESTAURANT_BOUNDS.eyeHeight;
    const dx = targetX - this.position.x;
    const dy = targetY - eyeY;
    const dz = targetZ - this.position.z;
    const horizDist = Math.hypot(dx, dz);
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = THREE.MathUtils.clamp(
      Math.atan2(dy, Math.max(1e-5, horizDist)),
      -1.35,
      1.35
    );
    this.syncCameraTransform(0, false);
  }

  triggerHandAnimation(action: HandActionType): void {
    this.handAnimator.triggerAction(action);
    this.applyGripPoseForItem(this.currentHeldItem, this.handAnimator.getActiveAction());
  }

  setHeldItemVisual(item: HeldItem | null, assets: AssetFactory): void {
    this.currentHeldItem = item;
    if (this.heldVisual) {
      this.handAnchor.remove(this.heldVisual);
      this.heldVisual = null;
    }
    if (item) {
      this.heldVisual = assets.createHeldItemVisual(item);
      if (
        item.type === 'service_tray' ||
        item.type === 'dirty_tray' ||
        item.type === 'order_tray'
      ) {
        // Tray sits cleanly atop the flat upturned palm & spread fingers (zero finger clipping)
        this.heldVisual.position.set(-0.085, 0.026, -0.095);
        this.heldVisual.rotation.set(0.08, 0.14, -0.02);
      } else if (item.type === 'soda_cup') {
        // Soda cup sits naturally inside the cylindrical finger wrap
        this.heldVisual.position.set(-0.032, -0.018, -0.068);
        this.heldVisual.rotation.set(0.06, 0.1, 0);
      } else {
        // Burger or ingredient rests in the cupped palm & fingers
        this.heldVisual.position.set(-0.038, 0.022, -0.072);
        this.heldVisual.rotation.set(0.08, 0.12, 0);
      }
      this.handAnchor.add(this.heldVisual);
    }
    this.applyGripPoseForItem(this.currentHeldItem, this.handAnimator.getActiveAction());
  }

  handleMouseMove(dx: number, dy: number, sensitivity: number): void {
    const scale = 0.0022 * sensitivity;
    this.yaw -= dx * scale;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * scale, -1.35, 1.35);
    this.handAnimator.addLookImpulse(dx, dy);
  }

  onPointerDown(clientX: number, clientY: number): void {
    this.isDraggingLook = true;
    this.lastPointerX = clientX;
    this.lastPointerY = clientY;
  }

  onPointerMoveFallback(clientX: number, clientY: number, sensitivity: number): void {
    if (!this.isPointerLocked && this.isDraggingLook) {
      const dx = clientX - this.lastPointerX;
      const dy = clientY - this.lastPointerY;
      this.lastPointerX = clientX;
      this.lastPointerY = clientY;
      this.handleMouseMove(dx, dy, sensitivity);
    }
  }

  onPointerUp(): void {
    this.isDraggingLook = false;
  }

  update(dt: number, headBobEnabled = true, onFootstep?: () => void): void {
    let moveZ = 0;
    let moveX = 0;

    if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) moveZ += 1;
    if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) moveZ -= 1;
    if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) moveX += 1;
    if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) moveX -= 1;

    const isRunning = this.keysPressed.has('ShiftLeft') || this.keysPressed.has('ShiftRight');
    const speed = isRunning ? 5.2 : 3.6;

    let targetVx = 0;
    let targetVz = 0;

    if (moveX !== 0 || moveZ !== 0) {
      _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

      _moveVec
        .set(0, 0, 0)
        .addScaledVector(_forward, moveZ)
        .addScaledVector(_right, moveX)
        .normalize()
        .multiplyScalar(speed);

      targetVx = _moveVec.x;
      targetVz = _moveVec.z;
    }

    // Smooth acceleration & deceleration damping
    const accel = Math.min(1, dt * 16);
    this.velX = THREE.MathUtils.lerp(this.velX, targetVx, accel);
    this.velZ = THREE.MathUtils.lerp(this.velZ, targetVz, accel);

    if (Math.hypot(this.velX, this.velZ) > 0.02) {
      const resolved = resolvePlayerMovement(
        this.position.x,
        this.position.z,
        this.position.x + this.velX * dt,
        this.position.z + this.velZ * dt
      );

      const stepDist = Math.hypot(resolved.x - this.position.x, resolved.z - this.position.z);
      this.walkDistance += stepDist;
      this.stepAccum += stepDist;
      if (this.stepAccum >= 0.68) {
        this.stepAccum = 0;
        onFootstep?.();
      }
      this.position.x = resolved.x;
      this.position.z = resolved.z;
    }

    this.syncCameraTransform(dt, headBobEnabled);
  }

  private syncCameraTransform(dt: number, headBobEnabled: boolean): void {
    const bobOffset = headBobEnabled ? Math.sin(this.walkDistance * 3.8) * 0.032 : 0;
    this.camera.position.set(
      this.position.x,
      RESTAURANT_BOUNDS.eyeHeight + bobOffset,
      this.position.z
    );

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;

    const handSample = this.handAnimator.evaluate(dt, this.walkDistance, headBobEnabled);
    this.handAnchor.position.set(handSample.posX, handSample.posY, handSample.posZ);
    this.handAnchor.rotation.set(handSample.rotX, handSample.rotY, handSample.rotZ);
    this.handAnchor.scale.setScalar(handSample.scalePunch);
    const activeAction = this.handAnimator.getActiveAction();
    this.cleaningClothMesh.visible = activeAction === 'wipe' && !this.heldVisual;
    this.applyGripPoseForItem(this.currentHeldItem, activeAction);
    this.camera.updateMatrixWorld();
  }

  raycastTarget(interactables: THREE.Object3D[]): InteractableTarget | null {
    return this.raycastDetailed(interactables).target;
  }

  raycastDetailed(
    interactables: THREE.Object3D[],
    prioritizeNonSurfaces = false
  ): {
    target: InteractableTarget | null;
    point: THREE.Vector3 | null;
  } {
    this.raycaster.setFromCamera(_rayCenter, this.camera);
    const hits = this.raycaster.intersectObjects(interactables, true);
    if (hits.length === 0) return { target: null, point: null };

    if (prioritizeNonSurfaces) {
      // If looking at a placed item or station sitting on top of a surface plane, prefer the item/station
      for (const hit of hits) {
        const t = hit.object.userData?.interactable as InteractableTarget | undefined;
        if (t && t.type !== 'placement_surface') {
          return { target: t, point: hit.point };
        }
      }
    }

    for (const hit of hits) {
      if (hit.object.userData?.interactable) {
        return {
          target: hit.object.userData.interactable as InteractableTarget,
          point: hit.point,
        };
      }
    }
    return { target: null, point: null };
  }

  getDropPositionInFront(): THREE.Vector3 {
    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    const desiredX = this.position.x + _forward.x * 0.9;
    const desiredZ = this.position.z + _forward.z * 0.9;
    const resolved = resolvePlayerMovement(
      this.position.x,
      this.position.z,
      desiredX,
      desiredZ,
      0.25
    );
    return new THREE.Vector3(resolved.x, this.position.y - 0.35, resolved.z);
  }
}
