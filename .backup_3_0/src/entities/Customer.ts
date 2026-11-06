import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RecipeId } from '../core/GameConfig';
import { DiningSeatState } from '../gameplay/DiningSystem';
import {
  CustomerAnimator,
  computeCharacterHeadingYaw,
  stepCharacterYawShortestArc,
} from '../rendering/AnimationSystem';

export interface CustomerAppearance {
  name: string;
  bodyType: 'male' | 'female';
  shirtColor: number;
  jacketColor?: number;
  pantsColor: number;
  shoeColor: number;
  skinColor: number;
  hairColor: number;
  hairStyle: 'quiff' | 'ponytail' | 'cap' | 'bob';
  hasGlasses?: boolean;
  heightScale: number;
}

export const CUSTOMER_PROFILES: CustomerAppearance[] = [
  {
    name: 'Emre',
    bodyType: 'male',
    shirtColor: 0xf8fafc,
    jacketColor: 0x2563eb,
    pantsColor: 0x1e293b,
    shoeColor: 0xe2e8f0,
    skinColor: 0xf1c27d,
    hairColor: 0x2b1d12,
    hairStyle: 'quiff',
    hasGlasses: true,
    heightScale: 1.01,
  },
  {
    name: 'Selin',
    bodyType: 'female',
    shirtColor: 0xf43f5e,
    jacketColor: 0xfde047,
    pantsColor: 0x334155,
    shoeColor: 0xffffff,
    skinColor: 0xffdbac,
    hairColor: 0x5c3317,
    hairStyle: 'ponytail',
    heightScale: 0.94,
  },
  {
    name: 'Kerem',
    bodyType: 'male',
    shirtColor: 0x10b981,
    pantsColor: 0x1f2937,
    shoeColor: 0x111827,
    skinColor: 0xe0ac69,
    hairColor: 0x1a1817,
    hairStyle: 'cap',
    heightScale: 1.03,
  },
  {
    name: 'Zeynep',
    bodyType: 'female',
    shirtColor: 0xa855f7,
    jacketColor: 0x1e1b4b,
    pantsColor: 0x1e293b,
    shoeColor: 0xf8fafc,
    skinColor: 0xf5cfa0,
    hairColor: 0x7c2d12,
    hairStyle: 'bob',
    hasGlasses: true,
    heightScale: 0.95,
  },
  {
    name: 'Mert',
    bodyType: 'male',
    shirtColor: 0xea580c,
    jacketColor: 0x292524,
    pantsColor: 0x1c1917,
    shoeColor: 0xfef3c7,
    skinColor: 0xebbc86,
    hairColor: 0x3b2818,
    hairStyle: 'quiff',
    heightScale: 1.02,
  },
  {
    name: 'Elif',
    bodyType: 'female',
    shirtColor: 0x38bdf8,
    jacketColor: 0x0f172a,
    pantsColor: 0x334155,
    shoeColor: 0xf1f5f9,
    skinColor: 0xffdbac,
    hairColor: 0x451a03,
    hairStyle: 'ponytail',
    hasGlasses: false,
    heightScale: 0.96,
  },
  {
    name: 'Caner',
    bodyType: 'male',
    shirtColor: 0xfacc15,
    jacketColor: 0x3f3f46,
    pantsColor: 0x18181b,
    shoeColor: 0xd97706,
    skinColor: 0xe0ac69,
    hairColor: 0x1c1917,
    hairStyle: 'cap',
    hasGlasses: true,
    heightScale: 1.04,
  },
  {
    name: 'Deniz',
    bodyType: 'female',
    shirtColor: 0xec4899,
    pantsColor: 0x1e293b,
    shoeColor: 0xffffff,
    skinColor: 0xf5cfa0,
    hairColor: 0x27272a,
    hairStyle: 'bob',
    heightScale: 0.96,
  },
];

export type CustomerState =
  | 'ENTERING'
  | 'WALKING_TO_COUNTER'
  | 'WAITING_TO_ORDER'
  | 'ORDERING'
  | 'ORDER_PLACED'
  | 'WAITING_FOR_FOOD'
  | 'RECEIVING_ORDER'
  | 'WALKING_TO_SEAT_APPROACH'
  | 'WALKING_TO_SEAT'
  | 'SITTING_DOWN'
  | 'DINING'
  | 'STANDING_UP'
  | 'STEPPING_OUT_OF_SEAT'
  | 'LEAVING'
  | 'LEAVING_ANGRY';

interface LoftRing {
  y: number;
  rx: number;
  rz: number;
  ox?: number;
  oz?: number;
}

/**
 * Builds an organic lofted cross-section BufferGeometry so customer anatomy
 * has natural deltoid shoulders, chest contour, tapered waist, calf curves, and jawline
 * instead of primitive cylinders or capsules.
 */
