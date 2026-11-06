import {
  GAME_CONFIG,
  HeldItem,
  StockInventory,
  StockKey,
  StorageCategory,
  SUPPLY_CATALOG,
  SupplyCrateState,
  SupplyOrder,
  SupplyOrderItem,
} from '../core/GameConfig';

/**
 * Delivery pallet slots positioned just inside the east storage & delivery zone
 * (x = 4.55..5.35, z = -1.65..-0.55) and entrance delivery mat so the player
 * can pick up delivered crates without leaving the interior room bounds!
 */
export const DELIVERY_PALLET_SLOTS: { x: number; y: number; z: number; rotationY: number }[] = [
  { x: 4.95, y: 0.14, z: -1.55, rotationY: 0.08 },
  { x: 5.55, y: 0.14, z: -1.55, rotationY: -0.06 },
  { x: 4.95, y: 0.14, z: -0.95, rotationY: 0.04 },
  { x: 5.55, y: 0.14, z: -0.95, rotationY: -0.05 },
  { x: 4.95, y: 0.46, z: -1.55, rotationY: -0.03 },
  { x: 5.55, y: 0.46, z: -1.55, rotationY: 0.06 },
  { x: 4.95, y: 0.46, z: -0.95, rotationY: 0.02 },
  { x: 5.55, y: 0.46, z: -0.95, rotationY: -0.04 },
];

export function calculateSupplyOrderTotal(items: SupplyOrderItem[]): number {
  let total = 0;
  for (const entry of items) {
    if (!entry || entry.packs <= 0) continue;
    const cat = SUPPLY_CATALOG[entry.key];
    if (!cat) continue;
    total += cat.cost * Math.floor(entry.packs);
  }
  return total;
}

