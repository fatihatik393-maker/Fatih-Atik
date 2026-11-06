import * as THREE from 'three';

export type CustomerAnimClip =
  | 'walk'
  | 'idle_queue'
  | 'ordering'
  | 'idle_waiting_food'
  | 'impatient_watch'
  | 'receiving_happy'
  | 'leaving_angry'
  | 'sit_down'
  | 'seated_eat'
  | 'seated_drink'
  | 'seated_phone'
  | 'seated_idle_look'
  | 'stand_up';

export interface CustomerRigTargets {
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArmGroup: THREE.Group;
  leftForeArmGroup?: THREE.Group;
  rightArmGroup: THREE.Group;
  rightForeArmGroup?: THREE.Group;
  leftLegGroup: THREE.Group;
  leftKneeGroup?: THREE.Group;
  rightLegGroup: THREE.Group;
  rightKneeGroup?: THREE.Group;
  mouthMesh?: THREE.Mesh;
  leftBrowMesh?: THREE.Mesh;
  rightBrowMesh?: THREE.Mesh;
}

export interface PoseSample {
  torsoPosY: number;
  torsoRotX: number;
  torsoRotY: number;
  torsoRotZ: number;
  headPosY: number;
  headRotX: number;
  headRotY: number;
  headRotZ: number;
  leftArmRotX: number;
  leftArmRotZ: number;
  leftForeArmRotX: number;
  leftForeArmRotZ: number;
  rightArmRotX: number;
  rightArmRotZ: number;
  rightForeArmRotX: number;
  leftLegRotX: number;
  leftKneeRotX: number;
  rightLegRotX: number;
  rightKneeRotX: number;
  mouthScaleY: number;
  browTilt: number;
}

/**
 * Unified Character Orientation Standard (BURGER DISTRICT 3.0):
 * All human characters (customers & street pedestrians) have their model-local forward axis along +Z (0, 0, +1).
 * Given a horizontal movement/velocity vector (vx, vz) in Three.js world space:
 * - Moving Right (+X, vx > 0, vz = 0) -> yaw = +PI / 2 (+90 deg)
 * - Moving Left (-X, vx < 0, vz = 0) -> yaw = -PI / 2 (-90 deg)
 * - Moving Forward (+Z, vx = 0, vz > 0) -> yaw = 0
 * - Moving Backward (-Z, vx = 0, vz < 0) -> yaw = PI
 * - Moving Diagonally -> yaw = atan2(vx, vz)
 */
export function computeCharacterHeadingYaw(
  vx: number,
  vz: number,
  fallbackYaw = 0
): number {
  const speedSq = vx * vx + vz * vz;
  if (speedSq < 1e-8) {
    return fallbackYaw;
  }
  return Math.atan2(vx, vz);
}

/**
 * Returns the shortest signed angular difference in [-PI, +PI] between `fromYaw` and `toYaw`.
 * Prevents the +-PI branch-cut wrap bug where naive scalar lerp spins a character 360 degrees.
 */
