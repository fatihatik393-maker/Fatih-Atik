import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { CustomerManager } from '../entities/CustomerManager';
import { BurgerAssembly } from '../gameplay/BurgerAssembly';
import { CookingSystem, GrillSlot } from '../gameplay/CookingSystem';
import { EconomySystem, evaluateIndependentOrderStatuses } from '../gameplay/EconomySystem';
import {
  combineItemIntoTray,
  PlacementEvaluation,
  SmartPlacementSystem,
} from '../gameplay/SmartPlacementSystem';
import { DroppedItemEntity, PlayerController } from '../player/PlayerController';
import { AssetFactory } from '../rendering/AssetFactory';
import { EffectsManager } from '../rendering/EffectsManager';
import { MaterialLibrary } from '../rendering/MaterialLibrary';
import { LightingSystem } from '../world/LightingSystem';
import { PLACEMENT_SURFACES, STATIONS } from '../world/RestaurantLayout';
import { InteractableTarget, RestaurantScene } from '../world/RestaurantScene';
import {
  CustomerOrder,
  DAY_PHASE_LABELS,
  DayPhase,
  DayStats,
  evaluateDayPhase,
  formatServiceTrayLabel,
  GAME_CONFIG,
  GameSettings,
  HeldItem,
  ITEM_LABELS,
  RECIPES,
  RecipeId,
  StockInventory,
  StockKey,
} from './GameConfig';
import { SaveManager } from './SaveManager';

export type GameModeState =
  | 'title'
  | 'playing'
  | 'paused'
  | 'pos_modal'
  | 'handbook'
  | 'day_summary';

export interface InteractionPromptInfo {
  title: string;
  actionKey?: string;
  primaryHint: string;
  secondaryHint?: string;
  subtext?: string;
  badgeText?: string;
  progress?: number;
  progressState?: 'cooking' | 'cooked' | 'burnt';
}

export interface GameHUDState {
  mode: GameModeState;
  day: number;
  timeRemaining: number;
  dayPhase: DayPhase;
  dayPhaseLabel: string;
  shopOpen: boolean;
  money: number;
  reputation: number;
  stock: StockInventory;
  maxStockCapacity: number;
  grillUpgraded: boolean;
  decorUpgraded: boolean;
  coldStorageUpgraded: boolean;
  unlockedRecipes: RecipeId[];
  activeCustomerCount: number;
  seatedCustomerCount: number;
  dirtyTableCount: number;
  heldItem: HeldItem | null;
  activeOrders: CustomerOrder[];
  selectedOrderId: string | null;
  grillSlots: GrillSlot[];
  assemblyLayersCount: number;
  assemblyHasSoda: boolean;
  assemblyHint: string;
  interactionPrompt: InteractionPromptInfo | null;
  placementPreviewValid: boolean | null;
  isLookingAtStockStation: boolean;
  placedSurfaceCount: number;
  toastMessage: { text: string; type: 'info' | 'success' | 'error' } | null;
  deliveryBanner: {
    customerName: string;
    recipeName: string;
    basePrice: number;
    tip: number;
    reputationDelta: number;
  } | null;
  dayStats: DayStats;
  settings: GameSettings;
  hasSavedGame: boolean;
}

export class GameEngine {
  readonly isSoftwareGl: boolean;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly mats: MaterialLibrary;
  readonly assets: AssetFactory;
  readonly lighting: LightingSystem;
  readonly restaurant: RestaurantScene;
  readonly player: PlayerController;
  readonly cooking: CookingSystem;
  readonly assembly: BurgerAssembly;
  readonly placement: SmartPlacementSystem;
  readonly economy: EconomySystem;
  readonly customers: CustomerManager;
  readonly effects: EffectsManager;
  readonly audio: AudioManager;

  mode: GameModeState = 'title';
  day = 1;
  shopOpen = false;
  timeRemaining = GAME_CONFIG.dayDurationSeconds;
  dayPhase: DayPhase = 'opening';
  heldItem: HeldItem | null = null;
  selectedOrderId: string | null = null;
  readonly startedOrderIds = new Set<string>();
  settings: GameSettings;

  private droppedItems: DroppedItemEntity[] = [];
  private hoveredTarget: InteractableTarget | null = null;
  private currentPlacementEval: PlacementEvaluation | null = null;
  private toast: { text: string; type: 'info' | 'success' | 'error'; timer: number } | null = null;
  private deliveryBanner: {
    customerName: string;
    recipeName: string;
    basePrice: number;
    tip: number;
    reputationDelta: number;
    timer: number;
  } | null = null;

  private frameId = 0;
  private lastFrameTime = performance.now();
  private elapsed = 0;
  private smokeAccum = 0;
  private uiSyncAccum = 0;
  private isMouseDownOnCanvas = false;
  private wipeAudioCooldown = 0;
  private onStateUpdate: (state: GameHUDState) => void;
  private resizeObserver: ResizeObserver;

  perfStats = {
    frameTimeMs: 0,
    fps: 60,
    drawCalls: 0,
    triangles: 0,
  };