function buildLoftedGeometry(
  rings: LoftRing[],
  radialSegments = 24,
  sculptFn?: (v: number, theta: number, x: number, y: number, z: number) => [number, number, number]
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
      let px = ox + Math.cos(theta) * rx;
      let py = y;
      let pz = oz + Math.sin(theta) * rz;
      if (sculptFn) {
        [px, py, pz] = sculptFn(v, theta, px, py, pz);
      }
      positions.push(px, py, pz);
      uvs.push(u * 2, v * 2);
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

  // Bottom cap
  const bottomCenterIdx = positions.length / 3;
  positions.push(rings[0].ox ?? 0, rings[0].y, rings[0].oz ?? 0);
  uvs.push(0.5, 0.5);
  for (let s = 0; s < radialSegments; s++) {
    indices.push(bottomCenterIdx, s + 1, s);
  }

  // Top cap
  const topRingStart = (ringCount - 1) * stride;
  const topCenterIdx = positions.length / 3;
  const last = rings[ringCount - 1];
  positions.push(last.ox ?? 0, last.y, last.oz ?? 0);
  uvs.push(0.5, 0.5);
  for (let s = 0; s < radialSegments; s++) {
    indices.push(topCenterIdx, topRingStart + s, topRingStart + s + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Shared sculpted anatomical geometries & soft AO shadow texture
let _sharedGeos: {
  torsoShirt: THREE.BufferGeometry;
  pelvisHips: THREE.BufferGeometry;
  neck: THREE.BufferGeometry;
  headCranium: THREE.BufferGeometry;
  upperArm: THREE.BufferGeometry;
  foreArm: THREE.BufferGeometry;
  handPalm: THREE.BufferGeometry;
  thigh: THREE.BufferGeometry;
  calf: THREE.BufferGeometry;
  sneakerUpper: THREE.BufferGeometry;
  sneakerSole: THREE.BufferGeometry;
  shadowTex: THREE.CanvasTexture | null;
} | null = null;

function getSharedCharacterAssets() {
  if (_sharedGeos) return _sharedGeos;

  const torsoShirt = buildLoftedGeometry(
    [
      { y: 0.08, rx: 0.172, rz: 0.124 },
      { y: 0.16, rx: 0.16, rz: 0.116 },
      { y: 0.24, rx: 0.156, rz: 0.114, oz: 0.002 },
      { y: 0.34, rx: 0.174, rz: 0.128, oz: 0.008 },
      { y: 0.43, rx: 0.192, rz: 0.138, oz: 0.012 },
      { y: 0.51, rx: 0.204, rz: 0.134, oz: 0.006 },
      { y: 0.57, rx: 0.178, rz: 0.116 },
      { y: 0.605, rx: 0.108, rz: 0.09 },
    ],
    28,
    (v, theta, x, y, z) => {
      if (z > 0 && v >= 0.42 && v <= 0.86) {
        const chest = Math.sin(((v - 0.42) / 0.44) * Math.PI) * 0.015 * Math.pow(Math.sin(theta), 2);
        z += chest;
      }
      return [x, y, z];
    }
  );

  const pelvisHips = buildLoftedGeometry(
    [
      { y: -0.04, rx: 0.162, rz: 0.118 },
      { y: 0.02, rx: 0.175, rz: 0.126 },
      { y: 0.09, rx: 0.176, rz: 0.128 },
      { y: 0.13, rx: 0.17, rz: 0.122 },
    ],
    24
  );

  const neck = buildLoftedGeometry(
    [
      { y: 0.56, rx: 0.075, rz: 0.074 },
      { y: 0.63, rx: 0.066, rz: 0.065, oz: 0.003 },
      { y: 0.71, rx: 0.068, rz: 0.066, oz: 0.005 },
    ],
    18
  );

  const headCranium = buildLoftedGeometry(
    [
      { y: -0.155, rx: 0.056, rz: 0.066, oz: 0.015 },
      { y: -0.12, rx: 0.098, rz: 0.118, oz: 0.012 },
      { y: -0.07, rx: 0.128, rz: 0.146, oz: 0.008 },
      { y: -0.015, rx: 0.146, rz: 0.158, oz: 0.004 },
      { y: 0.04, rx: 0.152, rz: 0.164, oz: 0.002 },
      { y: 0.1, rx: 0.146, rz: 0.158, oz: -0.004 },
      { y: 0.148, rx: 0.116, rz: 0.13, oz: -0.008 },
      { y: 0.18, rx: 0.055, rz: 0.062, oz: -0.01 },
    ],
    28,
    (v, theta, x, y, z) => {
      const front = Math.sin(theta);
      const horiz = Math.cos(theta);
      if (front > 0.72 && v >= 0.3 && v <= 0.62) {
        const noseW = Math.exp(-Math.pow(horiz / 0.18, 2));
        const noseH = Math.sin(((v - 0.3) / 0.32) * Math.PI);
        z += 0.028 * noseW * noseH;
      }
      if (front > 0.25 && v >= 0.34 && v <= 0.56) {
        const cheek = Math.exp(-Math.pow((Math.abs(horiz) - 0.58) / 0.22, 2));
        x += (x > 0 ? 0.009 : -0.009) * cheek;
        z += 0.008 * cheek;
      }
      return [x, y, z];
    }
  );

  const upperArm = buildLoftedGeometry(
    [
      { y: -0.21, rx: 0.047, rz: 0.047 },
      { y: -0.14, rx: 0.053, rz: 0.054 },
      { y: -0.06, rx: 0.058, rz: 0.058 },
      { y: 0.01, rx: 0.06, rz: 0.06 },
      { y: 0.05, rx: 0.042, rz: 0.044 },
    ],
    18
  );

  const foreArm = buildLoftedGeometry(
    [
      { y: -0.195, rx: 0.033, rz: 0.029 },
      { y: -0.13, rx: 0.039, rz: 0.038 },
      { y: -0.06, rx: 0.046, rz: 0.045 },
      { y: 0.01, rx: 0.044, rz: 0.044 },
    ],
    18
  );

  const handPalm = buildLoftedGeometry(
    [
      { y: -0.295, rx: 0.024, rz: 0.014, oz: 0.006 },
      { y: -0.265, rx: 0.039, rz: 0.021, oz: 0.008 },
      { y: -0.225, rx: 0.042, rz: 0.024, oz: 0.005 },
      { y: -0.19, rx: 0.033, rz: 0.026 },
    ],
    16
  );

  const thigh = buildLoftedGeometry(
    [
      { y: -0.33, rx: 0.058, rz: 0.06 },
      { y: -0.23, rx: 0.065, rz: 0.068, oz: 0.003 },
      { y: -0.11, rx: 0.075, rz: 0.077, oz: 0.004 },
      { y: -0.02, rx: 0.078, rz: 0.08 },
      { y: 0.03, rx: 0.065, rz: 0.068 },
    ],
    20
  );

  const calf = buildLoftedGeometry(
    [
      { y: -0.31, rx: 0.046, rz: 0.048 },
      { y: -0.22, rx: 0.052, rz: 0.055, oz: -0.004 },
      { y: -0.11, rx: 0.062, rz: 0.065, oz: -0.008 },
      { y: -0.03, rx: 0.058, rz: 0.058 },
      { y: 0.02, rx: 0.052, rz: 0.052 },
    ],
    20
  );

  const sneakerUpper = buildLoftedGeometry(
    [
      { y: -0.365, rx: 0.058, rz: 0.112, oz: 0.038 },
      { y: -0.34, rx: 0.056, rz: 0.108, oz: 0.036 },
      { y: -0.315, rx: 0.05, rz: 0.076, oz: 0.015 },
      { y: -0.295, rx: 0.045, rz: 0.055, oz: 0.002 },
    ],
    20
  );

  const sneakerSole = buildLoftedGeometry(
    [
      { y: -0.388, rx: 0.062, rz: 0.118, oz: 0.038 },
      { y: -0.364, rx: 0.06, rz: 0.115, oz: 0.038 },
    ],
    20
  );

  let shadowTex: THREE.CanvasTexture | null = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
      grad.addColorStop(0, 'rgba(9, 8, 7, 0.58)');
      grad.addColorStop(0.55, 'rgba(9, 8, 7, 0.26)');
      grad.addColorStop(1, 'rgba(9, 8, 7, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      shadowTex = new THREE.CanvasTexture(c);
    }
  }

  _sharedGeos = {
    torsoShirt,
    pelvisHips,
    neck,
    headCranium,
    upperArm,
    foreArm,
    handPalm,
    thigh,
    calf,
    sneakerUpper,
    sneakerSole,
    shadowTex,
  };
  return _sharedGeos;
}

// Shared GLB template loader cache for rigged & animated /models/customer_character.glb
interface CachedCustomerGltf {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  meshMap: Map<string, { geometry: THREE.BufferGeometry; normalMap: THREE.Texture | null }>;
}

let _cachedCustomerGltf: CachedCustomerGltf | null = null;
let _glbLoadStarted = false;
const _pendingActors: CustomerActor[] = [];

export function getCustomerGlbStats(): {
  loaded: boolean;
  skinnedMeshCount: number;
  boneCount: number;
  animationNames: string[];
} {
  if (!_cachedCustomerGltf) {
    return { loaded: false, skinnedMeshCount: 0, boneCount: 0, animationNames: [] };
  }
  let skinnedMeshCount = 0;
  const bones = new Set<THREE.Bone>();
  _cachedCustomerGltf.scene.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      skinnedMeshCount++;
      const sm = child as THREE.SkinnedMesh;
      if (sm.skeleton) {
        sm.skeleton.bones.forEach((b) => bones.add(b));
      }
    }
  });
  return {
    loaded: true,
    skinnedMeshCount,
    boneCount: bones.size,
    animationNames: _cachedCustomerGltf.animations.map((a) => a.name),
  };
}

function ensureCustomerGlbLoaded(): void {
  if (_glbLoadStarted || typeof window === 'undefined') return;
  _glbLoadStarted = true;
  const loader = new GLTFLoader();
  loader.load(
    '/models/customer_character.glb?v=31',
    (gltf) => {
      const map = new Map<string, { geometry: THREE.BufferGeometry; normalMap: THREE.Texture | null }>();
      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          const mat = m.material as THREE.MeshStandardMaterial;
          const entry = {
            geometry: m.geometry,
            normalMap: mat?.normalMap || null,
          };
          map.set(m.name, entry);
          if (m.parent?.name) {
            map.set(m.parent.name, entry);
          }
        }
      });
      _cachedCustomerGltf = {
        scene: gltf.scene,
        animations: gltf.animations || [],
        meshMap: map,
      };
      for (const actor of _pendingActors) {
        actor.applyGlbSkinnedCharacter(_cachedCustomerGltf);
      }
      _pendingActors.length = 0;
    },
    undefined,
    () => {
      // Fallback to synchronous sculpted lofted geometries if offline/test
    }
  );
}

if (typeof window !== 'undefined') {
  ensureCustomerGlbLoaded();
}

export class CustomerActor {
  readonly id: string;
  readonly profile: CustomerAppearance;
  readonly root: THREE.Group;
  readonly leftArmGroup: THREE.Group;
  readonly leftForeArmGroup: THREE.Group;
  readonly rightArmGroup: THREE.Group;
  readonly rightForeArmGroup: THREE.Group;
  readonly leftLegGroup: THREE.Group;
  readonly leftKneeGroup: THREE.Group;
  readonly rightLegGroup: THREE.Group;
  readonly rightKneeGroup: THREE.Group;
  readonly headGroup: THREE.Group;
  readonly torsoGroup: THREE.Group;
  readonly mouthMesh: THREE.Mesh;
  readonly leftBrowMesh: THREE.Mesh;
  readonly rightBrowMesh: THREE.Mesh;
  readonly badgeSprite: THREE.Sprite;
  readonly selectionRingMesh: THREE.Mesh;
  readonly animator: CustomerAnimator;

  private bodyGroup: THREE.Group;
  private shirtMesh: THREE.Mesh;
  private jacketMesh: THREE.Mesh | null = null;
  private shirtMat: THREE.MeshStandardMaterial;
  private jacketMat: THREE.MeshStandardMaterial;
  private pantsMat: THREE.MeshStandardMaterial;
  private badgeCanvas: HTMLCanvasElement;
  private lastBadgeTitle = '';
  private lastBadgeSub = '';
  private lastBadgeAccent = '';
  private lastPatienceBucket = -1;
  private lastSelectedFlag = false;
  private lastHoveredFlag = false;
  isUsingGlbSkinnedMesh = false;

  state: CustomerState = 'ENTERING';
  seedIndex = 0;
  queueIndex = 0;
  orderingTimer = 0;
  reactionTimer = 0;
  refusalTimer = 0;
  patience = 72;
  maxPatience = 72;
  patienceRatio = 1.0;
  orderId: string | null = null;
  isSelectedOrder = false;
  isHoveredByPlayer = false;
  targetPosition = new THREE.Vector3();

  // Dining & Table Seating + Paired Group properties
  groupId: string | null = null;
  partnerCustomerId: string | null = null;
  partnerName: string | null = null;
  isDiningWithPartner = false;
  assignedSeat: DiningSeatState | null = null;
  seatTransitionTimer = 0;
  diningTimer = 0;
  diningDuration = 15.0;
  orderedBurgerRecipe: RecipeId = 'classic_burger';
  orderedSoda = false;
  readonly carriedTrayGroup = new THREE.Group();
  readonly tabletopMealGroup = new THREE.Group();
  private tabletopBurgerGroup = new THREE.Group();
  private tabletopSodaGroup = new THREE.Group();
  readonly heldBurgerPropGroup = new THREE.Group();
  readonly heldDrinkPropGroup = new THREE.Group();
  readonly heldPhonePropGroup = new THREE.Group();