export function shortestAngleDiff(fromYaw: number, toYaw: number): number {
  const d = toYaw - fromYaw;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

/**
 * Smoothly steps `currentYaw` toward `targetYaw` along the shortest angular arc (equivalent to Y-axis Quaternion Slerp)
 * and normalizes the resulting angle into [-PI, +PI].
 */
export function stepCharacterYawShortestArc(
  currentYaw: number,
  targetYaw: number,
  dt: number,
  turnSpeed = 10
): number {
  const diff = shortestAngleDiff(currentYaw, targetYaw);
  const alpha = Math.max(0, Math.min(1, dt * turnSpeed));
  const next = currentYaw + diff * alpha;
  return Math.atan2(Math.sin(next), Math.cos(next));
}

/**
 * Returns the unit world-space forward direction vector (x, z) for a character with rotation.y = yaw
 * whose model-local forward axis is +Z.
 */
export function computeCharacterForwardVector(yaw: number): { x: number; z: number } {
  return {
    x: Math.sin(yaw),
    z: Math.cos(yaw),
  };
}

/**
 * Pure kinematic evaluator for customer animation clips (unit-testable without WebGL).
 */
export function evaluateCustomerPose(
  clip: CustomerAnimClip,
  time: number,
  clipElapsed: number,
  walkPhase: number,
  seedOffset = 0
): PoseSample {
  const t = time + seedOffset * 1.7;

  switch (clip) {
    case 'walk': {
      const swing = Math.sin(walkPhase) * 0.54;
      const bounce = Math.abs(Math.cos(walkPhase)) * 0.034;
      const leftKneeBend = Math.max(0, -Math.cos(walkPhase)) * 0.55;
      const rightKneeBend = Math.max(0, Math.cos(walkPhase)) * 0.55;
      return {
        torsoPosY: 0.72 + bounce,
        torsoRotX: 0.06,
        torsoRotY: Math.sin(walkPhase) * 0.09,
        torsoRotZ: Math.cos(walkPhase) * 0.028,
        headPosY: 1.49 + bounce * 0.9,
        headRotX: 0,
        headRotY: -Math.sin(walkPhase) * 0.05,
        headRotZ: 0,
        leftArmRotX: -swing * 0.75,
        leftArmRotZ: 0.05,
        leftForeArmRotX: -0.22 - Math.max(0, swing) * 0.35,
        leftForeArmRotZ: 0,
        rightArmRotX: swing * 0.75,
        rightArmRotZ: -0.05,
        rightForeArmRotX: -0.22 - Math.max(0, -swing) * 0.35,
        leftLegRotX: swing,
        leftKneeRotX: leftKneeBend,
        rightLegRotX: -swing,
        rightKneeRotX: rightKneeBend,
        mouthScaleY: 1.0,
        browTilt: -0.06,
      };
    }

    case 'idle_queue': {
      // Subtle breathing, shifting weight side-to-side, and glancing up at the menu board
      // Seed-based pose personality: some customers fold one arm or rest hand near chin
      const breath = Math.sin(t * 2.2) * 0.012;
      const weightShift = Math.sin(t * 0.9) * 0.035;
      const menuLookCycle = Math.sin(t * 0.65);
      const lookUpAtMenu = menuLookCycle > 0.25 ? -0.18 * (menuLookCycle - 0.25) : 0;
      const variant = Math.abs(Math.round(seedOffset)) % 3;
      const leftArmBase = variant === 1 ? -0.32 : 0;
      const leftForeArmBase = variant === 1 ? -0.68 : -0.18;

      return {
        torsoPosY: 0.72 + breath,
        torsoRotX: breath * 0.5,
        torsoRotY: Math.sin(t * 0.5) * 0.06,
        torsoRotZ: weightShift,
        headPosY: 1.49 + breath,
        headRotX: lookUpAtMenu,
        headRotY: Math.sin(t * 0.8) * 0.18,
        headRotZ: -weightShift * 0.6,
        leftArmRotX: leftArmBase + Math.sin(t * 1.5) * 0.06,
        leftArmRotZ: 0.06,
        leftForeArmRotX: leftForeArmBase,
        leftForeArmRotZ: variant === 1 ? -0.22 : 0,
        rightArmRotX: -Math.sin(t * 1.5) * 0.06,
        rightArmRotZ: -0.06,
        rightForeArmRotX: -0.18,
        leftLegRotX: weightShift * 0.4,
        leftKneeRotX: 0.04,
        rightLegRotX: -weightShift * 0.4,
        rightKneeRotX: 0.04,
        mouthScaleY: 1.0,
        browTilt: -0.06,
      };
    }

    case 'ordering': {
      // Expressive order-placing animation: leaning slightly toward cashier, raising right hand to point/wave, head nodding, mouth talking
      const gestureWave = Math.sin(clipElapsed * 6.5);
      const nod = Math.sin(clipElapsed * 5.2) * 0.11;
      const talkOpen = 1.0 + Math.abs(Math.sin(clipElapsed * 11.0)) * 0.85;

      return {
        torsoPosY: 0.72 + Math.abs(Math.sin(clipElapsed * 3.5)) * 0.015,
        torsoRotX: 0.09,
        torsoRotY: -0.12 + Math.sin(clipElapsed * 2.5) * 0.08,
        torsoRotZ: 0.02,
        headPosY: 1.49,
        headRotX: nod - 0.04,
        headRotY: Math.sin(clipElapsed * 3.0) * 0.12,
        headRotZ: Math.sin(clipElapsed * 2.5) * 0.05,
        leftArmRotX: -0.25 + Math.sin(clipElapsed * 4.0) * 0.08,
        leftArmRotZ: 0.08,
        leftForeArmRotX: -0.35,
        leftForeArmRotZ: 0,
        // Right arm raised forward (~75 deg) gesturing the order
        rightArmRotX: -1.28 + gestureWave * 0.22,
        rightArmRotZ: -0.18 + Math.cos(clipElapsed * 6.5) * 0.12,
        rightForeArmRotX: -0.45 + gestureWave * 0.18,
        leftLegRotX: 0,
        leftKneeRotX: 0,
        rightLegRotX: 0,
        rightKneeRotX: 0,
        mouthScaleY: talkOpen,
        browTilt: -0.1,
      };
    }

    case 'idle_waiting_food': {
      // Anticipatory idle at pickup counter: glancing toward kitchen, light rhythmic bounce
      const breath = Math.sin(t * 2.6) * 0.014;
      const kitchenPeek = Math.sin(t * 1.1) * 0.24;
      const tapCycle = Math.sin(t * 4.2);
      const variant = Math.abs(Math.round(seedOffset)) % 2;

      return {
        torsoPosY: 0.72 + breath,
        torsoRotX: 0.03,
        torsoRotY: kitchenPeek * 0.35,
        torsoRotZ: Math.sin(t * 1.3) * 0.03,
        headPosY: 1.49 + breath,
        headRotX: -0.05 + Math.sin(t * 1.8) * 0.04,
        headRotY: kitchenPeek,
        headRotZ: Math.sin(t * 1.1) * 0.04,
        leftArmRotX: -0.38 + tapCycle * 0.04,
        leftArmRotZ: 0.14,
        leftForeArmRotX: -0.65,
        leftForeArmRotZ: -0.25,
        rightArmRotX: (variant === 1 ? -0.32 : -0.18) - tapCycle * 0.03,
        rightArmRotZ: -0.08,
        rightForeArmRotX: variant === 1 ? -0.58 : -0.35,
        leftLegRotX: Math.max(0, tapCycle) * 0.08,
        leftKneeRotX: Math.max(0, tapCycle) * 0.12,
        rightLegRotX: 0,
        rightKneeRotX: 0,
        mouthScaleY: 1.0,
        browTilt: -0.05,
      };
    }

    case 'impatient_watch': {
      // Customer is running low on patience: raises left wrist to check watch, looks down at watch, taps foot rapidly, furrowed eyebrows
      const checkCycle = Math.sin(t * 2.4);
      const lookingAtWatch = checkCycle > -0.2;
      const footTap = Math.abs(Math.sin(t * 9.5)) * 0.14;
      const headShake = Math.sin(t * 6.5) * 0.12;

      return {
        torsoPosY: 0.72 + Math.sin(t * 4.5) * 0.015,
        torsoRotX: lookingAtWatch ? 0.08 : 0.02,
        torsoRotY: lookingAtWatch ? 0.14 : -0.12,
        torsoRotZ: Math.sin(t * 3.2) * 0.05,
        headPosY: 1.49,
        headRotX: lookingAtWatch ? 0.36 : -0.04, // Tilts head down toward left wrist watch
        headRotY: lookingAtWatch ? 0.28 : headShake,
        headRotZ: lookingAtWatch ? -0.1 : 0,
        // Left arm lifts up and folds forearm across chest so wristwatch is in front of gaze
        leftArmRotX: lookingAtWatch ? -0.95 : -0.45,
        leftArmRotZ: lookingAtWatch ? -0.22 : 0.12,
        leftForeArmRotX: lookingAtWatch ? -1.15 : -0.5,
        leftForeArmRotZ: lookingAtWatch ? -0.65 : -0.2,
        rightArmRotX: -0.32 + Math.sin(t * 5.0) * 0.08,
        rightArmRotZ: -0.18,
        rightForeArmRotX: -0.75,
        leftLegRotX: -footTap,
        leftKneeRotX: footTap * 1.4,
        rightLegRotX: 0,
        rightKneeRotX: 0,
        mouthScaleY: 0.65, // Purse lips
        browTilt: 0.22, // Furrowed angry/impatient brows
      };
    }

    case 'receiving_happy': {
      // Joyful celebration upon receiving burger: both arms raised cheering, happy hop
      const hop = Math.abs(Math.sin(clipElapsed * 9.0)) * 0.055;
      const wave = Math.sin(clipElapsed * 13.0) * 0.24;

      return {
        torsoPosY: 0.72 + hop,
        torsoRotX: -0.06,
        torsoRotY: Math.sin(clipElapsed * 6.0) * 0.14,
        torsoRotZ: 0,
        headPosY: 1.49 + hop,
        headRotX: -0.08 + Math.sin(clipElapsed * 10.0) * 0.08,
        headRotY: Math.sin(clipElapsed * 6.0) * 0.15,
        headRotZ: 0,
        leftArmRotX: -2.4 + wave,
        leftArmRotZ: 0.22,
        leftForeArmRotX: -0.35,
        leftForeArmRotZ: 0,
        rightArmRotX: -2.4 - wave,
        rightArmRotZ: -0.22,
        rightForeArmRotX: -0.35,
        leftLegRotX: -hop * 1.8,
        leftKneeRotX: hop * 2.2,
        rightLegRotX: hop * 1.8,
        rightKneeRotX: hop * 2.2,
        mouthScaleY: 1.65,
        browTilt: -0.16,
      };
    }

    case 'leaving_angry': {
      // Brisk frustrated stride when patience hits 0: leaning forward, pumping arms, shaking head
      const swing = Math.sin(walkPhase * 1.35) * 0.68;
      const stomp = Math.abs(Math.cos(walkPhase * 1.35)) * 0.048;
      return {
        torsoPosY: 0.72 + stomp,
        torsoRotX: 0.14,
        torsoRotY: Math.sin(walkPhase * 1.35) * 0.14,
        torsoRotZ: Math.cos(walkPhase * 1.35) * 0.05,
        headPosY: 1.48 + stomp,
        headRotX: 0.12,
        headRotY: Math.sin(t * 7.5) * 0.22,
        headRotZ: 0,
        leftArmRotX: -swing * 0.9,
        leftArmRotZ: 0.14,
        leftForeArmRotX: -0.55,
        leftForeArmRotZ: 0,
        rightArmRotX: swing * 0.9,
        rightArmRotZ: -0.14,
        rightForeArmRotX: -0.55,
        leftLegRotX: swing,
        leftKneeRotX: Math.max(0, -Math.cos(walkPhase * 1.35)) * 0.65,
        rightLegRotX: -swing,
        rightKneeRotX: Math.max(0, Math.cos(walkPhase * 1.35)) * 0.65,
        mouthScaleY: 0.55,
        browTilt: 0.28,
      };
    }

    case 'sit_down': {
      const u = Math.max(0, Math.min(1, clipElapsed / 0.8));
      const s = u * u * (3 - 2 * u);
      const torsoY = 0.72 - s * 0.275;
      return {
        torsoPosY: torsoY,
        torsoRotX: Math.sin(u * Math.PI) * 0.18 + s * 0.04,
        torsoRotY: 0,
        torsoRotZ: 0,
        headPosY: torsoY + 0.77,
        headRotX: s * 0.06,
        headRotY: 0,
        headRotZ: 0,
        leftArmRotX: -s * 0.9,
        leftArmRotZ: 0.12,
        leftForeArmRotX: -s * 0.52,
        leftForeArmRotZ: -0.22 * s,
        rightArmRotX: -s * 0.9,
        rightArmRotZ: -0.12,
        rightForeArmRotX: -s * 0.52,
        leftLegRotX: -s * 1.35,
        leftKneeRotX: s * 1.35,
        rightLegRotX: -s * 1.35,
        rightKneeRotX: s * 1.35,
        mouthScaleY: 1.0,
        browTilt: -0.06,
      };
    }

    case 'seated_eat': {
      const rawWave = Math.sin(t * Math.PI - Math.PI * 0.42);
      const bite = Math.max(0, Math.min(1, (rawWave + 0.25) / 1.25));
      const chew = bite > 0.55 ? Math.sin(t * 10.5) * 0.065 : Math.sin(t * 4.5) * 0.02;
      const torsoY = 0.445 + Math.sin(t * 2.0) * 0.004;
      return {
        torsoPosY: torsoY,
        torsoRotX: 0.05 + bite * 0.07,
        torsoRotY: Math.sin(t * 1.1) * 0.025,
        torsoRotZ: 0,
        headPosY: torsoY + 0.77,
        headRotX: 0.07 + bite * 0.14 + chew,
        headRotY: Math.sin(t * 0.9) * 0.04,
        headRotZ: 0,
        leftArmRotX: -0.9 - bite * 0.42,
        leftArmRotZ: 0.12,
        leftForeArmRotX: -0.5 - bite * 0.38,
        leftForeArmRotZ: -0.3 - bite * 0.16,
        rightArmRotX: -0.92 - bite * 0.44,
        rightArmRotZ: -0.12,
        rightForeArmRotX: -0.52 - bite * 0.4,
        leftLegRotX: -1.35,
        leftKneeRotX: 1.35,
        rightLegRotX: -1.35,
        rightKneeRotX: 1.35,
        mouthScaleY: 1.0 + Math.abs(Math.sin(t * 10.5)) * 0.7,
        browTilt: -0.1,
      };
    }

    case 'seated_drink': {
      const rawSip = Math.sin(t * Math.PI - Math.PI * 0.42);
      const sip = Math.max(0, Math.min(1, (rawSip + 0.25) / 1.25));
      const torsoY = 0.445 + Math.sin(t * 1.8) * 0.003;
      return {
        torsoPosY: torsoY,
        torsoRotX: 0.03 - sip * 0.03,
        torsoRotY: 0,
        torsoRotZ: 0,
        headPosY: torsoY + 0.77,
        headRotX: 0.04 + sip * 0.05,
        headRotY: -0.03,
        headRotZ: 0,
        leftArmRotX: -0.88,
        leftArmRotZ: 0.1,
        leftForeArmRotX: -0.48,
        leftForeArmRotZ: -0.22,
        rightArmRotX: -0.9 - sip * 0.44,
        rightArmRotZ: -0.12,
        rightForeArmRotX: -0.54 - sip * 0.42,
        leftLegRotX: -1.35,
        leftKneeRotX: 1.35,
        rightLegRotX: -1.35,
        rightKneeRotX: 1.35,
        mouthScaleY: 0.85,
        browTilt: -0.08,
      };
    }

    case 'seated_phone': {
      const scroll = Math.sin(t * 4.5) * 0.05;
      const torsoY = 0.445 + Math.sin(t * 1.8) * 0.003;
      return {
        torsoPosY: torsoY,
        torsoRotX: 0.05,
        torsoRotY: 0,
        torsoRotZ: 0,
        headPosY: torsoY + 0.77,
        headRotX: 0.24 + scroll * 0.3,
        headRotY: -0.06,
        headRotZ: 0.03,
        leftArmRotX: -0.88,
        leftArmRotZ: 0.1,
        leftForeArmRotX: -0.48,
        leftForeArmRotZ: -0.22,
        rightArmRotX: -1.02 + scroll,
        rightArmRotZ: -0.14,
        rightForeArmRotX: -0.72 - scroll,
        leftLegRotX: -1.35,
        leftKneeRotX: 1.35,
        rightLegRotX: -1.35,
        rightKneeRotX: 1.35,
        mouthScaleY: 1.0,
        browTilt: -0.05,
      };
    }

    case 'seated_idle_look': {
      const torsoY = 0.445 + Math.sin(t * 1.8) * 0.004;
      const nod = Math.sin(t * 3.6) * 0.075;
      const gesture = Math.sin(t * 2.2) * 0.12;
      return {
        torsoPosY: torsoY,
        torsoRotX: 0.03 + Math.abs(gesture) * 0.03,
        torsoRotY: Math.sin(t * 1.1) * 0.06,
        torsoRotZ: 0,
        headPosY: torsoY + 0.77,
        headRotX: nod - 0.02,
        headRotY: Math.sin(t * 1.2) * 0.18,
        headRotZ: Math.sin(t * 1.2) * 0.04,
        leftArmRotX: -0.9 + gesture * 0.4,
        leftArmRotZ: 0.1,
        leftForeArmRotX: -0.5 - Math.max(0, gesture) * 0.25,
        leftForeArmRotZ: -0.22,
        rightArmRotX: -0.92 - gesture * 0.5,
        rightArmRotZ: -0.1,
        rightForeArmRotX: -0.54 - Math.max(0, -gesture) * 0.28,
        leftLegRotX: -1.35,
        leftKneeRotX: 1.35,
        rightLegRotX: -1.35,
        rightKneeRotX: 1.35,
        mouthScaleY: 1.15 + Math.abs(Math.sin(t * 6.0)) * 0.35,
        browTilt: -0.12,
      };
    }

    case 'stand_up': {
      const u = Math.max(0, Math.min(1, clipElapsed / 0.8));
      const s = 1 - u * u * (3 - 2 * u);
      const torsoY = 0.72 - s * 0.275;
      return {
        torsoPosY: torsoY,
        torsoRotX: Math.sin(u * Math.PI) * 0.2 + s * 0.04,
        torsoRotY: 0,
        torsoRotZ: 0,
        headPosY: torsoY + 0.77,
        headRotX: s * 0.06,
        headRotY: 0,
        headRotZ: 0,
        leftArmRotX: -s * 0.9,
        leftArmRotZ: 0.12,
        leftForeArmRotX: -s * 0.52,
        leftForeArmRotZ: -0.22 * s,
        rightArmRotX: -s * 0.9,
        rightArmRotZ: -0.12,
        rightForeArmRotX: -s * 0.52,
        leftLegRotX: -s * 1.35,
        leftKneeRotX: s * 1.35,
        rightLegRotX: -s * 1.35,
        rightKneeRotX: s * 1.35,
        mouthScaleY: 1.15,
        browTilt: -0.08,
      };
    }
  }
}

/**
 * Builds genuine Three.js AnimationClips for a customer's hierarchical rig so
 * THREE.AnimationMixer can cross-fade full skeletal rotations & translations.
 */
let _cachedClips: Map<CustomerAnimClip, THREE.AnimationClip> | null = null;

export function getSharedCustomerAnimationClips(): Map<CustomerAnimClip, THREE.AnimationClip> {
  if (_cachedClips) return _cachedClips;
  _cachedClips = new Map();

  const clipNames: CustomerAnimClip[] = [
    'walk',
    'idle_queue',
    'ordering',
    'idle_waiting_food',
    'impatient_watch',
    'receiving_happy',
    'leaving_angry',
    'sit_down',
    'seated_eat',
    'seated_drink',
    'seated_phone',
    'seated_idle_look',
    'stand_up',
  ];

  const duration = 2.0;
  const sampleCount = 16;
  const times: number[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    times.push((i / sampleCount) * duration);
  }

  const euler = new THREE.Euler();
  const quat = new THREE.Quaternion();
  const pushQuat = (arr: number[], rx: number, ry: number, rz: number) => {
    euler.set(rx, ry, rz);
    quat.setFromEuler(euler);
    arr.push(quat.x, quat.y, quat.z, quat.w);
  };

  for (const name of clipNames) {
    const torsoPosValues: number[] = [];
    const torsoQuatValues: number[] = [];
    const headPosValues: number[] = [];
    const headQuatValues: number[] = [];
    const leftArmQuatValues: number[] = [];
    const rightArmQuatValues: number[] = [];
    const leftLegQuatValues: number[] = [];
    const rightLegQuatValues: number[] = [];

    for (const t of times) {
      const wPhase = (t / duration) * Math.PI * 4;
      const sample = evaluateCustomerPose(name, t, t, wPhase, 0);
      torsoPosValues.push(0, sample.torsoPosY, 0);
      pushQuat(torsoQuatValues, sample.torsoRotX, sample.torsoRotY, sample.torsoRotZ);
      headPosValues.push(0, sample.headPosY, 0);
      pushQuat(headQuatValues, sample.headRotX, sample.headRotY, sample.headRotZ);
      pushQuat(leftArmQuatValues, sample.leftArmRotX, 0, sample.leftArmRotZ);
      pushQuat(rightArmQuatValues, sample.rightArmRotX, 0, sample.rightArmRotZ);
      pushQuat(leftLegQuatValues, sample.leftLegRotX, 0, 0);
      pushQuat(rightLegQuatValues, sample.rightLegRotX, 0, 0);
    }

    const tracks: THREE.KeyframeTrack[] = [
      new THREE.VectorKeyframeTrack('Torso.position', times, torsoPosValues),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', times, torsoQuatValues),
      new THREE.VectorKeyframeTrack('Head.position', times, headPosValues),
      new THREE.QuaternionKeyframeTrack('Head.quaternion', times, headQuatValues),
      new THREE.QuaternionKeyframeTrack('LeftArm.quaternion', times, leftArmQuatValues),
      new THREE.QuaternionKeyframeTrack('RightArm.quaternion', times, rightArmQuatValues),
      new THREE.QuaternionKeyframeTrack('LeftLeg.quaternion', times, leftLegQuatValues),
      new THREE.QuaternionKeyframeTrack('RightLeg.quaternion', times, rightLegQuatValues),
    ];

    const clip = new THREE.AnimationClip(name, duration, tracks);
    clip.optimize();
    _cachedClips.set(name, clip);
  }

  return _cachedClips;
}

export class CustomerAnimator {
  currentClip: CustomerAnimClip = 'idle_queue';
  clipElapsed = 0;
  walkPhase = 0;
  mixer: THREE.AnimationMixer | null = null;
  usingGlbSkeleton = false;
  private actions: Map<CustomerAnimClip, THREE.AnimationAction> = new Map();
  private headBone: THREE.Object3D | null = null;
  private seedOffset: number;
  private currentWalkSpeedRatio = 1.0;

  constructor(
    seedOffset = 0,
    rootObject?: THREE.Object3D,
    glbAnimations?: THREE.AnimationClip[]
  ) {
    this.seedOffset = seedOffset;
    if (rootObject) {
      if (glbAnimations && glbAnimations.length > 0) {
        this.bindGlbRig(rootObject, glbAnimations);
      } else {
        this.mixer = new THREE.AnimationMixer(rootObject);
        const clips = getSharedCustomerAnimationClips();
        for (const [name, clip] of clips.entries()) {
          const action = this.mixer.clipAction(clip);
          this.actions.set(name, action);
        }
        const initial = this.actions.get('idle_queue');
        initial?.play();
      }
    }
  }

  /**
   * Binds THREE.AnimationMixer directly to a cloned SkinnedMesh hierarchy and its
   * embedded glTF 2.0 skeletal AnimationClips.
   */
  bindGlbRig(rootObject: THREE.Object3D, glbAnimations: THREE.AnimationClip[]): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
    this.actions.clear();
    this.mixer = new THREE.AnimationMixer(rootObject);
    this.usingGlbSkeleton = true;
    this.headBone = rootObject.getObjectByName('Head') || null;

    for (const clip of glbAnimations) {
      const name = clip.name as CustomerAnimClip;
      const action = this.mixer.clipAction(clip);
      if (name === 'sit_down' || name === 'stand_up') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      } else {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
      }
      action.enabled = true;
      this.actions.set(name, action);
    }

    const active =
      this.actions.get(this.currentClip) || this.actions.get('idle_queue');
    if (active) {
      active.reset().play();
      // Desynchronize idle phase slightly per customer seed so multiple customers never move in robotic unison
      if (
        this.currentClip === 'idle_queue' ||
        this.currentClip === 'idle_waiting_food' ||
        this.currentClip === 'seated_eat'
      ) {
        this.mixer.update((Math.abs(this.seedOffset) * 0.43) % 1.8);
      }
    }
  }

  playClip(clip: CustomerAnimClip): void {
    if (this.currentClip !== clip) {
      const prevClip = this.currentClip;
      const prevAction = this.actions.get(prevClip);
      const nextAction = this.actions.get(clip);

      for (const [k, act] of this.actions.entries()) {
        if (k !== clip && k !== prevClip) {
          act.stop();
        }
      }

      if (prevAction) {
        if (prevAction.isRunning()) {
          prevAction.fadeOut(0.22);
        } else {
          prevAction.stop();
        }
      }

      if (nextAction) {
        nextAction.reset();
        nextAction.enabled = true;
        // sit_down and stand_up play over ~0.83s (2.4x timescale on 2.0s clip) and hold final frame
        nextAction.setEffectiveTimeScale(
          clip === 'sit_down' || clip === 'stand_up' ? 2.4 : 1.0
        );
        nextAction.setEffectiveWeight(1.0);
        nextAction.fadeIn(0.22);
        nextAction.play();
      }

      this.currentClip = clip;
      this.clipElapsed = 0;
    }
  }

  advanceWalk(stepDistance: number, dt = 0.016, nominalStrideSpeed = 1.75): void {
    this.walkPhase += stepDistance * 3.6;
    if (dt > 0.0001) {
      const actualSpeed = stepDistance / dt;
      // Match walk animation playback speed to world translation speed to eliminate foot sliding
      this.currentWalkSpeedRatio = THREE.MathUtils.clamp(
        actualSpeed / Math.max(0.4, nominalStrideSpeed),
        0.35,
        1.55
      );
      const walkAction = this.actions.get(this.currentClip);
      if (
        walkAction &&
        (this.currentClip === 'walk' || this.currentClip === 'leaving_angry')
      ) {
        walkAction.setEffectiveTimeScale(this.currentWalkSpeedRatio);
      }
    }
  }

  update(
    dt: number,
    totalElapsed: number,
    rig: CustomerRigTargets,
    refusalShakeTimer = 0
  ): void {
    this.clipElapsed += dt;
    if (this.mixer) {
      this.mixer.update(dt);
    }

    // When bound to the true glTF SkinnedMesh skeleton, the AnimationMixer drives all 15 humanoid joints directly!
    if (this.usingGlbSkeleton) {
      if (refusalShakeTimer > 0 && this.headBone) {
        this.headBone.rotation.y += Math.sin(totalElapsed * 22.0) * 0.32;
      }
      return;
    }

    const pose = evaluateCustomerPose(
      this.currentClip,
      totalElapsed,
      this.clipElapsed,
      this.walkPhase,
      this.seedOffset
    );

    const damp = Math.min(1, dt * 12);

    rig.torsoGroup.position.y = THREE.MathUtils.lerp(
      rig.torsoGroup.position.y,
      pose.torsoPosY,
      damp
    );
    rig.torsoGroup.rotation.x = THREE.MathUtils.lerp(
      rig.torsoGroup.rotation.x,
      pose.torsoRotX,
      damp
    );
    rig.torsoGroup.rotation.y = THREE.MathUtils.lerp(
      rig.torsoGroup.rotation.y,
      pose.torsoRotY,
      damp
    );
    rig.torsoGroup.rotation.z = THREE.MathUtils.lerp(
      rig.torsoGroup.rotation.z,
      pose.torsoRotZ,
      damp
    );

    rig.headGroup.position.y = THREE.MathUtils.lerp(
      rig.headGroup.position.y,
      pose.headPosY,
      damp
    );
    rig.headGroup.rotation.x = THREE.MathUtils.lerp(
      rig.headGroup.rotation.x,
      pose.headRotX,
      damp
    );
    const refusalYaw =
      refusalShakeTimer > 0 ? Math.sin(totalElapsed * 22.0) * 0.34 : pose.headRotY;
    rig.headGroup.rotation.y = THREE.MathUtils.lerp(
      rig.headGroup.rotation.y,
      refusalYaw,
      damp
    );
    rig.headGroup.rotation.z = THREE.MathUtils.lerp(
      rig.headGroup.rotation.z,
      pose.headRotZ,
      damp
    );

    rig.leftArmGroup.rotation.x = THREE.MathUtils.lerp(
      rig.leftArmGroup.rotation.x,
      pose.leftArmRotX,
      damp
    );
    rig.leftArmGroup.rotation.z = THREE.MathUtils.lerp(
      rig.leftArmGroup.rotation.z,
      pose.leftArmRotZ,
      damp
    );
    if (rig.leftForeArmGroup) {
      rig.leftForeArmGroup.rotation.x = THREE.MathUtils.lerp(
        rig.leftForeArmGroup.rotation.x,
        pose.leftForeArmRotX,
        damp
      );
      rig.leftForeArmGroup.rotation.z = THREE.MathUtils.lerp(
        rig.leftForeArmGroup.rotation.z,
        pose.leftForeArmRotZ,
        damp
      );
    }

    rig.rightArmGroup.rotation.x = THREE.MathUtils.lerp(
      rig.rightArmGroup.rotation.x,
      pose.rightArmRotX,
      damp
    );
    rig.rightArmGroup.rotation.z = THREE.MathUtils.lerp(
      rig.rightArmGroup.rotation.z,
      pose.rightArmRotZ,
      damp
    );
    if (rig.rightForeArmGroup) {
      rig.rightForeArmGroup.rotation.x = THREE.MathUtils.lerp(
        rig.rightForeArmGroup.rotation.x,
        pose.rightForeArmRotX,
        damp
      );
    }

    rig.leftLegGroup.rotation.x = THREE.MathUtils.lerp(
      rig.leftLegGroup.rotation.x,
      pose.leftLegRotX,
      damp
    );
    if (rig.leftKneeGroup) {
      rig.leftKneeGroup.rotation.x = THREE.MathUtils.lerp(
        rig.leftKneeGroup.rotation.x,
        pose.leftKneeRotX,
        damp
      );
    }

    rig.rightLegGroup.rotation.x = THREE.MathUtils.lerp(
      rig.rightLegGroup.rotation.x,
      pose.rightLegRotX,
      damp
    );
    if (rig.rightKneeGroup) {
      rig.rightKneeGroup.rotation.x = THREE.MathUtils.lerp(
        rig.rightKneeGroup.rotation.x,
        pose.rightKneeRotX,
        damp
      );
    }

    if (rig.mouthMesh) {
      rig.mouthMesh.scale.y = THREE.MathUtils.lerp(
        rig.mouthMesh.scale.y,
        pose.mouthScaleY,
        damp
      );
    }
    if (rig.leftBrowMesh && rig.rightBrowMesh) {
      rig.leftBrowMesh.rotation.z = THREE.MathUtils.lerp(
        rig.leftBrowMesh.rotation.z,
        -pose.browTilt,
        damp
      );
      rig.rightBrowMesh.rotation.z = THREE.MathUtils.lerp(
        rig.rightBrowMesh.rotation.z,
        pose.browTilt,
        damp
      );
    }
  }
}

