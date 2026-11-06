export type IngredientType =
  | 'bun_bottom'
  | 'patty_raw'
  | 'patty_cooked'
  | 'patty_burnt'
  | 'cheese'
  | 'lettuce'
  | 'bun_top';

export type HeldItemType =
  | IngredientType
  | 'burger_classic'
  | 'burger_cheese'
  | 'burger_double_smash'
  | 'burger_invalid'
  | 'soda_cup'
  | 'service_tray'
  | 'dirty_tray'
  | 'order_tray';

export interface HeldItem {
  type: HeldItemType;
  label: string;
  layers?: IngredientType[];
  hasSoda?: boolean;
  /** Optional recipe ID when a burger is placed on a service tray or held */
  burgerRecipe?: RecipeId;
  /** Whether disposing this dirty tray at a bussing/trash station grants cleanliness bonus */
  cleanBonusPending?: boolean;
}

export type RecipeId = 'classic_burger' | 'cheeseburger' | 'double_smash';

export type OrderPreparationStatus = 'waiting' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export interface CustomerOrder {
  id: string;
  customerId: string;
  customerName: string;
  burger: RecipeId;
  wantsSoda: boolean;
  totalPrice: number;
  createdAt: number;
  delivered: boolean;
  /** Remaining patience in seconds (optional for legacy test objects) */
  patience?: number;
  /** Maximum patience in seconds */
  maxPatience?: number;
  /** Elapsed wait time in seconds */
  elapsedSeconds?: number;
  /** Live KDS status */
  status?: OrderPreparationStatus;
}

export type StockKey = 'bun' | 'patty' | 'cheese' | 'lettuce' | 'soda';

export type StockInventory = Record<StockKey, number>;

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export type DayPhase = 'opening' | 'normal' | 'rush_hour' | 'closing';

export interface GameSettings {
  mouseSensitivity: number;
  masterVolume: number;
  graphicsQuality: GraphicsQuality;
  headBob: boolean;
}

export interface DayStats {
  day: number;
  totalSales: number;
  tipIncome: number;
  ordersPrepared: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  lostCustomers: number;
  supplyExpenses: number;
  upgradeExpenses: number;
  reputationDelta: number;
}

export interface SaveData {
  money: number;
  day: number;
  reputation: number;
  stock: StockInventory;
  grillUpgraded: boolean;
  decorUpgraded: boolean;
  coldStorageUpgraded: boolean;
  unlockedRecipes: RecipeId[];
  settings: GameSettings;
}

export const GAME_CONFIG = {
  startingMoney: 200,
  startingReputation: 50,
  dayDurationSeconds: 360, // 6 minutes per work day
  baseMaxStock: 25,
  upgradedMaxStock: 60,
  prices: {
    classic_burger: 60,
    cheeseburger: 75,
    double_smash: 115,
    soda: 20,
  },
  recipeUnitCosts: {
    classic_burger: 20,
    cheeseburger: 25,
    double_smash: 38,
    soda: 8,
  },
  restockPacks: {
    bun: { label: 'Burger Ekmeği Paketi', amount: 5, upgradedAmount: 8, cost: 30 },
    patty: { label: 'Dana Köfte Paketi', amount: 5, upgradedAmount: 8, cost: 45 },
    cheese: { label: 'Cheddar Peyniri Paketi', amount: 5, upgradedAmount: 8, cost: 25 },
    lettuce: { label: 'Taze Marul Paketi', amount: 5, upgradedAmount: 8, cost: 20 },
    soda: { label: 'Gazlı İçecek Şurubu', amount: 5, upgradedAmount: 8, cost: 40 },
  } as Record<
    StockKey,
    { label: string; amount: number; upgradedAmount: number; cost: number }
  >,
  grillUpgradeCost: 250,
  decorUpgradeCost: 300,
  coldStorageUpgradeCost: 220,
  cooking: {
    standard: {
      cookedTime: 8,
      burntTime: 18,
    },
    upgraded: {
      cookedTime: 4.5,
      burntTime: 14,
    },
  },
  patience: {
    baseSeconds: 72,
    rushHourSeconds: 60,
    decorBonusSeconds: 15,
  },
  initialStock: {
    bun: 12,
    patty: 12,
    cheese: 10,
    lettuce: 10,
    soda: 10,
  } as StockInventory,
  defaultSettings: {
    mouseSensitivity: 1.0,
    masterVolume: 0.7,
    graphicsQuality: 'high',
    headBob: true,
  } as GameSettings,
};

export const RECIPES: Record<
  RecipeId,
  { name: string; shortDesc: string; layers: IngredientType[]; price: number }
