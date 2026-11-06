import {
  CustomerOrder,
  DailyFinanceRecord,
  DayStats,
  DEFAULT_MENU_PRICING,
  GAME_CONFIG,
  HeldItem,
  MenuPricingConfig,
  RECIPES,
  RecipeId,
  resolveHeldItemRecipe,
  StockInventory,
  StockKey,
} from '../core/GameConfig';

export interface DeliveryCheckResult {
  valid: boolean;
  reason: string;
  payout: number;
  tip: number;
  reputationDelta: number;
}

export class EconomySystem {
  money: number;
  reputation: number;
  stock: StockInventory;
  grillUpgraded: boolean;
  decorUpgraded: boolean;
  coldStorageUpgraded: boolean;
  unlockedRecipes: RecipeId[];
  dayStats: DayStats;
  menuPricing: MenuPricingConfig;
  financeHistory: DailyFinanceRecord[];
  private deliveredOrderIds: Set<string> = new Set();

  constructor(
    initialMoney = GAME_CONFIG.startingMoney,
    initialStock: Partial<StockInventory> = { ...GAME_CONFIG.initialStock },
    grillUpgraded = false,
    day = 1,
    reputation = GAME_CONFIG.startingReputation,
    decorUpgraded = false,
    coldStorageUpgraded = false,
    unlockedRecipes: RecipeId[] = ['classic_burger', 'cheeseburger', 'crispy_fries_solo']
  ) {
    this.money = initialMoney;
    this.reputation = Math.max(0, Math.min(100, reputation));
    this.stock = {
      ...GAME_CONFIG.initialStock,
      ...initialStock,
    };
    this.grillUpgraded = grillUpgraded;
    this.decorUpgraded = decorUpgraded;
    this.coldStorageUpgraded = coldStorageUpgraded;
    this.unlockedRecipes = [...unlockedRecipes];
    if (!this.unlockedRecipes.includes('crispy_fries_solo')) {
      this.unlockedRecipes.push('crispy_fries_solo');
    }
    if (day >= 2 && !this.unlockedRecipes.includes('double_smash')) {
      this.unlockedRecipes.push('double_smash');
    }
    this.menuPricing = { ...DEFAULT_MENU_PRICING };
    this.financeHistory = [];
    this.dayStats = this.createEmptyDayStats(day);
  }

  createEmptyDayStats(day: number): DayStats {
    return {
      day,
      totalSales: 0,
      tipIncome: 0,
      ordersPrepared: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      lostCustomers: 0,
      supplyExpenses: 0,
      staffExpenses: 0,
      upgradeExpenses: 0,
      reputationDelta: 0,
    };
  }

  startNewDay(day: number): void {
    this.deliveredOrderIds.clear();
    if (!this.unlockedRecipes.includes('crispy_fries_solo')) {
      this.unlockedRecipes.push('crispy_fries_solo');
    }
    if (day >= 2 && !this.unlockedRecipes.includes('double_smash')) {
      this.unlockedRecipes.push('double_smash');
    }
    this.dayStats = this.createEmptyDayStats(day);
  }

  finalizeDayFinanceRecord(): DailyFinanceRecord {
    const rec: DailyFinanceRecord = {
      day: this.dayStats.day,
      totalSales: this.dayStats.totalSales,
      tipIncome: this.dayStats.tipIncome,
      supplyExpenses: this.dayStats.supplyExpenses,
      staffExpenses: this.dayStats.staffExpenses,
      upgradeExpenses: this.dayStats.upgradeExpenses,
      netProfit: this.getNetProfit(),
      ordersPrepared: this.dayStats.ordersPrepared,
    };
    const existingIdx = this.financeHistory.findIndex((r) => r.day === rec.day);
    if (existingIdx >= 0) {
      this.financeHistory[existingIdx] = rec;
    } else {
      this.financeHistory.push(rec);
    }
    return rec;
  }

  setMenuPrice(key: keyof MenuPricingConfig, newPrice: number): boolean {
    if (!Number.isFinite(newPrice)) return false;
    const clamped = Math.max(10, Math.min(200, Math.round(newPrice)));
    this.menuPricing[key] = clamped;
    return true;
  }

