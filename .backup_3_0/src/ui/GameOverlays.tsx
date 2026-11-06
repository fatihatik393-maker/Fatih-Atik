import React, { useState } from 'react';
import { GameEngine, GameHUDState } from '../core/GameEngine';
import { GAME_CONFIG, RECIPES, RecipeId, StockKey } from '../core/GameConfig';
import { HandbookModal } from './HandbookModal';

interface GameOverlaysProps {
  hud: GameHUDState;
  engineRef: React.MutableRefObject<GameEngine | null>;
}

const STATUS_BADGE: Record<
  string,
  { label: string; colorClass: string; dotClass: string }
> = {
  waiting: {
    label: 'BEKLİYOR',
    colorClass: 'bg-stone-800/95 text-stone-300 border-stone-600/60',
    dotClass: 'bg-stone-400',
  },
  preparing: {
    label: 'HAZIRLANIYOR',
    colorClass: 'bg-amber-950/95 text-amber-300 border-amber-500/50',
    dotClass: 'bg-amber-400',
  },
  ready: {
    label: 'TESLİME HAZIR!',
    colorClass: 'bg-emerald-950/95 text-emerald-300 border-emerald-500/60',
    dotClass: 'bg-emerald-400',
  },
};

export const GameOverlays: React.FC<GameOverlaysProps> = ({ hud, engineRef }) => {
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTabOrders, setShowTabOrders] = useState(false);

  // Listen for TAB key to toggle expanded KDS order & recipe screen
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Tab' && hud.mode === 'playing') {
        e.preventDefault();
        setShowTabOrders((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hud.mode]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // 1. TITLE SCREEN (ANA MENÜ — v2.8 AAA SIMULATION OVERHAUL)
  if (hud.mode === 'title') {
    return (
      <div className="fixed inset-0 z-20 flex flex-col justify-between p-10 pointer-events-none bg-gradient-to-r from-stone-950/90 via-stone-950/55 to-transparent">
        {/* Top-left Brand Lockup & Card */}
        <div className="max-w-xl pointer-events-auto mt-4 ml-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-500/15 border border-amber-400/35 text-amber-300 text-[11px] font-semibold tracking-widest uppercase mb-4">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Birinci Şahıs 3D Restoran Simülasyonu · v2.8</span>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <svg
              viewBox="0 0 64 64"
              className="w-16 h-16 shrink-0 drop-shadow-lg"
              aria-hidden="true"
            >
              <rect
                x="4"
                y="4"
                width="56"
                height="56"
                rx="14"
                fill="#0c0a09"
                stroke="#f59e0b"
                strokeWidth="2.5"
              />
              <path d="M16 28 C16 17, 48 17, 48 28 Z" fill="#f59e0b" />
              <circle cx="26" cy="22" r="1.5" fill="#fef3c7" />
              <circle cx="32" cy="20" r="1.5" fill="#fef3c7" />
              <circle cx="38" cy="22" r="1.5" fill="#fef3c7" />
              <path d="M14 31 L50 31 L46 35 L32 33 L18 35 Z" fill="#4ade80" />
              <rect x="15" y="35" width="34" height="7" rx="3.5" fill="#78350f" />
              <rect x="17" y="44" width="30" height="7" rx="3" fill="#d97706" />
            </svg>
            <div>
              <h1 className="font-display text-5xl font-extrabold tracking-tight text-stone-50 leading-none drop-shadow">
                BURGER DISTRICT
              </h1>
              <p className="text-xs font-medium tracking-wider text-amber-300/90 uppercase mt-1.5">
                Artisan Kitchen · Canlı Salon · Smart Placement &amp; Soğuk Depo
              </p>
            </div>
          </div>

          <p className="text-stone-200/95 text-sm leading-relaxed mb-7 max-w-md drop-shadow-sm">
            Modern endüstriyel mutfağın başına geçin, tezgâhların istediğiniz noktasına
            serbestçe yerleştirme yapın, servis tepsileriyle sunum hazırlayın ve yaşayan
            restoranınızın her detayını yönetin.
          </p>

          {/* Menu Actions */}
          <div className="flex flex-col gap-2.5 w-80 bg-stone-950/90 border border-white/10 p-4 rounded-2xl shadow-2xl">
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                engineRef.current?.startNewGame();
              }}
              className="w-full py-3.5 px-5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-base rounded-xl shadow-lg transition-all duration-150 active:scale-98 text-left flex items-center justify-between cursor-pointer"
            >
              <span>Yeni Oyun Başlat</span>
              <span className="text-xs font-mono-num font-extrabold px-2 py-0.5 rounded bg-stone-950/20">
                GÜN 1
              </span>
            </button>

            <button
              type="button"
              disabled={!hud.hasSavedGame}
              onClick={(e) => {
                e.currentTarget.blur();
                engineRef.current?.continueSavedGame();
              }}
              className={`w-full py-3 px-5 font-display font-semibold text-sm rounded-xl border transition-all duration-150 text-left flex items-center justify-between ${
                hud.hasSavedGame
                  ? 'bg-stone-900/90 hover:bg-stone-800 text-stone-100 border-white/15 cursor-pointer'
                  : 'bg-stone-900/35 text-stone-600 border-white/5 cursor-not-allowed'
              }`}
            >
              <span>Kayıtlı Oyuna Devam Et</span>
              {hud.hasSavedGame && (
                <span className="text-xs font-mono-num text-amber-400 font-bold">
                  GÜN {hud.day} · {hud.money} $
                </span>
              )}
            </button>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  engineRef.current?.audio.playMenuClick();
                  setShowSettingsModal(true);
                }}
                className="py-2.5 px-4 bg-stone-900/80 hover:bg-stone-800 text-stone-200 font-display font-semibold text-xs rounded-xl border border-white/10 transition-colors text-center cursor-pointer"
              >
                Ayarlar
              </button>

              <button
                type="button"
                onClick={() => {
                  engineRef.current?.audio.playMenuClick();
                  engineRef.current?.showToast(
                    'İlerleme durumunuz her gün sonunda otomatik kaydedilir.',
                    'info'
                  );
                }}
                className="py-2.5 px-4 bg-stone-900/50 hover:bg-stone-800/80 text-stone-400 hover:text-stone-200 font-display font-medium text-xs rounded-xl border border-white/10 transition-colors text-center cursor-pointer"
              >
                Kayıt Bilgisi
              </button>
            </div>
          </div>

          {hud.toastMessage && (
            <div className="mt-4 p-3 rounded-xl bg-stone-950/92 border border-amber-500/40 text-amber-200 text-xs font-medium max-w-xs">
              {hud.toastMessage.text}
            </div>
          )}
        </div>

        {/* Bottom Control Legend Bar */}
        <div className="ml-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-300/90 bg-stone-950/88 border border-white/10 px-4 py-2 rounded-xl w-fit">
          <span>
            <strong className="text-amber-400 font-mono-num">WASD</strong> Hareket
          </span>
          <span>·</span>
          <span>
            <strong className="text-amber-400 font-mono-num">E / Sol Tık</strong> Yüzeye Bırak / Masa Topla
          </span>
          <span>·</span>
          <span>
            <strong className="text-amber-400 font-mono-num">R</strong> 45° Döndür
          </span>
          <span>·</span>
          <span>
            <strong className="text-amber-400 font-mono-num">F1</strong> Rehber Kitapçık
          </span>
          <span>·</span>
          <span>
            <strong className="text-amber-400 font-mono-num">TAB</strong> KDS Detay
          </span>
        </div>

        {showSettingsModal && (
          <SettingsModal
            hud={hud}
            engineRef={engineRef}
            onClose={() => setShowSettingsModal(false)}
          />
        )}
      </div>
    );
  }

  // 2. CLEAN HUD 3.0 SHELL (PLAYING / POS / HANDBOOK / PAUSE / DAY SUMMARY)
  const activeCookingCount = hud.grillSlots.filter((s) => s.state !== 'empty').length;
  const selectedOrder =
    hud.activeOrders.find((o) => o.id === hud.selectedOrderId) ||
    hud.activeOrders[0] ||
    null;

  const isReticleVisible =
    hud.mode === 'playing' && !showTabOrders && !showSettingsModal;
  const isHoveringTarget = Boolean(hud.interactionPrompt);

  // Stock bar only appears contextually when looking at an ingredient/soda station OR when any stock is critical (<=3)
  const hasCriticalStock =
    hud.stock.bun <= 3 ||
    hud.stock.patty <= 3 ||
    hud.stock.cheese <= 3 ||
    hud.stock.lettuce <= 3 ||
    hud.stock.soda <= 3;
  const showContextualStockBar = hud.isLookingAtStockStation || hasCriticalStock;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3.5 select-none">
      {/* TOP BAR: COMPACT TOP-LEFT STATUS PILL + COMPACT TOP-RIGHT KDS & UTILITY */}
      <div className="flex items-start justify-between gap-3">
        {/* TOP-LEFT: Ultra-Compact Single-Row Restaurant Status Pill */}
        <div className="flex flex-col gap-1.5 items-start">
          <div className="flex items-center gap-2.5 bg-stone-950/88 border border-white/10 rounded-xl px-3 py-1.5 shadow-lg pointer-events-auto">
            {/* Money */}
            <div
              data-testid="hud-money"
              className="font-mono-num text-base font-extrabold text-amber-400 leading-none"
            >
              {Math.round(hud.money)} $
            </div>

            <div className="h-4 w-px bg-white/10" />

            {/* Day & Phase */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-200">
                GÜN {hud.day}
              </span>
              <span
                data-testid="hud-day-phase"
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                  !hud.shopOpen
                    ? 'bg-stone-800 text-stone-300 border-stone-600/50'
                    : hud.dayPhase === 'rush_hour'
                    ? 'bg-red-950 text-red-300 border-red-500/60'
                    : hud.dayPhase === 'closing'
                    ? 'bg-orange-950 text-orange-300 border-orange-500/50'
                    : 'bg-amber-950 text-amber-300 border-amber-500/40'
                }`}
              >
                {hud.shopOpen ? hud.dayPhaseLabel : 'HAZIRLIK'}
              </span>
            </div>

            {/* Clock */}
            <div className="font-mono-num text-sm font-bold text-stone-100 leading-none">
              {formatTime(hud.timeRemaining)}
            </div>

            <div className="h-4 w-px bg-white/10" />

            {/* Reputation */}
            <div
              data-testid="hud-reputation"
              className="font-mono-num text-xs font-bold text-emerald-400 flex items-center gap-0.5 leading-none"
            >
              <span>★</span>
              <span>%{Math.round(hud.reputation)}</span>
            </div>

            {/* Seated Diners Badge (Only when customers are seated at tables) */}
            {hud.seatedCustomerCount > 0 && (
              <>
                <div className="h-4 w-px bg-white/10" />
                <div
                  data-testid="hud-seated-count"
                  className="text-[10px] font-mono-num font-bold px-1.5 py-0.5 rounded-md bg-sky-950/90 text-sky-300 border border-sky-500/40"
                >
                  Masada: {hud.seatedCustomerCount}
                </div>
              </>
            )}

            {/* Dirty Tables Badge (Only when tables need bussing) */}
            {hud.dirtyTableCount > 0 && (
              <>
                <div className="h-4 w-px bg-white/10" />
                <div
                  data-testid="hud-dirty-tables"
                  className="text-[10px] font-mono-num font-bold px-1.5 py-0.5 rounded-md bg-amber-950/95 text-amber-300 border border-amber-500/60"
                >
                  Kirli Masa: {hud.dirtyTableCount}
                </div>
              </>
            )}

            {/* Contextual Open Shop CTA or Compact POS Button */}
            {!hud.shopOpen && (
              <>
                <div className="h-4 w-px bg-white/10" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.openShopForDay();
                  }}
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-display font-bold text-[11px] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  Dükkânı Aç [O]
                </button>
              </>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                engineRef.current?.setMode('pos_modal');
              }}
              className="px-2 py-1 bg-stone-800/90 hover:bg-stone-700 text-stone-200 font-display font-semibold text-[11px] rounded-lg border border-white/10 transition-colors cursor-pointer whitespace-nowrap"
            >
              Kasa
            </button>
          </div>

          {/* Compact Live Grill Strip ONLY when patties are actively on the grill */}
          {activeCookingCount > 0 && (
            <div className="flex items-center gap-1.5 bg-stone-950/88 border border-white/10 rounded-xl px-2.5 py-1 shadow-md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                IZGARA
              </span>
              {hud.grillSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center gap-1 text-[10px] font-mono-num px-1.5 py-0.5 rounded bg-stone-900 border border-white/5"
                >
                  <span className="text-stone-400">#{slot.id + 1}</span>
                  <span
                    className={
                      slot.state === 'empty'
                        ? 'text-stone-500'
                        : slot.state === 'cooking'
                        ? 'text-amber-400 font-bold'
                        : slot.state === 'cooked'
                        ? 'text-emerald-400 font-bold'
                        : 'text-red-400 font-bold'
                    }
                  >
                    {slot.state === 'empty'
                      ? 'Boş'
                      : slot.state === 'cooking'
                      ? `%${Math.round(slot.progress * 100)}`
                      : slot.state === 'cooked'
                      ? 'PİŞTİ'
                      : 'YANDI'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TOP-RIGHT: Compact Utility Bar + Single Pinned Active Order Strip */}
        <div className="flex flex-col items-end gap-1.5 pointer-events-auto">
          {/* Utility Row: KDS [TAB], Handbook [F1], Mute, Pause */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                setShowTabOrders((prev) => !prev);
              }}
              className="h-8 px-2.5 flex items-center gap-1.5 rounded-xl bg-stone-950/88 hover:bg-stone-900 border border-white/10 text-stone-200 text-xs font-display font-semibold cursor-pointer transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>KDS ({hud.activeOrders.length})</span>
              <span className="text-[10px] font-mono-num text-stone-400">[TAB]</span>
            </button>

            <button
              type="button"
              data-testid="handbook-toggle-btn"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                engineRef.current?.audio.playMenuClick();
                engineRef.current?.setMode(
                  hud.mode === 'handbook' ? 'playing' : 'handbook'
                );
              }}
              className="h-8 px-2.5 flex items-center gap-1 rounded-xl bg-stone-950/88 hover:bg-stone-900 border border-amber-500/30 text-amber-300 text-xs font-display font-semibold cursor-pointer transition-colors"
            >
              <span>Rehber</span>
              <span className="text-[10px] font-mono-num text-amber-400/80">[F1]</span>
            </button>

            <button
              type="button"
              aria-label="Sesi Aç veya Kapat"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                if (engineRef.current) {
                  engineRef.current.audio.muted = !engineRef.current.audio.muted;
                  engineRef.current.emitHUDState();
                }
              }}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-stone-950/88 hover:bg-stone-900 border border-white/10 text-stone-200 cursor-pointer transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
              </svg>
            </button>

            <button
              type="button"
              aria-label="Oyunu Duraklat"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                engineRef.current?.setMode('paused');
              }}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-stone-950/88 hover:bg-stone-900 border border-white/10 text-stone-200 cursor-pointer transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </button>
          </div>

          {/* Single Compact Pinned Active Order Strip (Only rendered when at least 1 order exists) */}
          {selectedOrder && (
            <div
              data-testid="active-order-card"
              className="w-72 rounded-xl bg-stone-950/90 border border-amber-400/50 px-3 py-2 shadow-lg"
            >
              {/* Quick Order Switcher Pills [1] [2] [3] + Status Badge */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {hud.activeOrders.map((ord, idx) => {
                    const isSel = ord.id === selectedOrder.id;
                    return (
                      <button
                        key={ord.id}
                        type="button"
                        data-testid={`kds-select-order-${idx}`}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          engineRef.current?.selectOrder(ord.id);
                        }}
                        className={`text-[10px] font-mono-num font-extrabold px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                          isSel
                            ? 'bg-amber-500 text-stone-950'
                            : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                        }`}
                      >
                        [{idx + 1}]
                      </button>
                    );
                  })}
                  <span className="font-display font-bold text-xs text-stone-100 truncate ml-1">
                    {selectedOrder.customerName}
                  </span>
                </div>

                <span
                  data-testid="selected-order-status"
                  className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
                    STATUS_BADGE[selectedOrder.status || 'waiting'].colorClass
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      STATUS_BADGE[selectedOrder.status || 'waiting'].dotClass
                    }`}
                  />
                  {STATUS_BADGE[selectedOrder.status || 'waiting'].label}
                </span>
              </div>

              {/* Recipe & Price Row */}
              <div className="flex items-baseline justify-between gap-2 mt-1">
                <div className="font-display text-xs font-bold text-amber-300 truncate">
                  {RECIPES[selectedOrder.burger].name}
                  {selectedOrder.wantsSoda ? ' + İçecek' : ''}
                </div>
                <div className="font-mono-num text-xs font-bold text-emerald-400 shrink-0">
                  {selectedOrder.totalPrice} $
                </div>
              </div>

              {/* Slim Patience Bar */}
              {(() => {
                const pRatio =
                  typeof selectedOrder.patience === 'number' &&
                  typeof selectedOrder.maxPatience === 'number' &&
                  selectedOrder.maxPatience > 0
                    ? Math.max(0, Math.min(1, selectedOrder.patience / selectedOrder.maxPatience))
                    : 1;
                return (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-stone-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-150 ${
                          pRatio > 0.55
                            ? 'bg-emerald-400'
                            : pRatio > 0.28
                            ? 'bg-amber-400'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.round(pRatio * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono-num font-bold text-stone-400">
                      %{Math.round(pRatio * 100)}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* STRICTLY CENTERED SINGLE CROSSHAIR (NEVER MOVES WHEN PROMPT APPEARS) */}
      {isReticleVisible && (
        <div
          data-testid="center-crosshair"
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 flex items-center justify-center"
        >
          <div
            className={`rounded-full transition-all duration-150 ${
              hud.placementPreviewValid === false
                ? 'w-3 h-3 bg-red-500 ring-4 ring-red-500/30'
                : isHoveringTarget
                ? 'w-2.5 h-2.5 bg-amber-400 ring-4 ring-amber-400/25'
                : 'w-2 h-2 bg-stone-100/95 ring-1 ring-stone-950/80'
            }`}
          />
        </div>
      )}

      {/* STEAM-SIMULATION SINGLE-LINE MICRO-HUD INTERACTION READOUT BELOW CENTER CROSSHAIR */}
      {isReticleVisible && hud.interactionPrompt && (
        <div
          data-testid="interaction-prompt"
          className="fixed left-1/2 top-[calc(50%+15px)] -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center gap-1"
        >
          <div className="inline-flex items-center gap-1.5 bg-stone-950/88 border border-white/15 rounded-lg px-2.5 py-1 shadow-lg">
            <span className="text-[10px] font-display font-extrabold uppercase tracking-wider text-amber-300 whitespace-nowrap">
              {hud.interactionPrompt.title}
            </span>
            <span className="text-stone-500 text-xs font-bold">·</span>
            {hud.interactionPrompt.actionKey && (
              <span className="px-1.5 py-0.5 rounded bg-amber-400 text-stone-950 font-mono-num font-extrabold text-[10px] leading-none shrink-0">
                [{hud.interactionPrompt.actionKey}]
              </span>
            )}
            <span className="text-xs font-display font-bold text-stone-50 tracking-tight whitespace-nowrap">
              {hud.interactionPrompt.primaryHint}
            </span>
            {hud.interactionPrompt.badgeText && (
              <span
                className={`text-[9px] font-mono-num font-bold px-1.5 py-0.5 rounded leading-none ${
                  hud.interactionPrompt.progressState === 'cooked'
                    ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/40'
                    : hud.interactionPrompt.progressState === 'burnt'
                    ? 'bg-red-950/90 text-red-300 border border-red-500/40'
                    : 'bg-stone-800/90 text-amber-300 border border-white/10'
                }`}
              >
                {hud.interactionPrompt.badgeText}
              </span>
            )}
          </div>

          {typeof hud.interactionPrompt.progress === 'number' && (
            <div className="mt-0.5 h-1 w-28 bg-stone-900/90 border border-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.interactionPrompt.progressState === 'burnt'
                    ? 'bg-red-500'
                    : hud.interactionPrompt.progressState === 'cooked'
                    ? 'bg-emerald-400'
                    : 'bg-amber-400'
                }`}
                style={{
                  width: `${Math.round(
                    Math.max(0, Math.min(1, hud.interactionPrompt.progress)) * 100
                  )}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB KDS ORDER & RECIPE BOARD OVERLAY */}
      {showTabOrders && hud.mode === 'playing' && (
        <div className="self-center bg-stone-950/95 border border-white/15 rounded-2xl p-5 w-full max-w-xl shadow-2xl pointer-events-auto z-30">
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-white/10">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                MUTFAK SİPARİŞ EKRANI (KDS)
              </p>
              <h2 className="font-display font-bold text-lg text-stone-100">
                Aktif Siparişler & Tarif Rehberi
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowTabOrders(false)}
              className="text-xs text-stone-300 hover:text-stone-100 px-3 py-1 rounded-lg bg-stone-900 border border-white/10 cursor-pointer"
            >
              Kapat [TAB]
            </button>
          </div>

          {hud.activeOrders.length === 0 ? (
            <p className="text-sm text-stone-400 mb-4">
              Şu anda bekleyen müşteri siparişi bulunmuyor.
            </p>
          ) : (
            <div className="space-y-2 mb-4 max-h-56 overflow-y-auto pr-1">
              {hud.activeOrders.map((ord, idx) => {
                const isSelected =
                  selectedOrder ? ord.id === selectedOrder.id : idx === 0;
                const pRatio =
                  typeof ord.patience === 'number' &&
                  typeof ord.maxPatience === 'number' &&
                  ord.maxPatience > 0
                    ? Math.max(0, Math.min(1, ord.patience / ord.maxPatience))
                    : 1;
                return (
                  <div
                    key={ord.id}
                    data-testid={`kds-modal-order-${ord.id}`}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'bg-stone-900 border-amber-400/80 shadow-md'
                        : 'bg-stone-900/60 border-white/10'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-amber-400 font-semibold">
                          [{idx + 1}] {ord.customerName} ({ord.id})
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            STATUS_BADGE[ord.status || 'waiting'].colorClass
                          }`}
                        >
                          {STATUS_BADGE[ord.status || 'waiting'].label}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-stone-100 mt-0.5">
                        {RECIPES[ord.burger].name}
                        {ord.wantsSoda ? ' + Gazlı İçecek' : ''}
                      </div>
                      <div className="text-[11px] text-stone-400">
                        {RECIPES[ord.burger].shortDesc}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-mono-num font-bold text-emerald-400 text-base">
                          {ord.totalPrice} $
                        </div>
                        <div className="text-[11px] font-mono-num text-stone-400">
                          Sabır: %{Math.round(pRatio * 100)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => engineRef.current?.selectOrder(ord.id)}
                        className={`px-3 py-1.5 rounded-lg font-display font-bold text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-amber-500 text-stone-950'
                            : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-white/10'
                        }`}
                      >
                        {isSelected ? '★ SEÇİLİ' : 'Hedef Seç'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recipe Reference Strip */}
          <div className="border-t border-white/10 pt-3">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-300 mb-2">
              MENÜ TARİFLERİ
            </div>
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              {(Object.keys(RECIPES) as RecipeId[]).map((rId) => {
                const r = RECIPES[rId];
                const unlocked = hud.unlockedRecipes.includes(rId);
                return (
                  <div
                    key={rId}
                    className={`p-2.5 rounded-xl border flex items-center justify-between ${
                      unlocked
                        ? 'bg-stone-900 border-white/10 text-stone-200'
                        : 'bg-stone-950 border-white/5 text-stone-500'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-amber-400">{r.name}</span>
                      {!unlocked && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-400">
                          GÜN 2’DE AÇILIR
                        </span>
                      )}
                      <div className="text-[11px] text-stone-400">{r.shortDesc}</div>
                    </div>
                    <span className="font-mono-num font-bold text-emerald-400">
                      {r.price} $
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM BAR: Contextual Stock Pill (Bottom-Left), Toast/Delivery (Bottom-Center), Contextual Held Item (Bottom-Right) */}
      <div className="flex items-end justify-between gap-4">
        {/* Bottom-Left: Contextual Stock Pill Bar (Only visible when looking at stock bin or critical stock <= 3) */}
        <div className="min-w-[1px]">
          {showContextualStockBar && (
            <div
              data-testid="contextual-stock-bar"
              className="bg-stone-950/90 border border-white/10 rounded-xl px-3 py-1.5 shadow-lg"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-mono-num">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 mr-1">
                  STOK
                </span>
                {(
                  [
                    ['Ekmek', hud.stock.bun],
                    ['Köfte', hud.stock.patty],
                    ['Peynir', hud.stock.cheese],
                    ['Marul', hud.stock.lettuce],
                    ['İçecek', hud.stock.soda],
                  ] as const
                ).map(([label, val]) => (
                  <div
                    key={label}
                    className="px-1.5 py-0.5 rounded bg-stone-900 border border-white/5 flex items-center gap-1"
                  >
                    <span className="text-stone-400 text-[10px] font-sans">{label}</span>
                    <strong
                      className={
                        val <= 3 ? 'text-red-400 font-bold' : 'text-stone-100 font-bold'
                      }
                    >
                      {val}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom-Center: Delivery Celebration Banner & Toast Feedback */}
        <div className="flex flex-col items-center gap-1.5">
          {hud.deliveryBanner && (
            <div
              data-testid="delivery-reward-banner"
              className="px-3.5 py-1.5 rounded-xl bg-emerald-950/95 border border-emerald-400/60 text-emerald-100 shadow-xl flex items-center gap-2.5"
            >
              <span className="font-display font-bold text-xs uppercase tracking-wider text-emerald-300">
                ★ {hud.deliveryBanner.customerName} TESLİMATI
              </span>
              <span className="font-mono-num font-extrabold text-sm text-amber-300">
                +{hud.deliveryBanner.basePrice} $
              </span>
              {hud.deliveryBanner.tip > 0 && (
                <span className="font-mono-num font-bold text-[11px] px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-200">
                  +{hud.deliveryBanner.tip} $ BAHŞİŞ!
                </span>
              )}
              <span className="font-mono-num font-bold text-xs text-amber-400">
                ★ +{hud.deliveryBanner.reputationDelta} İtibar
              </span>
            </div>
          )}

          {hud.toastMessage && (
            <div
              data-testid="game-toast"
              className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold shadow-lg ${
                hud.toastMessage.type === 'success'
                  ? 'bg-emerald-950/92 border-emerald-500/50 text-emerald-200'
                  : hud.toastMessage.type === 'error'
                  ? 'bg-red-950/92 border-red-500/50 text-red-200'
                  : 'bg-stone-950/90 border-amber-500/40 text-amber-200'
              }`}
            >
              {hud.toastMessage.text}
            </div>
          )}
        </div>

        {/* Bottom-Right: Contextual Held Item Pill (Only visible when holding an item) */}
        <div className="min-w-[1px]">
          {hud.heldItem ? (
            <div className="bg-stone-950/90 border border-amber-400/40 rounded-xl px-3.5 py-2 shadow-lg text-right">
              <div className="flex items-center justify-end gap-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
                  ELDEKİ NESNE
                </span>
                {hud.assemblyLayersCount > 0 && (
                  <span className="text-[9px] font-mono-num font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                    Tezgâh: {hud.assemblyLayersCount} Katman
                  </span>
                )}
              </div>
              <div
                data-testid="held-item-label"
                className="font-display font-bold text-xs text-amber-400 mt-0.5"
              >
                {hud.heldItem.label}
              </div>
              <div className="text-[10px] text-stone-300 mt-0.5">
                [E] Yüzeye Bırak · [R] Döndür · [G] Yere At
              </div>
            </div>
          ) : (
            <span data-testid="held-item-label" className="sr-only">
              Boş (El Boş)
            </span>
          )}
        </div>
      </div>

      {/* 3. POS TERMINAL MODAL */}
      {hud.mode === 'pos_modal' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-stone-950/85 pointer-events-auto p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-white/15 rounded-2xl max-w-3xl w-full p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                  BURGER DISTRICT POS YÖNETİM TERMİNALİ · v2.4
                </p>
                <h2 className="font-display text-2xl font-bold text-stone-100">
                  Kasa, Tedarik & İşletme Geliştirme — Gün {hud.day}
                </h2>
              </div>
              <div className="flex items-center gap-6 text-right">
                <div>
                  <span className="text-xs text-stone-400 block">Restoran İtibarı</span>
                  <span className="font-mono-num text-xl font-bold text-amber-400">
                    ★ %{Math.round(hud.reputation)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-stone-400 block">Mevcut Bakiye</span>
                  <span className="font-mono-num text-2xl font-bold text-emerald-400">
                    {hud.money} $
                  </span>
                </div>
              </div>
            </div>

            {/* Shop Open / End Day Controls */}
            <div className="my-4 p-4 rounded-xl bg-stone-950 border border-white/10 flex items-center justify-between gap-4">
              <div>
                <div className="font-display font-bold text-base text-stone-100">
                  Restoran Durumu:{' '}
                  {hud.shopOpen
                    ? `AÇIK (${hud.dayPhaseLabel})`
                    : 'KAPALI (Sabah Hazırlığı)'}
                </div>
                <div className="text-xs text-stone-400">
                  {hud.shopOpen
                    ? 'İstediğiniz zaman günü tamamlayıp gün sonu raporuna geçebilirsiniz.'
                    : 'Dükkânı açtığınızda müşteriler kapıdan girerek sipariş vermeye başlar.'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!hud.shopOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      engineRef.current?.openShopForDay();
                      engineRef.current?.setMode('playing');
                    }}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-display font-bold text-sm rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    Dükkânı Aç
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => engineRef.current?.endWorkDay()}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-sm rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    Günü Bitir & Raporu Gör
                  </button>
                )}
              </div>
            </div>

            {/* Stock Restock Section */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display font-bold text-sm uppercase tracking-wider text-stone-300">
                Hızlı Stok Yenileme (Paket Başına +{hud.coldStorageUpgraded ? 8 : 5} Adet)
              </h3>
              <span className="text-xs font-mono-num text-stone-400">
                Maksimum Depo Kapasitesi: {hud.maxStockCapacity} adet
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-5">
              {(Object.keys(GAME_CONFIG.restockPacks) as StockKey[]).map((key) => {
                const pack = GAME_CONFIG.restockPacks[key];
                const addCount = hud.coldStorageUpgraded
                  ? pack.upgradedAmount
                  : pack.amount;
                const isFull = hud.stock[key] >= hud.maxStockCapacity;
                return (
                  <div
                    key={key}
                    className="p-3 rounded-xl bg-stone-950 border border-white/10 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-xs text-stone-100">
                        {pack.label}
                      </div>
                      <div className="text-[11px] text-stone-400 font-mono-num">
                        Stok: {hud.stock[key]}/{hud.maxStockCapacity} (+{addCount})
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isFull}
                      onClick={() => engineRef.current?.buyStockFromPOS(key)}
                      className={`px-3 py-1.5 font-mono-num font-bold text-xs rounded-lg border transition-colors whitespace-nowrap ${
                        isFull
                          ? 'bg-stone-900 text-stone-500 border-white/5 cursor-not-allowed'
                          : 'bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-amber-400 border-white/10 cursor-pointer'
                      }`}
                    >
                      {isFull ? 'DOLU' : `${pack.cost} $`}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Equipment & Restaurant Upgrades Section */}
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-stone-300 mb-2.5">
              Restoran & Mutfak Geliştirmeleri
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
              <div className="p-3.5 rounded-xl bg-stone-950 border border-white/10 flex flex-col justify-between">
                <div>
                  <div className="font-display font-bold text-sm text-amber-400">
                    Endüstriyel Hızlı Izgara
                  </div>
                  <p className="text-xs text-stone-400 mt-1">
                    Köfte pişirme süresini 8 sn’den 4.5 sn’ye düşürür ve yanma toleransını artırır.
                  </p>
                </div>
                <div className="mt-3">
                  {hud.grillUpgraded ? (
                    <span className="inline-block text-xs font-mono-num font-bold text-emerald-400">
                      SATIN ALINDI ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      data-testid="buy-grill-upgrade"
                      onClick={() => engineRef.current?.buyGrillUpgradeFromPOS()}
                      className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono-num font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Satın Al ({GAME_CONFIG.grillUpgradeCost} $)
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-950 border border-white/10 flex flex-col justify-between">
                <div>
                  <div className="font-display font-bold text-sm text-amber-400">
                    Premium Restoran Dekoru
                  </div>
                  <p className="text-xs text-stone-400 mt-1">
                    Sıcak neon aydınlatma ve salon bitkileri ekler. +8 İtibar, +15 sn Müşteri Sabrı ve +%5 Bahşiş sağlar.
                  </p>
                </div>
                <div className="mt-3">
                  {hud.decorUpgraded ? (
                    <span className="inline-block text-xs font-mono-num font-bold text-emerald-400">
                      SATIN ALINDI ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      data-testid="buy-decor-upgrade"
                      onClick={() => engineRef.current?.buyDecorUpgradeFromPOS()}
                      className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono-num font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Satın Al ({GAME_CONFIG.decorUpgradeCost} $)
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-950 border border-white/10 flex flex-col justify-between">
                <div>
                  <div className="font-display font-bold text-sm text-amber-400">
                    Geliştirilmiş Soğuk Depo
                  </div>
                  <p className="text-xs text-stone-400 mt-1">
                    Mutfağa ek soğutucu kule kurar. Maksimum stok kapasitesini 60’a, paket alımlarını +8 adede çıkarır.
                  </p>
                </div>
                <div className="mt-3">
                  {hud.coldStorageUpgraded ? (
                    <span className="inline-block text-xs font-mono-num font-bold text-emerald-400">
                      SATIN ALINDI ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      data-testid="buy-cold-storage-upgrade"
                      onClick={() => engineRef.current?.buyColdStorageUpgradeFromPOS()}
                      className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono-num font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Satın Al ({GAME_CONFIG.coldStorageUpgradeCost} $)
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => engineRef.current?.setMode('playing')}
                className="px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-100 font-display font-semibold text-sm rounded-xl border border-white/10 cursor-pointer"
              >
                Oyuna Dön [ESC]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. INTERACTIVE HANDBOOK MODAL (FAZ E) */}
      {hud.mode === 'handbook' && (
        <HandbookModal
          engineRef={engineRef}
          onClose={() => engineRef.current?.setMode('playing')}
        />
      )}

      {/* 5. PAUSE MODAL */}
      {hud.mode === 'paused' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-stone-950/85 pointer-events-auto p-4">
          <div className="bg-stone-900 border border-white/15 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-stone-100 mb-1">
              Oyun Duraklatıldı
            </h2>
            <p className="text-xs text-stone-400 mb-5">
              Gün {hud.day} · Kasa: {hud.money} $ · İtibar: ★ %{hud.reputation}
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => engineRef.current?.setMode('playing')}
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-sm rounded-xl cursor-pointer"
              >
                Oyuna Devam Et
              </button>

              <button
                type="button"
                onClick={() => engineRef.current?.setMode('handbook')}
                className="w-full py-3 px-4 bg-stone-800 hover:bg-stone-700 text-amber-300 font-display font-semibold text-sm rounded-xl border border-amber-500/30 cursor-pointer"
              >
                İşletme & Mutfak Rehberini Aç [F1]
              </button>

              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                className="w-full py-3 px-4 bg-stone-800 hover:bg-stone-700 text-stone-100 font-display font-semibold text-sm rounded-xl border border-white/10 cursor-pointer"
              >
                Ayarlar
              </button>

              <button
                type="button"
                onClick={() => engineRef.current?.endWorkDay()}
                className="w-full py-3 px-4 bg-stone-800 hover:bg-stone-700 text-amber-400 font-display font-semibold text-sm rounded-xl border border-white/10 cursor-pointer"
              >
                Günü Bitir & Gün Sonu Raporu
              </button>

              <button
                type="button"
                onClick={() => {
                  engineRef.current?.persistProgress();
                  engineRef.current?.setMode('title');
                }}
                className="w-full py-3 px-4 bg-stone-950 hover:bg-stone-800 text-stone-400 hover:text-stone-200 font-display font-medium text-sm rounded-xl border border-white/10 cursor-pointer"
              >
                Kaydet ve Ana Menüye Dön
              </button>
            </div>
          </div>

          {showSettingsModal && (
            <SettingsModal
              hud={hud}
              engineRef={engineRef}
              onClose={() => setShowSettingsModal(false)}
            />
          )}
        </div>
      )}

      {/* 6. END-OF-DAY SUMMARY MODAL */}
      {hud.mode === 'day_summary' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-stone-950/88 pointer-events-auto p-4">
          <div className="bg-stone-900 border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
              İŞ GÜNÜ TAMAMLANDI
            </p>
            <h2 className="font-display text-3xl font-extrabold text-stone-100 mb-4">
              Gün {hud.dayStats.day} — İşletme Raporu
            </h2>

            {hud.day === 1 && (
              <div className="mb-4 p-3 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs font-semibold">
                YENİ TARİF AÇILIYOR: Gün 2’de menüye yüksek kazançlı{' '}
                <strong className="text-amber-400">Double Smash Burger (115 $)</strong>{' '}
                ekleniyor!
              </div>
            )}

            <div className="space-y-2 bg-stone-950 p-4 rounded-xl border border-white/10 font-mono-num text-sm mb-5">
              <div className="flex justify-between">
                <span className="text-stone-400">Sipariş Satış Geliri:</span>
                <span className="font-bold text-emerald-400">+{hud.dayStats.totalSales} $</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Hızlı Servis Bahşiş Geliri:</span>
                <span className="font-bold text-emerald-400">+{hud.dayStats.tipIncome} $</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Başarılı Teslimatlar:</span>
                <span className="font-bold text-stone-100">{hud.dayStats.successfulDeliveries}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Hatalı / Reddedilen Teslimatlar:</span>
                <span className="font-bold text-red-400">{hud.dayStats.failedDeliveries}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Sabrı Taşıp Ayrılan Müşteriler:</span>
                <span className="font-bold text-red-400">{hud.dayStats.lostCustomers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Günlük İtibar Değişimi:</span>
                <span
                  className={`font-bold ${
                    hud.dayStats.reputationDelta >= 0
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}
                >
                  {hud.dayStats.reputationDelta >= 0
                    ? `+${hud.dayStats.reputationDelta}`
                    : hud.dayStats.reputationDelta}{' '}
                  (★ %{hud.reputation})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Malzeme Tedarik Giderleri:</span>
                <span className="font-bold text-amber-400">-{hud.dayStats.supplyExpenses} $</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Ekipman Geliştirme Giderleri:</span>
                <span className="font-bold text-amber-400">-{hud.dayStats.upgradeExpenses} $</span>
              </div>
              <div className="h-px bg-white/10 my-2" />
              <div className="flex justify-between text-base">
                <span className="font-sans font-semibold text-stone-200">Günlük Net Kazanç:</span>
                <span className="font-bold text-amber-400">
                  {hud.dayStats.totalSales +
                    hud.dayStats.tipIncome -
                    hud.dayStats.supplyExpenses -
                    hud.dayStats.upgradeExpenses}{' '}
                  $
                </span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="font-sans font-bold text-stone-100">Gün Sonu Kasa Bakiyesi:</span>
                <span className="font-bold text-emerald-400">{hud.money} $</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                data-start="true"
                onClick={() => engineRef.current?.advanceToNextDay()}
                className="flex-1 py-3.5 px-5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-base rounded-xl cursor-pointer"
              >
                Sonraki Güne Geç (Gün {hud.day + 1})
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.setMode('title')}
                className="py-3.5 px-5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-display font-semibold text-sm rounded-xl border border-white/10 cursor-pointer"
              >
                Ana Menü
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface SettingsModalProps {
  hud: GameHUDState;
  engineRef: React.MutableRefObject<GameEngine | null>;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ hud, engineRef, onClose }) => {
  const { settings } = hud;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/88 pointer-events-auto p-4">
      <div className="bg-stone-900 border border-white/15 rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <h2 className="font-display text-2xl font-bold text-stone-100 mb-4">
          Oyun Ayarları
        </h2>

        <div className="space-y-4 mb-6">
          <div>
            <label
              htmlFor="mouse-sens"
              className="flex justify-between text-xs font-semibold text-stone-300 mb-1"
            >
              <span>Fare Hassasiyeti</span>
              <span className="font-mono-num text-amber-400">
                {settings.mouseSensitivity.toFixed(1)}x
              </span>
            </label>
            <input
              id="mouse-sens"
              type="range"
              min="0.3"
              max="2.5"
              step="0.1"
              value={settings.mouseSensitivity}
              onChange={(e) =>
                engineRef.current?.updateSettings({
                  mouseSensitivity: parseFloat(e.target.value),
                })
              }
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div>
            <label
              htmlFor="master-vol"
              className="flex justify-between text-xs font-semibold text-stone-300 mb-1"
            >
              <span>Genel Ses Seviyesi</span>
              <span className="font-mono-num text-amber-400">
                %{Math.round(settings.masterVolume * 100)}
              </span>
            </label>
            <input
              id="master-vol"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.masterVolume}
              onChange={(e) =>
                engineRef.current?.updateSettings({
                  masterVolume: parseFloat(e.target.value),
                })
              }
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div>
            <label
              htmlFor="gfx-quality"
              className="block text-xs font-semibold text-stone-300 mb-1"
            >
              Grafik Kalitesi
            </label>
            <select
              id="gfx-quality"
              value={settings.graphicsQuality}
              onChange={(e) =>
                engineRef.current?.updateSettings({
                  graphicsQuality: e.target.value as 'low' | 'medium' | 'high' | 'ultra',
                })
              }
              className="w-full bg-stone-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-stone-100"
            >
              <option value="low">Düşük (Yüksek Performans)</option>
              <option value="medium">Orta (Dengeli)</option>
              <option value="high">Yüksek (Yumuşak Gölgeler & Tam Detay)</option>
              <option value="ultra">Ultra (2048px Gölgeler & Maksimum Keskinlik)</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label htmlFor="head-bob" className="text-xs font-semibold text-stone-300">
              Yürürken Hafif Kamera Sallanması (Head Bob)
            </label>
            <input
              id="head-bob"
              type="checkbox"
              checked={settings.headBob}
              onChange={(e) =>
                engineRef.current?.updateSettings({ headBob: e.target.checked })
              }
              className="w-4 h-4 accent-amber-500 cursor-pointer"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-sm rounded-xl cursor-pointer"
        >
          Kaydet ve Kapat
        </button>
      </div>
    </div>
  );
};
