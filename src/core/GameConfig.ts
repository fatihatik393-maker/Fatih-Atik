export type IngredientType =
  | 'bun_bottom'
  | 'patty_raw'
  | 'patty_cooked'
  | 'patty_burnt'
  | 'cheese'
  | 'lettuce'
  | 'bun_top'
  | 'fries_raw'
  | 'fries_undercooked'
  | 'fries_cooked'
  | 'fries_burnt';

export type HeldItemType =
  | IngredientType
  | 'burger_classic'
  | 'burger_cheese'
  | 'burger_double_smash'
  | 'burger_invalid'
  | 'fries_box'
  | 'soda_cup'
  | 'service_tray'
  | 'dirty_tray'
  | 'order_tray'
  | 'supply_crate';

export type StorageCategory = 'dry' | 'cold' | 'freezer' | 'packaging';

export interface HeldItem {
  type: HeldItemType;
  label: string;
  layers?: IngredientType[];
  hasFries?: boolean;
  hasSoda?: boolean;
  /** Optional recipe ID when a burger is placed on a service tray or held */
  burgerRecipe?: RecipeId;
  /** Whether disposing this dirty tray at a bussing/trash station grants cleanliness bonus */
  cleanBonusPending?: boolean;
  /** Supply crate metadata when holding a 3D delivery crate */
  crateId?: string;
  crateStockKey?: StockKey;
  crateAmount?: number;
  crateOpened?: boolean;
}

export type RecipeId = 'classic_burger' | 'cheeseburger' | 'double_smash' | 'crispy_fries_solo';

export type OrderPreparationStatus = 'waiting' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export interface CustomerOrder {
  id: string;
  customerId: string;
  customerName: string;
  burger: RecipeId;
  wantsFries?: boolean;
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

export type StockKey = 'bun' | 'patty' | 'cheese' | 'lettuce' | 'soda' | 'fries' | 'packaging';

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
  staffExpenses: number;
  upgradeExpenses: number;
  reputationDelta: number;
}

export interface MenuPricingConfig {
  classic_burger: number;
  cheeseburger: number;
  double_smash: number;
  crispy_fries_solo: number;
  friesAddon: number;
  sodaAddon: number;
}

export interface SupplyCatalogItem {
  key: StockKey;
  label: string;
  shortLabel: string;
  amount: number;
  upgradedAmount: number;
  cost: number;
  storageCategory: StorageCategory;
  storageConditionLabel: string;
  accentColorHex: number;
}

export interface SupplyOrderItem {
  key: StockKey;
  packs: number;
}

export type DeliveryOrderStatus = 'in_transit' | 'arriving' | 'unloaded';

export interface SupplyOrder {
  id: string;
  items: SupplyOrderItem[];
  totalCost: number;
  remainingSeconds: number;
  totalDurationSeconds: number;
  status: DeliveryOrderStatus;
  createdAtDay: number;
}

export interface SupplyCrateState {
  id: string;
  stockKey: StockKey;
  amount: number;
  opened: boolean;
  shelved: boolean;
  position: { x: number; y: number; z: number };
  rotationY: number;
}

export type CashierAIState =
  | 'OFF_DUTY'
  | 'ARRIVING'
  | 'WALKING_TO_POST'
  | 'WAITING_FOR_CUSTOMER'
  | 'TAKING_ORDER'
  | 'SENDING_TO_KDS'
  | 'READY';

export interface StaffCandidate {
  id: string;
  name: string;
  role: 'cashier';
  roleTitle: string;
  dailyWage: number;
  hireFee: number;
  orderSpeedSeconds: number;
  efficiencyLabel: string;
  bio: string;
}

export const STAFF_CANDIDATES: StaffCandidate[] = [
  {
    id: 'cashier_elif',
    name: 'Elif Demir',
    role: 'cashier',
    roleTitle: 'Kıdemli Kasa & Sipariş Uzmanı',
    dailyWage: 40,
    hireFee: 50,
    orderSpeedSeconds: 2.5,
    efficiencyLabel: '%98 Hız • Sıfır Hata',
    bio: 'Kasada bekleyen müşterileri otomatik karşılar, siparişlerini alır ve doğrudan mutfak KDS ekranına iletir.',
  },
];