> = {
  classic_burger: {
    name: 'Klasik Burger',
    shortDesc: 'Alt Ekmek → Pişmiş Köfte → Marul → Üst Ekmek',
    layers: ['bun_bottom', 'patty_cooked', 'lettuce', 'bun_top'],
    price: GAME_CONFIG.prices.classic_burger,
  },
  cheeseburger: {
    name: 'Cheeseburger',
    shortDesc: 'Alt Ekmek → Pişmiş Köfte → Cheddar → Marul → Üst Ekmek',
    layers: ['bun_bottom', 'patty_cooked', 'cheese', 'lettuce', 'bun_top'],
    price: GAME_CONFIG.prices.cheeseburger,
  },
  double_smash: {
    name: 'Double Smash Burger',
    shortDesc: 'Alt Ekmek → Köfte → Cheddar → 2. Köfte → Cheddar → Marul → Üst Ekmek',
    layers: [
      'bun_bottom',
      'patty_cooked',
      'cheese',
      'patty_cooked',
      'cheese',
      'lettuce',
      'bun_top',
    ],
    price: GAME_CONFIG.prices.double_smash,
  },
};

export const ITEM_LABELS: Record<HeldItemType, string> = {
  bun_bottom: 'Alt Ekmek',
  patty_raw: 'Çiğ Köfte',
  patty_cooked: 'Pişmiş Köfte',
  patty_burnt: 'Yanmış Köfte (Çöpe Atın)',
  cheese: 'Cheddar Peyniri',
  lettuce: 'Taze Marul',
  bun_top: 'Üst Ekmek',
  burger_classic: 'Hazır Klasik Burger',
  burger_cheese: 'Hazır Cheeseburger',
  burger_double_smash: 'Hazır Double Smash Burger',
  burger_invalid: 'Hatalı Burger',
  soda_cup: 'Gazlı İçecek',
  service_tray: 'Servis Tepsisi',
  dirty_tray: 'Kullanılmış Servis Tepsisi (Temizle)',
  order_tray: 'Sipariş Tepsisi',
};

/**
 * Resolves the RecipeId carried by a HeldItem (either a standalone burger or a loaded Service Tray).
 */
export function resolveHeldItemRecipe(held: HeldItem | null | undefined): RecipeId | null {
  if (!held) return null;
  if (held.burgerRecipe) return held.burgerRecipe;
  if (held.type === 'burger_classic') return 'classic_burger';
  if (held.type === 'burger_cheese') return 'cheeseburger';
  if (held.type === 'burger_double_smash') return 'double_smash';
  if (held.layers && held.layers.length > 0) {
    for (const [rId, recipeDef] of Object.entries(RECIPES) as [
      RecipeId,
      (typeof RECIPES)[RecipeId],
    ][]) {
      if (
        held.layers.length === recipeDef.layers.length &&
        held.layers.every((l, i) => l === recipeDef.layers[i])
      ) {
        return rId;
      }
    }
  }
  return null;
}

/**
 * Formats a clear Turkish label for a Service Tray based on its current contents.
 */
export function formatServiceTrayLabel(burgerRecipe?: RecipeId | null, hasSoda?: boolean): string {
  const bName = burgerRecipe ? RECIPES[burgerRecipe].name : null;
  if (bName && hasSoda) return `Tepsi: ${bName} + İçecek`;
  if (bName) return `Tepsi: ${bName}`;
  if (hasSoda) return 'Tepsi: Gazlı İçecek (Burger Eksik)';
  return 'Boş Servis Tepsisi';
}

/**
 * Evaluates the current DayPhase from remaining seconds in a 360s workday.
 */
export function evaluateDayPhase(
  timeRemaining: number,
  totalDuration = GAME_CONFIG.dayDurationSeconds
): DayPhase {
  const elapsed = Math.max(0, totalDuration - timeRemaining);
  const progress = elapsed / Math.max(1, totalDuration);
  if (progress < 0.16) return 'opening'; // 0..57.6s
  if (progress < 0.45) return 'normal'; // 57.6s..162s
  if (progress < 0.78) return 'rush_hour'; // 162s..280.8s (ÖĞLE YOĞUNLUĞU)
  return 'closing'; // 280.8s..360s
}

export const DAY_PHASE_LABELS: Record<DayPhase, string> = {
  opening: 'SABAH AÇILIŞI',
  normal: 'NORMAL SERVİS',
  rush_hour: 'ÖĞLE YOĞUNLUĞU (RUSH HOUR)',
  closing: 'AKŞAM KAPANIŞ SERVİSİ',
};
