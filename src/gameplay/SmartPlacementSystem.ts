import {
  formatServiceTrayLabel,
  HeldItem,
  RECIPES,
  RecipeId,
  resolveHeldItemRecipe,
} from '../core/GameConfig';
import { PLACEMENT_SURFACES, PlacementSurfaceZone } from '../world/RestaurantLayout';

export interface PlacedSurfaceItem {
  id: string;
  surfaceId: string;
  surfaceLabel: string;
  item: HeldItem;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  radius: number;
}

export interface PlacementEvaluation {
  valid: boolean;
  surfaceId: string;
  surfaceLabel: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  reason?: string;
  /** If hovering near a placed Service Tray with a compatible burger, fries box, or soda cup */
  combineTargetTrayId?: string;
}

export function getPlacementRadius(item: HeldItem): number {
  if (item.type === 'supply_crate') {
    return 0.24;
  }
  if (
    item.type === 'service_tray' ||
    item.type === 'order_tray' ||
    item.type === 'dirty_tray'
  ) {
    return 0.23;
  }
  if (
    item.type === 'burger_classic' ||
    item.type === 'burger_cheese' ||
    item.type === 'burger_double_smash'
  ) {
    return 0.16;
  }
  if (item.type === 'fries_box') {
    return 0.13;
  }
  if (item.type === 'soda_cup') {
    return 0.11;
  }
  return 0.14;
}

export function isTrayItem(item: HeldItem | null | undefined): boolean {
  if (!item) return false;
  return item.type === 'service_tray' || item.type === 'order_tray';
}

export function isCompletedBurgerItem(item: HeldItem | null | undefined): boolean {
  if (!item) return false;
  return (
    item.type === 'burger_classic' ||
    item.type === 'burger_cheese' ||
    item.type === 'burger_double_smash'
  );
}

/**
 * Pure function that combines a completed burger, a crispy fries box, or a soda cup onto a Service Tray.
 * Guarantees single-owner item integrity: never overwrites an existing burger, existing fries, or existing soda.
 */
export function combineItemIntoTray(
  tray: HeldItem,
  incoming: HeldItem
): { success: boolean; updatedTray: HeldItem; reason: string } {
  if (!isTrayItem(tray)) {
    return {
      success: false,
      updatedTray: tray,
      reason: 'Hedef nesne bir servis tepsisi değil!',
    };
  }

  const rawExistingRecipe = resolveHeldItemRecipe(tray);
  const existingBurgerRecipe: RecipeId | null =
    rawExistingRecipe && rawExistingRecipe !== 'crispy_fries_solo' ? rawExistingRecipe : null;
  const existingHasFries = Boolean(tray.hasFries) || rawExistingRecipe === 'crispy_fries_solo';
  const existingHasSoda = Boolean(tray.hasSoda);

  if (incoming.type === 'soda_cup') {
    if (existingHasSoda) {
      return {
        success: false,
        updatedTray: tray,
        reason: 'Bu servis tepsisinde zaten Gazlı İçecek var!',
      };
    }
    const nextLabel = formatServiceTrayLabel(existingBurgerRecipe, true, existingHasFries);
    return {
      success: true,
      updatedTray: {
        ...tray,
        type: 'service_tray',
        hasSoda: true,
        hasFries: existingHasFries,
        burgerRecipe: existingBurgerRecipe ?? (existingHasFries ? 'crispy_fries_solo' : undefined),
        label: nextLabel,
      },
      reason:
        existingBurgerRecipe || existingHasFries
          ? `Gazlı İçecek eklendi! (${nextLabel})`
          : 'Gazlı İçecek servis tepsisine yerleştirildi.',
    };
  }

  if (incoming.type === 'fries_box') {
    if (existingHasFries) {
      return {
        success: false,
        updatedTray: tray,
        reason: 'Bu servis tepsisinde zaten Çıtır Patates Kutusu var!',
      };
    }
    const nextLabel = formatServiceTrayLabel(existingBurgerRecipe, existingHasSoda, true);
    return {
      success: true,
      updatedTray: {
        ...tray,
        type: 'service_tray',
        hasFries: true,
        hasSoda: existingHasSoda,
        burgerRecipe: existingBurgerRecipe ?? 'crispy_fries_solo',
        label: nextLabel,
      },
      reason: `Çıtır Patates Kutusu servis tepsisine eklendi! (${nextLabel})`,
    };
  }

  const incomingRecipe = resolveHeldItemRecipe(incoming);
  if (incomingRecipe && incomingRecipe !== 'crispy_fries_solo' && isCompletedBurgerItem(incoming)) {
    if (existingBurgerRecipe) {
      return {
        success: false,
        updatedTray: tray,
        reason: `Bu servis tepsisinde zaten ${RECIPES[existingBurgerRecipe].name} var!`,
      };
    }
    const layers: typeof tray.layers = incoming.layers
      ? [...incoming.layers]
      : [...RECIPES[incomingRecipe].layers];
    const nextLabel = formatServiceTrayLabel(incomingRecipe, existingHasSoda, existingHasFries);
    return {
      success: true,
      updatedTray: {
        ...tray,
        type: 'service_tray',
        burgerRecipe: incomingRecipe,
        layers,
        hasFries: existingHasFries,
        hasSoda: existingHasSoda,
        label: nextLabel,
      },
      reason:
        existingHasSoda || existingHasFries
          ? `${RECIPES[incomingRecipe].name} eklendi! Sipariş tepsisi teslime hazır!`
          : `${RECIPES[incomingRecipe].name} servis tepsisine yerleştirildi.`,
    };
  }

  return {
    success: false,
    updatedTray: tray,
    reason:
      'Servis tepsisine yalnızca tamamlanmış Burger, Çıtır Patates Kutusu veya Gazlı İçecek konulabilir!',
  };
}