  constructor(
    id: string,
    profile: CustomerAppearance,
    startPosition: THREE.Vector3,
    seedIndex = 0,
    maxPatience = 72
  ) {
    this.id = id;
    this.profile = profile;
    this.seedIndex = seedIndex;
    this.patience = maxPatience;
    this.maxPatience = maxPatience;
    this.root = new THREE.Group();
    this.root.position.copy(startPosition);
    this.targetPosition.copy(startPosition);

    const shared = getSharedCharacterAssets();

    const skinMat = new THREE.MeshStandardMaterial({
      color: profile.skinColor,
      roughness: 0.48,
      metalness: 0.02,
    });
    const lipMat = new THREE.MeshStandardMaterial({
      color: 0xb85d56,
      roughness: 0.44,
      metalness: 0.02,
    });
    const irisMat = new THREE.MeshStandardMaterial({
      color: 0x3b2a1e,
      roughness: 0.24,
    });
    this.shirtMat = new THREE.MeshStandardMaterial({
      color: profile.shirtColor,
      roughness: 0.66,
      metalness: 0.04,
    });
    this.jacketMat = new THREE.MeshStandardMaterial({
      color: profile.jacketColor ?? profile.shirtColor,
      roughness: 0.58,
      metalness: 0.06,
      side: THREE.DoubleSide,
    });
    this.pantsMat = new THREE.MeshStandardMaterial({
      color: profile.pantsColor,
      roughness: 0.76,
      metalness: 0.04,
    });
    const beltMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.38,
      metalness: 0.2,
    });
    const buckleMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.25,
      metalness: 0.85,
    });
    const shoeMat = new THREE.MeshStandardMaterial({
      color: profile.shoeColor,
      roughness: 0.42,
      metalness: 0.06,
    });
    const soleMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.52,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: profile.hairColor,
      roughness: 0.56,
      metalness: 0.05,
    });
    const darkEyeMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.12,
    });
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.22,
    });

    // Soft radial ambient-occlusion contact shadow grounded at y = 0.012
    const shadowDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(0.84, 0.84),
      new THREE.MeshBasicMaterial({
        map: shared.shadowTex,
        color: shared.shadowTex ? 0xffffff : 0x000000,
        transparent: true,
        opacity: shared.shadowTex ? 0.92 : 0.34,
        depthWrite: false,
      })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.012;
    this.root.add(shadowDisc);

    // Golden target selection indicator ring on the floor when this customer's order is selected in KDS
    this.selectionRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.43, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      })
    );
    this.selectionRingMesh.rotation.x = -Math.PI / 2;
    this.selectionRingMesh.position.y = 0.018;
    this.selectionRingMesh.visible = false;
    this.root.add(this.selectionRingMesh);

    const bodyGroup = new THREE.Group();
    bodyGroup.name = 'CustomerBodyGroup';
    bodyGroup.scale.setScalar(profile.heightScale);
    this.bodyGroup = bodyGroup;
    this.root.add(bodyGroup);

    // 1. Articulated Upper & Lower Legs with Knee Joints & Sculpted Sneakers (pivoted at hip y = 0.72)
    const leftLegBuilt = this.buildArticulatedLeg(this.pantsMat, shoeMat, soleMat);
    this.leftLegGroup = leftLegBuilt.hipGroup;
    this.leftLegGroup.name = 'LeftLeg';
    this.leftKneeGroup = leftLegBuilt.kneeGroup;
    this.leftKneeGroup.name = 'LeftKnee';
    this.leftLegGroup.position.set(-0.105, 0.72, 0);
    bodyGroup.add(this.leftLegGroup);

    const rightLegBuilt = this.buildArticulatedLeg(this.pantsMat, shoeMat, soleMat);
    this.rightLegGroup = rightLegBuilt.hipGroup;
    this.rightLegGroup.name = 'RightLeg';
    this.rightKneeGroup = rightLegBuilt.kneeGroup;
    this.rightKneeGroup.name = 'RightKnee';
    this.rightLegGroup.position.set(0.105, 0.72, 0);
    bodyGroup.add(this.rightLegGroup);

    // 2. Sculpted Anatomical Torso, Pelvis, Belt, Open-Front Jacket & Collar
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.name = 'Torso';
    this.torsoGroup.position.set(0, 0.72, 0);
    bodyGroup.add(this.torsoGroup);

    const hips = new THREE.Mesh(shared.pelvisHips, this.pantsMat);
    hips.castShadow = true;
    hips.receiveShadow = true;
    this.torsoGroup.add(hips);

    // Leather belt & brass buckle at waist
    const belt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.174, 0.174, 0.036, 24),
      beltMat
    );
    belt.scale.set(1.0, 1.0, 0.73);
    belt.position.y = 0.11;
    this.torsoGroup.add(belt);

    const buckle = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.042, 0.022),
      buckleMat
    );
    buckle.position.set(0, 0.11, 0.126);
    this.torsoGroup.add(buckle);

    this.shirtMesh = new THREE.Mesh(shared.torsoShirt, this.shirtMat);
    this.shirtMesh.castShadow = true;
    this.shirtMesh.receiveShadow = true;
    this.torsoGroup.add(this.shirtMesh);

    // Tailored collar ring at neckline
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.088, 0.018, 10, 22, Math.PI * 1.45),
      this.jacketMat
    );
    collar.rotation.x = Math.PI / 2 + 0.12;
    collar.rotation.z = Math.PI * 0.78;
    collar.position.set(0, 0.585, -0.005);
    this.torsoGroup.add(collar);

    const neckMesh = new THREE.Mesh(shared.neck, skinMat);
    neckMesh.castShadow = true;
    this.torsoGroup.add(neckMesh);

    // 3. Articulated Shoulder + Elbow + Forearm + Sculpted Hand Rig
    const leftArmBuilt = this.buildArticulatedArm(this.jacketMat, skinMat, true);
    this.leftArmGroup = leftArmBuilt.shoulderGroup;
    this.leftArmGroup.name = 'LeftArm';
    this.leftForeArmGroup = leftArmBuilt.foreArmGroup;
    this.leftForeArmGroup.name = 'LeftForeArm';
    this.leftArmGroup.position.set(-0.235, 1.23, 0);
    bodyGroup.add(this.leftArmGroup);

    const rightArmBuilt = this.buildArticulatedArm(this.jacketMat, skinMat, false);
    this.rightArmGroup = rightArmBuilt.shoulderGroup;
    this.rightArmGroup.name = 'RightArm';
    this.rightForeArmGroup = rightArmBuilt.foreArmGroup;
    this.rightForeArmGroup.name = 'RightForeArm';
    this.rightArmGroup.position.set(0.235, 1.23, 0);
    bodyGroup.add(this.rightArmGroup);

    // 4. Sculpted Organic Head with Facial Anatomy & Layered Hair (y = 1.49)
    this.headGroup = new THREE.Group();
    this.headGroup.name = 'Head';
    this.headGroup.position.set(0, 1.49, 0);
    bodyGroup.add(this.headGroup);

    const headMesh = new THREE.Mesh(shared.headCranium, skinMat);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    this.headGroup.add(headMesh);

    const earGeo = new THREE.SphereGeometry(0.036, 12, 10);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.scale.set(0.52, 1.12, 0.78);
      ear.position.set(side * 0.152, 0.005, -0.008);
      this.headGroup.add(ear);
    }

    // 3D Sculpted Nose Bridge, Nose Tip & Nostril Wings
    const noseBridge = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.013, 0.028, 6, 10),
      skinMat
    );
    noseBridge.position.set(0, 0.008, 0.166);
    noseBridge.rotation.x = -0.22;
    this.headGroup.add(noseBridge);

    const noseTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.017, 12, 10),
      skinMat
    );
    noseTip.scale.set(1.06, 0.88, 1.15);
    noseTip.position.set(0, -0.012, 0.178);
    this.headGroup.add(noseTip);

    for (const side of [-1, 1]) {
      const nostrilWing = new THREE.Mesh(
        new THREE.SphereGeometry(0.011, 8, 8),
        skinMat
      );
      nostrilWing.scale.set(1.1, 0.78, 0.95);
      nostrilWing.position.set(side * 0.014, -0.016, 0.171);
      this.headGroup.add(nostrilWing);
    }

    const brows: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      const sclera = new THREE.Mesh(
        new THREE.SphereGeometry(0.024, 12, 10),
        whiteMat
      );
      sclera.scale.set(1.08, 0.88, 0.56);
      sclera.position.set(side * 0.054, 0.026, 0.151);
      this.headGroup.add(sclera);

      const iris = new THREE.Mesh(
        new THREE.SphereGeometry(0.0135, 10, 10),
        irisMat
      );
      iris.scale.set(1.0, 1.04, 0.58);
      iris.position.set(side * 0.054, 0.026, 0.16);
      this.headGroup.add(iris);

      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.008, 10, 10),
        darkEyeMat
      );
      pupil.scale.set(1.0, 1.04, 0.6);
      pupil.position.set(side * 0.054, 0.026, 0.165);
      this.headGroup.add(pupil);

      const upperLid = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, 0.006, 0.014),
        skinMat
      );
      upperLid.position.set(side * 0.054, 0.039, 0.159);
      upperLid.rotation.z = side * -0.04;
      this.headGroup.add(upperLid);

      const brow = new THREE.Mesh(
        new THREE.BoxGeometry(0.044, 0.01, 0.014),
        hairMat
      );
      brow.position.set(side * 0.054, 0.064, 0.156);
      brow.rotation.z = side * -0.07;
      this.headGroup.add(brow);
      brows.push(brow);
    }
    this.leftBrowMesh = brows[0];
    this.rightBrowMesh = brows[1];

    // Sculpted Upper & Lower Lips on the outer facial surface (z = 0.164..0.168)
    this.mouthMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0065, 0.034, 6, 12),
      lipMat
    );
    this.mouthMesh.rotation.z = Math.PI / 2;
    this.mouthMesh.scale.set(0.86, 1.0, 1.15);
    this.mouthMesh.position.set(0, -0.046, 0.165);
    this.headGroup.add(this.mouthMesh);

    const lowerLip = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.007, 0.03, 6, 12),
      lipMat
    );
    lowerLip.rotation.z = Math.PI / 2;
    lowerLip.scale.set(0.88, 1.0, 1.12);
    lowerLip.position.set(0, -0.055, 0.164);
    this.headGroup.add(lowerLip);

    if (profile.hasGlasses) {
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x18181b,
        metalness: 0.75,
        roughness: 0.22,
      });
      for (const side of [-1, 1]) {
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(0.036, 0.0045, 8, 18),
          frameMat
        );
        rim.position.set(side * 0.056, 0.028, 0.162);
        this.headGroup.add(rim);
      }
      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(0.032, 0.005, 0.005),
        frameMat
      );
      bridge.position.set(0, 0.032, 0.164);
      this.headGroup.add(bridge);
    }

    this.buildHairStyle(profile.hairStyle, hairMat, this.jacketMat);

    // Initialize AnimationMixer + procedural secondary rig animator
    this.animator = new CustomerAnimator(seedIndex, bodyGroup);

    // Apply true rigged & skinned GLB character if loaded, or register for async swap
    ensureCustomerGlbLoaded();
    if (_cachedCustomerGltf) {
      this.applyGlbSkinnedCharacter(_cachedCustomerGltf);
    } else {
      _pendingActors.push(this);
    }

    // Compact contextual floating pill (hidden by default unless selected, hovered, or critical)
    this.badgeCanvas = document.createElement('canvas');
    this.badgeCanvas.width = 256;
    this.badgeCanvas.height = 96;
    const badgeTex = new THREE.CanvasTexture(this.badgeCanvas);
    badgeTex.colorSpace = THREE.SRGBColorSpace;
    const spriteMat = new THREE.SpriteMaterial({
      map: badgeTex,
      transparent: true,
      depthWrite: false,
    });
    this.badgeSprite = new THREE.Sprite(spriteMat);
    this.badgeSprite.position.set(0, 1.94, 0);
    this.badgeSprite.scale.set(0.68, 0.25, 1);
    this.badgeSprite.visible = false;
    this.root.add(this.badgeSprite);

    // Carried tray group (when walking from pickup counter to table or takeaway exit)
    this.carriedTrayGroup.position.set(0, 0.94, 0.34);
    this.carriedTrayGroup.visible = false;
    this.root.add(this.carriedTrayGroup);

    // Handheld props during seated dining (kept above tabletop y >= 0.88)
    this.heldBurgerPropGroup.position.set(0, 0.96, 0.28);
    this.heldBurgerPropGroup.visible = false;
    this.root.add(this.heldBurgerPropGroup);

    this.heldDrinkPropGroup.position.set(0.08, 0.96, 0.28);
    this.heldDrinkPropGroup.visible = false;
    this.root.add(this.heldDrinkPropGroup);

    this.heldPhonePropGroup.position.set(0.1, 0.92, 0.28);
    this.heldPhonePropGroup.visible = false;
    this.root.add(this.heldPhonePropGroup);

    this.updateBadgeText(profile.name, 'Geliyor...', '#fbbf24', 1.0);
  }

  private buildMiniBurgerMesh(recipe: RecipeId): THREE.Group {
    const g = new THREE.Group();
    const bunMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55 });
    const pattyMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.72 });
    const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.35 });
    const lettuceMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.65 });

    const botBun = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.08, 0.028, 16),
      bunMat
    );
    botBun.position.y = 0.014;
    g.add(botBun);

    let y = 0.028;
    const pattyCount = recipe === 'double_smash' ? 2 : 1;
    const hasCheese = recipe === 'cheeseburger' || recipe === 'double_smash';

    for (let i = 0; i < pattyCount; i++) {
      const patty = new THREE.Mesh(
        new THREE.CylinderGeometry(0.086, 0.086, 0.022, 16),
        pattyMat
      );
      patty.position.y = y + 0.011;
      g.add(patty);
      y += 0.022;

      if (hasCheese) {
        const ch = new THREE.Mesh(
          new THREE.BoxGeometry(0.135, 0.008, 0.135),
          cheeseMat
        );
        ch.position.y = y + 0.004;
        ch.rotation.y = i * 0.4 + 0.2;
        g.add(ch);
        y += 0.008;
      }
    }

    const letMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.085, 0.014, 14),
      lettuceMat
    );
    letMesh.position.y = y + 0.007;
    g.add(letMesh);
    y += 0.014;

    const topBun = new THREE.Mesh(
      new THREE.SphereGeometry(0.086, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      bunMat
    );
    topBun.position.y = y;
    g.add(topBun);

    return g;
  }

  private buildMiniSodaMesh(): THREE.Group {
    const g = new THREE.Group();
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.036, 0.13, 14),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 })
    );
    cup.position.y = 0.065;
    g.add(cup);

    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.048, 0.012, 14),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 })
    );
    lid.position.y = 0.132;
    g.add(lid);

    const straw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.065, 8),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 })
    );
    straw.position.set(0.008, 0.16, 0);
    straw.rotation.z = -0.22;
    g.add(straw);
    return g;
  }

  private buildMiniTrayBaseMesh(): THREE.Group {
    const g = new THREE.Group();
    const tray = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.016, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.42 })
    );
    tray.position.y = 0.008;
    g.add(tray);

    const liner = new THREE.Mesh(
      new THREE.PlaneGeometry(0.37, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.78 })
    );
    liner.rotation.x = -Math.PI / 2;
    liner.position.y = 0.017;
    g.add(liner);
    return g;
  }

  /**
   * Builds and attaches the 3D meal tray & handheld props when the customer receives their order.
   */
  prepareDeliveredMealProps(recipe: RecipeId, hasSoda: boolean): void {
    this.orderedBurgerRecipe = recipe;
    this.orderedSoda = hasSoda;

    // 1. Clear previous props
    for (const grp of [
      this.carriedTrayGroup,
      this.tabletopMealGroup,
      this.tabletopBurgerGroup,
      this.tabletopSodaGroup,
      this.heldBurgerPropGroup,
      this.heldDrinkPropGroup,
      this.heldPhonePropGroup,
    ]) {
      while (grp.children.length > 0) {
        grp.remove(grp.children[0]);
      }
    }

    // 2. Carried tray (shown while walking from pickup counter to table or takeaway exit)
    const carriedTray = this.buildMiniTrayBaseMesh();
    const carriedBurger = this.buildMiniBurgerMesh(recipe);
    carriedBurger.position.set(-0.08, 0.018, 0);
    carriedTray.add(carriedBurger);
    if (hasSoda) {
      const carriedSoda = this.buildMiniSodaMesh();
      carriedSoda.position.set(0.11, 0.018, 0);
      carriedTray.add(carriedSoda);
    }
    this.carriedTrayGroup.add(carriedTray);
    this.carriedTrayGroup.visible = true;

    // 3. Tabletop meal group (placed on the table once seated)
    const tableTray = this.buildMiniTrayBaseMesh();
    this.tabletopMealGroup.add(tableTray);

    const tableBurger = this.buildMiniBurgerMesh(recipe);
    tableBurger.position.set(-0.08, 0.018, 0);
    this.tabletopBurgerGroup.add(tableBurger);
    this.tabletopMealGroup.add(this.tabletopBurgerGroup);

    if (hasSoda) {
      const tableSoda = this.buildMiniSodaMesh();
      tableSoda.position.set(0.11, 0.018, 0);
      this.tabletopSodaGroup.add(tableSoda);
      this.tabletopMealGroup.add(this.tabletopSodaGroup);
    }
    this.tabletopMealGroup.visible = false;

    // 4. Handheld burger prop (raised to mouth during seated_eat)
    const heldBurger = this.buildMiniBurgerMesh(recipe);
    heldBurger.scale.setScalar(0.88);
    this.heldBurgerPropGroup.add(heldBurger);
    this.heldBurgerPropGroup.visible = false;

    // 5. Handheld drink prop (raised during seated_drink)
    const heldDrink = this.buildMiniSodaMesh();
    heldDrink.scale.setScalar(0.92);
    this.heldDrinkPropGroup.add(heldDrink);
    this.heldDrinkPropGroup.visible = false;

    // 6. Handheld smartphone prop (held during seated_phone)
    const phoneGroup = new THREE.Group();
    const phoneBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.072, 0.01, 0.142),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.25,
        metalness: 0.7,
      })
    );
    phoneGroup.add(phoneBody);
    const phoneScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.064, 0.13),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    phoneScreen.rotation.x = -Math.PI / 2;
    phoneScreen.position.y = 0.006;
    phoneGroup.add(phoneScreen);
    phoneGroup.rotation.x = -0.55;
    this.heldPhonePropGroup.add(phoneGroup);
    this.heldPhonePropGroup.visible = false;
  }

  /**
   * Moves the customer's carried tray onto the assigned dining table seat spot.
   */
  placeMealOnAssignedSeatTable(scene: THREE.Scene): void {
    if (!this.assignedSeat) return;
    this.carriedTrayGroup.visible = false;
    this.tabletopMealGroup.position.set(
      this.assignedSeat.trayPosition.x,
      this.assignedSeat.trayPosition.y,
      this.assignedSeat.trayPosition.z
    );
    this.tabletopMealGroup.rotation.set(0, this.assignedSeat.trayRotationY, 0);
    this.tabletopMealGroup.visible = true;
    this.tabletopBurgerGroup.visible = true;
    this.tabletopSodaGroup.visible = this.orderedSoda;
    if (!this.tabletopMealGroup.parent) {
      scene.add(this.tabletopMealGroup);
    }
  }

  /**
   * Cleans up active meal props from the customer and scene when eating finishes or on reset.
   */
  cleanupActiveMealProps(scene: THREE.Scene): void {
    this.carriedTrayGroup.visible = false;
    this.heldBurgerPropGroup.visible = false;
    this.heldDrinkPropGroup.visible = false;
    this.heldPhonePropGroup.visible = false;
    this.tabletopMealGroup.visible = false;
    if (this.tabletopMealGroup.parent) {
      scene.remove(this.tabletopMealGroup);
    }
  }

  /**
   * Instantiates the rigged glTF 2.0 customer character via SkeletonUtils.clone,
   * customizes PBR materials, toggles hairstyle & jacket/glasses variants, and
   * binds THREE.AnimationMixer to the 7 embedded skeletal AnimationClips.
   */
  applyGlbSkinnedCharacter(cached: CachedCustomerGltf): void {
    let hasSkinnedMeshes = false;
    cached.scene.traverse((c) => {
      if ((c as THREE.SkinnedMesh).isSkinnedMesh) {
        hasSkinnedMeshes = true;
      }
    });

    if (!hasSkinnedMeshes) {
      this.applyGlbEnhancements(cached.meshMap);
      return;
    }

    const clonedRig = SkeletonUtils.clone(cached.scene) as THREE.Group;
    clonedRig.name = 'GLB_SkinnedCustomerRig';

    const targetHairNodeName = `Hair_${this.profile.hairStyle}`;
    const hasJacket = Boolean(this.profile.jacketColor);
    const hasGlasses = Boolean(this.profile.hasGlasses);

    clonedRig.traverse((child) => {
      if (child.name.startsWith('Hair_') && child.name !== 'HairBaseMesh') {
        const baseName = child.name.replace(/Node$/, '');
        child.visible = baseName === targetHairNodeName;
      }
      if (child.name === 'JacketOuterMesh' || child.name === 'JacketOuterNode') {
        child.visible = hasJacket;
      }
      if (child.name === 'GlassesMesh' || child.name === 'GlassesNode') {
        child.visible = hasGlasses;
      }

      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
          mesh.frustumCulled = false;
        }

        const origMat = mesh.material as THREE.MeshStandardMaterial;
        if (origMat && origMat.isMeshStandardMaterial) {
          const mat = origMat.clone();
          const mName = origMat.name || '';
          if (mName === 'Mat_Skin' || mesh.name === 'BodySkinMesh') {
            mat.color.setHex(this.profile.skinColor);
            mat.roughness = 0.48;
          } else if (mName === 'Mat_Shirt' || mesh.name === 'TorsoShirtMesh') {
            mat.color.setHex(this.profile.shirtColor);
            mat.roughness = 0.68;
          } else if (mName === 'Mat_Jacket' || mesh.name === 'JacketOuterMesh') {
            mat.color.setHex(this.profile.jacketColor ?? this.profile.shirtColor);
            mat.roughness = 0.56;
          } else if (mName === 'Mat_Pants' || mesh.name === 'LegsPantsMesh') {
            mat.color.setHex(this.profile.pantsColor);
            mat.roughness = 0.76;
          } else if (mName === 'Mat_Shoe' || mesh.name === 'ShoesUpperMesh') {
            mat.color.setHex(this.profile.shoeColor);
            mat.roughness = 0.42;
          } else if (
            mName === 'Mat_Hair' ||
            mesh.name.startsWith('Hair') ||
            mesh.name === 'EyebrowsMesh'
          ) {
            mat.color.setHex(
              this.profile.hairStyle === 'cap' && mesh.name === 'Hair_cap'
                ? this.profile.jacketColor ?? this.profile.shirtColor
                : this.profile.hairColor
            );
          }
          mesh.material = mat;
        }
      }
    });

    // Apply anatomical bodyType silhouette variation (male athletic shoulder breadth vs female tapered waist & shoulder silhouette)
    const isFemale = this.profile.bodyType === 'female';
    const chestBone = clonedRig.getObjectByName('Chest');
    const spineBone = clonedRig.getObjectByName('Spine');
    const headBone = clonedRig.getObjectByName('Head');
    if (chestBone && spineBone && headBone) {
      if (isFemale) {
        spineBone.scale.set(0.92, 1.0, 0.94);
        chestBone.scale.set(0.94, 1.0, 0.98);
        headBone.scale.set(1.06, 1.02, 1.04);
      } else {
        spineBone.scale.set(1.03, 1.0, 1.02);
        chestBone.scale.set(1.04, 1.0, 1.02);
        headBone.scale.set(0.96, 1.0, 0.98);
      }
    }

    // Replace procedural bodyGroup children with the true SkinnedMesh rig
    while (this.bodyGroup.children.length > 0) {
      this.bodyGroup.remove(this.bodyGroup.children[0]);
    }
    this.bodyGroup.add(clonedRig);
    this.isUsingGlbSkinnedMesh = true;

    if (cached.animations.length > 0) {
      this.animator.bindGlbRig(clonedRig, cached.animations);
    }
  }

  applyGlbEnhancements(
    glbMap: Map<string, { geometry: THREE.BufferGeometry; normalMap: THREE.Texture | null }>
  ): void {
    const jacketEntry =
      glbMap.get('JacketOuterMesh') ||
      glbMap.get('TorsoJacketNode') ||
      glbMap.get('TorsoJacket') ||
      Array.from(glbMap.values())[0];
    if (jacketEntry) {
      if (jacketEntry.normalMap) {
        this.shirtMat.normalMap = jacketEntry.normalMap;
        this.shirtMat.normalScale.set(0.45, 0.45);
        this.shirtMat.needsUpdate = true;

        this.jacketMat.normalMap = jacketEntry.normalMap;
        this.jacketMat.normalScale.set(0.55, 0.55);
        this.jacketMat.needsUpdate = true;

        this.pantsMat.normalMap = jacketEntry.normalMap;
        this.pantsMat.normalScale.set(0.6, 0.6);
        this.pantsMat.needsUpdate = true;
      }

      if (this.profile.jacketColor && !this.jacketMesh) {
        this.jacketMesh = new THREE.Mesh(jacketEntry.geometry, this.jacketMat);
        this.jacketMesh.name = 'GLB_CustomerJacket';
        this.jacketMesh.castShadow = true;
        this.jacketMesh.receiveShadow = true;
        this.torsoGroup.add(this.jacketMesh);
      }
    }
  }

  triggerRefusalReaction(message = 'Yanlış Sipariş!'): void {
    this.refusalTimer = 1.65;
    this.updateBadgeText(this.profile.name, message, '#ef4444', this.patienceRatio);
  }

  private buildArticulatedLeg(
    pantsMat: THREE.Material,
    shoeMat: THREE.Material,
    soleMat: THREE.Material
  ): { hipGroup: THREE.Group; kneeGroup: THREE.Group } {
    const shared = getSharedCharacterAssets();
    const hipGroup = new THREE.Group();

    const thigh = new THREE.Mesh(shared.thigh, pantsMat);
    thigh.castShadow = true;
    thigh.receiveShadow = true;
    hipGroup.add(thigh);

    const kneeGroup = new THREE.Group();
    kneeGroup.position.set(0, -0.32, 0);
    hipGroup.add(kneeGroup);

    const shin = new THREE.Mesh(shared.calf, pantsMat);
    shin.castShadow = true;
    shin.receiveShadow = true;
    kneeGroup.add(shin);

    const shoeUpper = new THREE.Mesh(shared.sneakerUpper, shoeMat);
    shoeUpper.castShadow = true;
    shoeUpper.receiveShadow = true;
    kneeGroup.add(shoeUpper);

    const sole = new THREE.Mesh(shared.sneakerSole, soleMat);
    sole.receiveShadow = true;
    kneeGroup.add(sole);

    return { hipGroup, kneeGroup };
  }

  private buildArticulatedArm(
    sleeveMat: THREE.Material,
    skinMat: THREE.Material,
    includeWristWatch: boolean
  ): { shoulderGroup: THREE.Group; foreArmGroup: THREE.Group } {
    const shared = getSharedCharacterAssets();
    const shoulderGroup = new THREE.Group();

    const sleeve = new THREE.Mesh(shared.upperArm, sleeveMat);
    sleeve.castShadow = true;
    sleeve.receiveShadow = true;
    shoulderGroup.add(sleeve);

    const foreArmGroup = new THREE.Group();
    foreArmGroup.position.set(0, -0.2, 0);
    shoulderGroup.add(foreArmGroup);

    const forearm = new THREE.Mesh(shared.foreArm, skinMat);
    forearm.castShadow = true;
    foreArmGroup.add(forearm);

    if (includeWristWatch) {
      const strap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.036, 0.02, 14),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.38 })
      );
      strap.position.y = -0.175;
      foreArmGroup.add(strap);

      const dial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.017, 0.017, 0.012, 12),
        new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          metalness: 0.85,
          roughness: 0.18,
        })
      );
      dial.rotation.z = Math.PI / 2;
      dial.position.set(-0.034, -0.175, 0.008);
      foreArmGroup.add(dial);
    }

    const hand = new THREE.Mesh(shared.handPalm, skinMat);
    hand.castShadow = true;
    foreArmGroup.add(hand);

    return { shoulderGroup, foreArmGroup };
  }

  private buildHairStyle(
    style: CustomerAppearance['hairStyle'],
    hairMat: THREE.Material,
    capMat: THREE.Material
  ): void {
    // Full cranial hair base covering crown, back of head, and temples without skin clipping
    const hairCrown = new THREE.Mesh(
      new THREE.SphereGeometry(0.164, 26, 20, 0, Math.PI * 2, 0, Math.PI * 0.64),
      hairMat
    );
    hairCrown.position.set(0, 0.056, -0.012);
    hairCrown.scale.set(1.04, 1.08, 1.09);
    hairCrown.rotation.x = -0.22;
    hairCrown.castShadow = true;
    this.headGroup.add(hairCrown);

    // Nape / back-of-head hair volume
    const hairBack = new THREE.Mesh(
      new THREE.SphereGeometry(0.148, 20, 16),
      hairMat
    );
    hairBack.position.set(0, 0.015, -0.048);
    hairBack.scale.set(1.02, 1.05, 1.0);
    hairBack.castShadow = true;
    this.headGroup.add(hairBack);

    // Temple / sideburn locks framing the upper face
    for (const side of [-1, 1]) {
      const templeLock = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.032, 0.085, 8, 10),
        hairMat
      );
      templeLock.position.set(side * 0.144, 0.045, 0.028);
      templeLock.rotation.z = side * 0.08;
      templeLock.rotation.x = 0.15;
      this.headGroup.add(templeLock);
    }

    if (style === 'quiff') {
      const topVolume = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.068, 0.12, 12, 16),
        hairMat
      );
      topVolume.rotation.z = Math.PI / 2;
      topVolume.position.set(0, 0.168, 0.025);
      topVolume.castShadow = true;
      this.headGroup.add(topVolume);

      const frontWave = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.056, 0.135, 12, 16),
        hairMat
      );
      frontWave.rotation.z = Math.PI / 2;
      frontWave.rotation.x = 0.25;
      frontWave.position.set(0, 0.158, 0.095);
      frontWave.castShadow = true;
      this.headGroup.add(frontWave);
    } else if (style === 'ponytail') {
      // Swept front bangs framing forehead
      for (const side of [-1, 1]) {
        const sweptBang = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.045, 0.1, 10, 12),
          hairMat
        );
        sweptBang.rotation.z = side * 1.15;
        sweptBang.rotation.y = side * -0.35;
        sweptBang.position.set(side * 0.065, 0.135, 0.105);
        this.headGroup.add(sweptBang);
      }

      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.076, 16, 14), hairMat);
      bun.position.set(0, 0.062, -0.188);
      bun.castShadow = true;
      this.headGroup.add(bun);

      const tail = new THREE.Mesh(
        new THREE.ConeGeometry(0.056, 0.175, 14),
        hairMat
      );
      tail.position.set(0, -0.022, -0.215);
      tail.rotation.x = 0.45;
      tail.castShadow = true;
      this.headGroup.add(tail);
    } else if (style === 'bob') {
      // Full fringe / bangs across upper forehead
      const fringe = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.048, 0.13, 10, 14),
        hairMat
      );
      fringe.rotation.z = Math.PI / 2;
      fringe.position.set(0, 0.138, 0.108);
      this.headGroup.add(fringe);

      for (const side of [-1, 1]) {
        const sideLock = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.052, 0.165, 10, 14),
          hairMat
        );
        sideLock.position.set(side * 0.138, -0.012, 0.018);
        sideLock.rotation.z = side * -0.06;
        sideLock.castShadow = true;
        this.headGroup.add(sideLock);
      }
    } else if (style === 'cap') {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.172, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.54),
        capMat
      );
      dome.position.set(0, 0.058, -0.006);
      dome.scale.set(1.04, 1.06, 1.08);
      dome.castShadow = true;
      this.headGroup.add(dome);

      const visor = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.164,
          0.164,
          0.018,
          20,
          1,
          false,
          -Math.PI * 0.36,
          Math.PI * 0.72
        ),
        capMat
      );
      visor.position.set(0, 0.096, 0.076);
      visor.rotation.x = 0.14;
      visor.castShadow = true;
      this.headGroup.add(visor);
    }
  }

  setSelectedTarget(selected: boolean): void {
    if (this.isSelectedOrder === selected) return;
    this.isSelectedOrder = selected;
    this.selectionRingMesh.visible = selected;
    this.updateBadgeText(
      this.lastBadgeTitle || this.profile.name,
      this.lastBadgeSub,
      this.lastBadgeAccent || '#38bdf8',
      this.patienceRatio
    );
    this.updateBadgeVisibility();
  }

  /**
   * Controls contextual visibility of the overhead floating indicator pill:
   * Hidden by default on walking/seated customers so characters look natural without black boxes.
   * Shown ONLY when:
   * - The customer's order is actively selected in KDS (`isSelectedOrder`), OR
   * - The player is looking directly at the customer (`isHoveredByPlayer`), OR
   * - The customer is actively placing an order at the register (`ORDERING`), refusing a wrong item,
   *   or critically low on patience (`patienceRatio < 0.40` while waiting).
   */
  updateBadgeVisibility(): void {
    const isWaitingState =
      this.state === 'WAITING_TO_ORDER' ||
      this.state === 'ORDER_PLACED' ||
      this.state === 'WAITING_FOR_FOOD';
    const isCriticalPatience = isWaitingState && this.patienceRatio < 0.4;
    const shouldShow =
      this.isSelectedOrder ||
      this.isHoveredByPlayer ||
      this.refusalTimer > 0 ||
      this.state === 'ORDERING' ||
      isCriticalPatience;

    this.badgeSprite.visible = shouldShow;
  }

  updateBadgeText(
    title: string,
    subtitle: string,
    accent = '#fbbf24',
    patienceRatio = this.patienceRatio
  ): void {
    const clampedRatio = Math.max(0, Math.min(1, patienceRatio));
    const bucket = Math.round(clampedRatio * 25);
    if (
      title === this.lastBadgeTitle &&
      subtitle === this.lastBadgeSub &&
      accent === this.lastBadgeAccent &&
      bucket === this.lastPatienceBucket &&
      this.isSelectedOrder === this.lastSelectedFlag &&
      this.isHoveredByPlayer === this.lastHoveredFlag
    ) {
      return;
    }
    this.lastBadgeTitle = title;
    this.lastBadgeSub = subtitle;
    this.lastBadgeAccent = accent;
    this.lastPatienceBucket = bucket;
    this.lastSelectedFlag = this.isSelectedOrder;
    this.lastHoveredFlag = this.isHoveredByPlayer;

    const ctx = this.badgeCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 256, 96);

    ctx.fillStyle = this.isSelectedOrder
      ? 'rgba(20, 16, 13, 0.82)'
      : 'rgba(15, 23, 42, 0.68)';
    ctx.beginPath();
    ctx.roundRect(14, 10, 228, 76, 24);
    ctx.fill();

    ctx.strokeStyle = this.isSelectedOrder
      ? 'rgba(251, 191, 36, 0.85)'
      : 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = this.isSelectedOrder ? 2.5 : 1.5;
    ctx.stroke();

    const headerText = this.isSelectedOrder ? `★ ${title}` : title;
    ctx.fillStyle = this.isSelectedOrder ? '#fbbf24' : '#f8fafc';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(headerText, 128, 34, 204);

    ctx.fillStyle = this.isSelectedOrder ? '#fde68a' : accent;
    ctx.font = '600 13px sans-serif';
    ctx.fillText(subtitle, 128, 55, 204);

    // Subtle slim patience bar at bottom of compact pill
    const barX = 36;
    const barY = 68;
    const barW = 184;
    const barH = 5;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 3);
    ctx.fill();

    const fillW = Math.max(6, Math.round(barW * clampedRatio));
    const barColor =
      clampedRatio > 0.55
        ? '#4ade80'
        : clampedRatio > 0.28
        ? '#fbbf24'
        : '#ef4444';
    ctx.fillStyle = barColor;
    ctx.beginPath();
    ctx.roundRect(barX, barY, fillW, barH, 3);
    ctx.fill();

    if (this.badgeSprite.material.map) {
      this.badgeSprite.material.map.needsUpdate = true;
    }
  }

  update(dt: number, elapsed: number): boolean {
    const dx = this.targetPosition.x - this.root.position.x;
    const dz = this.targetPosition.z - this.root.position.z;
    const dist = Math.hypot(dx, dz);
    const speed = this.state === 'LEAVING_ANGRY' ? 2.85 : 2.15;

    if (this.selectionRingMesh.visible) {
      const pulse = 1.0 + Math.sin(elapsed * 5.0) * 0.06;
      this.selectionRingMesh.scale.setScalar(pulse);
    }

    this.updateBadgeVisibility();

    const isSeatedState =
      this.state === 'SITTING_DOWN' ||
      this.state === 'DINING' ||
      this.state === 'STANDING_UP';

    let reached = false;
    if (dist > 0.04 && !isSeatedState) {
      const step = Math.min(dist, speed * dt);
      const nx = dx / dist;
      const nz = dz / dist;
      this.root.position.x += nx * step;
      this.root.position.z += nz * step;

      const targetAngle = computeCharacterHeadingYaw(
        nx,
        nz,
        this.root.rotation.y
      );
      this.root.rotation.y = stepCharacterYawShortestArc(
        this.root.rotation.y,
        targetAngle,
        dt,
        10
      );

      this.badgeSprite.position.y = 1.94;
      this.animator.playClip(
        this.state === 'LEAVING_ANGRY' ? 'leaving_angry' : 'walk'
      );
      this.animator.advanceWalk(step, dt, 2.15);
    } else {
      reached = true;

      if (this.state === 'SITTING_DOWN' && this.assignedSeat) {
        // Smooth weight transfer & slide onto the booth cushion over 0.78s (no snapping)
        const sitProgress = Math.max(
          0,
          Math.min(1, 1 - this.seatTransitionTimer / 0.78)
        );
        const smoothSit =
          sitProgress * sitProgress * (3 - 2 * sitProgress);
        const entryX = THREE.MathUtils.lerp(
          this.assignedSeat.approachPosition.x,
          this.assignedSeat.seatPosition.x,
          0.65
        );
        const entryZ = THREE.MathUtils.lerp(
          this.assignedSeat.approachPosition.z,
          this.assignedSeat.seatPosition.z,
          0.65
        );
        this.root.position.x = THREE.MathUtils.lerp(
          entryX,
          this.assignedSeat.seatPosition.x,
          smoothSit
        );
        this.root.position.z = THREE.MathUtils.lerp(
          entryZ,
          this.assignedSeat.seatPosition.z,
          smoothSit
        );
        this.root.rotation.y = stepCharacterYawShortestArc(
          this.root.rotation.y,
          this.assignedSeat.seatYaw,
          dt,
          9
        );
      } else if (this.state === 'STANDING_UP' && this.assignedSeat) {
        // Smooth weight shift out of the booth cushion toward aisle over 0.75s
        const standProgress = Math.max(
          0,
          Math.min(1, 1 - this.seatTransitionTimer / 0.75)
        );
        const smoothStand =
          standProgress * standProgress * (3 - 2 * standProgress);
        const exitX = THREE.MathUtils.lerp(
          this.assignedSeat.seatPosition.x,
          this.assignedSeat.approachPosition.x,
          0.38
        );
        const exitZ = THREE.MathUtils.lerp(
          this.assignedSeat.seatPosition.z,
          this.assignedSeat.approachPosition.z,
          0.38
        );
        this.root.position.x = THREE.MathUtils.lerp(
          this.assignedSeat.seatPosition.x,
          exitX,
          smoothStand
        );
        this.root.position.z = THREE.MathUtils.lerp(
          this.assignedSeat.seatPosition.z,
          exitZ,
          smoothStand
        );
        this.root.rotation.y = stepCharacterYawShortestArc(
          this.root.rotation.y,
          this.assignedSeat.seatYaw,
          dt,
          8
        );
      } else if (this.state === 'DINING' && this.assignedSeat) {
        this.root.position.x = this.assignedSeat.seatPosition.x;
        this.root.position.z = this.assignedSeat.seatPosition.z;
        this.root.rotation.y = this.assignedSeat.seatYaw;
      } else {
        this.root.position.x = this.targetPosition.x;
        this.root.position.z = this.targetPosition.z;
        if (isSeatedState && this.assignedSeat) {
          this.root.rotation.y = this.assignedSeat.seatYaw;
        } else if (
          this.state !== 'LEAVING' &&
          this.state !== 'LEAVING_ANGRY' &&
          this.state !== 'WALKING_TO_SEAT_APPROACH' &&
          this.state !== 'WALKING_TO_SEAT' &&
          this.state !== 'STEPPING_OUT_OF_SEAT'
        ) {
          this.root.rotation.y = stepCharacterYawShortestArc(
            this.root.rotation.y,
            Math.PI,
            dt,
            8
          );
        }
      }

      if (this.refusalTimer > 0) {
        this.refusalTimer = Math.max(0, this.refusalTimer - dt);
      }

      // Select appropriate stationary or seated animation clip
      if (this.state === 'SITTING_DOWN') {
        this.badgeSprite.position.y = 1.78;
        this.heldBurgerPropGroup.visible = false;
        this.heldDrinkPropGroup.visible = false;
        this.heldPhonePropGroup.visible = false;
        this.animator.playClip('sit_down');
      } else if (this.state === 'DINING') {
        this.badgeSprite.position.y = 1.74;
        const diningElapsed = Math.max(0, this.diningDuration - this.diningTimer);

        // Cycle naturally between eating burger bites (lifting from tray to mouth and setting back down),
        // chatting with table partner, sipping soda, and checking phone
        if (diningElapsed < 5.2 || (diningElapsed >= 8.4 && diningElapsed < 11.8)) {
          this.animator.playClip('seated_eat');
          const clipPhase = ((this.animator.clipElapsed % 2.0) / 2.0) * Math.PI * 2;
          const rawWave = Math.sin(clipPhase - Math.PI * 0.42);
          const bite = Math.max(0, Math.min(1, (rawWave + 0.25) / 1.25));
          const chewBob =
            bite > 0.72 ? Math.sin(elapsed * 12.0) * 0.012 : 0;

          if (bite <= 0.14) {
            // Burger rests on the tray between bites
            this.heldBurgerPropGroup.visible = false;
            this.tabletopBurgerGroup.visible = true;
          } else {
            // Customer grasps burger with both hands and lifts it from tray to mouth
            this.heldBurgerPropGroup.visible = true;
            this.tabletopBurgerGroup.visible = false;
            this.heldBurgerPropGroup.position.set(
              0,
              0.84 + bite * 0.22 + chewBob,
              0.34 - bite * 0.10
            );
            this.heldBurgerPropGroup.rotation.set(bite * 0.24, 0, 0);
          }
          this.heldDrinkPropGroup.visible = false;
          this.tabletopSodaGroup.visible = this.orderedSoda;
          this.heldPhonePropGroup.visible = false;
        } else if (diningElapsed >= 5.2 && diningElapsed < 8.4) {
          // Mid-meal sip of drink or lively table conversation with partner
          this.heldBurgerPropGroup.visible = false;
          this.tabletopBurgerGroup.visible = true;
          this.heldPhonePropGroup.visible = false;
          if (this.orderedSoda && (!this.isDiningWithPartner || diningElapsed < 6.8)) {
            this.animator.playClip('seated_drink');
            const clipPhase = ((this.animator.clipElapsed % 2.0) / 2.0) * Math.PI * 2;
            const rawSip = Math.sin(clipPhase - Math.PI * 0.42);
            const sip = Math.max(0, Math.min(1, (rawSip + 0.25) / 1.25));
            if (sip <= 0.14) {
              this.heldDrinkPropGroup.visible = false;
              this.tabletopSodaGroup.visible = true;
            } else {
              this.heldDrinkPropGroup.visible = true;
              this.tabletopSodaGroup.visible = false;
              this.heldDrinkPropGroup.position.set(
                0.04,
                0.84 + sip * 0.20,
                0.32 - sip * 0.09
              );
              this.heldDrinkPropGroup.rotation.set(-sip * 0.36, 0, -0.05);
            }
          } else {
            this.animator.playClip('seated_idle_look');
            this.heldDrinkPropGroup.visible = false;
            this.tabletopSodaGroup.visible = this.orderedSoda;
          }
        } else {
          // Final moments after finishing burger: chatting across the booth or checking phone
          this.heldBurgerPropGroup.visible = false;
          this.tabletopBurgerGroup.visible = false;
          this.heldDrinkPropGroup.visible = false;
          this.tabletopSodaGroup.visible = this.orderedSoda;
          if (this.isDiningWithPartner) {
            this.animator.playClip('seated_idle_look');
            this.heldPhonePropGroup.visible = false;
          } else if (this.seedIndex % 2 === 0) {
            this.animator.playClip('seated_phone');
            this.heldPhonePropGroup.visible = true;
            this.heldPhonePropGroup.position.set(0.06, 0.96, 0.25);
          } else {
            this.animator.playClip('seated_idle_look');
            this.heldPhonePropGroup.visible = false;
          }
        }
      } else if (this.state === 'STANDING_UP') {
        this.badgeSprite.position.y = 1.88;
        this.heldBurgerPropGroup.visible = false;
        this.heldDrinkPropGroup.visible = false;
        this.heldPhonePropGroup.visible = false;
        this.animator.playClip('stand_up');
      } else if (this.state === 'RECEIVING_ORDER' || this.reactionTimer > 0) {
        this.reactionTimer = Math.max(0, this.reactionTimer - dt);
        this.animator.playClip('receiving_happy');
      } else if (this.state === 'ORDERING') {
        this.animator.playClip('ordering');
      } else if (this.patienceRatio < 0.38 || this.refusalTimer > 0) {
        this.animator.playClip('impatient_watch');
      } else if (
        this.state === 'WAITING_FOR_FOOD' ||
        this.state === 'ORDER_PLACED'
      ) {
        this.animator.playClip('idle_waiting_food');
      } else {
        this.animator.playClip('idle_queue');
      }
    }

    this.animator.update(
      dt,
      elapsed,
      {
        torsoGroup: this.torsoGroup,
        headGroup: this.headGroup,
        leftArmGroup: this.leftArmGroup,
        leftForeArmGroup: this.leftForeArmGroup,
        rightArmGroup: this.rightArmGroup,
        rightForeArmGroup: this.rightForeArmGroup,
        leftLegGroup: this.leftLegGroup,
        leftKneeGroup: this.leftKneeGroup,
        rightLegGroup: this.rightLegGroup,
        rightKneeGroup: this.rightKneeGroup,
        mouthMesh: this.mouthMesh,
        leftBrowMesh: this.leftBrowMesh,
        rightBrowMesh: this.rightBrowMesh,
      },
      this.refusalTimer
    );

    return reached;
  }
}

