import {
  DEFAULT_MENU_PRICING,
  GAME_CONFIG,
  GameSettings,
  MenuPricingConfig,
  RecipeId,
  SaveData,
  STAFF_CANDIDATES,
  StaffMemberState,
} from './GameConfig';

const SAVE_KEY = 'burger_district_save_v1';

export function createInitialCashierState(hired = false): StaffMemberState {
  const candidate = STAFF_CANDIDATES[0];
  return {
    id: candidate.id,
    name: candidate.name,
    role: 'cashier',
    hired,
    dailyWage: candidate.dailyWage,
    orderSpeedSeconds: candidate.orderSpeedSeconds,
    aiState: hired ? 'WAITING_FOR_CUSTOMER' : 'OFF_DUTY',
    activeCustomerId: null,
    orderTimer: 0,
    ordersTakenToday: 0,
    position: { x: -1.55, y: 0, z: -1.28 },
    rotationY: 0,
  };
}

export class SaveManager {
  static hasSave(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw !== null && raw.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Migrates any raw v1, v2, v3.1, or v3.2 partial save object into a complete, valid SaveData structure.
   * Pure and unit-testable without browser localStorage.
   */
  static migrateSaveData(parsed: Partial<SaveData> | null | undefined): SaveData {
    if (!parsed || typeof parsed !== 'object') {
      return this.createDefaultSave();
    }

    const day =
      typeof parsed.day === 'number' && Number.isFinite(parsed.day) && parsed.day >= 1
        ? Math.floor(parsed.day)
        : 1;

    const money =
      typeof parsed.money === 'number' && Number.isFinite(parsed.money)
        ? Math.max(0, Math.round(parsed.money))
        : GAME_CONFIG.startingMoney;

    const reputation =
      typeof parsed.reputation === 'number' && Number.isFinite(parsed.reputation)
        ? Math.max(0, Math.min(100, Math.round(parsed.reputation)))
        : GAME_CONFIG.startingReputation;

    const baseRecipes: RecipeId[] = ['classic_burger', 'cheeseburger', 'crispy_fries_solo'];
    if (day >= 2) {
      baseRecipes.push('double_smash');
    }

    const unlockedRecipes: RecipeId[] = [...baseRecipes];
    if (Array.isArray(parsed.unlockedRecipes)) {
      const validIds: RecipeId[] = [
        'classic_burger',
        'cheeseburger',
        'double_smash',
        'crispy_fries_solo',
      ];
      const filtered = parsed.unlockedRecipes.filter((r): r is RecipeId =>
        validIds.includes(r as RecipeId)
      );
      for (const r of filtered) {
        if (!unlockedRecipes.includes(r)) {
          unlockedRecipes.push(r);
        }
      }
    }

    const rawPricing: Partial<MenuPricingConfig> = parsed.menuPricing ?? {};
    const menuPricing: MenuPricingConfig = {
      classic_burger:
        typeof rawPricing.classic_burger === 'number' && rawPricing.classic_burger >= 20
          ? rawPricing.classic_burger
          : DEFAULT_MENU_PRICING.classic_burger,
      cheeseburger:
        typeof rawPricing.cheeseburger === 'number' && rawPricing.cheeseburger >= 25
          ? rawPricing.cheeseburger
          : DEFAULT_MENU_PRICING.cheeseburger,
      double_smash:
        typeof rawPricing.double_smash === 'number' && rawPricing.double_smash >= 40
          ? rawPricing.double_smash
          : DEFAULT_MENU_PRICING.double_smash,
      crispy_fries_solo:
        typeof rawPricing.crispy_fries_solo === 'number' && rawPricing.crispy_fries_solo >= 15
          ? rawPricing.crispy_fries_solo
          : DEFAULT_MENU_PRICING.crispy_fries_solo,
      friesAddon:
        typeof rawPricing.friesAddon === 'number' && rawPricing.friesAddon >= 10
          ? rawPricing.friesAddon
          : DEFAULT_MENU_PRICING.friesAddon,
      sodaAddon:
        typeof rawPricing.sodaAddon === 'number' && rawPricing.sodaAddon >= 8
          ? rawPricing.sodaAddon
          : DEFAULT_MENU_PRICING.sodaAddon,
    };

    const mergedStock = {
      ...GAME_CONFIG.initialStock,
      ...(parsed.stock || {}),
    };

    return {
      money,
      day,
      reputation,
      stock: mergedStock,
      grillUpgraded: Boolean(parsed.grillUpgraded),
      decorUpgraded: Boolean(parsed.decorUpgraded),
      coldStorageUpgraded: Boolean(parsed.coldStorageUpgraded),
      unlockedRecipes,
      settings: {
        ...GAME_CONFIG.defaultSettings,
        ...(parsed.settings || {}),
      },
      menuPricing,
      cashierHired: Boolean(parsed.cashierHired),
      supplyOrders: Array.isArray(parsed.supplyOrders)
        ? parsed.supplyOrders.filter((o) => o && o.status !== 'unloaded')
        : [],
      supplyCrates: Array.isArray(parsed.supplyCrates)
        ? parsed.supplyCrates.filter((c) => c && !c.shelved)
        : [],
      financeHistory: Array.isArray(parsed.financeHistory) ? parsed.financeHistory.slice(-14) : [],
    };
  }

  static load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return this.createDefaultSave();
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return this.migrateSaveData(parsed);
    } catch {
      return this.createDefaultSave();
    }
  }

  static save(data: SaveData): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage quota errors in restricted contexts
    }
  }

  static saveSettings(settings: GameSettings): void {
    const current = this.load();
    current.settings = { ...settings };
    this.save(current);
  }

  static resetForNewGame(preserveSettings?: GameSettings): SaveData {
    const currentSettings = preserveSettings || this.load().settings;
    const fresh: SaveData = {
      money: GAME_CONFIG.startingMoney,
      day: 1,
      reputation: GAME_CONFIG.startingReputation,
      stock: { ...GAME_CONFIG.initialStock },
      grillUpgraded: false,
      decorUpgraded: false,
      coldStorageUpgraded: false,
      unlockedRecipes: ['classic_burger', 'cheeseburger', 'crispy_fries_solo'],
      settings: { ...currentSettings },
      menuPricing: { ...DEFAULT_MENU_PRICING },
      cashierHired: false,
      supplyOrders: [],
      supplyCrates: [],
      financeHistory: [],
    };
    this.save(fresh);
    return fresh;
  }

  static createDefaultSave(): SaveData {
    return {
      money: GAME_CONFIG.startingMoney,
      day: 1,
      reputation: GAME_CONFIG.startingReputation,
      stock: { ...GAME_CONFIG.initialStock },
      grillUpgraded: false,
      decorUpgraded: false,
      coldStorageUpgraded: false,
      unlockedRecipes: ['classic_burger', 'cheeseburger', 'crispy_fries_solo'],
      settings: { ...GAME_CONFIG.defaultSettings },
      menuPricing: { ...DEFAULT_MENU_PRICING },
      cashierHired: false,
      supplyOrders: [],
      supplyCrates: [],
      financeHistory: [],
    };
  }
}