/**
 * Pure function that evaluates whether `heldItem` can be placed at `(worldX, worldZ)` on `surfaceId`
 * or combined onto an existing Service Tray placed on that surface.
 */
export function evaluateSurfacePlacement(
  surfaceId: string,
  worldX: number,
  worldZ: number,
  rotationY: number,
  heldItem: HeldItem,
  placedItems: readonly PlacedSurfaceItem[],
  surfaces: readonly PlacementSurfaceZone[] = PLACEMENT_SURFACES
): PlacementEvaluation {
  const surface = surfaces.find((s) => s.id === surfaceId);
  if (!surface) {
    return {
      valid: false,
      surfaceId,
      surfaceLabel: 'Bilinmeyen Yüzey',
      x: worldX,
      y: 0.95,
      z: worldZ,
      rotationY,
      reason: 'Geçersiz yerleştirme yüzeyi.',
    };
  }

  // 1. Check if cursor is near an existing Service Tray on this surface and heldItem is combinable
  if (
    isCompletedBurgerItem(heldItem) ||
    heldItem.type === 'fries_box' ||
    heldItem.type === 'soda_cup'
  ) {
    for (const placed of placedItems) {
      if (placed.surfaceId === surface.id && isTrayItem(placed.item)) {
        const distToTray = Math.hypot(worldX - placed.x, worldZ - placed.z);
        if (distToTray <= placed.radius + 0.14) {
          const check = combineItemIntoTray(placed.item, heldItem);
          // Compute exact slot preview position on the tray
          const isSoda = heldItem.type === 'soda_cup';
          const isFries = heldItem.type === 'fries_box';
          const localOffsetX = isSoda ? 0.14 : isFries ? 0.035 : -0.105;
          const localOffsetZ = isSoda ? 0.04 : isFries ? -0.055 : 0.015;
          const cos = Math.cos(placed.rotationY);
          const sin = Math.sin(placed.rotationY);
          const slotX = placed.x + localOffsetX * cos + localOffsetZ * sin;
          const slotZ = placed.z - localOffsetX * sin + localOffsetZ * cos;

          return {
            valid: check.success,
            surfaceId: surface.id,
            surfaceLabel: `${surface.label} · Servis Tepsisi`,
            x: slotX,
            y: placed.y + 0.018,
            z: slotZ,
            rotationY: placed.rotationY,
            reason: check.reason,
            combineTargetTrayId: check.success ? placed.id : undefined,
          };
        }
      }
    }
  }

  // 1b. Prevent placing dirty bussing trays onto customer dining tables
  if (heldItem.type === 'dirty_tray' && surface.id.startsWith('dining_table')) {
    return {
      valid: false,
      surfaceId: surface.id,
      surfaceLabel: surface.label,
      x: worldX,
      y: surface.y,
      z: worldZ,
      rotationY,
      reason: 'Kirli tepsiyi müşteri masasına değil Atık / Tepsi Toplama İstasyonuna bırakın!',
    };
  }

  // 2. Check surface bounds
  const itemRadius = getPlacementRadius(heldItem);
  const pad = Math.max(surface.margin, itemRadius * 0.45);
  const minX = surface.minX + pad;
  const maxX = surface.maxX - pad;
  const minZ = surface.minZ + pad;
  const maxZ = surface.maxZ - pad;

  const clampedX = Math.max(minX, Math.min(maxX, worldX));
  const clampedZ = Math.max(minZ, Math.min(maxZ, worldZ));

  const outOfBounds =
    worldX < surface.minX - 0.04 ||
    worldX > surface.maxX + 0.04 ||
    worldZ < surface.minZ - 0.04 ||
    worldZ > surface.maxZ + 0.04;

  if (outOfBounds) {
    return {
      valid: false,
      surfaceId: surface.id,
      surfaceLabel: surface.label,
      x: clampedX,
      y: surface.y,
      z: clampedZ,
      rotationY,
      reason: 'Tezgâh sınırları dışında!',
    };
  }

  // 3. Check collision against existing placed items on the same surface
  for (const other of placedItems) {
    if (other.surfaceId !== surface.id) continue;
    const dist = Math.hypot(clampedX - other.x, clampedZ - other.z);
    const minAllowedDist = itemRadius + other.radius - 0.025;
    if (dist < minAllowedDist) {
      return {
        valid: false,
        surfaceId: surface.id,
        surfaceLabel: surface.label,
        x: clampedX,
        y: surface.y,
        z: clampedZ,
        rotationY,
        reason: 'Bu alan dolu! Yan tarafa yerleştirin.',
      };
    }
  }

  return {
    valid: true,
    surfaceId: surface.id,
    surfaceLabel: surface.label,
    x: clampedX,
    y: surface.y,
    z: clampedZ,
    rotationY,
  };
}

