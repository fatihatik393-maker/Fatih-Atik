import * as THREE from 'three';

export interface ColliderBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  label: string;
}

export interface StationConfig {
  id: string;
  label: string;
  position: THREE.Vector3;
  size: THREE.Vector3;
}

/**
  * Single source of truth for all physical colliders, stations, and waypoints
  * inside BURGER DISTRICT 2.0.
  */
export const RESTAURANT_BOUNDS = {
  minX: -6.6,
  maxX: 6.6,
  minZ: -5.6,
  maxZ: 5.6,
  playerRadius: 0.42,
  eyeHeight: 1.68,
};

export const PLAYER_SPAWN = {
  x: -0.35,
  y: 1.68,
  z: -1.85,
  yaw: Math.PI, // Facing +Z towards POS counter, customer area & storefront windows
  pitch: -0.06,
};

export interface PlacementSurfaceZone {
  id: string;
  label: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
  margin: number;
}

export const PLACEMENT_SURFACES: PlacementSurfaceZone[] = [
  {
    id: 'main_service_counter',
    label: 'Ana Servis Tezgâhı',
    minX: -0.18,
    maxX: 1.05,
    minZ: -0.82,
    maxZ: -0.08,
    y: 0.964,
    margin: 0.06,
  },
  {
    id: 'main_counter_left',
    label: 'Kasa Yanı Tezgâhı',
    minX: -3.95,
    maxX: -3.05,
    minZ: -0.82,
    maxZ: -0.08,
    y: 0.964,
    margin: 0.06,
  },
  {
    id: 'kitchen_prep_left',
    label: 'Mutfak Sol Hazırlık Tezgâhı',
    minX: -1.85,
    maxX: -0.68,
    minZ: -5.45,
    maxZ: -4.72,
    y: 0.946,
    margin: 0.06,
  },
  {
    id: 'kitchen_prep_right',
    label: 'Mutfak Sağ Hazırlık Tezgâhı',
    minX: 0.68,
    maxX: 2.15,
    minZ: -5.45,
    maxZ: -4.72,
    y: 0.946,
    margin: 0.06,
  },
  {
    id: 'dining_table_left',
    label: 'Sol Salon Masası (#1)',
    minX: -5.55,
    maxX: -4.25,
    minZ: 2.42,
    maxZ: 3.38,
    y: 0.798,
    margin: 0.06,
  },
  {
    id: 'dining_table_right',
    label: 'Sağ Salon Masası (#2)',
    minX: 4.25,
    maxX: 5.55,
    minZ: 2.42,
    maxZ: 3.38,
    y: 0.798,
    margin: 0.06,
  },
];