  computeOrderPrice(burger: RecipeId, wantsFries: boolean, wantsSoda: boolean): number {
    const base = this.menuPricing[burger] ?? RECIPES[burger].price;
    if (burger === 'crispy_fries_solo') {
      return base + (wantsSoda ? this.menuPricing.sodaAddon : 0);
    }
    return (
      base +
      (wantsFries ? this.menuPricing.friesAddon : 0) +
      (wantsSoda ? this.menuPricing.sodaAddon : 0)
    );
  }

  getMaxStockCapacity(): number {
    return this.coldStorageUpgraded
      ? GAME_CONFIG.upgradedMaxStock
      : GAME_CONFIG.baseMaxStock;
  }

  isRecipeUnlocked(recipe: RecipeId): boolean {
    return this.unlockedRecipes.includes(recipe);
  }

  unlockRecipe(recipe: RecipeId): boolean {
    if (this.unlockedRecipes.includes(recipe)) return false;
    this.unlockedRecipes.push(recipe);
    return true;
  }

  adjustReputation(delta: number): number {
    const prev = this.reputation;
    this.reputation = Math.max(0, Math.min(100, Math.round(this.reputation + delta)));
    const actualDelta = this.reputation - prev;
    this.dayStats.reputationDelta += actualDelta;
    return actualDelta;
  }

  recordCustomerLost(): number {
    this.dayStats.lostCustomers += 1;
    return this.adjustReputation(-8);
  }

  consumeStock(key: StockKey): boolean {
    if ((this.stock[key] ?? 0) <= 0) return false;
    this.stock[key] -= 1;
    return true;
  }

  recordSupplyOrderExpense(cost: number): void {
    this.dayStats.supplyExpenses += cost;
  }

  recordStaffPayrollExpense(wage: number): void {
    this.dayStats.staffExpenses += wage;
  }

  buyRestock(key: StockKey): { success: boolean; message: string } {
    const pack = GAME_CONFIG.restockPacks[key];
    if (!pack) return { success: false, message: 'Geçersiz stok paketi.' };
    const maxCap = this.getMaxStockCapacity();
    if (this.stock[key] >= maxCap) {
      return {
        success: false,
        message: `Depo kapasitesi dolu (${maxCap} adet)! ${
          !this.coldStorageUpgraded ? 'Soğuk Depo geliştirmesiyle kapasiteyi artırabilirsiniz.' : ''
        }`.trim(),
      };
    }
    if (this.money < pack.cost) {
      return { success: false, message: `Yetersiz bakiye! (${pack.cost} $ gerekli)` };
    }
    const rawAdd = this.coldStorageUpgraded ? pack.upgradedAmount : pack.amount;
    const actualAdd = Math.min(rawAdd, maxCap - this.stock[key]);
    this.money -= pack.cost;
    this.stock[key] += actualAdd;
    this.dayStats.supplyExpenses += pack.cost;
    return {
      success: true,
      message: `${pack.label} satın alındı (+${actualAdd} adet).`,
    };
  }

  buyGrillUpgrade(): { success: boolean; message: string } {
    if (this.grillUpgraded) {
      return { success: false, message: 'Endüstriyel Izgara zaten satın alındı!' };
    }
    if (this.money < GAME_CONFIG.grillUpgradeCost) {
      return {
        success: false,
        message: `Yetersiz bakiye! (${GAME_CONFIG.grillUpgradeCost} $ gerekli)`,
      };
    }
    this.money -= GAME_CONFIG.grillUpgradeCost;
    this.grillUpgraded = true;
    this.dayStats.upgradeExpenses += GAME_CONFIG.grillUpgradeCost;
    return {
      success: true,
      message: 'Endüstriyel Izgara & Fritöz kuruldu! Köfte ve patates pişirme süresi %45 hızlandı.',
    };
  }

  buyDecorUpgrade(): { success: boolean; message: string } {
    if (this.decorUpgraded) {
      return { success: false, message: 'Premium Restoran Dekorasyonu zaten etkin!' };
    }
    if (this.money < GAME_CONFIG.decorUpgradeCost) {
      return {
        success: false,
        message: `Yetersiz bakiye! (${GAME_CONFIG.decorUpgradeCost} $ gerekli)`,
      };
    }
    this.money -= GAME_CONFIG.decorUpgradeCost;
    this.decorUpgraded = true;
    this.dayStats.upgradeExpenses += GAME_CONFIG.decorUpgradeCost;
    this.adjustReputation(8);
    return {
      success: true,
      message:
        'Premium Restoran Dekorasyonu kuruldu! Sıcak aydınlatma, neon tabela ve bitkiler eklendi (+8 İtibar, +Sabır & Bahşiş).',
    };
  }