export type HandActionType =
  | 'pickup'
  | 'place'
  | 'toss'
  | 'deliver'
  | 'tap_pos'
  | 'refuse_recoil'
  | 'wipe';

export interface HandTransformSample {
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scalePunch: number;
}

/**
 * First-person physical hand & held-object animation controller.
 * Provides tactile reach-forward, scoop-up, place-down, delivery presentation, recoil, and cloth-wiping curves.
 */
export class FirstPersonHandAnimator {
  private basePos = { x: 0.32, y: -0.26, z: -0.58 };
  private activeAction: HandActionType | null = null;
  private actionTimer = 0;
  private actionDuration = 0.28;

  // Rotational inertia from mouse look
  private swayX = 0;
  private swayY = 0;

  triggerAction(type: HandActionType): void {
    this.activeAction = type;
    this.actionTimer = 0;
    switch (type) {
      case 'pickup':
        this.actionDuration = 0.28;
        break;
      case 'place':
        this.actionDuration = 0.26;
        break;
      case 'deliver':
        this.actionDuration = 0.38;
        break;
      case 'toss':
        this.actionDuration = 0.24;
        break;
      case 'tap_pos':
        this.actionDuration = 0.22;
        break;
      case 'refuse_recoil':
        this.actionDuration = 0.34;
        break;
      case 'wipe':
        this.actionDuration = 0.52;
        break;
    }
  }