export interface StreetPedestrianWaypoint {
  x: number;
  z: number;
  pauseSeconds?: number;
  lookYaw?: number;
}

/**
 * Rigged 3D human pedestrian for Living Street 3.0.
 * Uses the full rigged CustomerActor (SkeletonUtils.clone + 13-clip AnimationMixer)
 * with shortest-arc heading interpolation so the pedestrian ALWAYS faces their
 * exact walking velocity vector across +X, -X, +Z, -Z, and diagonal paths.
 */
export class StreetPedestrianActor {
  readonly root: THREE.Group;
  private readonly actor: CustomerActor;
  private readonly waypoints: StreetPedestrianWaypoint[];
  private readonly walkSpeed: number;
  private readonly loopWrap: boolean;
  private currentWaypointIndex = 0;
  private pauseTimer = 0;
  private activePauseLookYaw: number | undefined = undefined;
  readonly velocity = new THREE.Vector3();

  constructor(options: {
    id: string;
    seedIndex: number;
    waypoints: StreetPedestrianWaypoint[];
    startWaypointIndex?: number;
    startProgressToNext?: number;
    walkSpeed?: number;
    loopWrap?: boolean;
  }) {
    this.waypoints = options.waypoints;
    this.walkSpeed = options.walkSpeed ?? 1.38;
    this.loopWrap = options.loopWrap ?? false;

    const startIdx =
      (options.startWaypointIndex ?? 0) % Math.max(1, this.waypoints.length);
    const nextIdx = (startIdx + 1) % Math.max(1, this.waypoints.length);
    const wpA = this.waypoints[startIdx] ?? { x: 0, z: 12 };
    const wpB = this.waypoints[nextIdx] ?? wpA;
    const t = Math.max(0, Math.min(0.95, options.startProgressToNext ?? 0));
    const startX = THREE.MathUtils.lerp(wpA.x, wpB.x, t);
    const startZ = THREE.MathUtils.lerp(wpA.z, wpB.z, t);

    this.currentWaypointIndex = nextIdx;

    const profile =
      CUSTOMER_PROFILES[options.seedIndex % CUSTOMER_PROFILES.length];
    this.actor = new CustomerActor(
      options.id,
      profile,
      new THREE.Vector3(startX, 0, startZ),
      options.seedIndex,
      999
    );
    this.actor.state = 'LEAVING'; // hides overhead order badge
    this.actor.setSelectedTarget(false);

    const initDx = wpB.x - wpA.x;
    const initDz = wpB.z - wpA.z;
    const initialYaw = computeCharacterHeadingYaw(initDx, initDz, 0);
    this.actor.root.rotation.y = initialYaw;
    this.root = this.actor.root;
  }