  buyColdStorageUpgrade(): { success: boolean; message: string } {
    if (this.coldStorageUpgraded) {
      return { success: false, message: 'Geliştirilmiş Soğuk Depo zaten satın alındı!' };
    }
    if (this.money < GAME_CONFIG.coldStorageUpgradeCost) {
      return {
        success: false,
        message: `Yetersiz bakiye! (${GAME_CONFIG.coldStorageUpgradeCost} $ gerekli)`,
      };
    }
    this.money -= GAME_CONFIG.coldStorageUpgradeCost;
    this.coldStorageUpgraded = true;
    this.dayStats.upgradeExpenses += GAME_CONFIG.coldStorageUpgradeCost;
    return {
      success: true,
      message:
        'Geliştirilmiş Soğuk Depo kuruldu! Maksimum stok kapasitesi 60 adede, paket alımları +8 adede yükseldi.',
    };
  }

  /**
   * Calculates customer tip based on delivery speed / remaining patience ratio,
   * restaurant reputation (0..100), and Premium Decor upgrade.
   */
  calculateTip(order: CustomerOrder): number {
    if (
      typeof order.patience !== 'number' ||
      typeof order.maxPatience !== 'number' ||
      order.maxPatience <= 0
    ) {
      return 0;
    }

    const patienceRatio = Math.max(0, Math.min(1, order.patience / order.maxPatience));
    if (patienceRatio < 0.28) {
      return 0;
    }

    const speedFactor = (patienceRatio - 0.25) * 0.18; // up to ~13.5%
    const repFactor = (this.reputation / 100) * 0.1; // up to 10%
    const decorFactor = this.decorUpgraded ? 0.05 : 0; // +5%
    const rawTip = order.totalPrice * (speedFactor + repFactor + decorFactor);
    return Math.max(2, Math.round(rawTip));
  }

