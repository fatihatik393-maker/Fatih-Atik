/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { DAY_PHASE_LABELS, GAME_CONFIG } from './core/GameConfig';
import { GameEngine, GameHUDState } from './core/GameEngine';
import { SaveManager } from './core/SaveManager';
import { GameOverlays } from './ui/GameOverlays';
import { GlbStandaloneViewer } from './viewer/GlbStandaloneViewer';

const INITIAL_HUD_STATE: GameHUDState = {
  mode: 'title',
  day: 1,
  timeRemaining: GAME_CONFIG.dayDurationSeconds,
  dayPhase: 'opening',
  dayPhaseLabel: DAY_PHASE_LABELS.opening,
  shopOpen: false,
  money: GAME_CONFIG.startingMoney,
  reputation: GAME_CONFIG.startingReputation,
  stock: { ...GAME_CONFIG.initialStock },
  maxStockCapacity: GAME_CONFIG.baseMaxStock,
  grillUpgraded: false,
  decorUpgraded: false,
  coldStorageUpgraded: false,
  unlockedRecipes: ['classic_burger', 'cheeseburger'],
  activeCustomerCount: 0,
  seatedCustomerCount: 0,
  dirtyTableCount: 0,
  heldItem: null,
  activeOrders: [],
  selectedOrderId: null,
  grillSlots: [
    { id: 0, state: 'empty', elapsed: 0, progress: 0 },
    { id: 1, state: 'empty', elapsed: 0, progress: 0 },
    { id: 2, state: 'empty', elapsed: 0, progress: 0 },
    { id: 3, state: 'empty', elapsed: 0, progress: 0 },
  ],
  assemblyLayersCount: 0,
  assemblyHasSoda: false,
  assemblyHint: '1. Alt Ekmek yerleştirin',
  interactionPrompt: null,
  placementPreviewValid: null,
  isLookingAtStockStation: false,
  placedSurfaceCount: 0,
  toastMessage: null,
  deliveryBanner: null,
  dayStats: {
    day: 1,
    totalSales: 0,
    tipIncome: 0,
    ordersPrepared: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    lostCustomers: 0,
    supplyExpenses: 0,
    upgradeExpenses: 0,
    reputationDelta: 0,
  },
  settings: { ...GAME_CONFIG.defaultSettings },
  hasSavedGame: SaveManager.hasSave(),
};

declare global {
  interface Window {
    __burgerGame?: GameEngine;
  }
}

export default function App() {
  const isGlbViewer =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('glb_viewer') === '1';

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hudState, setHudState] = useState<GameHUDState>(INITIAL_HUD_STATE);

  useEffect(() => {
    if (isGlbViewer) return;
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new GameEngine(mount, (nextState) => {
      setHudState(nextState);
    });
    engineRef.current = engine;
    window.__burgerGame = engine;

    // Support ?autostart=1 to jump directly into active gameplay
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startNewGame();
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
      delete window.__burgerGame;
    };
  }, [isGlbViewer]);

  if (isGlbViewer) {
    return <GlbStandaloneViewer />;
  }

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-stone-950 select-none">
      {/* Isolated WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        data-testid="webgl-canvas-container"
        className="w-full h-full"
      />

      {/* Semantic HTML HUD & Game Shell Overlays */}
      <GameOverlays hud={hudState} engineRef={engineRef} />
    </main>
  );
}