export interface StaffMemberState {
  id: string;
  name: string;
  role: 'cashier';
  hired: boolean;
  dailyWage: number;
  orderSpeedSeconds: number;
  aiState: CashierAIState;
  activeCustomerId: string | null;
  orderTimer: number;
  ordersTakenToday: number;
  position: { x: number; y: number; z: number };
  rotationY: number;
}

export interface DailyFinanceRecord {
  day: number;
  totalSales: number;
  tipIncome: number;
  supplyExpenses: number;
  staffExpenses: number;
  upgradeExpenses: number;
  netProfit: number;
  ordersPrepared: number;
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
  menuPricing?: MenuPricingConfig;
  cashierHired?: boolean;
  supplyOrders?: SupplyOrder[];
  supplyCrates?: SupplyCrateState[];
  financeHistory?: DailyFinanceRecord[];
}

export const DEFAULT_MENU_PRICING: MenuPricingConfig = {
  classic_burger: 60,
  cheeseburger: 75,
  double_smash: 115,
  crispy_fries_solo: 35,
  friesAddon: 28,
  sodaAddon: 20,
};

export const SUPPLY_CATALOG: Record<StockKey, SupplyCatalogItem> = {
  bun: {
    key: 'bun',
    label: 'Brioche Burger Ekmeği Kolisi',
    shortLabel: 'BRIOCHE EKMEK',
    amount: 5,
    upgradedAmount: 8,
    cost: 30,
    storageCategory: 'dry',
    storageConditionLabel: 'Kuru Gıda Rafı',
    accentColorHex: 0xd97706,
  },
  patty: {
    key: 'patty',
    label: 'Dana Smash Köfte Kolisi',
    shortLabel: 'DANA KÖFTE',
    amount: 5,
    upgradedAmount: 8,
    cost: 45,
    storageCategory: 'cold',
    storageConditionLabel: 'Soğuk Hava Dolabı (+4°C)',
    accentColorHex: 0xdc2626,
  },
  cheese: {
    key: 'cheese',
    label: 'Cheddar Peyniri Kolisi',
    shortLabel: 'CHEDDAR PEYNİR',
    amount: 5,
    upgradedAmount: 8,
    cost: 25,
    storageCategory: 'cold',
    storageConditionLabel: 'Soğuk Hava Dolabı (+4°C)',
    accentColorHex: 0xf59e0b,
  },
  lettuce: {
    key: 'lettuce',
    label: 'Taze Göbek Marul Kolisi',
    shortLabel: 'TAZE MARUL',
    amount: 5,
    upgradedAmount: 8,
    cost: 20,
    storageCategory: 'cold',
    storageConditionLabel: 'Soğuk Hava Dolabı (+4°C)',
    accentColorHex: 0x16a34a,
  },
  soda: {
    key: 'soda',
    label: 'Gazlı İçecek Şurubu Kolisi',
    shortLabel: 'KOLA ŞURUBU',
    amount: 5,
    upgradedAmount: 8,
    cost: 40,
    storageCategory: 'dry',
    storageConditionLabel: 'Kuru Gıda & İçecek Rafı',
    accentColorHex: 0x2563eb,
  },
  fries: {
    key: 'fries',
    label: 'Dondurulmuş Patates Stoğu Kolisi',
    shortLabel: 'ÇITIR PATATES',
    amount: 6,
    upgradedAmount: 10,
    cost: 32,
    storageCategory: 'freezer',
    storageConditionLabel: 'Derin Dondurucu (-18°C)',
    accentColorHex: 0xeab308,
  },
  packaging: {
    key: 'packaging',
    label: 'Servis Ambalajı & Patates Kutusu',
    shortLabel: 'SERVİS AMBALAJI',
    amount: 8,
    upgradedAmount: 12,
    cost: 18,
    storageCategory: 'packaging',
    storageConditionLabel: 'Kuru Gıda & Ambalaj Rafı',
    accentColorHex: 0x9333ea,
  },
};