  validateAndDeliverOrder(order: CustomerOrder | null, held: HeldItem | null): DeliveryCheckResult {
    if (!order) {
      return {
        valid: false,
        reason: 'Şu anda teslimat bekleyen aktif bir müşteri siparişi yok!',
        payout: 0,
        tip: 0,
        reputationDelta: 0,
      };
    }

    if (order.status === 'cancelled') {
      return {
        valid: false,
        reason: 'Bu sipariş müşteri beklemekten vazgeçtiği için iptal edildi!',
        payout: 0,
        tip: 0,
        reputationDelta: 0,
      };
    }

    if (order.delivered || order.status === 'delivered' || this.deliveredOrderIds.has(order.id)) {
      return {
        valid: false,
        reason: 'Bu sipariş zaten teslim edildi!',
        payout: 0,
        tip: 0,
        reputationDelta: 0,
      };
    }

    if (!held) {
      return {
        valid: false,
        reason: 'Elinizde teslim edilecek bir burger, patates kutusu veya sipariş tepsisi yok!',
        payout: 0,
        tip: 0,
        reputationDelta: 0,
      };
    }

    // Check if held item is burnt or undercooked
    if (
      held.type === 'patty_burnt' ||
      held.type === 'fries_burnt' ||
      held.type === 'fries_undercooked' ||
      held.type === 'fries_raw' ||
      held.layers?.includes('patty_burnt')
    ) {
      this.dayStats.failedDeliveries += 1;
      const repDelta = this.adjustReputation(-3);
      return {
        valid: false,
        reason: 'Yanmış veya çiğ ürün müşteriye teslim edilemez!',
        payout: 0,
        tip: 0,
        reputationDelta: repDelta,
      };
    }

    // Determine recipe in hand or on service tray
    const heldRecipe: RecipeId | null = resolveHeldItemRecipe(held);

    if (!heldRecipe) {
      this.dayStats.failedDeliveries += 1;
      const reason =
        held.type === 'service_tray' || held.type === 'order_tray'
          ? 'Servis tepsisinde tamamlanmış bir burger veya patates yok! Önce tepsiye ürün yerleştirin.'
          : 'Teslim edilen ürün tamamlanmış bir menü ürünü değil!';
      return {
        valid: false,
        reason,
        payout: 0,
        tip: 0,
        reputationDelta: 0,
      };
    }

    if (heldRecipe !== order.burger) {
      this.dayStats.failedDeliveries += 1;
      const repDelta = this.adjustReputation(-2);
      const expectedName = RECIPES[order.burger].name;
      const givenName = RECIPES[heldRecipe].name;
      return {
        valid: false,
        reason: `Yanlış ürün! ${order.customerName} ${expectedName} istedi, elinizdeki ${givenName}.`,
        payout: 0,
        tip: 0,
        reputationDelta: repDelta,
      };
    }

    // Check fries requirement (either standalone crispy_fries_solo or burger combo with wantsFries)
    const orderWantsFries = Boolean(order.wantsFries) || order.burger === 'crispy_fries_solo';
    const heldHasFries =
      Boolean(held.hasFries) ||
      held.type === 'fries_box' ||
      heldRecipe === 'crispy_fries_solo';

    if (orderWantsFries && !heldHasFries) {
      this.dayStats.failedDeliveries += 1;
      return {
        valid: false,
        reason: `Eksik ürün! ${order.customerName} siparişte Çıtır Patates Kızartması da istedi. Tepsiye patates ekleyin.`,
        payout: 0,
        tip: 0,
        reputationDelta: 0,
      };
    }

    if (!orderWantsFries && heldHasFries && order.burger !== 'crispy_fries_solo') {
      this.dayStats.failedDeliveries += 1;
      return {
        valid: false,
        reason: `Fazla ürün! ${order.customerName} patates kızartması istemedi.`,
        payout: 0,
        tip: 0,
        reputationDelta: 0,
      };
    }

    const heldHasSoda = Boolean(held.hasSoda);
    if (order.wantsSoda && !heldHasSoda) {
      this.dayStats.failedDeliveries += 1;
      return {
        valid: false,
        reason: `Eksik ürün! ${order.customerName} siparişte Gazlı İçecek de istedi. Tepsiye içecek ekleyin.`,
        payout: 0,
        tip: 0,
        reputationDelta: 0,
      };
    }

    if (!order.wantsSoda && heldHasSoda) {
      this.dayStats.failedDeliveries += 1;
      return {
        valid: false,
        reason: `Fazla ürün! ${order.customerName} içecek istemedi.`,
        payout: 0,
        tip: 0,
        reputationDelta: 0,
      };
    }

    // Calculate tip & reputation reward
    const tip = this.calculateTip(order);
    const patienceRatio =
      typeof order.patience === 'number' && typeof order.maxPatience === 'number' && order.maxPatience > 0
        ? order.patience / order.maxPatience
        : 0.8;
    const rawRepGain =
      (patienceRatio >= 0.65 ? 4 : patienceRatio >= 0.35 ? 3 : 2) +
      (this.decorUpgraded ? 1 : 0);
    const repDelta = this.adjustReputation(rawRepGain);

    // Mark delivered
    order.delivered = true;
    order.status = 'delivered';
    this.deliveredOrderIds.add(order.id);

    const totalPayout = order.totalPrice + tip;
    this.money += totalPayout;
    this.dayStats.totalSales += order.totalPrice;
    this.dayStats.tipIncome += tip;
    this.dayStats.ordersPrepared += 1;
    this.dayStats.successfulDeliveries += 1;

    const tipText = tip > 0 ? ` (+${tip} $ Bahşiş!)` : '';
    return {
      valid: true,
      reason: `${order.customerName} siparişi teslim edildi! +${order.totalPrice} $${tipText}`,
      payout: totalPayout,
      tip,
      reputationDelta: repDelta,
    };
  }

  getNetProfit(): number {
    return (
      this.dayStats.totalSales +
      this.dayStats.tipIncome -
      this.dayStats.supplyExpenses -
      this.dayStats.staffExpenses -
      this.dayStats.upgradeExpenses
    );
  }
}

/**
 * Evaluates independent status ('waiting' | 'preparing' | 'ready') for each active order.
 * Tracks 'preparing' per order ID via `startedOrderIds` so switching KDS selection never
 * resets an in-progress order back to 'waiting' or falsely marks an untouched order as 'preparing'.
 */