export class SmartPlacementSystem {
  placedItems: PlacedSurfaceItem[] = [];
  previewRotationY = 0;
  private nextId = 1;

  rotatePreview(stepRadians = Math.PI / 4): number {
    this.previewRotationY = (this.previewRotationY + stepRadians) % (Math.PI * 2);
    return this.previewRotationY;
  }

  evaluate(
    surfaceId: string,
    worldX: number,
    worldZ: number,
    heldItem: HeldItem
  ): PlacementEvaluation {
    return evaluateSurfacePlacement(
      surfaceId,
      worldX,
      worldZ,
      this.previewRotationY,
      heldItem,
      this.placedItems
    );
  }

  placeOrCombine(
    evaluation: PlacementEvaluation,
    heldItem: HeldItem
  ): {
    success: boolean;
    mode: 'placed' | 'combined' | 'invalid';
    placedRecord?: PlacedSurfaceItem;
    reason: string;
  } {
    if (!evaluation.valid) {
      return {
        success: false,
        mode: 'invalid',
        reason: evaluation.reason || 'Buraya yerleştirilemez!',
      };
    }

    if (evaluation.combineTargetTrayId) {
      const target = this.placedItems.find((p) => p.id === evaluation.combineTargetTrayId);
      if (target) {
        const comb = combineItemIntoTray(target.item, heldItem);
        if (comb.success) {
          target.item = comb.updatedTray;
          return {
            success: true,
            mode: 'combined',
            placedRecord: target,
            reason: comb.reason,
          };
        }
        return {
          success: false,
          mode: 'invalid',
          reason: comb.reason,
        };
      }
    }

    const record: PlacedSurfaceItem = {
      id: `placed_surface_${this.nextId++}`,
      surfaceId: evaluation.surfaceId,
      surfaceLabel: evaluation.surfaceLabel,
      item: {
        ...heldItem,
        layers: heldItem.layers ? [...heldItem.layers] : undefined,
      },
      x: evaluation.x,
      y: evaluation.y,
      z: evaluation.z,
      rotationY: evaluation.rotationY,
      radius: getPlacementRadius(heldItem),
    };
    this.placedItems.push(record);
    return {
      success: true,
      mode: 'placed',
      placedRecord: record,
      reason: `${heldItem.label} → ${evaluation.surfaceLabel} üzerine yerleştirildi.`,
    };
  }

  takeItem(id: string): PlacedSurfaceItem | null {
    const idx = this.placedItems.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const [removed] = this.placedItems.splice(idx, 1);
    return removed;
  }

  getItemById(id: string): PlacedSurfaceItem | null {
    return this.placedItems.find((p) => p.id === id) || null;
  }

  updatePlacedItem(id: string, newItem: HeldItem): PlacedSurfaceItem | null {
    const entry = this.placedItems.find((p) => p.id === id);
    if (!entry) return null;
    entry.item = {
      ...newItem,
      layers: newItem.layers ? [...newItem.layers] : undefined,
    };
    entry.radius = getPlacementRadius(entry.item);
    return entry;
  }

  /**
   * Returns all completed burgers/fries/trays currently sitting on surfaces so KDS status can reflect them.
   */
  getReadySurfaceItems(): { recipe: RecipeId; hasFries: boolean; hasSoda: boolean }[] {
    const list: { recipe: RecipeId; hasFries: boolean; hasSoda: boolean }[] = [];
    for (const p of this.placedItems) {
      const r = resolveHeldItemRecipe(p.item);
      if (r) {
        list.push({
          recipe: r,
          hasFries: Boolean(p.item.hasFries) || p.item.type === 'fries_box' || r === 'crispy_fries_solo',
          hasSoda: Boolean(p.item.hasSoda),
        });
      }
    }
    return list;
  }

  clear(): void {
    this.placedItems = [];
  }
}