  constructor(mountEl: HTMLElement, onStateUpdate: (state: GameHUDState) => void) {
    this.onStateUpdate = onStateUpdate;

    // 1. Software WebGL detection per Three.js skill
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.5)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    const rect = mountEl.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;
    this.renderer.setSize(width, height);
    mountEl.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 65);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.mats = new MaterialLibrary(maxAniso, this.isSoftwareGl);
    this.assets = new AssetFactory(this.mats);
    this.lighting = new LightingSystem(this.scene, this.renderer, this.isSoftwareGl);
    this.restaurant = new RestaurantScene(this.scene, this.mats, this.assets);
    this.player = new PlayerController(this.camera, this.scene);
    this.effects = new EffectsManager(this.scene);
    this.audio = new AudioManager();

    // Load saved state or defaults
    const saved = SaveManager.load();
    this.day = saved.day;
    this.settings = { ...saved.settings };
    this.audio.masterVolume = this.settings.masterVolume;
    this.lighting.applyQualityPreset(this.settings.graphicsQuality, this.isSoftwareGl);

    this.cooking = new CookingSystem(4, saved.grillUpgraded);
    this.assembly = new BurgerAssembly();
    this.placement = new SmartPlacementSystem();
    this.economy = new EconomySystem(
      saved.money,
      saved.stock,
      saved.grillUpgraded,
      saved.day,
      saved.reputation,
      saved.decorUpgraded,
      saved.coldStorageUpgraded,
      saved.unlockedRecipes
    );
    this.customers = new CustomerManager(this.scene);
    this.restaurant.syncUpgradesVisuals(
      this.economy.decorUpgraded,
      this.economy.coldStorageUpgraded
    );

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize(mountEl));
    this.resizeObserver.observe(mountEl);

    this.bindInputEvents();
    this.syncBodyDataset();
    this.emitHUDState();
    this.startLoop();
  }

  private handleResize(mountEl: HTMLElement): void {
    const rect = mountEl.getBoundingClientRect();
    const w = Math.max(1, rect.width || window.innerWidth);
    const h = Math.max(1, rect.height || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private bindInputEvents(): void {
    const canvas = this.renderer.domElement;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onCanvasMouseDown);
    window.addEventListener('mouseup', this.onWindowMouseUp);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.mode === 'title') {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.startNewGame();
      }
      return;
    }

    if (e.code === 'F1') {
      e.preventDefault();
      if (this.mode === 'playing') {
        this.audio.playMenuClick();
        this.setMode('handbook');
      } else if (this.mode === 'handbook') {
        this.audio.playMenuClick();
        this.setMode('playing');
      }
      return;
    }

    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      if (this.mode === 'pos_modal' || this.mode === 'handbook') {
        this.setMode('playing');
      } else if (this.mode === 'playing') {
        this.setMode('paused');
      } else if (this.mode === 'paused') {
        this.setMode('playing');
      }
      return;
    }

    if (this.mode !== 'playing') return;

    this.player.keysPressed.add(e.code);

    if (!e.repeat) {
      if (e.code === 'KeyE') {
        this.handleSecondaryInteract();
      } else if (e.code === 'KeyR') {
        this.rotateHeldPlacementPreview();
      } else if (e.code === 'KeyG') {
        this.dropHeldItemToFloor();
      } else if (e.code === 'KeyO') {
        if (!this.shopOpen) {
          this.openShopForDay();
        }
      } else if (
        e.code === 'Digit1' ||
        e.code === 'Digit2' ||
        e.code === 'Digit3' ||
        e.code === 'Digit4' ||
        e.code === 'Digit5'
      ) {
        const idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
        const active = this.customers.getActiveOrders();
        if (active[idx]) {
          this.selectOrder(active[idx].id);
        }
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.player.keysPressed.delete(e.code);
  };

  private onWindowBlur = (): void => {
    this.player.keysPressed.clear();
    this.isMouseDownOnCanvas = false;
    this.player.onPointerUp();
  };

  private onPointerLockChange = (): void => {
    this.player.isPointerLocked = document.pointerLockElement === this.renderer.domElement;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.mode !== 'playing') return;
    if (this.player.isPointerLocked) {
      this.player.handleMouseMove(e.movementX, e.movementY, this.settings.mouseSensitivity);
    } else {
      this.player.onPointerMoveFallback(e.clientX, e.clientY, this.settings.mouseSensitivity);
    }
  };

  private onCanvasMouseDown = (e: MouseEvent): void => {
    if (this.mode !== 'playing') return;

    if (e.button === 0) {
      this.isMouseDownOnCanvas = true;
      this.player.onPointerDown(e.clientX, e.clientY);
      if (!this.isSoftwareGl && !this.player.isPointerLocked) {
        this.renderer.domElement.requestPointerLock?.();
      }
      this.handlePrimaryInteract();
    }
  };

  private onWindowMouseUp = (): void => {
    this.isMouseDownOnCanvas = false;
    this.player.onPointerUp();
  };

  setMode(newMode: GameModeState): void {
    this.mode = newMode;
    this.player.keysPressed.clear();
    this.isMouseDownOnCanvas = false;
    if (newMode !== 'playing') {
      document.exitPointerLock?.();
      this.audio.silenceAll();
      this.restaurant.syncGhostPreview(null, null, this.elapsed);
    }
    this.syncBodyDataset();
    this.emitHUDState();
  }

  private syncBodyDataset(): void {
    if (this.mode === 'title') document.body.dataset.state = 'title';
    else if (
      this.mode === 'playing' ||
      this.mode === 'pos_modal' ||
      this.mode === 'handbook'
    )
      document.body.dataset.state = 'playing';
    else if (this.mode === 'paused') document.body.dataset.state = 'paused';
    else if (this.mode === 'day_summary') document.body.dataset.state = 'gameover';
  }

  startNewGame(): void {
    this.audio.playMenuClick();
    const fresh = SaveManager.resetForNewGame(this.settings);
    this.applySaveData(fresh);
    this.resetWorldForDay();
    this.setMode('playing');
    this.showToast('Burger District’e hoş geldiniz! Kasadan dükkânı açarak güne başlayın.', 'info');
  }

  continueSavedGame(): void {
    this.audio.playMenuClick();
    const saved = SaveManager.load();
    this.applySaveData(saved);
    this.resetWorldForDay();
    this.setMode('playing');
    this.showToast(`Gün ${this.day} yüklendi. Kasadan dükkânı açabilirsiniz.`, 'info');
  }

  private applySaveData(data: ReturnType<typeof SaveManager.load>): void {
    this.day = data.day;
    this.economy.money = data.money;
    this.economy.reputation = data.reputation;
    this.economy.stock = { ...data.stock };
    this.economy.grillUpgraded = data.grillUpgraded;
    this.economy.decorUpgraded = data.decorUpgraded;
    this.economy.coldStorageUpgraded = data.coldStorageUpgraded;
    this.economy.unlockedRecipes = [...data.unlockedRecipes];
    this.cooking.isUpgraded = data.grillUpgraded;
    this.settings = { ...data.settings };
    this.audio.masterVolume = this.settings.masterVolume;
    this.lighting.applyQualityPreset(this.settings.graphicsQuality, this.isSoftwareGl);
    this.restaurant.syncUpgradesVisuals(
      this.economy.decorUpgraded,
      this.economy.coldStorageUpgraded
    );
  }

  private resetWorldForDay(): void {
    this.shopOpen = false;
    this.timeRemaining = GAME_CONFIG.dayDurationSeconds;
    this.dayPhase = 'opening';
    this.heldItem = null;
    this.selectedOrderId = null;
    this.startedOrderIds.clear();
    this.deliveryBanner = null;
    this.currentPlacementEval = null;
    this.player.setHeldItemVisual(null, this.assets);
    this.player.resetSpawn();
    this.cooking.reset();
    this.assembly.clear();
    this.placement.clear();
    this.restaurant.syncPlacedSurfaceItems([]);
    this.restaurant.syncGhostPreview(null, null, 0);
    this.customers.reset();
    this.restaurant.syncDirtyTableTrays(this.customers.dining.seats);
    this.clearDroppedItems();
    this.economy.startNewDay(this.day);
    this.restaurant.syncGrillVisuals(this.cooking.slots, this.cooking.isUpgraded);
    this.restaurant.syncAssemblyVisuals(this.assembly.layers, this.assembly.hasSoda);
    this.restaurant.syncUpgradesVisuals(
      this.economy.decorUpgraded,
      this.economy.coldStorageUpgraded
    );
    this.lighting.updateDayTimeAtmosphere(
      this.timeRemaining,
      GAME_CONFIG.dayDurationSeconds,
      this.economy.decorUpgraded
    );
    this.restaurant.updatePOSScreen(
      this.shopOpen,
      this.economy.money,
      this.day,
      this.economy.reputation
    );
  }

  openShopForDay(): void {
    if (this.shopOpen) return;
    this.shopOpen = true;
    this.dayPhase = evaluateDayPhase(this.timeRemaining);
    this.audio.playCashRegister();
    this.restaurant.updatePOSScreen(
      this.shopOpen,
      this.economy.money,
      this.day,
      this.economy.reputation
    );
    this.customers.spawnCustomer(this.dayPhase, this.economy.decorUpgraded);
    this.audio.playDoorBell();
    const smashNote =
      this.day >= 2 ? ' Double Smash Burger menüde aktif!' : '';
    this.showToast(
      `Gün ${this.day} başladı! İlk müşteriniz kapıdan giriyor.${smashNote}`,
      'success'
    );
    this.emitHUDState();
  }

  endWorkDay(): void {
    this.shopOpen = false;
    this.audio.playDayComplete();
    this.persistProgress();
    this.setMode('day_summary');
  }

  advanceToNextDay(): void {
    this.audio.playMenuClick();
    this.day += 1;
    if (this.day >= 2) {
      this.economy.unlockRecipe('double_smash');
    }
    this.persistProgress();
    this.resetWorldForDay();
    this.setMode('playing');
    if (this.day === 2) {
      this.showToast(
        'Gün 2! Yeni Tarif Açıldı: Double Smash Burger (115 $)!',
        'success'
      );
    } else {
      this.showToast(`Gün ${this.day} hazırlık aşaması başladı!`, 'info');
    }
  }

  persistProgress(): void {
    SaveManager.save({
      money: this.economy.money,
      day: this.day,
      reputation: this.economy.reputation,
      stock: { ...this.economy.stock },
      grillUpgraded: this.economy.grillUpgraded,
      decorUpgraded: this.economy.decorUpgraded,
      coldStorageUpgraded: this.economy.coldStorageUpgraded,
      unlockedRecipes: [...this.economy.unlockedRecipes],
      settings: { ...this.settings },
    });
  }

  updateSettings(partial: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.audio.masterVolume = this.settings.masterVolume;
    this.lighting.applyQualityPreset(this.settings.graphicsQuality, false);
    SaveManager.saveSettings(this.settings);
    this.emitHUDState();
  }

  buyStockFromPOS(key: StockKey): void {
    const res = this.economy.buyRestock(key);
    if (res.success) {
      this.audio.playCashRegister();
      this.restaurant.updatePOSScreen(
        this.shopOpen,
        this.economy.money,
        this.day,
        this.economy.reputation
      );
      this.persistProgress();
      this.showToast(res.message, 'success');
    } else {
      this.audio.playOrderFail();
      this.showToast(res.message, 'error');
    }
    this.emitHUDState();
  }

  buyGrillUpgradeFromPOS(): void {
    const res = this.economy.buyGrillUpgrade();
    if (res.success) {
      this.cooking.isUpgraded = true;
      this.audio.playCashRegister();
      this.restaurant.syncGrillVisuals(this.cooking.slots, true);
      this.restaurant.updatePOSScreen(
        this.shopOpen,
        this.economy.money,
        this.day,
        this.economy.reputation
      );
      this.persistProgress();
      this.showToast(res.message, 'success');
    } else {
      this.audio.playOrderFail();
      this.showToast(res.message, 'error');
    }
    this.emitHUDState();
  }

  buyDecorUpgradeFromPOS(): void {
    const res = this.economy.buyDecorUpgrade();
    if (res.success) {
      this.audio.playCashRegister();
      this.restaurant.syncUpgradesVisuals(
        this.economy.decorUpgraded,
        this.economy.coldStorageUpgraded
      );
      this.lighting.updateDayTimeAtmosphere(
        this.timeRemaining,
        GAME_CONFIG.dayDurationSeconds,
        this.economy.decorUpgraded
      );
      this.restaurant.updatePOSScreen(
        this.shopOpen,
        this.economy.money,
        this.day,
        this.economy.reputation
      );
      this.persistProgress();
      this.showToast(res.message, 'success');
    } else {
      this.audio.playOrderFail();
      this.showToast(res.message, 'error');
    }
    this.emitHUDState();
  }

  buyColdStorageUpgradeFromPOS(): void {
    const res = this.economy.buyColdStorageUpgrade();
    if (res.success) {
      this.audio.playCashRegister();
      this.restaurant.syncUpgradesVisuals(
        this.economy.decorUpgraded,
        this.economy.coldStorageUpgraded
      );
      this.restaurant.updatePOSScreen(
        this.shopOpen,
        this.economy.money,
        this.day,
        this.economy.reputation
      );
      this.persistProgress();
      this.showToast(res.message, 'success');
    } else {
      this.audio.playOrderFail();
      this.showToast(res.message, 'error');
    }
    this.emitHUDState();
  }

  selectOrder(orderId: string): void {
    const order = this.customers.getActiveOrderById(orderId);
    if (!order) return;
    this.selectedOrderId = order.id;
    this.audio.playMenuClick();
    this.syncActiveOrderStatuses();
    const summary = `${RECIPES[order.burger].name}${order.wantsSoda ? ' + İçecek' : ''}`;
    this.showToast(`Seçili Sipariş: ${order.customerName} (${summary})`, 'info');
    this.emitHUDState();
  }

  private setHeldItem(item: HeldItem | null): void {
    this.heldItem = item;
    if (!item) {
      this.currentPlacementEval = null;
      this.restaurant.syncGhostPreview(null, null, this.elapsed);
    }
    this.player.setHeldItemVisual(item, this.assets);
    this.syncActiveOrderStatuses();
    this.emitHUDState();
  }

  rotateHeldPlacementPreview(stepRadians = Math.PI / 4): void {
    if (!this.heldItem) return;
    this.placement.rotatePreview(stepRadians);
    this.audio.playMenuClick();
    this.emitHUDState();
  }

  private markSelectedOrderPreparing(): void {
    const activeOrders = this.customers.getActiveOrders();
    if (activeOrders.length === 0) return;
    const targetId =
      this.selectedOrderId && activeOrders.some((o) => o.id === this.selectedOrderId)
        ? this.selectedOrderId
        : activeOrders[0].id;
    this.startedOrderIds.add(targetId);
  }

  private syncActiveOrderStatuses(): void {
    const activeOrders = this.customers.getActiveOrders();
    const activeIds = new Set(activeOrders.map((o) => o.id));
    for (const id of Array.from(this.startedOrderIds)) {
      if (!activeIds.has(id)) {
        this.startedOrderIds.delete(id);
      }
    }

    const completedBoard = this.assembly.getCompletedBurgerRecipe();
    const hasCooking = this.cooking.hasActiveCooking();
    const hasAssemblyProgress = !this.assembly.isEmpty();
    const readySurfaceItems = this.placement.getReadySurfaceItems();

    this.selectedOrderId = evaluateIndependentOrderStatuses(
      activeOrders,
      this.selectedOrderId,
      this.heldItem,
      completedBoard,
      this.assembly.hasSoda,
      hasCooking || hasAssemblyProgress,
      this.startedOrderIds,
      readySurfaceItems
    );
    this.customers.syncSelectedOrderHighlight(this.selectedOrderId);
  }

  private pulseObjectScale(obj: THREE.Object3D, peakScale = 1.12): void {
    obj.scale.setScalar(peakScale);
    setTimeout(() => {
      obj.scale.setScalar(1.0);
    }, 110);
  }

  private placeHeldItemOnSurface(): boolean {
    if (!this.heldItem || !this.currentPlacementEval) return false;
    if (!this.currentPlacementEval.valid) {
      this.audio.playOrderFail();
      this.showToast(
        this.currentPlacementEval.reason || 'Buraya yerleştirilemez!',
        'error'
      );
      return false;
    }

    const res = this.placement.placeOrCombine(
      this.currentPlacementEval,
      this.heldItem
    );
    if (!res.success) {
      this.audio.playOrderFail();
      this.showToast(res.reason, 'error');
      return false;
    }

    this.player.triggerHandAnimation('place');
    this.audio.playPlaceOnCounter();
    this.setHeldItem(null);
    this.restaurant.syncPlacedSurfaceItems(this.placement.placedItems);
    this.syncActiveOrderStatuses();
    this.showToast(res.reason, 'info');
    this.emitHUDState();
    return true;
  }

  dropHeldItemToFloor(): void {
    if (!this.heldItem) return;
    const item = this.heldItem;
    this.player.triggerHandAnimation('toss');
    this.setHeldItem(null);
    this.audio.playDrop();

    const dropPos = this.player.getDropPositionInFront();
    const mesh = this.assets.createHeldItemVisual(item);
    mesh.position.copy(dropPos);

    const dropId = `dropped_${Date.now()}_${Math.random()}`;
    const target: InteractableTarget = {
      id: dropId,
      type: 'dropped_item',
      label: `Yerdeki ${item.label}`,
      mesh,
    };
    mesh.userData.interactable = target;
    mesh.traverse((c) => {
      c.userData.interactable = target;
    });

    this.scene.add(mesh);
    this.restaurant.interactableMeshes.push(mesh);
    this.droppedItems.push({
      id: dropId,
      item,
      mesh,
      vy: 0,
    });
    this.showToast(`${item.label} yere bırakıldı.`, 'info');
  }

  private clearDroppedItems(): void {
    for (const d of this.droppedItems) {
      this.scene.remove(d.mesh);
      const idx = this.restaurant.interactableMeshes.indexOf(d.mesh);
      if (idx !== -1) this.restaurant.interactableMeshes.splice(idx, 1);
    }
    this.droppedItems = [];
  }

  /**
   * Primary interaction (Left Click)
   */
  handlePrimaryInteract(): void {
    const target = this.hoveredTarget;
    if (!target) return;

    switch (target.type) {
      case 'handbook_shelf': {
        this.audio.playMenuClick();
        this.pulseObjectScale(target.mesh, 1.05);
        this.setMode('handbook');
        break;
      }

      case 'tray_stack': {
        this.interactWithTrayStack(target);
        break;
      }

      case 'placement_surface': {
        if (this.heldItem) {
          this.placeHeldItemOnSurface();
        }
        break;
      }

      case 'placed_item': {
        this.interactWithPlacedSurfaceItem(target);
        break;
      }

      case 'dropped_item': {
        if (this.heldItem) {
          this.showToast('Eliniz dolu! Önce elinizdeki nesneyi bir yüzeye (E) veya yere (G) bırakın.', 'error');
          return;
        }
        const idx = this.droppedItems.findIndex((d) => d.id === target.id);
        if (idx !== -1) {
          const entry = this.droppedItems[idx];
          this.scene.remove(entry.mesh);
          const mIdx = this.restaurant.interactableMeshes.indexOf(entry.mesh);
          if (mIdx !== -1) this.restaurant.interactableMeshes.splice(mIdx, 1);
          this.droppedItems.splice(idx, 1);
          this.player.triggerHandAnimation('pickup');
          this.audio.playPickup();
          this.setHeldItem(entry.item);
        }
        break;
      }

      case 'ingredient_bin': {
        if (this.heldItem) {
          this.showToast('Elinizde zaten bir nesne var! Önce yüzeye (E) bırakın.', 'error');
          return;
        }
        if (!target.ingredient || !target.stockKey) return;
        if (!this.economy.consumeStock(target.stockKey)) {
          this.audio.playOrderFail();
          this.showToast(
            `Stok tükendi! Kasa terminalinden ${target.label} stoğu satın alın.`,
            'error'
          );
          return;
        }
        this.markSelectedOrderPreparing();
        this.pulseObjectScale(target.mesh, 1.08);
        this.player.triggerHandAnimation('pickup');
        this.audio.playPickup();
        this.setHeldItem({
          type: target.ingredient,
          label: ITEM_LABELS[target.ingredient],
        });
        break;
      }

      case 'grill_slot': {
        const slotIdx = target.slotIndex ?? 0;
        const slot = this.cooking.slots[slotIdx];
        if (!slot) return;

        if (slot.state === 'empty') {
          if (this.heldItem?.type === 'patty_raw') {
            this.markSelectedOrderPreparing();
            this.cooking.placeRawPatty(slotIdx);
            this.player.triggerHandAnimation('place');
            this.pulseObjectScale(target.mesh, 1.08);
            this.setHeldItem(null);
            this.audio.playPlaceOnCounter();
            this.restaurant.syncGrillVisuals(this.cooking.slots, this.cooking.isUpgraded);
            this.showToast('Çiğ köfte ızgaraya bırakıldı. Pişiyor...', 'info');
          } else {
            this.showToast('Izgaraya koymak için elinize Çiğ Köfte alın.', 'info');
          }
        } else {
          if (this.heldItem) {
            this.showToast('Köfteyi almak için önce elinizdeki nesneyi bırakın.', 'error');
            return;
          }
          const taken = this.cooking.takePatty(slotIdx);
          if (taken) {
            this.markSelectedOrderPreparing();
            this.player.triggerHandAnimation('pickup');
            this.pulseObjectScale(target.mesh, 1.08);
            this.audio.playPickup();
            this.setHeldItem({
              type: taken.item,
              label: ITEM_LABELS[taken.item],
            });
            this.restaurant.syncGrillVisuals(this.cooking.slots, this.cooking.isUpgraded);
          }
        }
        break;
      }

      case 'assembly_board': {
        this.interactWithAssemblyBoard();
        break;
      }

      case 'soda_dispenser': {
        if (this.heldItem?.type === 'service_tray') {
          if (this.heldItem.hasSoda) {
            this.audio.playOrderFail();
            this.showToast('Servis tepsisinde zaten gazlı içecek var!', 'error');
            return;
          }
          if (!this.economy.consumeStock('soda')) {
            this.audio.playOrderFail();
            this.showToast('Gazlı içecek şurubu bitti! Kasadan stok yenileyin.', 'error');
            return;
          }
          this.markSelectedOrderPreparing();
          this.pulseObjectScale(target.mesh, 1.06);
          this.player.triggerHandAnimation('pickup');
          this.audio.playPickup();
          const updatedTray: HeldItem = {
            ...this.heldItem,
            hasSoda: true,
            label: formatServiceTrayLabel(this.heldItem.burgerRecipe, true),
          };
          this.setHeldItem(updatedTray);
          this.showToast('Gazlı içecek doğrudan servis tepsisine yerleştirildi.', 'success');
          return;
        }

        if (this.heldItem) {
          this.showToast('İçecek almak için eliniz boş olmalı veya Servis Tepsisi tutmalısınız.', 'error');
          return;
        }
        if (!this.economy.consumeStock('soda')) {
          this.audio.playOrderFail();
          this.showToast('Gazlı içecek şurubu bitti! Kasadan stok yenileyin.', 'error');
          return;
        }
        this.markSelectedOrderPreparing();
        this.pulseObjectScale(target.mesh, 1.06);
        this.player.triggerHandAnimation('pickup');
        this.audio.playPickup();
        this.setHeldItem({
          type: 'soda_cup',
          label: ITEM_LABELS.soda_cup,
        });
        this.showToast('Gazlı içecek dolduruldu.', 'info');
        break;
      }

      case 'trash_bin':
      case 'bussing_station': {
        this.disposeHeldItemOrClearBoard(target);
        break;
      }

      case 'dirty_table_tray': {
        this.pickupDirtyTrayFromTable(target);
        break;
      }

      case 'dirty_table_crumbs': {
        this.wipeDirtyTableSurface(target);
        break;
      }

      case 'pickup_tray': {
        this.deliverOrderAtPickup();
        break;
      }

      case 'pos_terminal': {
        this.player.triggerHandAnimation('tap_pos');
        this.pulseObjectScale(target.mesh, 1.06);
        this.setMode('pos_modal');
        break;
      }
    }
  }

  private pickupDirtyTrayFromTable(target: InteractableTarget): void {
    if (this.heldItem) {
      this.audio.playOrderFail();
      this.showToast(
        'Masadaki kirli tepsiyi toplamak için önce elinizdeki nesneyi bırakın!',
        'error'
      );
      return;
    }
    if (!target.seatId) return;
    const res = this.customers.dining.pickupDirtyTrayFromSeat(target.seatId);
    if (!res.success || !res.item) {
      this.audio.playOrderFail();
      this.showToast(res.reason, 'error');
      return;
    }
    this.player.triggerHandAnimation('pickup');
    this.audio.playPickup();
    this.restaurant.syncDirtyTableTrays(this.customers.dining.seats);
    this.setHeldItem(res.item);
    this.showToast(res.reason, 'info');
  }

  private wipeDirtyTableSurface(
    target: InteractableTarget,
    deltaProgress = 0.36
  ): void {
    if (this.heldItem) {
      this.audio.playOrderFail();
      this.showToast(
        'Masayı bezle silmek için önce elinizdeki nesneyi bir yüzeye veya atık istasyonuna bırakın!',
        'error'
      );
      return;
    }
    if (!target.seatId) return;
    const res = this.customers.dining.advanceWipeSeatSurface(
      target.seatId,
      deltaProgress
    );
    if (!res.success) {
      return;
    }

    if (this.player.handAnimator.getActiveAction() !== 'wipe') {
      this.player.triggerHandAnimation('wipe');
    }
    if (this.wipeAudioCooldown <= 0) {
      this.audio.playTableWipe();
      this.wipeAudioCooldown = 0.34;
    }

    // Progressively shrink and remove crumbs, napkins, and sauce smudges on the table
    this.restaurant.updateSeatWipeVisual(target.seatId, res.wipeProgress);

    if (res.completed) {
      if (res.bonusMoney > 0) {
        this.economy.money += res.bonusMoney;
        this.economy.dayStats.tipIncome += res.bonusMoney;
        this.economy.reputation = Math.min(
          100,
          this.economy.reputation + res.bonusReputation
        );
        this.economy.dayStats.reputationDelta += res.bonusReputation;
        this.audio.playCashRegister();
        this.restaurant.updatePOSScreen(
          this.shopOpen,
          this.economy.money,
          this.day,
          this.economy.reputation
        );
        this.persistProgress();
      }
      this.restaurant.syncDirtyTableTrays(this.customers.dining.seats);
      this.showToast(res.reason, 'success');
    }
    this.emitHUDState();
  }

  private disposeHeldItemOrClearBoard(target: InteractableTarget): void {
    if (this.heldItem) {
      const item = this.heldItem;
      this.player.triggerHandAnimation('toss');
      this.pulseObjectScale(target.mesh, 1.06);
      this.setHeldItem(null);

      this.audio.playDrop();
      if (item.type === 'dirty_tray') {
        this.showToast(
          'Kirli servis tepsisi atık istasyonuna bırakıldı. Masayı açmak için kalan kırıntıları bezle silin!',
          'info'
        );
      } else {
        this.showToast(`${item.label} atık istasyonuna bırakıldı.`, 'info');
      }
      this.emitHUDState();
    } else if (target.type === 'trash_bin' && !this.assembly.isEmpty()) {
      this.player.triggerHandAnimation('toss');
      this.assembly.clear();
      this.restaurant.syncAssemblyVisuals(
        this.assembly.layers,
        this.assembly.hasSoda
      );
      this.audio.playDrop();
      this.showToast('Hazırlama tezgâhı temizlendi.', 'info');
    } else if (target.type === 'bussing_station') {
      this.showToast(
        'Masalarda kalan kullanılmış servis tepsilerini (E) toplayıp buraya bırakabilirsiniz.',
        'info'
      );
    }
  }

  /**
   * Secondary interaction ('E' key)
   */
  handleSecondaryInteract(): void {
    const target = this.hoveredTarget;
    if (!target) return;

    if (target.type === 'handbook_shelf') {
      this.audio.playMenuClick();
      this.setMode('handbook');
      return;
    }

    if (target.type === 'pos_terminal') {
      this.player.triggerHandAnimation('tap_pos');
      this.setMode('pos_modal');
      return;
    }

    if (target.type === 'dirty_table_tray') {
      this.pickupDirtyTrayFromTable(target);
      return;
    }

    if (target.type === 'dirty_table_crumbs') {
      this.wipeDirtyTableSurface(target);
      return;
    }

    if (target.type === 'bussing_station' || target.type === 'trash_bin') {
      this.disposeHeldItemOrClearBoard(target);
      return;
    }

    if (target.type === 'placement_surface' && this.heldItem) {
      this.placeHeldItemOnSurface();
      return;
    }

    if (target.type === 'placed_item') {
      this.interactWithPlacedSurfaceItem(target);
      return;
    }

    if (target.type === 'tray_stack') {
      this.interactWithTrayStack(target);
      return;
    }

    if (target.type === 'assembly_board') {
      if (this.heldItem?.type === 'service_tray') {
        this.interactWithAssemblyBoard();
      } else {
        this.pickupCompletedTrayFromBoard();
      }
      return;
    }

    this.handlePrimaryInteract();
  }

  private interactWithTrayStack(target: InteractableTarget): void {
    if (!this.heldItem) {
      this.pulseObjectScale(target.mesh, 1.06);
      this.player.triggerHandAnimation('pickup');
      this.audio.playPickup();
      this.setHeldItem({
        type: 'service_tray',
        label: ITEM_LABELS.service_tray,
        hasSoda: false,
      });
      this.showToast(
        'Servis Tepsisi alındı! Tezgâha bırakabilir (E) veya üzerine burger ve içecek ekleyebilirsiniz.',
        'info'
      );
      return;
    }

    if (
      this.heldItem.type === 'service_tray' &&
      !this.heldItem.burgerRecipe &&
      !this.heldItem.hasSoda
    ) {
      this.pulseObjectScale(target.mesh, 1.06);
      this.player.triggerHandAnimation('place');
      this.audio.playPlaceOnCounter();
      this.setHeldItem(null);
      this.showToast('Boş servis tepsisi yığına geri bırakıldı.', 'info');
      return;
    }

    const emptyTray: HeldItem = {
      type: 'service_tray',
      label: ITEM_LABELS.service_tray,
      hasSoda: false,
    };
    const combined = combineItemIntoTray(emptyTray, this.heldItem);
    if (combined.success && combined.updatedTray) {
      this.pulseObjectScale(target.mesh, 1.06);
      this.player.triggerHandAnimation('pickup');
      this.audio.playPickup();
      this.setHeldItem(combined.updatedTray);
      this.showToast(`${combined.updatedTray.label} hazırlandı!`, 'success');
      return;
    }

    this.showToast('Yeni tepsi almak için önce elinizdeki nesneyi yüzeye (E) bırakın.', 'error');
  }

  private interactWithPlacedSurfaceItem(target: InteractableTarget): void {
    const placedId = target.placedItemId;
    if (!placedId) return;
    const existing = this.placement.getItemById(placedId);
    if (!existing) return;

    // Case 1: Empty hand -> Pick up placed item from surface
    if (!this.heldItem) {
      const taken = this.placement.takeItem(placedId);
      if (!taken) return;
      this.player.triggerHandAnimation('pickup');
      this.audio.playPickup();
      this.restaurant.syncPlacedSurfaceItems(this.placement.placedItems);
      this.setHeldItem(taken.item);
      this.showToast(`${taken.item.label} tezgâhtan alındı.`, 'info');
      return;
    }

    // Case 2: Holding burger or soda and clicking a placed Service Tray -> Combine into placed tray
    if (existing.item.type === 'service_tray') {
      const combineCheck = combineItemIntoTray(existing.item, this.heldItem);
      if (combineCheck.success && combineCheck.updatedTray) {
        this.placement.updatePlacedItem(placedId, combineCheck.updatedTray);
        this.player.triggerHandAnimation('place');
        this.audio.playPlaceOnCounter();
        this.setHeldItem(null);
        this.restaurant.syncPlacedSurfaceItems(this.placement.placedItems);
        this.syncActiveOrderStatuses();
        this.showToast(
          `${combineCheck.updatedTray.label} tepsi üzerinde birleştirildi!`,
          'success'
        );
        this.emitHUDState();
        return;
      } else {
        this.audio.playOrderFail();
        this.showToast(combineCheck.reason, 'error');
        return;
      }
    }

    // Case 3: Holding a Service Tray and clicking a placed burger or soda -> Put placed item onto held tray
    if (this.heldItem.type === 'service_tray') {
      const combineCheck = combineItemIntoTray(this.heldItem, existing.item);
      if (combineCheck.success && combineCheck.updatedTray) {
        this.placement.takeItem(placedId);
        this.player.triggerHandAnimation('pickup');
        this.audio.playPickup();
        this.restaurant.syncPlacedSurfaceItems(this.placement.placedItems);
        this.setHeldItem(combineCheck.updatedTray);
        this.showToast(
          `${existing.item.label} elinizdeki servis tepsisine alındı!`,
          'success'
        );
        return;
      }
    }

    // Case 4: Otherwise, if we have a valid placement evaluation on the same surface, place beside it
    if (this.currentPlacementEval?.valid) {
      this.placeHeldItemOnSurface();
      return;
    }

    this.audio.playOrderFail();
    this.showToast('Bu nokta dolu! Tezgâhta boş bir noktaya nişan alın.', 'error');
  }

  private interactWithAssemblyBoard(): void {
    if (!this.heldItem) {
      this.pickupCompletedTrayFromBoard();
      return;
    }

    // Holding a Service Tray and interacting with a finished burger on the assembly board
    if (this.heldItem.type === 'service_tray') {
      const completedRecipe = this.assembly.getCompletedBurgerRecipe();
      if (!completedRecipe) {
        this.audio.playOrderFail();
        this.showToast(
          'Hazırlama tezgâhında tamamlanmış bir burger yok.',
          'error'
        );
        return;
      }
      if (this.heldItem.burgerRecipe) {
        this.audio.playOrderFail();
        this.showToast('Servis tepsisinde zaten bir burger bulunuyor!', 'error');
        return;
      }

      const layersCopy = [...this.assembly.layers];
      const mergedSoda = Boolean(this.heldItem.hasSoda || this.assembly.hasSoda);
      this.assembly.clear();
      this.restaurant.syncAssemblyVisuals(this.assembly.layers, this.assembly.hasSoda);

      this.player.triggerHandAnimation('pickup');
      this.audio.playPickup();
      const updatedTray: HeldItem = {
        type: 'service_tray',
        burgerRecipe: completedRecipe,
        layers: layersCopy,
        hasSoda: mergedSoda,
        label: formatServiceTrayLabel(completedRecipe, mergedSoda),
      };
      this.setHeldItem(updatedTray);
      this.showToast(
        `${RECIPES[completedRecipe].name} servis tepsisine yerleştirildi!`,
        'success'
      );
      return;
    }

    if (this.heldItem.type === 'soda_cup') {
      const res = this.assembly.addSoda();
      if (!res.success) {
        this.audio.playOrderFail();
        this.showToast(res.reason || 'İçecek eklenemedi.', 'error');
        return;
      }
      this.markSelectedOrderPreparing();
      this.player.triggerHandAnimation('place');
      this.setHeldItem(null);
      this.audio.playPlaceOnCounter();
      this.restaurant.syncAssemblyVisuals(this.assembly.layers, this.assembly.hasSoda);
      this.showToast('Gazlı içecek hazırlama tezgâhına eklendi.', 'success');
      return;
    }

    const ing = this.heldItem.type;
    if (
      ing === 'bun_bottom' ||
      ing === 'patty_raw' ||
      ing === 'patty_cooked' ||
      ing === 'patty_burnt' ||
      ing === 'cheese' ||
      ing === 'lettuce' ||
      ing === 'bun_top'
    ) {
      const check = this.assembly.addIngredient(ing);
      if (!check.canAdd) {
        this.audio.playOrderFail();
        this.showToast(check.reason || 'Bu malzeme eklenemez.', 'error');
        return;
      }

      this.markSelectedOrderPreparing();
      this.player.triggerHandAnimation('place');
      this.setHeldItem(null);
      this.audio.playPlaceOnCounter();
      this.restaurant.syncAssemblyVisuals(this.assembly.layers, this.assembly.hasSoda);

      if (check.completedRecipe) {
        const recipeName = RECIPES[check.completedRecipe].name;
        this.showToast(
          `${recipeName} tamamlandı! Elinize alabilir veya Servis Tepsisine koyabilirsiniz.`,
          'success'
        );
      }
    }
  }

  private pickupCompletedTrayFromBoard(): void {
    if (this.heldItem) {
      this.showToast('Almak için eliniz boş olmalı veya Servis Tepsisi tutmalısınız!', 'error');
      return;
    }

    const recipe = this.assembly.getCompletedBurgerRecipe();
    if (!recipe) {
      if (this.assembly.layers.length === 0) {
        this.showToast('Hazırlama tezgâhı boş. Önce Alt Ekmek koyun.', 'info');
      } else {
        this.showToast(`Burger henüz tamamlanmadı: ${this.assembly.getNextHint()}`, 'error');
      }
      return;
    }

    const burgerType =
      recipe === 'double_smash'
        ? 'burger_double_smash'
        : recipe === 'cheeseburger'
        ? 'burger_cheese'
        : 'burger_classic';
    const hasSoda = this.assembly.hasSoda;
    const label = `${RECIPES[recipe].name}${hasSoda ? ' + İçecek' : ''}`;

    const layersCopy = [...this.assembly.layers];
    this.assembly.clear();
    this.restaurant.syncAssemblyVisuals(this.assembly.layers, this.assembly.hasSoda);

    this.player.triggerHandAnimation('pickup');
    this.audio.playPickup();
    this.setHeldItem({
      type: burgerType,
      burgerRecipe: recipe,
      label,
      layers: layersCopy,
      hasSoda,
    });
    this.showToast(
      `${label} alındı! Servis tepsisine koyabilir (E) veya teslim bankosuna götürebilirsiniz.`,
      'info'
    );
  }

  private deliverOrderAtPickup(): void {
    const targetOrder =
      this.customers.getActiveOrderById(this.selectedOrderId) ||
      this.customers.getFirstPendingOrder();
    const res = this.economy.validateAndDeliverOrder(targetOrder, this.heldItem);

    if (!res.valid) {
      this.player.triggerHandAnimation('refuse_recoil');
      if (targetOrder) {
        this.customers.refuseCustomerOrder(targetOrder.id);
      }
      this.audio.playOrderFail();
      this.showToast(res.reason, 'error');
      this.emitHUDState();
      return;
    }

    const deliveredItem = this.heldItem;
    this.player.triggerHandAnimation('deliver');
    this.setHeldItem(null);
    this.audio.playOrderSuccess();

    if (targetOrder) {
      this.startedOrderIds.delete(targetOrder.id);
      const deliveryOutcome = this.customers.completeCustomerOrder(targetOrder.id);
      this.deliveryBanner = {
        customerName: targetOrder.customerName,
        recipeName: `${RECIPES[targetOrder.burger].name}${
          targetOrder.wantsSoda ? ' + İçecek' : ''
        }`,
        basePrice: targetOrder.totalPrice,
        tip: res.tip,
        reputationDelta: res.reputationDelta,
        timer: 3.0,
      };
      const seatNote = deliveryOutcome.dinedIn
        ? ' (Masaya geçiyor)'
        : ' (Paket servis)';
      this.showToast(`${res.reason}${seatNote}`, 'success');
    } else {
      this.showToast(res.reason, 'success');
    }

    this.syncActiveOrderStatuses();

    this.restaurant.flashDeliveryTray(deliveredItem?.layers, deliveredItem?.hasSoda);
    this.restaurant.updatePOSScreen(
      this.shopOpen,
      this.economy.money,
      this.day,
      this.economy.reputation
    );
    this.effects.spawnCelebrationBurst(
      STATIONS.pickupTray.position.x,
      STATIONS.pickupTray.position.y,
      STATIONS.pickupTray.position.z
    );
    this.persistProgress();
    this.emitHUDState();
  }

  private buildInteractionPrompt(target: InteractableTarget | null): InteractionPromptInfo | null {
    if (!target) return null;

    switch (target.type) {
      case 'handbook_shelf':
        return {
          title: 'REHBER KİTAPÇIK',
          actionKey: 'E / F1',
          primaryHint: 'İşletme & Mutfak Rehberini Aç',
          badgeText: '7 SAYFA',
        };

      case 'dirty_table_tray':
        return {
          title: 'MASA TEMİZLİĞİ (1/2)',
          actionKey: 'E / Sol Tık',
          primaryHint: this.heldItem
            ? 'Önce Elinizi Boşaltın'
            : '1. Adım: Kullanılmış Servis Tepsisini Al',
          badgeText: '1/2 TEPSİYİ TOPLA',
          progressState: this.heldItem ? 'burnt' : 'cooking',
        };

      case 'dirty_table_crumbs': {
        const seat = target.seatId
          ? this.customers.dining.getSeatById(target.seatId)
          : null;
        const wipePct = seat ? Math.round(seat.wipeProgress * 100) : 0;
        return {
          title: 'MASA TEMİZLİĞİ (2/2)',
          actionKey: 'Basılı Tut: E / Sol Tık',
          primaryHint: this.heldItem
            ? 'Bezle Silmek İçin Elinizi Boşaltın'
            : wipePct > 0
            ? `Masayı Bezle Siliyorsunuz (%${wipePct})...`
            : '2. Adım: Masayı Bezle Sil (+5 $ Prim)',
          badgeText:
            wipePct > 0 ? `%${wipePct} SİLİNİYOR` : '2/2 BEZLE SİL (+5$)',
          progress: this.heldItem ? undefined : seat ? seat.wipeProgress : 0,
          progressState: this.heldItem ? 'burnt' : 'cooked',
        };
      }

      case 'bussing_station':
        return {
          title: 'TEPSİ & ATIK İSTASYONU',
          actionKey: 'E / Sol Tık',
          primaryHint:
            this.heldItem?.type === 'dirty_tray'
              ? 'Kirli Servis Tepsisini Bırak'
              : this.heldItem
              ? `${this.heldItem.label} Atığa Bırak`
              : 'Kullanılmış Tepsileri Buraya Bırakın',
          badgeText:
            this.heldItem?.type === 'dirty_tray' ? 'TEPSİ BIRAK' : 'Tepsi Dönüş',
          progressState:
            this.heldItem?.type === 'dirty_tray' ? 'cooked' : undefined,
        };

      case 'tray_stack':
        return {
          title: 'SERVİS TEPSİLERİ',
          actionKey: 'E / Sol Tık',
          primaryHint: this.heldItem
            ? this.heldItem.type === 'service_tray' &&
              !this.heldItem.burgerRecipe &&
              !this.heldItem.hasSoda
              ? 'Boş Tepsiyi Geri Bırak'
              : 'Tepsiye Yerleştir ve Al'
            : 'Servis Tepsisi Al',
          badgeText: 'Tepsi Yığını',
        };

      case 'placement_surface': {
        if (!this.heldItem || !this.currentPlacementEval) return null;
        return {
          title: target.label.toUpperCase(),
          actionKey: 'E / Sol Tık',
          primaryHint:
            this.currentPlacementEval.reason ||
            `${this.heldItem.label} Bırak`,
          badgeText: this.currentPlacementEval.valid ? 'YERLEŞTİR [R Döndür]' : 'DOLU ALAN',
          progressState: this.currentPlacementEval.valid ? 'cooked' : 'burnt',
        };
      }

      case 'placed_item': {
        const placed = target.placedItemId
          ? this.placement.getItemById(target.placedItemId)
          : null;
        if (!placed) return null;
        if (!this.heldItem) {
          return {
            title: 'TEZGÂHTAKİ NESNE',
            actionKey: 'E / Sol Tık',
            primaryHint: `${placed.item.label} Al`,
            badgeText: placed.item.type === 'service_tray' ? 'Servis Tepsisi' : 'Yüzeyde',
          };
        }
        if (placed.item.type === 'service_tray') {
          const check = combineItemIntoTray(placed.item, this.heldItem);
          return {
            title: 'SERVİS TEPSİSİ',
            actionKey: 'E / Sol Tık',
            primaryHint: check.success
              ? `${this.heldItem.label} Tepsiye Koy`
              : check.reason,
            badgeText: check.success ? 'BİRLEŞTİR' : 'DOLU',
            progressState: check.success ? 'cooked' : 'burnt',
          };
        }
        if (this.heldItem.type === 'service_tray') {
          const check = combineItemIntoTray(this.heldItem, placed.item);
          if (check.success) {
            return {
              title: 'TEPSİYE AL',
              actionKey: 'E / Sol Tık',
              primaryHint: `${placed.item.label} Tepsiye Al`,
              badgeText: 'TEPSİ',
            };
          }
        }
        return {
          title: 'TEZGÂHTAKİ NESNE',
          actionKey: 'R / E',
          primaryHint: `${placed.item.label} (Yanına Bırak)`,
        };
      }

      case 'pos_terminal':
        return {
          title: 'POS TERMİNALİ',
          actionKey: 'E / Sol Tık',
          primaryHint: 'Kasa & Yönetim Ekranını Aç',
          badgeText: this.shopOpen ? 'SERVİS AÇIK' : 'SERVİS KAPALI',
        };

      case 'ingredient_bin': {
        const count = target.stockKey ? this.economy.stock[target.stockKey] : 0;
        const maxCap = this.economy.getMaxStockCapacity();
        return {
          title: target.label.toUpperCase(),
          actionKey: 'Sol Tık',
          primaryHint: `${target.ingredient ? ITEM_LABELS[target.ingredient] : 'Malzeme'} Al`,
          badgeText: `Stok ${count}/${maxCap}`,
        };
      }

      case 'grill_slot': {
        const slotIdx = target.slotIndex ?? 0;
        const slot = this.cooking.slots[slotIdx];
        if (!slot) return null;
        if (slot.state === 'empty') {
          return {
            title: `IZGARA · BÖLME #${slotIdx + 1}`,
            actionKey: 'Sol Tık',
            primaryHint:
              this.heldItem?.type === 'patty_raw'
                ? 'Çiğ Köfteyi Yerleştir'
                : 'Çiğ Köfte Bırak',
            badgeText: this.cooking.isUpgraded ? 'Hızlı Izgara' : 'Boş Bölme',
          };
        }
        const pct = Math.round(slot.progress * 100);
        const badgeText =
          slot.state === 'cooking'
            ? `%${pct} Pişiyor`
            : slot.state === 'cooked'
            ? 'PİŞTİ · HAZIR'
            : 'YANDI!';
        return {
          title: `IZGARA · BÖLME #${slotIdx + 1}`,
          actionKey: 'Sol Tık',
          primaryHint:
            slot.state === 'cooked'
              ? 'Pişmiş Köfteyi Al'
              : slot.state === 'burnt'
              ? 'Yanmış Köfteyi Al'
              : 'Köfteyi Izgaradan Al',
          badgeText,
          progress: slot.state === 'cooking' ? slot.progress : 1,
          progressState: slot.state,
        };
      }

      case 'assembly_board': {
        const completed = this.assembly.getCompletedBurgerRecipe();
        if (completed && !this.heldItem) {
          return {
            title: 'HAZIRLAMA TEZGÂHI',
            actionKey: 'E / Sol Tık',
            primaryHint: `${RECIPES[completed].name} Al`,
            badgeText: this.assembly.hasSoda ? '+ İçecek Hazır' : 'Burger Hazır',
          };
        }
        if (completed && this.heldItem?.type === 'service_tray') {
          return {
            title: 'HAZIRLAMA TEZGÂHI',
            actionKey: 'E / Sol Tık',
            primaryHint: `${RECIPES[completed].name} Servis Tepsisine Koy`,
            badgeText: 'TEPSİYE AKTAR',
            progressState: 'cooked',
          };
        }
        return {
          title: 'HAZIRLAMA TEZGÂHI',
          actionKey: this.heldItem ? 'Sol Tık' : 'E',
          primaryHint: this.heldItem
            ? `${this.heldItem.label} Yerleştir`
            : this.assembly.getNextHint(),
          badgeText: `${this.assembly.layers.length} Katman`,
        };
      }

      case 'soda_dispenser':
        return {
          title: 'İÇECEK İSTASYONU',
          actionKey: 'Sol Tık',
          primaryHint:
            this.heldItem?.type === 'service_tray'
              ? 'İçeceği Servis Tepsisine Doldur'
              : 'Gazlı İçecek Doldur',
          badgeText: `Stok ${this.economy.stock.soda}/${this.economy.getMaxStockCapacity()}`,
        };

      case 'pickup_tray': {
        const order =
          this.customers.getActiveOrderById(this.selectedOrderId) ||
          this.customers.getFirstPendingOrder();
        return {
          title: 'TESLİM BANKOSU',
          actionKey: 'E / Sol Tık',
          primaryHint: order
            ? `${order.customerName} Siparişini Teslim Et`
            : 'Bekleyen Sipariş Yok',
          badgeText: order
            ? `${RECIPES[order.burger].name}${order.wantsSoda ? ' + İçecek' : ''}`
            : 'Kuyruk Boş',
        };
      }

      case 'trash_bin':
        return {
          title: 'ATIK İSTASYONU',
          actionKey: 'E / Sol Tık',
          primaryHint:
            this.heldItem?.type === 'dirty_tray'
              ? 'Kirli Servis Tepsisini Bırak'
              : this.heldItem
              ? `${this.heldItem.label} Çöpe At`
              : 'Hazırlama Tezgâhını Temizle',
        };

      case 'dropped_item':
        return {
          title: 'YERDEKİ NESNE',
          actionKey: 'Sol Tık',
          primaryHint: `${target.label.replace(/^Yerdeki\s+/i, '')} Al`,
        };
    }
  }

  showToast(text: string, type: 'info' | 'success' | 'error' = 'info'): void {
    this.toast = { text, type, timer: 3.4 };
    this.emitHUDState();
  }

  private startLoop(): void {
    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      const now = performance.now();
      const rawDt = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;
      const dt = Math.min(rawDt, 0.05);
      this.elapsed += dt;

      const t0 = performance.now();
      this.updateSimulation(dt);
      this.renderer.render(this.scene, this.camera);
      const frameCost = performance.now() - t0;

      this.perfStats.frameTimeMs = Number((this.perfStats.frameTimeMs * 0.85 + frameCost * 0.15).toFixed(2));
      this.perfStats.fps = Math.round(1000 / Math.max(1, rawDt * 1000));
      this.perfStats.drawCalls = this.renderer.info.render.calls;
      this.perfStats.triangles = this.renderer.info.render.triangles;

      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.lastFrameTime = performance.now();
    this.frameId = requestAnimationFrame(tick);
  }

  private updateSimulation(dt: number): void {
    if (this.mode === 'title') {
      this.player.handAnchor.visible = false;
      this.restaurant.updateExteriorTraffic(dt);
      const t = this.elapsed * 0.22;
      const camX = 1.45 + Math.sin(t) * 1.15;
      const camY = 1.92 + Math.cos(t * 0.7) * 0.08;
      const camZ = 3.25 + Math.cos(t * 0.5) * 0.55;
      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(
        0.35 + Math.sin(t * 0.6) * 0.55,
        1.32,
        -2.45 + Math.cos(t * 0.4) * 0.45
      );
      return;
    }

    this.player.handAnchor.visible = true;

    if (
      this.mode !== 'playing' &&
      this.mode !== 'pos_modal' &&
      this.mode !== 'handbook'
    ) {
      return;
    }

    // 1. Player movement, raycast target detection & Smart Placement ghost preview
    this.wipeAudioCooldown = Math.max(0, this.wipeAudioCooldown - dt);
    if (this.mode === 'playing') {
      this.player.update(dt, this.settings.headBob, () => this.audio.playFootstep());
      const detailed = this.player.raycastDetailed(
        this.restaurant.interactableMeshes,
        true
      );
      this.hoveredTarget = detailed.target;

      // Continuous hold-to-wipe progression when aiming at a dirty table surface and holding E or Left Click
      if (
        this.hoveredTarget?.type === 'dirty_table_crumbs' &&
        !this.heldItem &&
        (this.player.keysPressed.has('KeyE') || this.isMouseDownOnCanvas)
      ) {
        this.wipeDirtyTableSurface(this.hoveredTarget, dt * 0.95);
      }

      // Contextual customer gaze detection: show compact floating pill only when player looks directly at a customer
      const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(
        this.camera.quaternion
      );
      const toCust = new THREE.Vector3();
      for (const c of this.customers.customers) {
        toCust.set(
          c.root.position.x - this.camera.position.x,
          c.root.position.y + 1.35 - this.camera.position.y,
          c.root.position.z - this.camera.position.z
        );
        const dist = toCust.length();
        let lookedAt = false;
        if (dist > 0.2 && dist < 2.25) {
          toCust.divideScalar(dist);
          lookedAt = camForward.dot(toCust) > 0.991;
        }
        if (c.isHoveredByPlayer !== lookedAt) {
          c.isHoveredByPlayer = lookedAt;
          c.updateBadgeVisibility();
        }
      }

      if (this.heldItem && detailed.target && detailed.point) {
        if (detailed.target.type === 'placement_surface' && detailed.target.surfaceId) {
          this.currentPlacementEval = this.placement.evaluate(
            detailed.target.surfaceId,
            detailed.point.x,
            detailed.point.z,
            this.heldItem
          );
        } else if (
          detailed.target.type === 'placed_item' &&
          detailed.target.placedItemId
        ) {
          const placed = this.placement.getItemById(
            detailed.target.placedItemId
          );
          this.currentPlacementEval = placed
            ? this.placement.evaluate(
                placed.surfaceId,
                detailed.point.x,
                detailed.point.z,
                this.heldItem
              )
            : null;
        } else {
          this.currentPlacementEval = null;
        }
      } else {
        this.currentPlacementEval = null;
      }

      this.restaurant.syncGhostPreview(
        this.currentPlacementEval,
        this.heldItem,
        this.elapsed
      );
    }

    // 2. Dropped items gravity & floor landing (never falls through floor y=0.02)
    for (const d of this.droppedItems) {
      if (d.mesh.position.y > 0.02) {
        d.vy -= 9.8 * dt;
        d.mesh.position.y = Math.max(0.02, d.mesh.position.y + d.vy * dt);
      }
    }

    // 3. Grill cooking progress, sizzle audio, and smoke particles
    const cookEvents = this.cooking.update(dt);
    const hasCooking = this.cooking.hasActiveCooking();
    this.audio.updateSizzle(hasCooking && this.mode === 'playing');

    if (hasCooking) {
      this.restaurant.syncGrillVisuals(this.cooking.slots, this.cooking.isUpgraded);
      this.smokeAccum += dt;
      if (this.smokeAccum >= 0.22) {
        this.smokeAccum = 0;
        this.cooking.slots.forEach((slot, idx) => {
          if (slot.state !== 'empty') {
            const pos = STATIONS.grill.slots[idx];
            this.effects.spawnSmoke(pos.x, pos.y, pos.z, slot.state === 'burnt');
          }
        });
      }
    }

    if (cookEvents.newlyCooked.length > 0) {
      this.audio.playCookedDing();
      this.showToast('Izgaradaki köfte pişti! Yanmadan alın.', 'success');
    }
    if (cookEvents.newlyBurnt.length > 0) {
      this.audio.playOrderFail();
      this.showToast('Dikkat! Izgaradaki köfte yandı! Çöpe atmalısınız.', 'error');
    }

    // 4. Evaluate DayPhase & dynamic sun/interior lighting
    const nextPhase = evaluateDayPhase(this.timeRemaining);
    if (this.shopOpen && nextPhase !== this.dayPhase) {
      this.dayPhase = nextPhase;
      if (nextPhase === 'rush_hour') {
        this.audio.playCookedDing();
        this.showToast(
          'ÖĞLE YOĞUNLUĞU (RUSH HOUR) Başladı! Müşteri akışı hızlandı!',
          'info'
        );
      } else if (nextPhase === 'closing') {
        this.showToast('Akşam Kapanış Servisi başladı. Son siparişleri yetiştirin!', 'info');
      }
    }

    if (this.shopOpen) {
      this.lighting.updateDayTimeAtmosphere(
        this.timeRemaining,
        GAME_CONFIG.dayDurationSeconds,
        this.economy.decorUpgraded
      );
    }

    // 5. Customer AI state machine, order queue, dining tables & patience timeout
    this.customers.update(dt, this.elapsed, this.shopOpen, {
      dayPhase: this.dayPhase,
      unlockedRecipes: this.economy.unlockedRecipes,
      decorUpgraded: this.economy.decorUpgraded,
      reputation: this.economy.reputation,
      onNewOrderPlaced: (newOrder) => {
        this.audio.playPickup();
        const recipeName = RECIPES[newOrder.burger].name;
        this.showToast(
          `Yeni Sipariş (${newOrder.customerName}): ${recipeName}${newOrder.wantsSoda ? ' + İçecek' : ''}`,
          'info'
        );
        this.syncActiveOrderStatuses();
        this.emitHUDState();
      },
      onCustomerLost: (customer) => {
        this.economy.recordCustomerLost();
        this.audio.playOrderFail();
        this.restaurant.updatePOSScreen(
          this.shopOpen,
          this.economy.money,
          this.day,
          this.economy.reputation
        );
        this.showToast(
          `${customer.profile.name} çok beklediği için kızıp dükkândan ayrıldı! (-8 İtibar)`,
          'error'
        );
        this.emitHUDState();
      },
      onSeatBecameDirty: (seat, customer) => {
        this.restaurant.syncDirtyTableTrays(this.customers.dining.seats);
        this.showToast(
          `${customer.profile.name} masadan kalktı! ${seat.label}: Önce tepsiyi (E) alın, ardından yüzeyi bezle silin.`,
          'info'
        );
        this.emitHUDState();
      },
      onCustomerEntered: () => {
        this.audio.playDoorBell();
      },
      onCustomerSeated: () => {
        this.audio.playSeatSit();
      },
    });

    this.syncActiveOrderStatuses();

    // 6. Workday timer countdown
    if (this.shopOpen) {
      this.timeRemaining = Math.max(0, this.timeRemaining - dt);
      if (this.timeRemaining <= 0) {
        this.endWorkDay();
        return;
      }
    }

    // 7. Toast & Delivery Banner timers
    if (this.toast) {
      this.toast.timer -= dt;
      if (this.toast.timer <= 0) {
        this.toast = null;
      }
    }
    if (this.deliveryBanner) {
      this.deliveryBanner.timer -= dt;
      if (this.deliveryBanner.timer <= 0) {
        this.deliveryBanner = null;
      }
    }

    this.effects.update(dt);
    this.restaurant.updateExteriorTraffic(dt);

    // Throttle HUD state push to ~8Hz so React never re-renders at 60Hz
    this.uiSyncAccum += dt;
    if (this.uiSyncAccum >= 0.12) {
      this.uiSyncAccum = 0;
      this.emitHUDState();
    }
  }

  emitHUDState(): void {
    const activeCustomerCount = this.customers.customers.filter(
      (c) => c.state !== 'LEAVING' && c.state !== 'LEAVING_ANGRY'
    ).length;

    const seatedCustomerCount = this.customers.customers.filter(
      (c) =>
        c.state === 'SITTING_DOWN' ||
        c.state === 'DINING' ||
        c.state === 'STANDING_UP'
    ).length;

    const dirtyTableCount = this.customers.dining.getDirtySeats().length;

    const isLookingAtStockStation = Boolean(
      this.hoveredTarget &&
        (this.hoveredTarget.type === 'ingredient_bin' ||
          this.hoveredTarget.type === 'soda_dispenser')
    );

    this.onStateUpdate({
      mode: this.mode,
      day: this.day,
      timeRemaining: this.timeRemaining,
      dayPhase: this.dayPhase,
      dayPhaseLabel: DAY_PHASE_LABELS[this.dayPhase],
      shopOpen: this.shopOpen,
      money: this.economy.money,
      reputation: this.economy.reputation,
      stock: { ...this.economy.stock },
      maxStockCapacity: this.economy.getMaxStockCapacity(),
      grillUpgraded: this.economy.grillUpgraded,
      decorUpgraded: this.economy.decorUpgraded,
      coldStorageUpgraded: this.economy.coldStorageUpgraded,
      unlockedRecipes: [...this.economy.unlockedRecipes],
      activeCustomerCount,
      seatedCustomerCount,
      dirtyTableCount,
      heldItem: this.heldItem ? { ...this.heldItem } : null,
      activeOrders: this.customers.getActiveOrders().map((o) => ({ ...o })),
      selectedOrderId: this.selectedOrderId,
      grillSlots: this.cooking.slots.map((s) => ({ ...s })),
      assemblyLayersCount: this.assembly.layers.length,
      assemblyHasSoda: this.assembly.hasSoda,
      assemblyHint: this.assembly.getNextHint(),
      interactionPrompt: this.buildInteractionPrompt(this.hoveredTarget),
      placementPreviewValid: this.currentPlacementEval
        ? this.currentPlacementEval.valid
        : null,
      isLookingAtStockStation,
      placedSurfaceCount: this.placement.placedItems.length,
      toastMessage: this.toast ? { text: this.toast.text, type: this.toast.type } : null,
      deliveryBanner: this.deliveryBanner
        ? {
            customerName: this.deliveryBanner.customerName,
            recipeName: this.deliveryBanner.recipeName,
            basePrice: this.deliveryBanner.basePrice,
            tip: this.deliveryBanner.tip,
            reputationDelta: this.deliveryBanner.reputationDelta,
          }
        : null,
      dayStats: { ...this.economy.dayStats },
      settings: { ...this.settings },
      hasSavedGame: SaveManager.hasSave(),
    });
  }

  dispose(): void {
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onWindowMouseUp);
    this.audio.silenceAll();
    this.mats.dispose();
    this.renderer.dispose();
  }
}