export function createSupplyOrderTransaction(
  items: SupplyOrderItem[],
  currentMoney: number,
  currentDay: number,
  orderIdPrefix = 'sup'
): {
  ok: boolean;
  reason?: string;
  order?: SupplyOrder;
  newMoney: number;
  costDeducted: number;
} {
  const sanitized: SupplyOrderItem[] = [];
  for (const item of items) {
    if (!item || !SUPPLY_CATALOG[item.key]) continue;
    const packs = Math.floor(item.packs);
    if (packs > 0) {
      sanitized.push({ key: item.key, packs });
    }
  }

  if (sanitized.length === 0) {
    return {
      ok: false,
      reason: 'Sipariş sepeti boş! Lütfen en az 1 koli ürün seçin.',
      newMoney: currentMoney,
      costDeducted: 0,
    };
  }

  const totalCost = calculateSupplyOrderTotal(sanitized);
  if (totalCost <= 0) {
    return {
      ok: false,
      reason: 'Geçersiz sipariş tutarı.',
      newMoney: currentMoney,
      costDeducted: 0,
    };
  }

  if (currentMoney < totalCost) {
    return {
      ok: false,
      reason: `Yetersiz bakiye! Gerekli: ${totalCost} $, Mevcut: ${currentMoney} $`,
      newMoney: currentMoney,
      costDeducted: 0,
    };
  }

  const order: SupplyOrder = {
    id: `${orderIdPrefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    items: sanitized,
    totalCost,
    remainingSeconds: GAME_CONFIG.supplyDeliverySeconds,
    totalDurationSeconds: GAME_CONFIG.supplyDeliverySeconds,
    status: 'in_transit',
    createdAtDay: currentDay,
  };

  return {
    ok: true,
    order,
    newMoney: currentMoney - totalCost,
    costDeducted: totalCost,
  };
}

export function spawnCratesForSupplyOrder(
  order: SupplyOrder,
  existingCrates: SupplyCrateState[],
  coldStorageUpgraded = false
): SupplyCrateState[] {
  const created: SupplyCrateState[] = [];
  let slotCursor = existingCrates.filter((c) => !c.shelved).length;

  for (const item of order.items) {
    const catalog = SUPPLY_CATALOG[item.key];
    if (!catalog) continue;
    const packAmount = coldStorageUpgraded ? catalog.upgradedAmount : catalog.amount;
    for (let i = 0; i < item.packs; i++) {
      const slot = DELIVERY_PALLET_SLOTS[slotCursor % DELIVERY_PALLET_SLOTS.length];
      const stackLevel = Math.floor(slotCursor / DELIVERY_PALLET_SLOTS.length);
      created.push({
        id: `crate_${order.id}_${item.key}_${i}_${slotCursor}`,
        stockKey: item.key,
        amount: packAmount,
        opened: false,
        shelved: false,
        position: {
          x: slot.x,
          y: slot.y + stackLevel * 0.32,
          z: slot.z,
        },
        rotationY: slot.rotationY,
      });
      slotCursor += 1;
    }
  }

  return created;
}

export function createHeldItemFromCrate(crate: SupplyCrateState): HeldItem {
  const catalog = SUPPLY_CATALOG[crate.stockKey];
  return {
    type: 'supply_crate',
    label: crate.opened
      ? `Açık Koli: ${catalog.shortLabel} (+${crate.amount})`
      : `Kapalı Koli: ${catalog.shortLabel} (${crate.amount} Adet)`,
    crateId: crate.id,
    crateStockKey: crate.stockKey,
    crateAmount: crate.amount,
    crateOpened: crate.opened,
  };
}

export function openHeldSupplyCrate(held: HeldItem | null): {
  ok: boolean;
  reason?: string;
  updatedItem?: HeldItem;
} {
  if (!held || held.type !== 'supply_crate' || !held.crateStockKey) {
    return { ok: false, reason: 'Elinizde açılacak bir tedarik kolisi yok!' };
  }
  if (held.crateOpened) {
    return { ok: false, reason: 'Bu tedarik kolisi zaten açılmış! Depo rafına yerleştirin.' };
  }
  const catalog = SUPPLY_CATALOG[held.crateStockKey];
  const amount = held.crateAmount ?? catalog.amount;
  return {
    ok: true,
    updatedItem: {
      ...held,
      crateOpened: true,
      label: `Açık Koli: ${catalog.shortLabel} (+${amount})`,
    },
  };
}

export function isStorageCategoryCompatible(
  crateStockKey: StockKey,
  targetZoneCategory?: StorageCategory
): boolean {
  const itemCat = SUPPLY_CATALOG[crateStockKey]?.storageCategory;
  if (!itemCat) return false;
  if (!targetZoneCategory) return true;
  if (targetZoneCategory === 'dry' && (itemCat === 'dry' || itemCat === 'packaging')) {
    return true;
  }
  if (targetZoneCategory === 'packaging' && (itemCat === 'packaging' || itemCat === 'dry')) {
    return true;
  }
  return itemCat === targetZoneCategory;
}

export function shelveSupplyCrateIntoStock(
  held: HeldItem | null,
  currentStock: StockInventory,
  consumedCrateIds: Set<string>,
  targetStorageCategory?: StorageCategory,
  maxCapacity = GAME_CONFIG.upgradedMaxStock
): {
  ok: boolean;
  reason?: string;
  stockKey?: StockKey;
  addedAmount?: number;
  updatedStock: StockInventory;
} {
  if (!held || held.type !== 'supply_crate' || !held.crateStockKey) {
    return {
      ok: false,
      reason: 'Rafa yerleştirmek için elinizde bir tedarik kolisi olmalı!',
      updatedStock: currentStock,
    };
  }

  const crateId = held.crateId ?? '';
  if (crateId && consumedCrateIds.has(crateId)) {
    return {
      ok: false,
      reason: 'Bu tedarik kolisi zaten depoya aktarılmış!',
      updatedStock: currentStock,
    };
  }

  if (!held.crateOpened) {
    return {
      ok: false,
      reason: 'Önce koliyi açmalısınız! ([F] tuşu veya Depo Koli Açma Tezgâhı)',
      updatedStock: currentStock,
    };
  }

  const catalog = SUPPLY_CATALOG[held.crateStockKey];
  if (targetStorageCategory && !isStorageCategoryCompatible(held.crateStockKey, targetStorageCategory)) {
    return {
      ok: false,
      reason: `Yanlış depo bölümü! ${catalog.shortLabel} → ${catalog.storageConditionLabel} bölümüne yerleştirilmeli.`,
      updatedStock: currentStock,
    };
  }

  const amount = held.crateAmount ?? catalog.amount;
  const currentVal = currentStock[held.crateStockKey] ?? 0;
  const newVal = Math.min(maxCapacity, currentVal + amount);
  const actualAdded = Math.max(1, newVal - currentVal);

  const nextStock: StockInventory = {
    ...currentStock,
    [held.crateStockKey]: currentVal + actualAdded,
  };

  if (crateId) {
    consumedCrateIds.add(crateId);
  }

  return {
    ok: true,
    stockKey: held.crateStockKey,
    addedAmount: actualAdded,
    updatedStock: nextStock,
  };
}