export function evaluateIndependentOrderStatuses(
  activeOrders: CustomerOrder[],
  selectedOrderId: string | null,
  heldItem: HeldItem | null,
  completedBoardRecipe: RecipeId | null,
  hasAssemblySoda: boolean,
  hasActiveKitchenWork: boolean,
  startedOrderIds?: ReadonlySet<string>,
  readySurfaceItems: readonly { recipe: RecipeId; hasFries?: boolean; hasSoda: boolean }[] = []
): string | null {
  if (activeOrders.length === 0) return null;

  const effectiveSelectedId =
    selectedOrderId && activeOrders.some((o) => o.id === selectedOrderId)
      ? selectedOrderId
      : activeOrders[0].id;

  const heldRecipe: RecipeId | null = resolveHeldItemRecipe(heldItem);
  const heldHasFries =
    Boolean(heldItem?.hasFries) ||
    heldItem?.type === 'fries_box' ||
    heldRecipe === 'crispy_fries_solo';

  let heldClaimed = false;
  let boardClaimed = false;
  const claimedSurfaceIndices = new Set<number>();

  const isOrderStarted = (orderId: string, isSelected: boolean): boolean => {
    if (startedOrderIds) {
      return startedOrderIds.has(orderId);
    }
    return isSelected && (hasActiveKitchenWork || heldItem !== null);
  };

  const doesHeldMatchOrder = (order: CustomerOrder): boolean => {
    const orderWantsFries = Boolean(order.wantsFries) || order.burger === 'crispy_fries_solo';
    return (
      heldRecipe === order.burger &&
      heldHasFries === orderWantsFries &&
      Boolean(heldItem?.hasSoda) === order.wantsSoda
    );
  };

  const findMatchingSurfaceIdx = (order: CustomerOrder): number => {
    const orderWantsFries = Boolean(order.wantsFries) || order.burger === 'crispy_fries_solo';
    for (let i = 0; i < readySurfaceItems.length; i++) {
      if (claimedSurfaceIndices.has(i)) continue;
      const s = readySurfaceItems[i];
      const surfaceHasFries = Boolean(s.hasFries) || s.recipe === 'crispy_fries_solo';
      if (
        s.recipe === order.burger &&
        surfaceHasFries === orderWantsFries &&
        s.hasSoda === order.wantsSoda
      ) {
        return i;
      }
    }
    return -1;
  };

  // Evaluate the selected order first so it has top priority for claiming a matching 'ready' burger
  const selectedOrder = activeOrders.find((o) => o.id === effectiveSelectedId);
  if (selectedOrder) {
    const orderWantsFries =
      Boolean(selectedOrder.wantsFries) || selectedOrder.burger === 'crispy_fries_solo';
    const matchesHeld = doesHeldMatchOrder(selectedOrder);
    const matchesBoard =
      completedBoardRecipe === selectedOrder.burger &&
      !orderWantsFries &&
      (!selectedOrder.wantsSoda || hasAssemblySoda);
    const surfaceIdx = findMatchingSurfaceIdx(selectedOrder);

    if (matchesHeld) {
      selectedOrder.status = 'ready';
      heldClaimed = true;
    } else if (matchesBoard) {
      selectedOrder.status = 'ready';
      boardClaimed = true;
    } else if (surfaceIdx !== -1) {
      selectedOrder.status = 'ready';
      claimedSurfaceIndices.add(surfaceIdx);
    } else if (isOrderStarted(selectedOrder.id, true)) {
      selectedOrder.status = 'preparing';
    } else {
      selectedOrder.status = 'waiting';
    }
  }

  // Evaluate remaining non-selected active orders independently by their own order.id
  for (const order of activeOrders) {
    if (order.id === effectiveSelectedId) continue;

    const orderWantsFries = Boolean(order.wantsFries) || order.burger === 'crispy_fries_solo';
    const matchesHeld = !heldClaimed && doesHeldMatchOrder(order);
    const matchesBoard =
      !boardClaimed &&
      completedBoardRecipe === order.burger &&
      !orderWantsFries &&
      (!order.wantsSoda || hasAssemblySoda);
    const surfaceIdx = findMatchingSurfaceIdx(order);

    if (matchesHeld) {
      order.status = 'ready';
      heldClaimed = true;
    } else if (matchesBoard) {
      order.status = 'ready';
      boardClaimed = true;
    } else if (surfaceIdx !== -1) {
      order.status = 'ready';
      claimedSurfaceIndices.add(surfaceIdx);
    } else if (isOrderStarted(order.id, false)) {
      order.status = 'preparing';
    } else {
      order.status = 'waiting';
    }
  }

  return effectiveSelectedId;
}