export const STATIONS = {
  posTerminal: {
    id: 'pos_terminal',
    label: 'Dijital Kasa & Yönetim Terminali',
    position: new THREE.Vector3(-1.55, 1.08, -0.45),
  },
  trayStack: {
    id: 'tray_stack',
    label: 'Servis Tepsisi İstasyonu',
    position: new THREE.Vector3(-0.68, 0.964, -0.45),
  },
  handbookShelf: {
    id: 'handbook_shelf',
    label: 'Burger District İşletme El Kitabı',
    position: new THREE.Vector3(-2.55, 0.964, -0.45),
  },
  orderCounterSpot: {
    id: 'order_spot',
    label: 'Sipariş Noktası',
    position: new THREE.Vector3(-1.55, 1.0, -0.45),
  },
  pickupTray: {
    id: 'pickup_tray',
    label: 'Sipariş Teslim Tezgâhı',
    position: new THREE.Vector3(1.55, 0.96, -0.45),
  },
  grill: {
    id: 'grill_station',
    label: 'Endüstriyel Izgara',
    position: new THREE.Vector3(-2.6, 0.94, -5.15),
    slots: [
      new THREE.Vector3(-3.05, 0.97, -5.05),
      new THREE.Vector3(-2.55, 0.97, -5.05),
      new THREE.Vector3(-3.05, 0.97, -5.35),
      new THREE.Vector3(-2.55, 0.97, -5.35),
    ],
  },
  assemblyBoard: {
    id: 'assembly_board',
    label: 'Burger Hazırlama İstasyonu',
    position: new THREE.Vector3(0.0, 0.95, -5.1),
    stackOrigin: new THREE.Vector3(-0.18, 0.98, -5.08),
    sodaSpot: new THREE.Vector3(0.32, 0.98, -5.08),
  },
  sodaDispenser: {
    id: 'soda_dispenser',
    label: 'Gazlı İçecek Makinesi',
    position: new THREE.Vector3(2.8, 1.15, -5.15),
  },
  trashBin: {
    id: 'trash_bin',
    label: 'Çöp Kutusu',
    position: new THREE.Vector3(4.35, 0.55, -5.15),
  },
  bussingStation: {
    id: 'bussing_station',
    label: 'Tepsi Dönüş & Atık İstasyonu',
    position: new THREE.Vector3(2.52, 0.0, -0.45),
  },
  bins: {
    bun_bottom: {
      id: 'bin_bun_bottom',
      ingredient: 'bun_bottom' as const,
      stockKey: 'bun' as const,
      label: 'Alt Ekmek Kabı',
      position: new THREE.Vector3(-6.2, 0.96, -4.4),
    },
    patty_raw: {
      id: 'bin_patty_raw',
      ingredient: 'patty_raw' as const,
      stockKey: 'patty' as const,
      label: 'Çiğ Köfte Dolabı',
      position: new THREE.Vector3(-6.2, 0.96, -3.55),
    },
    cheese: {
      id: 'bin_cheese',
      ingredient: 'cheese' as const,
      stockKey: 'cheese' as const,
      label: 'Cheddar Peyniri Kabı',
      position: new THREE.Vector3(-6.2, 0.96, -2.7),
    },
    lettuce: {
      id: 'bin_lettuce',
      ingredient: 'lettuce' as const,
      stockKey: 'lettuce' as const,
      label: 'Taze Marul Kabı',
      position: new THREE.Vector3(-6.2, 0.96, -1.85),
    },
    bun_top: {
      id: 'bin_bun_top',
      ingredient: 'bun_top' as const,
      stockKey: 'bun' as const,
      label: 'Üst Ekmek Kabı',
      position: new THREE.Vector3(-6.2, 0.96, -1.0),
    },
  },
};

export const CUSTOMER_WAYPOINTS = {
  outsideSpawnLeft: new THREE.Vector3(-4.5, 0, 8.6),
  outsideSpawnRight: new THREE.Vector3(4.5, 0, 8.6),
  outsideSpawn: new THREE.Vector3(0.0, 0, 8.8),
  doorExterior: new THREE.Vector3(0.0, 0, 6.4),
  doorThreshold: new THREE.Vector3(0.0, 0, 5.05),
  /** 5 distinct, non-overlapping ordering queue positions from POS counter back toward entrance */
  queueSlots: [
    new THREE.Vector3(-1.55, 0, 0.85),  // 1st: Front at POS counter
    new THREE.Vector3(-1.55, 0, 1.95),  // 2nd in line
    new THREE.Vector3(-1.55, 0, 3.05),  // 3rd in line
    new THREE.Vector3(-1.55, 0, 4.15),  // 4th in line
    new THREE.Vector3(-0.65, 0, 4.75),  // 5th in line (curved near entrance mat)
  ],
  /** 5 distinct, non-overlapping waiting positions near the pickup counter */
  waitingForFoodSlots: [
    new THREE.Vector3(1.55, 0, 0.85),   // 1st waiting right at Pickup counter
    new THREE.Vector3(2.65, 0, 1.25),   // 2nd waiting to the right
    new THREE.Vector3(0.55, 0, 1.35),   // 3rd waiting center-right
    new THREE.Vector3(2.25, 0, 2.35),   // 4th waiting back-right
    new THREE.Vector3(1.05, 0, 2.45),   // 5th waiting back-center
  ],
  exitDoorInside: new THREE.Vector3(0.45, 0, 5.2),
  exitTarget: new THREE.Vector3(2.2, 0, 9.2),
};