export const GAME_CONFIG = {
  startingMoney: 200,
  startingReputation: 50,
  dayDurationSeconds: 360, // 6 minutes per work day
  supplyDeliverySeconds: 12,
  baseMaxStock: 25,
  upgradedMaxStock: 60,
  prices: {
    classic_burger: 60,
    cheeseburger: 75,
    double_smash: 115,
    crispy_fries_solo: 35,
    fries: 28,
    soda: 20,
  },
  recipeUnitCosts: {
    classic_burger: 20,
    cheeseburger: 25,
    double_smash: 38,
    crispy_fries_solo: 10,
    fries: 8,
    soda: 8,
  },
  restockPacks: {
    bun: { label: 'Burger Ekmeği Paketi', amount: 5, upgradedAmount: 8, cost: 30 },
    patty: { label: 'Dana Köfte Paketi', amount: 5, upgradedAmount: 8, cost: 45 },
    cheese: { label: 'Cheddar Peyniri Paketi', amount: 5, upgradedAmount: 8, cost: 25 },
    lettuce: { label: 'Taze Marul Paketi', amount: 5, upgradedAmount: 8, cost: 20 },
    soda: { label: 'Gazlı İçecek Şurubu', amount: 5, upgradedAmount: 8, cost: 40 },
    fries: { label: 'Dondurulmuş Patates Paketi', amount: 6, upgradedAmount: 10, cost: 32 },
    packaging: { label: 'Servis Ambalajı Paketi', amount: 8, upgradedAmount: 12, cost: 18 },
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
  frying: {
    standard: {
      cookedTime: 6,
      burntTime: 15,
    },
    upgraded: {
      cookedTime: 3.8,
      burntTime: 12.5,
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
    fries: 12,
    packaging: 16,
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
  crispy_fries_solo: {
    name: 'Çıtır Patates Porsiyonu',
    shortDesc: 'Dondurulmuş Patates → Fritözde Altın Sarısı Kızartma → Patates Kutusu',
    layers: [],
    price: GAME_CONFIG.prices.crispy_fries_solo,
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
  fries_raw: 'Dondurulmuş Çiğ Patates',
  fries_undercooked: 'Az Pişmiş Patates (Çöpe Atın)',
  fries_cooked: 'Pişmiş Çıtır Patates',
  fries_burnt: 'Yanmış Patates (Çöpe Atın)',
  burger_classic: 'Hazır Klasik Burger',
  burger_cheese: 'Hazır Cheeseburger',
  burger_double_smash: 'Hazır Double Smash Burger',
  burger_invalid: 'Hatalı Burger',
  fries_box: 'Çıtır Patates Kutusu',
  soda_cup: 'Gazlı İçecek',
  service_tray: 'Servis Tepsisi',
  dirty_tray: 'Kullanılmış Servis Tepsisi (Temizle)',
  order_tray: 'Sipariş Tepsisi',
  supply_crate: 'Tedarik Kolisi',
};

/**
 * Resolves the RecipeId carried by a HeldItem (either a standalone burger, standalone fries box, or a loaded Service Tray).
 */
export function resolveHeldItemRecipe(held: HeldItem | null | undefined): RecipeId | null {
  if (!held) return null;
  if (held.burgerRecipe) return held.burgerRecipe;
  if (held.type === 'burger_classic') return 'classic_burger';
  if (held.type === 'burger_cheese') return 'cheeseburger';
  if (held.type === 'burger_double_smash') return 'double_smash';
  if (held.type === 'fries_box') return 'crispy_fries_solo';
  if (held.layers && held.layers.length > 0) {
    for (const [rId, recipeDef] of Object.entries(RECIPES) as [
      RecipeId,
      (typeof RECIPES)[RecipeId],
    ][]) {
      if (
        recipeDef.layers.length > 0 &&
        held.layers.length === recipeDef.layers.length &&
        held.layers.every((l, i) => l === recipeDef.layers[i])
      ) {
        return rId;
      }
    }
  }
  if ((held.type === 'service_tray' || held.type === 'order_tray') && held.hasFries && !held.burgerRecipe) {
    return 'crispy_fries_solo';
  }
  return null;
}

/**
 * Formats a clear Turkish label for a Service Tray based on its current contents.
 */
export function formatServiceTrayLabel(
  burgerRecipe?: RecipeId | null,
  hasSoda?: boolean,
  hasFries?: boolean
): string {
  const parts: string[] = [];
  if (burgerRecipe && burgerRecipe !== 'crispy_fries_solo') {
    parts.push(RECIPES[burgerRecipe].name);
  }
  if (hasFries || burgerRecipe === 'crispy_fries_solo') {
    parts.push('Çıtır Patates');
  }
  if (hasSoda) {
    parts.push('İçecek');
  }
  if (parts.length === 0) {
    return 'Boş Servis Tepsisi';
  }
  return `Tepsi: ${parts.join(' + ')}`;
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