  addLookImpulse(dx: number, dy: number): void {
    this.swayX = THREE.MathUtils.clamp(this.swayX - dx * 0.00045, -0.06, 0.06);
    this.swayY = THREE.MathUtils.clamp(this.swayY + dy * 0.00045, -0.06, 0.06);
  }

  isAnimating(): boolean {
    return this.activeAction !== null;
  }

  getActiveAction(): HandActionType | null {
    return this.activeAction;
  }

  evaluate(dt: number, walkDistance: number, headBobEnabled: boolean): HandTransformSample {
    const damp = Math.min(1, dt * 10);
    this.swayX = THREE.MathUtils.lerp(this.swayX, 0, damp);
    this.swayY = THREE.MathUtils.lerp(this.swayY, 0, damp);

    const bobY = headBobEnabled ? Math.sin(walkDistance * 3.8) * 0.016 : 0;
    const bobX = headBobEnabled ? Math.cos(walkDistance * 1.9) * 0.012 : 0;

    let offsetX = bobX + this.swayX;
    let offsetY = bobY + this.swayY;
    let offsetZ = 0;
    let rotX = 0;
    let rotY = -0.35 + this.swayX * 1.8;
    let rotZ = -this.swayX * 1.5;
    let scalePunch = 1.0;

    if (this.activeAction) {
      this.actionTimer += dt;
      const p = Math.min(1, this.actionTimer / this.actionDuration);
      const arc = Math.sin(p * Math.PI);

      switch (this.activeAction) {
        case 'pickup': {
          const reachPhase = p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55;
          offsetZ -= reachPhase * 0.22;
          offsetY -= Math.sin(p * Math.PI * 2) * 0.065;
          rotX = -arc * 0.38;
          rotZ = arc * 0.16;
          scalePunch = 1 + Math.sin(p * Math.PI) * 0.14;
          break;
        }
        case 'place': {
          offsetZ -= arc * 0.26;
          offsetX -= arc * 0.08;
          offsetY -= arc * 0.09;
          rotX = -arc * 0.48;
          scalePunch = 1 - arc * 0.08;
          break;
        }
        case 'deliver': {
          offsetZ -= arc * 0.34;
          offsetX -= arc * 0.15;
          offsetY += arc * 0.045;
          rotX = -arc * 0.26;
          rotY = -0.35 + arc * 0.35;
          scalePunch = 1 + arc * 0.09;
          break;
        }
        case 'toss': {
          offsetZ -= arc * 0.24;
          offsetY -= arc * 0.14;
          rotX = -arc * 0.65;
          break;
        }
        case 'tap_pos': {
          offsetZ -= arc * 0.18;
          offsetY += arc * 0.05;
          rotX = -arc * 0.3;
          break;
        }
        case 'refuse_recoil': {
          offsetZ += arc * 0.08;
          offsetX += Math.sin(p * Math.PI * 3) * 0.055;
          rotZ += Math.sin(p * Math.PI * 3) * 0.24;
          rotX = arc * 0.18;
          break;
        }
        case 'wipe': {
          // Natural two-stroke circular/horizontal table-wiping sweep with cloth
          const sweep = Math.sin(p * Math.PI * 3.0);
          offsetZ -= arc * 0.25 + Math.cos(p * Math.PI * 2.0) * 0.04;
          offsetX -= arc * 0.11 + sweep * 0.15;
          offsetY -= arc * 0.07;
          rotX = -arc * 0.44;
          rotY = -0.35 + sweep * 0.32;
          rotZ = sweep * 0.22;
          scalePunch = 1 + arc * 0.06;
          break;
        }
      }

      if (p >= 1) {
        this.activeAction = null;
        this.actionTimer = 0;
      }
    }

    return {
      posX: this.basePos.x + offsetX,
      posY: this.basePos.y + offsetY,
      posZ: this.basePos.z + offsetZ,
      rotX,
      rotY,
      rotZ,
      scalePunch,
    };
  }
}