  get headingYaw(): number {
    return this.actor.root.rotation.y;
  }

  update(dt: number, elapsed: number): void {
    this.actor.state = 'LEAVING'; // Ensure overhead badge stays hidden
    if (this.waypoints.length < 2) return;

    if (this.pauseTimer > 0) {
      this.pauseTimer = Math.max(0, this.pauseTimer - dt);
      this.velocity.set(0, 0, 0);
      if (this.activePauseLookYaw !== undefined) {
        this.actor.root.rotation.y = stepCharacterYawShortestArc(
          this.actor.root.rotation.y,
          this.activePauseLookYaw,
          dt,
          7.5
        );
      }
      this.actor.animator.playClip('idle_queue');
      this.actor.animator.update(dt, elapsed, {
        torsoGroup: this.actor.torsoGroup,
        headGroup: this.actor.headGroup,
        leftArmGroup: this.actor.leftArmGroup,
        leftForeArmGroup: this.actor.leftForeArmGroup,
        rightArmGroup: this.actor.rightArmGroup,
        rightForeArmGroup: this.actor.rightForeArmGroup,
        leftLegGroup: this.actor.leftLegGroup,
        leftKneeGroup: this.actor.leftKneeGroup,
        rightLegGroup: this.actor.rightLegGroup,
        rightKneeGroup: this.actor.rightKneeGroup,
        mouthMesh: this.actor.mouthMesh,
        leftBrowMesh: this.actor.leftBrowMesh,
        rightBrowMesh: this.actor.rightBrowMesh,
      });
      return;
    }

    const targetWp = this.waypoints[this.currentWaypointIndex];
    const dx = targetWp.x - this.actor.root.position.x;
    const dz = targetWp.z - this.actor.root.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist <= 0.08) {
      this.actor.root.position.x = targetWp.x;
      this.actor.root.position.z = targetWp.z;

      if (targetWp.pauseSeconds && targetWp.pauseSeconds > 0) {
        this.pauseTimer = targetWp.pauseSeconds;
        this.activePauseLookYaw = targetWp.lookYaw;
      }

      const nextIndex = this.currentWaypointIndex + 1;
      if (nextIndex >= this.waypoints.length) {
        if (this.loopWrap) {
          // Teleport seamlessly to waypoint 0 (for off-screen straight sidewalk loops)
          const firstWp = this.waypoints[0];
          this.actor.root.position.x = firstWp.x;
          this.actor.root.position.z = firstWp.z;
          this.currentWaypointIndex = 1 % this.waypoints.length;
          const nextWp = this.waypoints[this.currentWaypointIndex];
          this.actor.root.rotation.y = computeCharacterHeadingYaw(
            nextWp.x - firstWp.x,
            nextWp.z - firstWp.z,
            this.actor.root.rotation.y
          );
        } else {
          this.currentWaypointIndex = 0;
        }
      } else {
        this.currentWaypointIndex = nextIndex;
      }
      return;
    }