export const COLLIDER_BOXES: ColliderBox[] = [
  // Front Main Counter (leaves x: 3.1 to 6.6 open as walk passage between kitchen & dining)
  {
    minX: -4.2,
    maxX: 3.0,
    minZ: -0.95,
    maxZ: 0.05,
    label: 'Ana Sipariş ve Teslim Tezgâhı',
  },
  // Back Kitchen Line (Grill, Assembly, Soda Machine)
  {
    minX: -6.8,
    maxX: 4.8,
    minZ: -5.9,
    maxZ: -4.55,
    label: 'Arka Mutfak Tezgâhı',
  },
  // Left Ingredient Prep Counter
  {
    minX: -6.8,
    maxX: -5.55,
    minZ: -4.8,
    maxZ: -0.5,
    label: 'Sol Malzeme Tezgâhı',
  },
  // Right Bread Rack in Kitchen
  {
    minX: 5.55,
    maxX: 6.8,
    minZ: -5.4,
    maxZ: -2.6,
    label: 'Ekmek Rafları',
  },
  // Dining Area Booths / Tables (Left & Right)
  {
    minX: -6.1,
    maxX: -3.7,
    minZ: 1.5,
    maxZ: 4.3,
    label: 'Sol Müşteri Oturma Grubu',
  },
  {
    minX: 3.7,
    maxX: 6.1,
    minZ: 1.5,
    maxZ: 4.3,
    label: 'Sağ Müşteri Oturma Grubu',
  },
];

/**
 * Pure deterministic collision solver for player circle vs room bounds & AABB obstacles.
 * Slides smoothly along walls and counters without getting stuck or tunneling.
 */
export function resolvePlayerMovement(
  currentX: number,
  currentZ: number,
  desiredX: number,
  desiredZ: number,
  radius = RESTAURANT_BOUNDS.playerRadius
): { x: number; z: number; collided: boolean } {
  let x = desiredX;
  let z = desiredZ;
  let collided = false;

  // 1. Clamp to outer interior walls
  const minWallX = RESTAURANT_BOUNDS.minX + radius;
  const maxWallX = RESTAURANT_BOUNDS.maxX - radius;
  const minWallZ = RESTAURANT_BOUNDS.minZ + radius;
  const maxWallZ = RESTAURANT_BOUNDS.maxZ - radius;

  if (x < minWallX) {
    x = minWallX;
    collided = true;
  } else if (x > maxWallX) {
    x = maxWallX;
    collided = true;
  }

  if (z < minWallZ) {
    z = minWallZ;
    collided = true;
  } else if (z > maxWallZ) {
    z = maxWallZ;
    collided = true;
  }

  // 2. Resolve circle vs AABB for each interior obstacle
  for (const box of COLLIDER_BOXES) {
    const closestX = Math.max(box.minX, Math.min(x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));

    const dx = x - closestX;
    const dz = z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      collided = true;
      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const overlap = radius - dist;
        x += (dx / dist) * overlap;
        z += (dz / dist) * overlap;
      } else {
        // Inside box center fallback: push out along shallowest penetration axis
        const leftPen = Math.abs(x - box.minX);
        const rightPen = Math.abs(x - box.maxX);
        const backPen = Math.abs(z - box.minZ);
        const frontPen = Math.abs(z - box.maxZ);
        const minPen = Math.min(leftPen, rightPen, backPen, frontPen);

        if (minPen === leftPen) x = box.minX - radius;
        else if (minPen === rightPen) x = box.maxX + radius;
        else if (minPen === backPen) z = box.minZ - radius;
        else z = box.maxZ + radius;
      }
    }
  }

  return { x, z, collided };
}
