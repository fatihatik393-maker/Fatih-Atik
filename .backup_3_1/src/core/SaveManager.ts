import {
  GAME_CONFIG,
  SaveData,
  GameSettings,
  RecipeId,
} from './GameConfig';

const SAVE_KEY = 'burger_district_save_v1';

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
   * Migrates any raw v1 or v2 partial save object into a complete, valid SaveData structure.
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

    const baseRecipes: RecipeId[] = ['classic_burger', 'cheeseburger'];
    if (day >= 2) {
      baseRecipes.push('double_smash');
    }

    let unlockedRecipes: RecipeId[] = [...baseRecipes];
    if (Array.isArray(parsed.unlockedRecipes)) {
      const validIds: RecipeId[] = ['classic_burger', 'cheeseburger', 'double_smash'];
      const filtered = parsed.unlockedRecipes.filter((r): r is RecipeId =>
        validIds.includes(r as RecipeId)
      );
      for (const r of filtered) {
        if (!unlockedRecipes.includes(r)) {
          unlockedRecipes.push(r);
        }
      }
    }

    return {
      money,
      day,
      reputation,
      stock: {
        ...GAME_CONFIG.initialStock,
        ...(parsed.stock || {}),
      },
      grillUpgraded: Boolean(parsed.grillUpgraded),
      decorUpgraded: Boolean(parsed.decorUpgraded),
      coldStorageUpgraded: Boolean(parsed.coldStorageUpgraded),
      unlockedRecipes,
      settings: {
        ...GAME_CONFIG.defaultSettings,
        ...(parsed.settings || {}),
      },
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
      unlockedRecipes: ['classic_burger', 'cheeseburger'],
      settings: { ...currentSettings },
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
      unlockedRecipes: ['classic_burger', 'cheeseburger'],
      settings: { ...GAME_CONFIG.defaultSettings },
    };
  }
}