    const step = Math.min(dist, this.walkSpeed * dt);
    const nx = dx / dist;
    const nz = dz / dist;
    this.velocity.set(nx * this.walkSpeed, 0, nz * this.walkSpeed);

    this.actor.root.position.x += nx * step;
    this.actor.root.position.z += nz * step;

    const targetYaw = computeCharacterHeadingYaw(
      nx,
      nz,
      this.actor.root.rotation.y
    );
    this.actor.root.rotation.y = stepCharacterYawShortestArc(
      this.actor.root.rotation.y,
      targetYaw,
      dt,
      11
    );

    this.actor.animator.playClip('walk');
    this.actor.animator.advanceWalk(step, dt, 1.42);
    this.actor.animator.update(dt, elapsed, {
      torsoGroup: this.actor.torsoGroup,
      headGroup: this.actor.headGroup,
      leftArmGroup: this.actor.leftArmGroup,
      leftForeArmGroup: this.actor.leftForeArmGroup,
      rightArmGroup: this.actor.rightArmGroup,
      rightForeArmGroup: this.actor.rightForeArmGroup,
      leftLegGroup: this.actor.leftLegGroup,
      leftKneeGroup: this.actor.leftKneeGroup,
      rightLegGroup: this.actor.rightLegGroup,
      rightKneeGroup: this.actor.rightKneeGroup,
      mouthMesh: this.actor.mouthMesh,
      leftBrowMesh: this.actor.leftBrowMesh,
      rightBrowMesh: this.actor.rightBrowMesh,
    });
  }
}

