import React, { useState } from 'react';
import {
  DailyFinanceRecord,
  DayStats,
  MenuPricingConfig,
  RECIPES,
  RecipeId,
  STAFF_CANDIDATES,
  StaffMemberState,
  StockInventory,
  StockKey,
  SUPPLY_CATALOG,
  SupplyCrateState,
  SupplyOrder,
  SupplyOrderItem,
} from '../core/GameConfig';
import {
  Monitor,
  LayoutDashboard,
  Truck,
  Users,
  UtensilsCrossed,
  TrendingUp,
  X,
  Package,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Minus,
  ShoppingCart,
  UserCheck,
  UserMinus,
  DollarSign,
  Award,
  Box,
} from 'lucide-react';

export type ManagementTabId =
  | 'dashboard'
  | 'supply'
  | 'staff'
  | 'menu'
  | 'finance';

interface ManagementComputerModalProps {
  money: number;
  day: number;
  reputation: number;
  stock: StockInventory;
  maxStockPerItem: number;
  unlockedRecipes: RecipeId[];
  menuPricing: MenuPricingConfig;
  cashierState: StaffMemberState;
  supplyOrders: SupplyOrder[];
  supplyCrates: SupplyCrateState[];
  dayStats: DayStats;
  financeHistory: DailyFinanceRecord[];
  onPlaceSupplyOrder: (items: SupplyOrderItem[]) => void;
  onHireCashier: () => void;
  onDismissCashier: () => void;
  onUpdateMenuPrice: (key: keyof MenuPricingConfig, newPrice: number) => void;
  onClose: () => void;
  initialTab?: ManagementTabId;
}

const STORAGE_BADGE_STYLES: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  dry: {
    label: 'Kuru Depo Rafı',
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
    border: 'border-amber-500/30',
  },
  packaging: {
    label: 'Ambalaj & Kuru Depo',
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
    border: 'border-amber-500/30',
  },
  cold: {
    label: 'Soğuk Hava Rafı (+4°C)',
    bg: 'bg-sky-500/10',
    text: 'text-sky-300',
    border: 'border-sky-500/30',
  },
  freezer: {
    label: 'Derin Dondurucu (-18°C)',
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-300',
    border: 'border-indigo-500/30',
  },
};

const AI_STATE_LABELS: Record<string, { label: string; color: string }> = {
  OFF_DUTY: { label: 'Görev Dışı', color: 'text-slate-400' },
  ARRIVING: { label: 'Restorana Giriyor...', color: 'text-sky-400' },
  WALKING_TO_POST: { label: 'Kasaya Yürüyor...', color: 'text-sky-400' },
  WAITING_FOR_CUSTOMER: {
    label: 'Kasada Müşteri Bekliyor',
    color: 'text-emerald-400',
  },
  TAKING_ORDER: {
    label: 'Müşteriden Sipariş Alıyor...',
    color: 'text-amber-400',
  },
  SENDING_TO_KDS: {
    label: 'Siparişi KDS Ekranına Aktarıyor...',
    color: 'text-emerald-300',
  },
  READY: { label: 'Kasada Hazır', color: 'text-emerald-400' },
};

export const ManagementComputerModal: React.FC<ManagementComputerModalProps> = ({
  money,
  day,
  reputation,
  stock,
  maxStockPerItem,
  unlockedRecipes,
  menuPricing,
  cashierState,
  supplyOrders,
  supplyCrates,
  dayStats,
  financeHistory,
  onPlaceSupplyOrder,
  onHireCashier,
  onDismissCashier,
  onUpdateMenuPrice,
  onClose,
  initialTab = 'dashboard',
}) => {
  const [activeTab, setActiveTab] = useState<ManagementTabId>(initialTab);
  const [cart, setCart] = useState<Record<StockKey, number>>({
    bun: 0,
    patty: 0,
    cheese: 0,
    lettuce: 0,
    soda: 0,
    fries: 0,
    packaging: 0,
  });

  const cartItems: SupplyOrderItem[] = (Object.keys(cart) as StockKey[])
    .filter((k) => cart[k] > 0)
    .map((k) => ({ key: k, packs: cart[k] }));

  const cartTotalCost = cartItems.reduce((sum, item) => {
    const def = SUPPLY_CATALOG[item.key];
    return sum + (def ? def.cost * item.packs : 0);
  }, 0);

  const cartTotalCrates = cartItems.reduce((sum, item) => sum + item.packs, 0);
  const canAffordCart = cartTotalCost > 0 && money >= cartTotalCost;


  const adjustCart = (key: StockKey, delta: number) => {
    setCart((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(8, (prev[key] || 0) + delta)),
    }));
  };

  const handleConfirmSupplyOrder = () => {
    if (!canAffordCart || cartItems.length === 0) return;
    onPlaceSupplyOrder(cartItems);
    setCart({
      bun: 0,
      patty: 0,
      cheese: 0,
      lettuce: 0,
      soda: 0,
      fries: 0,
      packaging: 0,
    });
  };

  const activeSupplyOrders = supplyOrders.filter(
    (o) => o.status !== 'unloaded'
  );
  const unshelvedCrates = supplyCrates.filter((c) => !c.shelved);

  const totalRevenueToday =
    (dayStats.totalSales ?? 0) + (dayStats.tipIncome ?? 0);
  const totalExpensesToday =
    (dayStats.supplyExpenses ?? 0) +
    (dayStats.staffExpenses ?? 0) +
    (dayStats.upgradeExpenses ?? 0);
  const netProfitToday = totalRevenueToday - totalExpensesToday;

  const candidate = STAFF_CANDIDATES[0];

  return (
    <div
      data-testid="management-pc-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 pointer-events-auto"
    >
      <div className="w-full max-w-5xl h-[86vh] max-h-[760px] bg-slate-950 border border-slate-700/80 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Desktop OS Window Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-bold text-base tracking-wide text-white">
                  BURGER DISTRICT OS v3.2 — İŞLETME YÖNETİM TERMİNALİ
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded">
                  GÜN {day}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tedarik Zinciri • Personel Yapay Zekâsı • Menü Fiyatlandırma • Finansal Muhasebe
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-slate-950/90 border border-slate-800 px-3.5 py-1.5 rounded-lg flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Kasa:
              </span>
              <span
                data-testid="mgmt-money-display"
                className="font-mono font-bold text-base text-emerald-400"
              >
                ${money}
              </span>
            </div>

            <div className="bg-slate-950/90 border border-slate-800 px-3.5 py-1.5 rounded-lg flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                İtibar:
              </span>
              <span className="font-mono font-bold text-sm text-amber-400">
                ★ %{reputation}
              </span>
            </div>

            <button
              data-testid="mgmt-close-btn"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
              Kapat [ESC]
            </button>
          </div>
        </div>

        {/* Main Body: Left Navigation Sidebar + Right Content Area */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar Navigation */}
          <div className="w-60 bg-slate-900/70 border-r border-slate-800/90 p-3 flex flex-col justify-between shrink-0">
            <div className="space-y-1.5">
              <button
                data-testid="mgmt-tab-dashboard"
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>Genel Bakış (Dashboard)</span>
              </button>

              <button
                data-testid="mgmt-tab-supply"
                onClick={() => setActiveTab('supply')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'supply'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Truck className="w-4 h-4 shrink-0" />
                  <span>Tedarik & Sevkiyat</span>
                </div>
                {(activeSupplyOrders.length > 0 || unshelvedCrates.length > 0) && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded ${
                      activeTab === 'supply'
                        ? 'bg-slate-950 text-amber-400'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {activeSupplyOrders.length + unshelvedCrates.length}
                  </span>
                )}
              </button>

              <button
                data-testid="mgmt-tab-staff"
                onClick={() => setActiveTab('staff')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'staff'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Personel Yönetimi</span>
                </div>
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded ${
                    cashierState.hired
                      ? activeTab === 'staff'
                        ? 'bg-slate-950 text-emerald-400'
                        : 'bg-emerald-500/20 text-emerald-300'
                      : activeTab === 'staff'
                      ? 'bg-slate-950 text-slate-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {cashierState.hired ? '1 Aktif' : '0'}
                </span>
              </button>

              <button
                data-testid="mgmt-tab-menu"
                onClick={() => setActiveTab('menu')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'menu'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <UtensilsCrossed className="w-4 h-4 shrink-0" />
                <span>Menü & Fiyatlandırma</span>
              </button>

              <button
                data-testid="mgmt-tab-finance"
                onClick={() => setActiveTab('finance')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'finance'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <TrendingUp className="w-4 h-4 shrink-0" />
                <span>Finansal Rapor</span>
              </button>
            </div>

            {/* Bottom Operational Summary */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 space-y-2 text-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Operasyonel Durum
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Kasiyer:</span>
                <span
                  className={
                    cashierState.hired ? 'text-emerald-400 font-semibold' : 'text-slate-500'
                  }
                >
                  {cashierState.hired ? 'Elif Demir (Aktif)' : 'Yok'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Bekleyen Koli:</span>
                <span
                  className={
                    unshelvedCrates.length > 0
                      ? 'text-amber-400 font-semibold'
                      : 'text-slate-500'
                  }
                >
                  {unshelvedCrates.length} adet
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Bugünkü Net:</span>
                <span
                  className={`font-mono font-bold ${
                    netProfitToday >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {netProfitToday >= 0 ? `+$${netProfitToday}` : `-$${Math.abs(netProfitToday)}`}
                </span>
              </div>
            </div>
          </div>

          {/* Right Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
            {/* TAB 1: DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Restoran Genel Bakış — Gün {day}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Canlı performans göstergeleri, stok uyarıları, aktif personel ve sevkiyat durumu.
                  </p>
                </div>

                {/* Top 4 KPI Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Kasa Bakiyesi</span>
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-mono font-bold text-emerald-400 mt-2">
                      ${money}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Kullanılabilir işletme sermayesi
                    </div>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Bugünkü Toplam Gelir</span>
                      <TrendingUp className="w-4 h-4 text-sky-400" />
                    </div>
                    <div className="text-2xl font-mono font-bold text-sky-400 mt-2">
                      ${totalRevenueToday}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Satış: ${dayStats.totalSales ?? 0} • Bahşiş: ${dayStats.tipIncome ?? 0}
                    </div>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Günlük Net Kâr</span>
                      <Award className="w-4 h-4 text-amber-400" />
                    </div>
                    <div
                      className={`text-2xl font-mono font-bold mt-2 ${
                        netProfitToday >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {netProfitToday >= 0
                        ? `+$${netProfitToday}`
                        : `-$${Math.abs(netProfitToday)}`}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Toplam Gider: ${totalExpensesToday}
                    </div>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Müşteri İtibarı</span>
                      <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-mono font-bold text-amber-400 mt-2">
                      %{reputation}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Teslim: {dayStats.ordersPrepared ?? 0} • Kaçan: {dayStats.lostCustomers ?? 0}
                    </div>
                  </div>
                </div>

                {/* Live Stock Overview & Quick Actions */}
                <div className="grid grid-cols-2 gap-5">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Package className="w-4 h-4 text-amber-400" />
                        Depo Stok Durumu (Maks: {maxStockPerItem})
                      </h4>
                      <button
                        onClick={() => setActiveTab('supply')}
                        className="text-xs font-semibold text-amber-400 hover:text-amber-300 cursor-pointer"
                      >
                        Tedarik Siparişi Ver →
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(Object.keys(SUPPLY_CATALOG) as StockKey[]).map((key) => {
                        const def = SUPPLY_CATALOG[key];
                        const count = stock[key] ?? 0;
                        const ratio = Math.min(1, count / maxStockPerItem);
                        const isLow = count <= 4;
                        return (
                          <div key={key} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-300 font-medium">
                                {def.label}
                              </span>
                              <span
                                className={`font-mono font-bold ${
                                  isLow ? 'text-rose-400' : 'text-slate-200'
                                }`}
                              >
                                {count} / {maxStockPerItem}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isLow
                                    ? 'bg-rose-500'
                                    : ratio > 0.5
                                    ? 'bg-emerald-500'
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.max(4, ratio * 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Staff & Delivery Status */}
                  <div className="space-y-4">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <Users className="w-4 h-4 text-sky-400" />
                          Personel Durumu
                        </h4>
                        <button
                          onClick={() => setActiveTab('staff')}
                          className="text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                        >
                          Personel Sekmesi →
                        </button>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-white">
                            {candidate.name} — Kasiyer
                          </div>
                          <div
                            className={`text-[11px] font-medium mt-0.5 ${
                              AI_STATE_LABELS[cashierState.aiState]?.color ||
                              'text-slate-400'
                            }`}
                          >
                            Durum:{' '}
                            {AI_STATE_LABELS[cashierState.aiState]?.label ||
                              cashierState.aiState}
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                            cashierState.hired
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {cashierState.hired
                            ? `Aktif ($${cashierState.dailyWage}/gün)`
                            : 'İşe Alınmadı'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <Truck className="w-4 h-4 text-amber-400" />
                          Lojistik & Sevkiyat Alanı
                        </h4>
                        <span className="text-xs font-mono text-slate-400">
                          Doğu Depo Paleti
                        </span>
                      </div>

                      {activeSupplyOrders.length === 0 &&
                      unshelvedCrates.length === 0 ? (
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400">
                          Şu anda yolda olan sevkiyat veya palet üzerinde bekleyen koli bulunmuyor.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {activeSupplyOrders.map((ord) => (
                            <div
                              key={ord.id}
                              className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs"
                            >
                              <span className="text-amber-200 font-semibold">
                                Sevkiyat #{ord.id.slice(-4)} ({ord.items.length} kalem)
                              </span>
                              <span className="font-mono font-bold text-amber-300">
                                {ord.status === 'in_transit'
                                  ? `Kamyon Yolda: ${Math.ceil(ord.remainingSeconds)} sn`
                                  : 'Teslimat Alanında!'}
                              </span>
                            </div>
                          ))}
                          {unshelvedCrates.length > 0 && (
                            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200">
                              Teslimat paletinde{' '}
                              <span className="font-bold">
                                {unshelvedCrates.length} adet fiziksel koli
                              </span>{' '}
                              bekliyor. Kolileri alıp [F] ile açarak uygun depo rafına yerleştirin.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SUPPLY CHAIN (TEDARİK & SEVKİYAT) */}
            {activeTab === 'supply' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Supply Chain 3.0 — Toptan Malzeme Tedariki
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Sipariş edilen malzemeler ticari sevkiyat kamyonuyla gelir ve teslimat paletine fiziksel 3D koli olarak indirilir. Stok yalnızca açılan koliler ilgili depo rafına yerleştirildiğinde artar.
                    </p>
                  </div>
                </div>

                {/* Active Delivery Banner */}
                {(activeSupplyOrders.length > 0 || unshelvedCrates.length > 0) && (
                  <div
                    data-testid="supply-delivery-status"
                    className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Truck className="w-5 h-5 text-amber-400 shrink-0" />
                      <div className="text-xs">
                        {activeSupplyOrders.map((ord) => (
                          <div key={ord.id} className="font-semibold text-amber-200">
                            Sevkiyat #{ord.id.slice(-4)}:{' '}
                            {ord.status === 'in_transit'
                              ? `Tedarik Kamyonu Yolda (${Math.ceil(ord.remainingSeconds)} sn kaldı)`
                              : 'Kamyon Yanaştı — Koliler Teslimat Paletine İndirildi!'}
                          </div>
                        ))}
                        {unshelvedCrates.length > 0 && (
                          <div className="text-emerald-300 font-medium mt-0.5">
                            Teslimat paletinde {unshelvedCrates.length} adet koli raf yerleşimi bekliyor (Koliyi Al → [F] ile Aç → Uygun Depo Rafına Yerleştir).
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Catalog Grid */}
                <div className="grid grid-cols-2 gap-3.5">
                  {(Object.keys(SUPPLY_CATALOG) as StockKey[]).map((key) => {
                    const def = SUPPLY_CATALOG[key];
                    const badge =
                      STORAGE_BADGE_STYLES[def.storageCategory] ||
                      STORAGE_BADGE_STYLES.dry;
                    const currentStock = stock[key] ?? 0;
                    const inCartPacks = cart[key] ?? 0;

                    return (
                      <div
                        key={key}
                        data-testid={`supply-card-${key}`}
                        className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">
                                {def.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {def.storageConditionLabel}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded border shrink-0 ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {badge.label}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                          <div className="text-xs space-y-0.5">
                            <div className="text-slate-300">
                              Koli İçeriği:{' '}
                              <span className="font-mono font-bold text-white">
                                +{def.amount} adet
                              </span>{' '}
                              • Fiyat:{' '}
                              <span className="font-mono font-bold text-emerald-400">
                                ${def.cost}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Mevcut Raf Stoğu:{' '}
                              <span className="font-mono font-semibold text-slate-200">
                                {currentStock} / {maxStockPerItem}
                              </span>
                            </div>
                          </div>


                          <div className="flex items-center gap-2">
                            <button
                              data-testid={`supply-minus-${key}`}
                              onClick={() => adjustCart(key, -1)}
                              disabled={inCartPacks <= 0}
                              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 flex items-center justify-center text-slate-200 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span
                              data-testid={`supply-qty-${key}`}
                              className="w-7 text-center font-mono font-bold text-sm text-amber-400"
                            >
                              {inCartPacks}
                            </span>
                            <button
                              data-testid={`supply-plus-${key}`}
                              onClick={() => adjustCart(key, 1)}
                              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Checkout Bar */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        Sevkiyat Sepeti: {cartTotalCrates} Koli
                      </div>
                      <div className="text-xs text-slate-400">
                        Toplam Tutar:{' '}
                        <span className="font-mono font-bold text-emerald-400">
                          ${cartTotalCost}
                        </span>
                        {cartTotalCost > money && (
                          <span className="text-rose-400 font-semibold ml-2">
                            (Yetersiz Bakiye!)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    data-testid="supply-confirm-order-btn"
                    onClick={handleConfirmSupplyOrder}
                    disabled={!canAffordCart}
                    className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs transition flex items-center gap-2 cursor-pointer"
                  >
                    <Box className="w-4 h-4" />
                    Siparişi Onayla & Kamyon Gönder (${cartTotalCost})
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: STAFF MANAGEMENT (PERSONEL YÖNETİMİ) */}
            {activeTab === 'staff' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Personel Yönetimi & 3D Kasiyer Yapay Zekâsı
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    İşe alınan kasiyer fiziksel olarak kasa arkasına geçer, sıradaki müşterilerin siparişlerini otomatik alır ve KDS ekranına düşürür. Gün sonunda maaşı otomatik ödenir.
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-start justify-between gap-6">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-300 font-bold text-lg">
                        ED
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h4 className="font-bold text-base text-white">
                            {candidate.name}
                          </h4>
                          <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded">
                            Kıdemli Kasa Operatörü
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {candidate.bio}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                        <div className="text-[11px] text-slate-400">
                          Sipariş Alma Hızı
                        </div>
                        <div className="text-sm font-mono font-bold text-sky-400 mt-0.5">
                          {candidate.orderSpeedSeconds} sn / müşteri
                        </div>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                        <div className="text-[11px] text-slate-400">
                          İşe Alım Ücreti (Tek Sefer)
                        </div>
                        <div className="text-sm font-mono font-bold text-amber-400 mt-0.5">
                          ${candidate.hireFee}
                        </div>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                        <div className="text-[11px] text-slate-400">
                          Günlük Maaş (Gün Sonu)
                        </div>
                        <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
                          ${candidate.dailyWage} / gün
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">
                        Canlı 3D AI Durumu:
                      </span>
                      <span
                        data-testid="staff-ai-state"
                        className={`font-mono font-bold ${
                          AI_STATE_LABELS[cashierState.aiState]?.color ||
                          'text-slate-300'
                        }`}
                      >
                        {AI_STATE_LABELS[cashierState.aiState]?.label ||
                          cashierState.aiState}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between gap-3 shrink-0">
                    {!cashierState.hired ? (
                      <button
                        data-testid="hire-cashier-btn"
                        onClick={onHireCashier}
                        disabled={money < candidate.hireFee}
                        className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs flex items-center gap-2 transition cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4" />
                        İşe Al (${candidate.hireFee})
                      </button>
                    ) : (
                      <button
                        data-testid="dismiss-cashier-btn"
                        onClick={onDismissCashier}
                        className="px-5 py-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs flex items-center gap-2 transition cursor-pointer"
                      >
                        <UserMinus className="w-4 h-4" />
                        İşten Çıkar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: MENU & PRICING (MENÜ & FİYATLANDIRMA) */}
            {activeTab === 'menu' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Menü Yönetimi & Dinamik Fiyatlandırma
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Açık tariflerin, çıtır patates porsiyonunun ve kombo yan ürünlerinin satış fiyatlarını ve tahmini kâr marjlarını yönetin.
                  </p>
                </div>

                <div className="space-y-3">
                  {(
                    [
                      {
                        key: 'classic_burger' as const,
                        label: RECIPES.classic_burger.label,
                        desc: 'Alt Ekmek + Pişmiş Köfte + Marul + Üst Ekmek',
                        unitCost: 18,
                        unlocked: unlockedRecipes.includes('classic_burger'),
                      },
                      {
                        key: 'cheeseburger' as const,
                        label: RECIPES.cheeseburger.label,
                        desc: 'Alt Ekmek + Pişmiş Köfte + Cheddar + Marul + Üst Ekmek',
                        unitCost: 23,
                        unlocked: unlockedRecipes.includes('cheeseburger'),
                      },
                      {
                        key: 'double_smash' as const,
                        label: RECIPES.double_smash.label,
                        desc: 'Alt Ekmek + 2x Pişmiş Köfte + Cheddar + Üst Ekmek',
                        unitCost: 34,
                        unlocked: unlockedRecipes.includes('double_smash'),
                      },
                      {
                        key: 'crispy_fries_solo' as const,
                        label: RECIPES.crispy_fries_solo.label,
                        desc: 'Fritözde İdeal Pişmiş Çıtır Patates Kutusu',
                        unitCost: 8,
                        unlocked: true,
                      },
                      {
                        key: 'friesAddon' as const,
                        label: 'Kombo Yan Ürün: + Çıtır Patates Kızartması',
                        desc: 'Burger siparişlerinin yanına eklenen patates farkı',
                        unitCost: 8,
                        unlocked: true,
                      },
                      {
                        key: 'sodaAddon' as const,
                        label: 'Kombo Yan Ürün: + Soğuk Gazlı İçecek',
                        desc: 'Siparişlerin yanına eklenen soğuk içecek farkı',
                        unitCost: 6,
                        unlocked: true,
                      },
                    ] as const
                  ).map((item) => {
                    const currentPrice = menuPricing[item.key];
                    const profit = currentPrice - item.unitCost;
                    const marginPct =
                      currentPrice > 0
                        ? Math.round((profit / currentPrice) * 100)
                        : 0;

                    return (
                      <div
                        key={item.key}
                        data-testid={`menu-price-row-${item.key}`}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">
                              {item.label}
                            </span>
                            {!item.unlocked && (
                              <span className="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-400 rounded">
                                Kilitli Tarif (Kasa Yükseltmesi Gerekir)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {item.desc} • Birim Maliyet:{' '}
                            <span className="font-mono text-slate-200">
                              ${item.unitCost}
                            </span>{' '}
                            • Net Kâr:{' '}
                            <span className="font-mono text-emerald-400 font-semibold">
                              +${profit} (%{marginPct})
                            </span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            data-testid={`menu-minus-${item.key}`}
                            onClick={() =>
                              onUpdateMenuPrice(item.key, currentPrice - 2)
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-slate-200 cursor-pointer"
                          >
                            -$2
                          </button>
                          <span
                            data-testid={`menu-val-${item.key}`}
                            className="w-16 text-center font-mono font-bold text-base text-amber-400"
                          >
                            ${currentPrice}
                          </span>
                          <button
                            data-testid={`menu-plus-${item.key}`}
                            onClick={() =>
                              onUpdateMenuPrice(item.key, currentPrice + 2)
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-slate-200 cursor-pointer"
                          >
                            +$2
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 5: FINANCE (FİNANSAL RAPOR) */}
            {activeTab === 'finance' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Finansal Muhasebe & Günlük Karşılaştırma
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Günlük satış gelirleri, bahşişler, malzeme tedarik giderleri, personel maaş ödemeleri ve net kâr tablosu.
                  </p>
                </div>

                {/* Today Breakdown */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Bugünkü Gelir Kalemleri
                    </div>
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>Sipariş Satış Geliri:</span>
                      <span className="font-mono font-bold text-white">
                        +${dayStats.totalSales ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>Bahşiş & Temizlik Primi:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        +${dayStats.tipIncome ?? 0}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex justify-between text-xs font-bold">
                      <span>Toplam Brüt Gelir:</span>
                      <span className="font-mono text-emerald-400">
                        +${totalRevenueToday}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-rose-400">
                      Bugünkü Gider Kalemleri
                    </div>
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>Tedarik & Koli Gideri:</span>
                      <span className="font-mono font-bold text-rose-300">
                        -${dayStats.supplyExpenses ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>Personel Ücret & Maaş:</span>
                      <span className="font-mono font-bold text-rose-300">
                        -${dayStats.staffExpenses ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>Ekipman & Yükseltme:</span>
                      <span className="font-mono font-bold text-rose-300">
                        -${dayStats.upgradeExpenses ?? 0}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex justify-between text-xs font-bold">
                      <span>Toplam Gider:</span>
                      <span className="font-mono text-rose-400">
                        -${totalExpensesToday}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        Gün {day} Net Bilanço
                      </div>
                      <div
                        data-testid="finance-net-profit"
                        className={`text-3xl font-mono font-bold mt-3 ${
                          netProfitToday >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {netProfitToday >= 0
                          ? `+$${netProfitToday}`
                          : `-$${Math.abs(netProfitToday)}`}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {cashierState.hired
                        ? `Not: Gün sonunda Kasiyer maaşı ($${cashierState.dailyWage}) kasadan otomatik tahsil edilir.`
                        : 'Aktif maaşlı personel bulunmuyor.'}
                    </div>
                  </div>
                </div>

                {/* Historical Ledger Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800 text-xs font-bold text-white">
                    Geçmiş Günler Finansal Karşılaştırma Tablosu
                  </div>
                  {financeHistory.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Henüz tamamlanmış geçmiş gün kaydı bulunmuyor. İlk iş gününü tamamladığınızda geçmiş bilançolar burada listelenir.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-4">Gün</th>
                          <th className="py-2.5 px-4">Satış</th>
                          <th className="py-2.5 px-4">Bahşiş</th>
                          <th className="py-2.5 px-4">Tedarik Gideri</th>
                          <th className="py-2.5 px-4">Personel Maaş</th>
                          <th className="py-2.5 px-4">Net Kâr</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {financeHistory.map((rec) => (
                          <tr key={rec.day}>
                            <td className="py-2.5 px-4 font-mono font-bold text-white">
                              Gün {rec.day}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-emerald-300">
                              +${rec.totalSales}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-emerald-300">
                              +${rec.tipIncome}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-rose-300">
                              -${rec.supplyExpenses}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-rose-300">
                              -${rec.staffExpenses}
                            </td>
                            <td
                              className={`py-2.5 px-4 font-mono font-bold ${
                                rec.netProfit >= 0
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {rec.netProfit >= 0
                                ? `+$${rec.netProfit}`
                                : `-$${Math.abs(rec.netProfit)}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
