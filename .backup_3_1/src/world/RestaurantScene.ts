import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeldItem, IngredientType } from '../core/GameConfig';
import { AssetFactory } from '../rendering/AssetFactory';
import { MaterialLibrary } from '../rendering/MaterialLibrary';
import { PLACEMENT_SURFACES, STATIONS } from './RestaurantLayout';
import { DiningSeatState } from '../gameplay/DiningSystem';
import { GrillSlot } from '../gameplay/CookingSystem';
import { PlacedSurfaceItem, PlacementEvaluation } from '../gameplay/SmartPlacementSystem';
import { StreetPedestrianActor } from '../entities/Customer';

export interface InteractableTarget {
  id: string;
  type:
    | 'pos_terminal'
    | 'pickup_tray'
    | 'tray_stack'
    | 'handbook_shelf'
    | 'bussing_station'
    | 'dirty_table_tray'
    | 'dirty_table_crumbs'
    | 'grill_slot'
    | 'assembly_board'
    | 'soda_dispenser'
    | 'trash_bin'
    | 'ingredient_bin'
    | 'placement_surface'
    | 'placed_item'
    | 'dropped_item';
  label: string;
  slotIndex?: number;
  ingredient?: IngredientType;
  stockKey?: 'bun' | 'patty' | 'cheese' | 'lettuce' | 'soda';
  surfaceId?: string;
  placedItemId?: string;
  seatId?: string;
  mesh: THREE.Object3D;
}

export class RestaurantScene {
  readonly scene: THREE.Scene;
  readonly interactableMeshes: THREE.Object3D[] = [];
  readonly kitchenReadyPromise: Promise<void>;
  private mats: MaterialLibrary;
  private assets: AssetFactory;

  // Dynamic visual groups
  readonly kitchenGlbGroup = new THREE.Group();
  readonly legacyKitchenGroup = new THREE.Group();
  kitchenGlbStats = {
    loaded: false,
    loadTimeMs: 0,
    meshCount: 0,
    materialCount: 0,
    vertexCount: 0,
    triangleCount: 0,
    activeMode: 'glb' as 'glb' | 'legacy_boxes' | 'none',
    legacyAttachedToScene: false,
  };
  private grillSlotVisuals: THREE.Group[] = [];
  private assemblyVisualGroup = new THREE.Group();
  private pickupVisualGroup = new THREE.Group();
  readonly placedSurfaceGroup = new THREE.Group();
  readonly dirtyTableTraysGroup = new THREE.Group();
  readonly ghostPreviewGroup = new THREE.Group();
  private ghostCacheKey = '';
  readonly decorUpgradeGroup = new THREE.Group();
  readonly coldStorageUpgradeGroup = new THREE.Group();
  private grillBodyMesh: THREE.Mesh | null = null;
  private posScreenCanvas: HTMLCanvasElement;
  private posScreenTexture: THREE.CanvasTexture;
  private passingCars: {
    group: THREE.Group;
    speed: number;
    minX: number;
    maxX: number;
  }[] = [];
  readonly streetPedestrians: StreetPedestrianActor[] = [];
  private streetElapsed = 0;

  constructor(scene: THREE.Scene, mats: MaterialLibrary, assets: AssetFactory) {
    this.scene = scene;
    this.mats = mats;
    this.assets = assets;

    this.posScreenCanvas = document.createElement('canvas');
    this.posScreenCanvas.width = 256;
    this.posScreenCanvas.height = 160;
    this.posScreenTexture = new THREE.CanvasTexture(this.posScreenCanvas);
    this.posScreenTexture.colorSpace = THREE.SRGBColorSpace;

    this.buildArchitecture();
    this.buildExteriorStreet();
    this.buildMainCounterAndPOS();
    this.kitchenReadyPromise = this.buildKitchenStations();
    this.buildDiningArea();
    this.buildLightingFixturesAndSignage();
    this.buildPlacementSurfaces();

    this.kitchenGlbGroup.name = 'IndustrialKitchenGLBGroup';
    this.legacyKitchenGroup.name = 'LegacyProceduralKitchenGroup';
    this.scene.add(this.kitchenGlbGroup);
    // Note: legacyKitchenGroup is NOT added to this.scene by default so old models never double-render!
    this.scene.add(this.assemblyVisualGroup);
    this.scene.add(this.pickupVisualGroup);
    this.scene.add(this.placedSurfaceGroup);
    this.scene.add(this.dirtyTableTraysGroup);
    this.scene.add(this.ghostPreviewGroup);
    this.buildUpgradeVisualGroups();
    this.scene.add(this.decorUpgradeGroup);
    this.scene.add(this.coldStorageUpgradeGroup);
    this.syncUpgradesVisuals(false, false);
    this.updatePOSScreen(false, 200, 1, 50);
  }

  /**
   * Switch kitchen representation strictly for A/B visual & performance comparison.
   * Ensures old and new kitchen meshes are NEVER rendered simultaneously.
   */
  setKitchenComparisonMode(mode: 'glb' | 'legacy_boxes' | 'none'): void {
    this.kitchenGlbStats.activeMode = mode;
    if (mode === 'glb') {
      if (this.legacyKitchenGroup.parent) {
        this.scene.remove(this.legacyKitchenGroup);
      }
      if (!this.kitchenGlbGroup.parent) {
        this.scene.add(this.kitchenGlbGroup);
      }
      this.kitchenGlbGroup.visible = true;
      this.kitchenGlbStats.legacyAttachedToScene = false;
    } else if (mode === 'legacy_boxes') {
      if (this.kitchenGlbGroup.parent) {
        this.scene.remove(this.kitchenGlbGroup);
      }
      if (this.legacyKitchenGroup.children.length === 0) {
        this.populateLegacyBoxKitchen();
      }
      if (!this.legacyKitchenGroup.parent) {
        this.scene.add(this.legacyKitchenGroup);
      }
      this.legacyKitchenGroup.visible = true;
      this.kitchenGlbStats.legacyAttachedToScene = true;
    } else {
      if (this.kitchenGlbGroup.parent) {
        this.scene.remove(this.kitchenGlbGroup);
      }
      if (this.legacyKitchenGroup.parent) {
        this.scene.remove(this.legacyKitchenGroup);
      }
      this.kitchenGlbStats.legacyAttachedToScene = false;
    }
  }

  private populateLegacyBoxKitchen(): void {
    const oldCounter = new THREE.Mesh(
      new THREE.BoxGeometry(10.0, 0.9, 1.05),
      this.mats.stainlessSteel
    );
    oldCounter.position.set(-1.5, 0.45, -5.15);
    this.legacyKitchenGroup.add(oldCounter);

    const oldLeftCounter = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.9, 4.3),
      this.mats.stainlessSteel
    );
    oldLeftCounter.position.set(-6.15, 0.45, -2.65);
    this.legacyKitchenGroup.add(oldLeftCounter);

    const oldGrillBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.08, 0.82),
      this.mats.darkIron
    );
    oldGrillBox.position.set(-2.8, 0.94, -5.2);
    this.legacyKitchenGroup.add(oldGrillBox);

    const oldHoodBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.55, 1.15),
      this.mats.stainlessSteel
    );
    oldHoodBox.position.set(-2.8, 2.58, -5.12);
    this.legacyKitchenGroup.add(oldHoodBox);

    const oldBoardBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.05, 0.65),
      this.mats.woodOak
    );
    oldBoardBox.position.set(0.0, 0.94, -5.1);
    this.legacyKitchenGroup.add(oldBoardBox);
  }

  private registerInteractable(mesh: THREE.Object3D, data: Omit<InteractableTarget, 'mesh'>): void {
    const target: InteractableTarget = { ...data, mesh };
    mesh.userData.interactable = target;
    mesh.traverse((child) => {
      child.userData.interactable = target;
    });
    this.interactableMeshes.push(mesh);
  }

  private buildArchitecture(): void {
    // 1. Dining Floor (Z from -0.5 to 5.8)
    const diningFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(13.6, 6.4),
      this.mats.floorTile
    );
    diningFloor.rotation.x = -Math.PI / 2;
    diningFloor.position.set(0, 0, 2.65);
    diningFloor.receiveShadow = true;
    this.scene.add(diningFloor);

    // 2. Kitchen Non-Slip Floor (Z from -5.8 to -0.5, offset by +0.004 to prevent Z-fight)
    const kitchenFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(13.6, 5.4),
      this.mats.kitchenFloorTile
    );
    kitchenFloor.rotation.x = -Math.PI / 2;
    kitchenFloor.position.set(0, 0.004, -3.15);
    kitchenFloor.receiveShadow = true;
    this.scene.add(kitchenFloor);

    // 2b. Brushed Brass Floor Transition Strip between Dining & Kitchen (Z = -0.45)
    const floorTransition = new THREE.Mesh(
      new THREE.BoxGeometry(13.4, 0.012, 0.08),
      this.mats.brassAccent
    );
    floorTransition.position.set(0, 0.006, -0.45);
    floorTransition.receiveShadow = true;
    this.scene.add(floorTransition);

    // 3. Ceiling & Exposed Architectural Beams + Industrial HVAC Duct
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(13.8, 12.0),
      this.mats.ceilingMatte
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 3.8, 0);
    this.scene.add(ceiling);

    const beamGeo = new THREE.BoxGeometry(13.4, 0.18, 0.22);
    for (const bz of [-4.2, -1.6, 1.0, 3.6]) {
      const beam = new THREE.Mesh(beamGeo, this.mats.woodDarkWalnut);
      beam.position.set(0, 3.7, bz);
      this.scene.add(beam);
    }

    // Galvanized Steel Ceiling HVAC Duct in Kitchen Zone
    const hvacMain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 11.2, 16),
      this.mats.stainlessSteel
    );
    hvacMain.rotation.z = Math.PI / 2;
    hvacMain.position.set(-0.5, 3.46, -3.3);
    this.scene.add(hvacMain);

    for (const vx of [-4.2, -1.4, 1.4, 4.0]) {
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.25, 0.018, 8, 20),
        this.mats.darkIron
      );
      collar.rotation.y = Math.PI / 2;
      collar.position.set(vx, 3.46, -3.3);
      this.scene.add(collar);
    }

    // 4. Back Wall (Z = -5.85)
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(13.8, 3.8, 0.25),
      this.mats.wallWarm
    );
    backWall.position.set(0, 1.9, -5.85);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // 5. Left Brick Accent Wall (X = -6.75)
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 3.8, 11.8),
      this.mats.wallBrick
    );
    leftWall.position.set(-6.75, 1.9, 0);
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);

    // 6. Right Warm Wall (X = 6.75)
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 3.8, 11.8),
      this.mats.wallWarm
    );
    rightWall.position.set(6.75, 1.9, 0);
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);

    // 6b. Detailed Baseboards, Walnut Wainscoting & Acoustic Wood Slat Feature Panels
    const sideBaseboardGeo = new THREE.BoxGeometry(0.05, 0.14, 11.5);
    const leftBaseboard = new THREE.Mesh(sideBaseboardGeo, this.mats.darkIron);
    leftBaseboard.position.set(-6.61, 0.07, 0);
    this.scene.add(leftBaseboard);

    const rightBaseboard = new THREE.Mesh(sideBaseboardGeo, this.mats.woodDarkWalnut);
    rightBaseboard.position.set(6.61, 0.07, 0);
    this.scene.add(rightBaseboard);

    // Lower Walnut Wainscoting & Brushed Brass Chair Rail in Dining Room (Z = 0.0 to 5.5)
    for (const side of [-1, 1]) {
      const wainscotPanel = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 1.05, 5.5),
        this.mats.woodDarkWalnut
      );
      wainscotPanel.position.set(side * 6.60, 0.58, 2.75);
      this.scene.add(wainscotPanel);

      const chairRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.035, 5.54),
        this.mats.brassAccent
      );
      chairRail.position.set(side * 6.59, 1.12, 2.75);
      this.scene.add(chairRail);

      // Warm Linear Architectural Cove Light Strip near ceiling along Dining Side Walls
      const coveLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.04, 5.2),
        this.mats.neonSignWarm
      );
      coveLight.position.set(side * 6.58, 3.56, 2.75);
      this.scene.add(coveLight);
    }

    // 6c. Wall Electrical Outlets & Switches (Elektrik Prizleri ve Anahtarlar)
    const socketPlateGeo = new THREE.BoxGeometry(0.11, 0.16, 0.02);
    const socketMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
    const outletCoords: [number, number, number, number][] = [
      [-1.4, 1.28, -5.71, 0],
      [1.4, 1.28, -5.71, 0],
      [3.6, 1.28, -5.71, 0],
      [6.61, 1.32, 0.4, -Math.PI / 2],
    ];
    for (const [ox, oy, oz, ry] of outletCoords) {
      const outletGroup = new THREE.Group();
      outletGroup.position.set(ox, oy, oz);
      outletGroup.rotation.y = ry;
      const plate = new THREE.Mesh(socketPlateGeo, socketMat);
      outletGroup.add(plate);
      const sock1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.05, 0.026),
        this.mats.darkIron
      );
      sock1.position.y = 0.03;
      const sock2 = sock1.clone();
      sock2.position.y = -0.03;
      outletGroup.add(sock1, sock2);
      this.scene.add(outletGroup);
    }

    // 7. Front Storefront Wall with Framed Mullions, Glass Windows & Entrance Door at Z = 5.75
    const frontHeader = new THREE.Mesh(
      new THREE.BoxGeometry(13.8, 0.75, 0.32),
      this.mats.darkIron
    );
    frontHeader.position.set(0, 3.42, 5.75);
    this.scene.add(frontHeader);

    // 7. Front Storefront Architectural Bulkhead (Dark Walnut Fluted Wainscot + Charcoal Plinth + Brushed Brass Sill)
    for (const sideX of [-4.2, 4.2]) {
      const kneeBase = new THREE.Mesh(
        new THREE.BoxGeometry(4.82, 0.14, 0.30),
        this.mats.darkIron
      );
      kneeBase.position.set(sideX, 0.07, 5.75);
      this.scene.add(kneeBase);

      const kneeWalnut = new THREE.Mesh(
        new THREE.BoxGeometry(4.8, 0.50, 0.28),
        this.mats.woodDarkWalnut
      );
      kneeWalnut.position.set(sideX, 0.39, 5.75);
      kneeWalnut.receiveShadow = true;
      this.scene.add(kneeWalnut);

      // Vertical Oak Fluting Slats along Interior & Exterior of Window Bulkhead
      for (let fx = sideX - 2.2; fx <= sideX + 2.2; fx += 0.22) {
        const flute = new THREE.Mesh(
          new THREE.BoxGeometry(0.045, 0.44, 0.305),
          this.mats.woodOak
        );
        flute.position.set(fx, 0.39, 5.75);
        this.scene.add(flute);
      }

      const ironSill = new THREE.Mesh(
        new THREE.BoxGeometry(4.88, 0.045, 0.35),
        this.mats.darkIron
      );
      ironSill.position.set(sideX, 0.655, 5.75);
      this.scene.add(ironSill);

      const brassSillTrim = new THREE.Mesh(
        new THREE.BoxGeometry(4.90, 0.02, 0.365),
        this.mats.brassAccent
      );
      brassSillTrim.position.set(sideX, 0.682, 5.75);
      this.scene.add(brassSillTrim);
    }

    // Storefront Pillars & Window Mullions
    const pillarPositions = [-6.55, -1.75, 1.75, 6.55];
    for (const px of pillarPositions) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 3.8, 0.32),
        this.mats.darkIron
      );
      pillar.position.set(px, 1.9, 5.75);
      this.scene.add(pillar);
    }

    // Vertical & Horizontal Window Mullion Sub-Frames for realistic architectural glazing
    const vMullionGeo = new THREE.BoxGeometry(0.06, 2.4, 0.12);
    for (const mx of [-4.95, -3.35, 3.35, 4.95]) {
      const mullion = new THREE.Mesh(vMullionGeo, this.mats.darkIron);
      mullion.position.set(mx, 1.85, 5.75);
      this.scene.add(mullion);
    }
    const hMullionGeo = new THREE.BoxGeometry(4.65, 0.05, 0.12);
    for (const hx of [-4.15, 4.15]) {
      const transom = new THREE.Mesh(hMullionGeo, this.mats.darkIron);
      transom.position.set(hx, 2.55, 5.75);
      this.scene.add(transom);
    }

    // Large Tempered Glass Window Panes (Left & Right)
    const leftGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 2.4),
      this.mats.glassWindow
    );
    leftGlass.position.set(-4.15, 1.85, 5.75);
    leftGlass.renderOrder = 2;
    this.scene.add(leftGlass);

    const rightGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 2.4),
      this.mats.glassWindow
    );
    rightGlass.position.set(4.15, 1.85, 5.75);
    rightGlass.renderOrder = 2;
    this.scene.add(rightGlass);

    // Overhead Door Transom Beam & Glass Transom Window above Double Entrance Doors
    const doorTransomBar = new THREE.Mesh(
      new THREE.BoxGeometry(3.32, 0.08, 0.24),
      this.mats.darkIron
    );
    doorTransomBar.position.set(0, 2.54, 5.75);
    this.scene.add(doorTransomBar);

    const doorTransomGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(3.22, 0.48),
      this.mats.glassWindow
    );
    doorTransomGlass.position.set(0, 2.82, 5.75);
    doorTransomGlass.renderOrder = 2;
    this.scene.add(doorTransomGlass);

    // Commercial Anodized Aluminum & Tempered Glass Double Entrance Doors with Hydraulic Closer & Brass Pull Bars
    const buildDoorLeaf = (isRight: boolean) => {
      const doorLeaf = new THREE.Group();
      doorLeaf.position.set(isRight ? 1.62 : -1.62, 0, 5.75);
      doorLeaf.rotation.y = isRight ? -0.42 : 0.42;
      const dir = isRight ? -1 : 1;

      // Full-height tempered glass pane
      const glassPane = new THREE.Mesh(
        new THREE.BoxGeometry(0.84, 2.46, 0.036),
        this.mats.glassWindow
      );
      glassPane.position.set(dir * 0.42, 1.25, 0);
      glassPane.renderOrder = 2;
      doorLeaf.add(glassPane);

      // Left & Right Vertical Anodized Aluminum Door Stiles
      const hingeStile = new THREE.Mesh(
        new THREE.BoxGeometry(0.065, 2.50, 0.06),
        this.mats.darkIron
      );
      hingeStile.position.set(dir * 0.032, 1.25, 0);
      doorLeaf.add(hingeStile);

      const lockStile = new THREE.Mesh(
        new THREE.BoxGeometry(0.065, 2.50, 0.06),
        this.mats.darkIron
      );
      lockStile.position.set(dir * 0.82, 1.25, 0);
      doorLeaf.add(lockStile);

      // Top Rail, Mid Push-Plate Rail & Brushed Brass Bottom Kickplate
      const topRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.86, 0.085, 0.062),
        this.mats.darkIron
      );
      topRail.position.set(dir * 0.42, 2.46, 0);
      doorLeaf.add(topRail);

      const bottomRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.86, 0.12, 0.062),
        this.mats.darkIron
      );
      bottomRail.position.set(dir * 0.42, 0.06, 0);
      doorLeaf.add(bottomRail);

      const kickPlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.76, 0.22, 0.056),
        this.mats.brassAccent
      );
      kickPlate.position.set(dir * 0.42, 0.16, 0);
      doorLeaf.add(kickPlate);

      // Overhead Hydraulic Door Closer Box
      const closerBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.055, 0.075),
        this.mats.stainlessSteel
      );
      closerBox.position.set(dir * 0.22, 2.43, -0.035);
      doorLeaf.add(closerBox);

      // Interior & Exterior Vertical Brushed Brass Pull Handles with Standoffs
      for (const zSide of [-1, 1]) {
        const pullBar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 0.52, 12),
          this.mats.brassAccent
        );
        pullBar.position.set(dir * 0.73, 1.16, zSide * 0.055);
        doorLeaf.add(pullBar);

        for (const sy of [0.96, 1.36]) {
          const standoff = new THREE.Mesh(
            new THREE.CylinderGeometry(0.01, 0.01, 0.05, 8),
            this.mats.brassAccent
          );
          standoff.rotation.x = Math.PI / 2;
          standoff.position.set(dir * 0.73, sy, zSide * 0.03);
          doorLeaf.add(standoff);
        }
      }

      return doorLeaf;
    };

    this.scene.add(buildDoorLeaf(false));
    this.scene.add(buildDoorLeaf(true));

    // Entrance Welcome Coir Mat with Rubber Bevel Frame inside doorway
    const matBorder = new THREE.Mesh(
      new THREE.BoxGeometry(2.24, 0.012, 1.18),
      this.mats.darkIron
    );
    matBorder.position.set(0, 0.006, 5.05);
    this.scene.add(matBorder);

    const welcomeMat = new THREE.Mesh(
      new THREE.BoxGeometry(2.08, 0.015, 1.04),
      new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.95 })
    );
    welcomeMat.position.set(0, 0.008, 5.05);
    welcomeMat.receiveShadow = true;
    this.scene.add(welcomeMat);

    // 8. BURGER DISTRICT HERO ENTRANCE & EXTERIOR ARCHITECTURAL FACADE (Z = 5.75 .. 6.95)
    // Beveled Granite & Brushed Brass Entrance Threshold (Eşik) bridging interior terrazzo & exterior sidewalk
    const thresholdStone = new THREE.Mesh(
      new THREE.BoxGeometry(3.48, 0.024, 0.54),
      this.mats.facadeStoneAshlar
    );
    thresholdStone.position.set(0, 0.004, 5.88);
    thresholdStone.receiveShadow = true;
    this.scene.add(thresholdStone);

    const thresholdBrassStrip = new THREE.Mesh(
      new THREE.BoxGeometry(3.48, 0.028, 0.055),
      this.mats.brassAccent
    );
    thresholdBrassStrip.position.set(0, 0.006, 6.13);
    this.scene.add(thresholdBrassStrip);

    // Exterior Heritage Brick & Limestone Pier Columns framing the restaurant storefront
    for (const pierX of [-6.62, -1.82, 1.82, 6.62]) {
      const isCorner = Math.abs(pierX) > 4.0;
      const brickPier = new THREE.Mesh(
        new THREE.BoxGeometry(isCorner ? 0.56 : 0.38, 3.8, 0.26),
        this.mats.facadeBrickWarm
      );
      brickPier.position.set(pierX, 1.9, 5.92);
      brickPier.castShadow = true;
      brickPier.receiveShadow = true;
      this.scene.add(brickPier);

      const pierPlinth = new THREE.Mesh(
        new THREE.BoxGeometry(isCorner ? 0.62 : 0.44, 0.48, 0.32),
        this.mats.facadeStoneAshlar
      );
      pierPlinth.position.set(pierX, 0.24, 5.93);
      this.scene.add(pierPlinth);

      const pierCapital = new THREE.Mesh(
        new THREE.BoxGeometry(isCorner ? 0.64 : 0.46, 0.14, 0.34),
        this.mats.facadeStoneAshlar
      );
      pierCapital.position.set(pierX, 3.74, 5.94);
      this.scene.add(pierCapital);
    }

    // Architectural Up/Down Warm Wall Sconces mounted on the two entrance piers (x = ±1.82)
    for (const sx of [-1.82, 1.82]) {
      const sconceGroup = new THREE.Group();
      sconceGroup.position.set(sx, 2.18, 6.08);
      const backplate = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.24, 0.04),
        this.mats.brassAccent
      );
      const cylinderHousing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.32, 14),
        this.mats.darkIron
      );
      cylinderHousing.position.z = 0.055;
      const topLens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048, 0.048, 0.02, 12),
        this.mats.neonSignWarm
      );
      topLens.position.set(0, 0.16, 0.055);
      const botLens = topLens.clone();
      botLens.position.set(0, -0.16, 0.055);
      sconceGroup.add(backplate, cylinderHousing, topLens, botLens);
      this.scene.add(sconceGroup);
    }

    // Upper Architectural Masonry Parapet, Limestone Belt Course & Dentil Roof Cornice (y = 3.80 .. 5.55)
    const lowerBeltCourse = new THREE.Mesh(
      new THREE.BoxGeometry(14.1, 0.18, 0.48),
      this.mats.facadeStoneAshlar
    );
    lowerBeltCourse.position.set(0, 3.84, 5.84);
    this.scene.add(lowerBeltCourse);

    const upperParapetBrick = new THREE.Mesh(
      new THREE.BoxGeometry(13.9, 1.56, 0.38),
      this.mats.facadeBrickWarm
    );
    upperParapetBrick.position.set(0, 4.71, 5.78);
    upperParapetBrick.castShadow = true;
    upperParapetBrick.receiveShadow = true;
    this.scene.add(upperParapetBrick);

    const upperRoofCornice = new THREE.Mesh(
      new THREE.BoxGeometry(14.24, 0.24, 0.58),
      this.mats.facadeStoneAshlar
    );
    upperRoofCornice.position.set(0, 5.58, 5.88);
    this.scene.add(upperRoofCornice);

    const upperCopingCap = new THREE.Mesh(
      new THREE.BoxGeometry(14.32, 0.08, 0.64),
      this.mats.darkIron
    );
    upperCopingCap.position.set(0, 5.74, 5.9);
    this.scene.add(upperCopingCap);

    // Rhythmic stone dentil blocks under the upper roof cornice
    const dentilGeo = new THREE.BoxGeometry(0.18, 0.12, 0.16);
    for (let dx = -6.6; dx <= 6.6; dx += 0.44) {
      const dentil = new THREE.Mesh(dentilGeo, this.mats.facadeStoneAshlar);
      dentil.position.set(dx, 5.41, 6.02);
      this.scene.add(dentil);
    }

    // Projecting Dark-Bronze & Walnut Entrance Marquee Canopy (Z = 5.75 .. 6.95, Y = 3.05)
    const canopyGroup = new THREE.Group();
    canopyGroup.position.set(0, 3.06, 6.36);

    const canopyFascia = new THREE.Mesh(
      new THREE.BoxGeometry(4.52, 0.22, 1.24),
      this.mats.darkIron
    );
    canopyFascia.castShadow = true;
    canopyFascia.receiveShadow = true;
    canopyGroup.add(canopyFascia);

    const canopyBrassTrim = new THREE.Mesh(
      new THREE.BoxGeometry(4.56, 0.045, 1.28),
      this.mats.brassAccent
    );
    canopyBrassTrim.position.y = -0.02;
    canopyGroup.add(canopyBrassTrim);

    const canopyWalnutSoffit = new THREE.Mesh(
      new THREE.BoxGeometry(4.28, 0.035, 1.12),
      this.mats.woodOak
    );
    canopyWalnutSoffit.position.y = -0.105;
    canopyGroup.add(canopyWalnutSoffit);

    // 3 Recessed Warm Downlight Pucks under the Entrance Canopy
    for (const lx of [-1.35, 0, 1.35]) {
      const downlightBezel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.095, 0.018, 16),
        this.mats.darkIron
      );
      downlightBezel.position.set(lx, -0.12, 0.05);
      const downlightLens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.022, 16),
        this.mats.neonSignWarm
      );
      downlightLens.position.set(lx, -0.122, 0.05);
      canopyGroup.add(downlightBezel, downlightLens);
    }

    // Diagonal Steel Tension Tie-Rods anchoring the Marquee Canopy to the Upper Brick Facade
    for (const tx of [-1.92, 1.92]) {
      const tieRod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 1.26, 8),
        this.mats.darkIron
      );
      tieRod.position.set(tx, 0.44, 0.02);
      tieRod.rotation.x = -0.68;
      const wallCleat = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 10, 10),
        this.mats.brassAccent
      );
      wallCleat.position.set(tx, 0.92, -0.38);
      canopyGroup.add(tieRod, wallCleat);
    }
    this.scene.add(canopyGroup);

    // 3D Illuminated Exterior Hero Signboard ("BURGER DISTRICT • ARTISAN SMASH & GRILL")
    const heroSignBacking = new THREE.Mesh(
      new THREE.BoxGeometry(6.84, 1.04, 0.16),
      this.mats.darkIron
    );
    heroSignBacking.position.set(0, 4.66, 6.0);
    heroSignBacking.castShadow = true;
    this.scene.add(heroSignBacking);

    const heroSignBrassFrame = new THREE.Mesh(
      new THREE.BoxGeometry(6.96, 1.14, 0.12),
      this.mats.brassAccent
    );
    heroSignBrassFrame.position.set(0, 4.66, 5.97);
    this.scene.add(heroSignBrassFrame);

    if (typeof document !== 'undefined') {
      const hc = document.createElement('canvas');
      hc.width = 1024;
      hc.height = 192;
      const hctx = hc.getContext('2d');
      if (hctx) {
        hctx.fillStyle = '#0c0a09';
        hctx.fillRect(0, 0, 1024, 192);
        hctx.strokeStyle = '#f59e0b';
        hctx.lineWidth = 6;
        hctx.strokeRect(10, 10, 1004, 172);
        hctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
        hctx.lineWidth = 2;
        hctx.strokeRect(20, 20, 984, 152);

        hctx.fillStyle = '#fbbf24';
        hctx.font = 'bold 64px sans-serif';
        hctx.textAlign = 'center';
        hctx.fillText('BURGER DISTRICT', 512, 98);

        hctx.fillStyle = '#fef3c7';
        hctx.font = '600 22px monospace';
        hctx.fillText('★ ARTISAN CAST-IRON SMASH BURGERS & GRILL • EST. 2024 ★', 512, 146);

        const htex = new THREE.CanvasTexture(hc);
        htex.colorSpace = THREE.SRGBColorSpace;
        const heroSignFace = new THREE.Mesh(
          new THREE.PlaneGeometry(6.68, 0.92),
          new THREE.MeshBasicMaterial({ map: htex })
        );
        heroSignFace.position.set(0, 4.66, 6.09);
        this.scene.add(heroSignFace);
      }
    }

    // Sidewalk Brass & Walnut Menu Pedestal Stand beside the Hero Entrance (x = 2.45, z = 6.42)
    const menuPedestal = new THREE.Group();
    menuPedestal.position.set(2.45, 0, 6.42);
    menuPedestal.rotation.y = -0.24;
    const pedBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.26, 0.05, 16),
      this.mats.darkIron
    );
    pedBase.position.y = 0.025;
    const pedPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 1.05, 12),
      this.mats.brassAccent
    );
    pedPost.position.y = 0.55;
    const pedBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.42, 0.04),
      this.mats.woodDarkWalnut
    );
    pedBoard.position.set(0, 1.08, 0);
    pedBoard.rotation.x = -0.52;
    const pedPoster = new THREE.Mesh(
      new THREE.PlaneGeometry(0.48, 0.34),
      this.mats.posterArtWarm
    );
    pedPoster.position.set(0, 1.095, 0.022);
    pedPoster.rotation.x = -0.52;
    menuPedestal.add(pedBase, pedPost, pedBoard, pedPoster);
    this.scene.add(menuPedestal);
  }

  private buildExteriorStreet(): void {
    // 0. Atmospheric Sky Dome with Horizon-to-Zenith Gradient & Soft Clouds
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(52, 32, 18),
      this.mats.skyDomeMat
    );
    skyDome.position.set(0, -2.0, 6.0);
    this.scene.add(skyDome);

    // 1. Paved Sidewalk, Joint Scoring & Beveled Granite Curbs outside front windows
    const sidewalk = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 3.8),
      this.mats.concreteCurb
    );
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.set(0, -0.008, 7.6);
    sidewalk.receiveShadow = true;
    this.scene.add(sidewalk);

    const nearCurb = new THREE.Mesh(
      new THREE.BoxGeometry(38, 0.14, 0.24),
      this.mats.concreteCurb
    );
    nearCurb.position.set(0, 0.04, 9.5);
    nearCurb.receiveShadow = true;
    this.scene.add(nearCurb);

    // Sidewalk expansion joint lines for architectural realism
    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.9,
    });
    for (let sx = -16; sx <= 16; sx += 2.0) {
      const joint = new THREE.Mesh(
        new THREE.PlaneGeometry(0.025, 3.65),
        jointMat
      );
      joint.rotation.x = -Math.PI / 2;
      joint.position.set(sx, -0.004, 7.55);
      this.scene.add(joint);
    }

    // 2. Textured Asphalt Avenue, Lane Markings, Manhole Covers & Storm Drains
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 9.2),
      this.mats.asphaltRoad
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.03, 14.1);
    road.receiveShadow = true;
    this.scene.add(road);

    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    for (let x = -14; x <= 14; x += 3.8) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(1.7, 0.16),
        stripeMat
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, -0.018, 14.1);
      this.scene.add(stripe);
    }

    // White Pedestrian Crosswalk (Yaya Geçidi) + Tactile Yellow Curb Ramps
    const crosswalkMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    for (let z = 10.4; z <= 17.8; z += 0.85) {
      const bar = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 0.42),
        crosswalkMat
      );
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(-2.4, -0.016, z);
      this.scene.add(bar);
    }

    const tactileMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.65,
    });
    for (const tz of [9.16, 19.04]) {
      const tactilePad = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 0.025, 0.44),
        tactileMat
      );
      tactilePad.position.set(-2.4, 0.01, tz);
      this.scene.add(tactilePad);
    }

    // Cast-iron Manhole Covers (Rögar Kapakları) & Curbside Storm Drain Grates (Mazgallar)
    const castIronRoadMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.55,
      metalness: 0.68,
    });
    for (const [mx, mz] of [
      [-5.2, 13.3],
      [4.6, 15.0],
    ]) {
      const manholeGroup = new THREE.Group();
      manholeGroup.position.set(mx, -0.014, mz);
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.44, 0.46, 0.02, 20),
        this.mats.darkIron
      );
      const lid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.38, 0.026, 20),
        castIronRoadMat
      );
      const innerRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.015, 8, 18),
        this.mats.darkIron
      );
      innerRing.rotation.x = Math.PI / 2;
      innerRing.position.y = 0.015;
      manholeGroup.add(rim, lid, innerRing);
      this.scene.add(manholeGroup);
    }

    for (const gx of [-8.2, 0.8, 8.8]) {
      for (const gz of [9.76, 18.44]) {
        const grate = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.02, 0.36),
          castIronRoadMat
        );
        grate.position.set(gx, -0.018, gz);
        this.scene.add(grate);
      }
    }

    // Opposite Sidewalk & Curb
    const farCurb = new THREE.Mesh(
      new THREE.BoxGeometry(38, 0.14, 0.24),
      this.mats.concreteCurb
    );
    farCurb.position.set(0, 0.04, 18.7);
    this.scene.add(farCurb);

    const farSidewalk = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 4.4),
      this.mats.concreteCurb
    );
    farSidewalk.rotation.x = -Math.PI / 2;
    farSidewalk.position.set(0, -0.008, 20.9);
    farSidewalk.receiveShadow = true;
    this.scene.add(farSidewalk);

    for (let sx = -16; sx <= 16; sx += 2.0) {
      const joint = new THREE.Mesh(
        new THREE.PlaneGeometry(0.025, 4.1),
        jointMat
      );
      joint.rotation.x = -Math.PI / 2;
      joint.position.set(sx, -0.004, 20.8);
      this.scene.add(joint);
    }

    // 3. Living Street 3.0 — 4 Distinct Opposite Storefronts with 3D Recessed Interior Rooms
    const buildingConfigs: {
      x: number;
      w: number;
      h: number;
      color: number;
      trimColor: number;
      awning: number;
      sign: string;
      subtitle: string;
      theme: 'coffee' | 'books' | 'bakery' | 'market';
    }[] = [
      {
        x: -11.2,
        w: 6.8,
        h: 8.6,
        color: 0xd6c7b2,
        trimColor: 0x27272a,
        awning: 0x7f1d1d,
        sign: 'ROAST & CO. KAHVE',
        subtitle: 'ESPRESSO BAR • ROASTERY',
        theme: 'coffee',
      },
      {
        x: -3.8,
        w: 6.6,
        h: 9.8,
        color: 0xb5654d,
        trimColor: 0x14532d,
        awning: 0x14532d,
        sign: 'PERA KİTABEVİ',
        subtitle: 'KİTAP • DERGİ • KÜLTÜR',
        theme: 'books',
      },
      {
        x: 3.6,
        w: 6.6,
        h: 8.2,
        color: 0xe2d9c8,
        trimColor: 0x451a03,
        awning: 0xb45309,
        sign: 'ARTISAN FIRIN',
        subtitle: 'EKŞİ MAYA • PATISSERIE',
        theme: 'bakery',
      },
      {
        x: 11.0,
        w: 6.8,
        h: 9.4,
        color: 0xc89f72,
        trimColor: 0x1e293b,
        awning: 0x15803d,
        sign: 'METRO MARKET',
        subtitle: 'TAZE MANAV • ŞARKÜTERİ',
        theme: 'market',
      },
    ];

    const upperWindowGlassMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0xfde68a,
      emissiveIntensity: 0.16,
      roughness: 0.14,
      metalness: 0.65,
    });

    const shopClearGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.24,
      roughness: 0.08,
      metalness: 0.08,
      reflectivity: 0.75,
    });

    const warmInteriorWallMat = new THREE.MeshStandardMaterial({
      color: 0xf5ebe0,
      roughness: 0.72,
    });

    const warmCeilingGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffedd5,
    });

    for (const cfg of buildingConfigs) {
      // Building group anchored at front facade line z = 22.0
      // Local -Z points toward the street (South), Local +Z extends deeper into the building (North)
      const bldg = new THREE.Group();
      bldg.position.set(cfg.x, 0, 22.0);

      const facadeMat =
        cfg.theme === 'coffee'
          ? this.mats.facadeSlateModern
          : cfg.theme === 'books'
          ? this.mats.facadeBrickWarm
          : cfg.theme === 'bakery'
          ? this.mats.facadeStoneAshlar
          : this.mats.facadeStuccoOchre;
      const shopTrimMat = new THREE.MeshStandardMaterial({
        color: cfg.trimColor,
        roughness: 0.42,
        metalness: 0.28,
      });

      // Upper stories solid architectural block (y = 3.1 .. cfg.h, z = 0 .. +3.6)
      const upperH = cfg.h - 3.1;
      const upperBody = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.w, upperH, 3.6),
        facadeMat
      );
      upperBody.position.set(0, 3.1 + upperH / 2, 1.8);
      upperBody.castShadow = true;
      upperBody.receiveShadow = true;
      bldg.add(upperBody);

      // Ground-floor left & right structural stone/iron piers framing the 3D shop interior
      for (const side of [-1, 1]) {
        const pier = new THREE.Mesh(
          new THREE.BoxGeometry(0.46, 3.15, 2.8),
          shopTrimMat
        );
        pier.position.set(side * (cfg.w * 0.5 - 0.23), 1.575, 1.35);
        bldg.add(pier);
      }

      // Ground-floor recessed 3D shop interior room (width = cfg.w - 0.92, depth = 2.6m, height = 2.85m)
      const roomW = cfg.w - 0.92;
      const roomFloor = new THREE.Mesh(
        new THREE.BoxGeometry(roomW, 0.08, 2.65),
        this.mats.woodOak
      );
      roomFloor.position.set(0, 0.04, 1.32);
      bldg.add(roomFloor);

      const roomBackWall = new THREE.Mesh(
        new THREE.BoxGeometry(roomW, 2.85, 0.12),
        warmInteriorWallMat
      );
      roomBackWall.position.set(0, 1.45, 2.62);
      bldg.add(roomBackWall);

      for (const side of [-1, 1]) {
        const sideWall = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 2.85, 2.6),
          warmInteriorWallMat
        );
        sideWall.position.set(side * (roomW * 0.5 - 0.04), 1.45, 1.32);
        bldg.add(sideWall);
      }

      // Illuminated interior ceiling panel so the 3D shop interior is brightly visible through the glass
      const ceilingGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(roomW - 0.3, 2.1),
        warmCeilingGlowMat
      );
      ceilingGlow.rotation.x = Math.PI / 2;
      ceilingGlow.position.set(0, 2.82, 1.32);
      bldg.add(ceilingGlow);

      // Hanging pendant lamps inside each shop
      for (const lx of [-roomW * 0.25, roomW * 0.18]) {
        const cord = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, 0.52, 6),
          this.mats.darkIron
        );
        cord.position.set(lx, 2.56, 1.15);
        const shade = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 0.16, 12),
          shopTrimMat
        );
        shade.position.set(lx, 2.28, 1.15);
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.065, 8, 8),
          this.mats.neonSignWarm
        );
        bulb.position.set(lx, 2.22, 1.15);
        bldg.add(cord, shade, bulb);
      }

      // Storefront architecture: low stallriser wall on left display bay + recessed entrance door on right
      const displayBayW = roomW * 0.68;
      const doorBayW = roomW - displayBayW;
      const displayCenterX = -roomW * 0.5 + displayBayW * 0.5;
      const doorCenterX = roomW * 0.5 - doorBayW * 0.5;

      const stallRiser = new THREE.Mesh(
        new THREE.BoxGeometry(displayBayW, 0.52, 0.18),
        shopTrimMat
      );
      stallRiser.position.set(displayCenterX, 0.26, 0.08);
      bldg.add(stallRiser);

      const sillLedge = new THREE.Mesh(
        new THREE.BoxGeometry(displayBayW + 0.06, 0.06, 0.26),
        this.mats.concreteCurb
      );
      sillLedge.position.set(displayCenterX, 0.54, 0.06);
      bldg.add(sillLedge);

      // Clear glass display window allowing direct sightline into the 3D shop interior
      const glassPane = new THREE.Mesh(
        new THREE.PlaneGeometry(displayBayW - 0.08, 2.12),
        shopClearGlassMat
      );
      glassPane.position.set(displayCenterX, 1.62, 0.04);
      glassPane.rotation.y = Math.PI;
      bldg.add(glassPane);

      // Mullion & transom bars framing the storefront glass and recessed door
      const mullionBetween = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 2.85, 0.2),
        shopTrimMat
      );
      mullionBetween.position.set(
        displayCenterX + displayBayW * 0.5,
        1.425,
        0.08
      );
      bldg.add(mullionBetween);

      const transomBar = new THREE.Mesh(
        new THREE.BoxGeometry(roomW, 0.1, 0.22),
        shopTrimMat
      );
      transomBar.position.set(0, 2.68, 0.08);
      bldg.add(transomBar);

      // Recessed shop entrance door (set back 0.38m into the vestibule)
      const doorFrame = new THREE.Mesh(
        new THREE.BoxGeometry(doorBayW - 0.08, 2.25, 0.08),
        shopTrimMat
      );
      doorFrame.position.set(doorCenterX, 1.125, 0.36);
      bldg.add(doorFrame);

      const doorGlass = new THREE.Mesh(
        new THREE.PlaneGeometry(doorBayW - 0.26, 1.65),
        shopClearGlassMat
      );
      doorGlass.position.set(doorCenterX, 1.32, 0.31);
      doorGlass.rotation.y = Math.PI;
      bldg.add(doorGlass);

      const doorHandle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.36, 8),
        this.mats.brassAccent
      );
      doorHandle.position.set(doorCenterX - 0.28, 1.05, 0.28);
      bldg.add(doorHandle);

      // Theme-Specific 3D Interior Furnishings & Props inside the Recessed Room
      if (cfg.theme === 'coffee') {
        // Walnut espresso bar counter & twin-group chrome espresso machine
        const counter = new THREE.Mesh(
          new THREE.BoxGeometry(2.5, 0.96, 0.68),
          this.mats.woodDarkWalnut
        );
        counter.position.set(-0.5, 0.48, 1.65);
        bldg.add(counter);

        const counterTop = new THREE.Mesh(
          new THREE.BoxGeometry(2.58, 0.06, 0.74),
          this.mats.floorTile
        );
        counterTop.position.set(-0.5, 0.99, 1.65);
        bldg.add(counterTop);

        const espressoMachine = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.44, 0.42),
          this.mats.stainlessSteel
        );
        espressoMachine.position.set(-0.85, 1.24, 1.62);
        bldg.add(espressoMachine);

        const pastryCase = new THREE.Mesh(
          new THREE.BoxGeometry(0.76, 0.42, 0.46),
          this.mats.glassWindow
        );
        pastryCase.position.set(0.15, 1.23, 1.58);
        bldg.add(pastryCase);

        // Window bar shelf with coffee cups & stools
        const windowBar = new THREE.Mesh(
          new THREE.BoxGeometry(2.1, 0.05, 0.38),
          this.mats.woodOak
        );
        windowBar.position.set(displayCenterX, 0.88, 0.42);
        bldg.add(windowBar);

        for (const sx of [displayCenterX - 0.55, displayCenterX + 0.45]) {
          const stoolLeg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.05, 0.62, 8),
            this.mats.darkIron
          );
          stoolLeg.position.set(sx, 0.31, 0.65);
          const stoolSeat = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.18, 0.06, 12),
            this.mats.boothLeatherTan
          );
          stoolSeat.position.set(sx, 0.64, 0.65);
          bldg.add(stoolLeg, stoolSeat);
        }

        // Outdoor sidewalk bistro table & canvas parasol in front of coffee shop
        const patioGroup = new THREE.Group();
        patioGroup.position.set(displayCenterX, 0, -1.15);
        const patioPedestal = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.22, 0.74, 10),
          this.mats.darkIron
        );
        patioPedestal.position.y = 0.37;
        const patioTop = new THREE.Mesh(
          new THREE.CylinderGeometry(0.46, 0.46, 0.04, 16),
          this.mats.floorTile
        );
        patioTop.position.y = 0.75;
        const umbrellaPole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 2.15, 8),
          this.mats.woodDarkWalnut
        );
        umbrellaPole.position.y = 1.08;
        const umbrellaCanopy = new THREE.Mesh(
          new THREE.ConeGeometry(1.18, 0.42, 8),
          new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.75 })
        );
        umbrellaCanopy.position.y = 2.18;
        patioGroup.add(patioPedestal, patioTop, umbrellaPole, umbrellaCanopy);
        bldg.add(patioGroup);
      } else if (cfg.theme === 'books') {
        // Tall wooden bookcases along the back wall + colorful 3D book rows + reading table
        const bookPalette = [0x991b1b, 0x1e40af, 0x065f46, 0xd97706, 0x581c87];
        for (const bx of [-1.65, -0.35, 0.95]) {
          const bookcase = new THREE.Mesh(
            new THREE.BoxGeometry(1.12, 2.25, 0.34),
            this.mats.woodDarkWalnut
          );
          bookcase.position.set(bx, 1.15, 2.34);
          bldg.add(bookcase);

          for (let row = 0; row < 4; row++) {
            const bookRow = new THREE.Mesh(
              new THREE.BoxGeometry(0.96, 0.28, 0.24),
              new THREE.MeshStandardMaterial({
                color: bookPalette[(row + Math.abs(Math.round(bx))) % bookPalette.length],
                roughness: 0.65,
              })
            );
            bookRow.position.set(bx, 0.48 + row * 0.48, 2.26);
            bldg.add(bookRow);
          }
        }

        // Front window featured book display table
        const displayTable = new THREE.Mesh(
          new THREE.BoxGeometry(1.85, 0.72, 0.78),
          this.mats.woodOak
        );
        displayTable.position.set(displayCenterX, 0.36, 0.92);
        bldg.add(displayTable);

        for (let stackIdx = 0; stackIdx < 4; stackIdx++) {
          const bookStack = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 0.16, 0.36),
            new THREE.MeshStandardMaterial({
              color: bookPalette[stackIdx % bookPalette.length],
              roughness: 0.55,
            })
          );
          bookStack.position.set(
            displayCenterX - 0.55 + stackIdx * 0.36,
            0.8,
            0.88
          );
          bookStack.rotation.y = (stackIdx % 2 === 0 ? 1 : -1) * 0.18;
          bldg.add(bookStack);
        }
      } else if (cfg.theme === 'bakery') {
        // Illuminated bakery pastry showcase & golden artisan bread loaves
        const showcaseBase = new THREE.Mesh(
          new THREE.BoxGeometry(2.35, 0.68, 0.76),
          this.mats.woodOak
        );
        showcaseBase.position.set(displayCenterX, 0.34, 1.05);
        bldg.add(showcaseBase);

        const showcaseGlass = new THREE.Mesh(
          new THREE.BoxGeometry(2.28, 0.48, 0.68),
          shopClearGlassMat
        );
        showcaseGlass.position.set(displayCenterX, 0.92, 1.05);
        bldg.add(showcaseGlass);

        const crustMat = new THREE.MeshStandardMaterial({
          color: 0xd97706,
          roughness: 0.52,
        });
        for (let i = 0; i < 5; i++) {
          const loaf = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.085, 0.22, 6, 10),
            crustMat
          );
          loaf.rotation.z = Math.PI / 2;
          loaf.rotation.y = 0.25;
          loaf.position.set(displayCenterX - 0.76 + i * 0.38, 0.76, 1.02);
          bldg.add(loaf);
        }

        // Back wall artisan bread rack & warm oven glow
        const breadRack = new THREE.Mesh(
          new THREE.BoxGeometry(2.6, 2.1, 0.36),
          this.mats.darkIron
        );
        breadRack.position.set(-0.35, 1.08, 2.32);
        bldg.add(breadRack);
      } else {
        // Metro Market: interior stocked grocery aisles + angled outdoor fresh produce crate stand
        for (const gz of [1.35, 2.25]) {
          const gondola = new THREE.Mesh(
            new THREE.BoxGeometry(2.2, 1.65, 0.42),
            this.mats.darkIron
          );
          gondola.position.set(displayCenterX, 0.85, gz);
          bldg.add(gondola);
        }

        // Outdoor slanted wooden produce stand with red, orange & green fruit/veg crates
        const crateStand = new THREE.Group();
        crateStand.position.set(displayCenterX, 0, -0.46);
        const standFrame = new THREE.Mesh(
          new THREE.BoxGeometry(2.15, 0.62, 0.66),
          this.mats.woodOak
        );
        standFrame.position.y = 0.31;
        crateStand.add(standFrame);

        const produceColors = [0xdc2626, 0xf97316, 0x16a34a, 0xeab308];
        for (let c = 0; c < 4; c++) {
          const crate = new THREE.Mesh(
            new THREE.BoxGeometry(0.46, 0.18, 0.52),
            new THREE.MeshStandardMaterial({
              color: produceColors[c],
              roughness: 0.62,
            })
          );
          crate.position.set(-0.75 + c * 0.5, 0.68, -0.02);
          crate.rotation.x = -0.22;
          crateStand.add(crate);
        }
        bldg.add(crateStand);
      }

      // Vertical fluted pilasters on building edges
      for (const px of [-cfg.w * 0.48, cfg.w * 0.48]) {
        const pilaster = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, cfg.h, 0.22),
          this.mats.concreteCurb
        );
        pilaster.position.set(px, cfg.h / 2, 0.02);
        bldg.add(pilaster);
      }

      // Ground-floor architectural cornice band separating shopfront from apartments
      const beltCourse = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.w + 0.16, 0.22, 0.34),
        this.mats.concreteCurb
      );
      beltCourse.position.set(0, 3.12, -0.04);
      bldg.add(beltCourse);

      // Angled fabric awning with front valance & steel tie-rods
      const awningMat = new THREE.MeshStandardMaterial({
        color: cfg.awning,
        roughness: 0.66,
      });
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.w * 0.86, 0.14, 1.18),
        awningMat
      );
      awning.position.set(0, 2.74, -0.52);
      awning.rotation.x = 0.28;
      awning.castShadow = true;
      bldg.add(awning);

      const valance = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.w * 0.86, 0.16, 0.05),
        awningMat
      );
      valance.position.set(0, 2.52, -1.08);
      bldg.add(valance);

      // Illuminated Storefront Signboard above Awning
      if (typeof document !== 'undefined') {
        const sc = document.createElement('canvas');
        sc.width = 512;
        sc.height = 112;
        const sctx = sc.getContext('2d');
        if (sctx) {
          sctx.fillStyle = '#111827';
          sctx.fillRect(0, 0, 512, 112);
          sctx.strokeStyle = '#fbbf24';
          sctx.lineWidth = 5;
          sctx.strokeRect(6, 6, 500, 100);
          sctx.fillStyle = '#fef3c7';
          sctx.font = 'bold 38px sans-serif';
          sctx.textAlign = 'center';
          sctx.fillText(cfg.sign, 256, 56);
          sctx.fillStyle = '#94a3b8';
          sctx.font = '600 18px sans-serif';
          sctx.fillText(cfg.subtitle, 256, 88);
          const stex = new THREE.CanvasTexture(sc);
          stex.colorSpace = THREE.SRGBColorSpace;
          const signBack = new THREE.Mesh(
            new THREE.BoxGeometry(cfg.w * 0.68, 0.64, 0.12),
            shopTrimMat
          );
          signBack.position.set(0, 3.52, -0.04);
          bldg.add(signBack);

          const signMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(cfg.w * 0.65, 0.56),
            new THREE.MeshBasicMaterial({ map: stex })
          );
          signMesh.position.set(0, 3.52, -0.11);
          signMesh.rotation.y = Math.PI;
          bldg.add(signMesh);
        }
      }

      // Upper floor apartment windows with casement muntins, curtains, stone lintels, sills & Juliette balconies
      const floors = Math.floor((cfg.h - 3.8) / 2.15);
      for (let f = 0; f < floors; f++) {
        const wy = 4.45 + f * 2.15;

        // Horizontal stone floor belt course between apartment stories
        if (f > 0) {
          const storyBelt = new THREE.Mesh(
            new THREE.BoxGeometry(cfg.w + 0.14, 0.11, 0.24),
            this.mats.facadeStoneAshlar
          );
          storyBelt.position.set(0, wy - 1.06, -0.02);
          bldg.add(storyBelt);
        }

        for (const [wIdx, wx] of ([-cfg.w * 0.27, 0, cfg.w * 0.27] as number[]).entries()) {
          // Recessed dark-bronze window casing
          const winFrame = new THREE.Mesh(
            new THREE.BoxGeometry(1.16, 1.44, 0.18),
            this.mats.darkIron
          );
          winFrame.position.set(wx, wy, 0.02);
          bldg.add(winFrame);

          // Multi-pane casement window with sheer curtains & sky reflection
          const winPane = new THREE.Mesh(
            new THREE.PlaneGeometry(1.02, 1.3),
            this.mats.upperApartmentWindow
          );
          winPane.position.set(wx, wy, -0.075);
          winPane.rotation.y = Math.PI;
          bldg.add(winPane);

          // Projecting Limestone Window Lintel Header & Keystone above each window
          const lintel = new THREE.Mesh(
            new THREE.BoxGeometry(1.28, 0.14, 0.26),
            this.mats.facadeStoneAshlar
          );
          lintel.position.set(wx, wy + 0.77, -0.04);
          bldg.add(lintel);

          const keystone = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.2, 0.3),
            this.mats.facadeStoneAshlar
          );
          keystone.position.set(wx, wy + 0.79, -0.06);
          bldg.add(keystone);

          // Moulded Stone Window Sill & Corbels below each window
          const sill = new THREE.Mesh(
            new THREE.BoxGeometry(1.3, 0.11, 0.32),
            this.mats.facadeStoneAshlar
          );
          sill.position.set(wx, wy - 0.74, -0.08);
          bldg.add(sill);

          // Wrought-iron Juliette Balcony Railing & Terracotta Flower Box on center or first-floor windows
          if (f === 0 || wIdx === 1) {
            const julietteRail = new THREE.Mesh(
              new THREE.BoxGeometry(1.22, 0.34, 0.04),
              this.mats.darkIron
            );
            julietteRail.position.set(wx, wy - 0.52, -0.18);
            const brassHandrail = new THREE.Mesh(
              new THREE.BoxGeometry(1.26, 0.035, 0.06),
              this.mats.brassAccent
            );
            brassHandrail.position.set(wx, wy - 0.34, -0.18);
            const flowerBox = new THREE.Mesh(
              new THREE.BoxGeometry(0.96, 0.16, 0.18),
              this.mats.wallBrick
            );
            flowerBox.position.set(wx, wy - 0.61, -0.13);
            const greenery = new THREE.Mesh(
              new THREE.BoxGeometry(0.92, 0.14, 0.16),
              this.mats.foliageRich
            );
            greenery.position.set(wx, wy - 0.5, -0.13);
            bldg.add(julietteRail, brassHandrail, flowerBox, greenery);
          }
        }
      }

      // Stepped roof cornice, stone frieze & dentil blocks
      const corniceFrieze = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.w + 0.22, 0.22, 3.8),
        this.mats.facadeStoneAshlar
      );
      corniceFrieze.position.set(0, cfg.h - 0.05, 1.8);
      bldg.add(corniceFrieze);

      for (let dx = -cfg.w * 0.45; dx <= cfg.w * 0.45; dx += 0.48) {
        const dentil = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.12, 0.18),
          this.mats.facadeStoneAshlar
        );
        dentil.position.set(dx, cfg.h - 0.14, -0.14);
        bldg.add(dentil);
      }

      const cornice = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.w + 0.46, 0.36, 4.02),
        this.mats.darkIron
      );
      cornice.position.set(0, cfg.h + 0.22, 1.8);
      bldg.add(cornice);

      this.scene.add(bldg);
    }

    // 4. Sculpted Organic Street Trees with Root-Flared Lathe Trunks & Smooth Botanical Canopies
    const trunkProfile = [
      new THREE.Vector2(0.24, 0.0),
      new THREE.Vector2(0.18, 0.35),
      new THREE.Vector2(0.14, 0.95),
      new THREE.Vector2(0.12, 1.55),
      new THREE.Vector2(0.09, 2.15),
    ];
    const trunkLatheGeo = new THREE.LatheGeometry(trunkProfile, 16);

    const buildLeafTuftGeo = (radius: number) => {
      const geo = new THREE.SphereGeometry(radius, 22, 18);
      const pos = geo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const ripple =
          1.0 +
          Math.sin(v.x * 4.4 + v.y * 3.2) * 0.065 +
          Math.cos(v.z * 4.8 + v.y * 2.5) * 0.055;
        v.multiplyScalar(ripple);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      return geo;
    };

    const tuftGeos = [
      buildLeafTuftGeo(0.92),
      buildLeafTuftGeo(0.76),
      buildLeafTuftGeo(0.65),
    ];

    const clusterOffsets: [number, number, number, number][] = [
      [0, 2.86, 0, 0],
      [-0.58, 2.54, 0.3, 1],
      [0.6, 2.58, -0.24, 1],
      [0.24, 3.18, 0.32, 2],
      [-0.38, 3.04, -0.34, 2],
      [0.4, 2.4, 0.42, 2],
      [-0.24, 2.44, -0.44, 1],
    ];

    const allTreeCoords: [number, number][] = [
      [-8.8, 8.1],
      [-4.8, 8.1],
      [4.8, 8.1],
      [8.8, 8.1],
      [-7.2, 19.55],
      [7.2, 19.55],
    ];

    allTreeCoords.forEach(([tx, tz], idx) => {
      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);

      const treeAO = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 1.9),
        this.mats.contactShadow
      );
      treeAO.rotation.x = -Math.PI / 2;
      treeAO.position.y = 0.002;
      tree.add(treeAO);

      const planterOuter = new THREE.Mesh(
        new THREE.BoxGeometry(1.32, 0.3, 1.32),
        this.mats.darkIron
      );
      planterOuter.position.y = 0.15;
      tree.add(planterOuter);

      const soil = new THREE.Mesh(
        new THREE.BoxGeometry(1.14, 0.32, 1.14),
        this.mats.woodDarkWalnut
      );
      soil.position.y = 0.16;
      tree.add(soil);

      const trunk = new THREE.Mesh(trunkLatheGeo, this.mats.treeBark);
      trunk.position.y = 0.15;
      trunk.rotation.z = (idx % 2 === 0 ? 1 : -1) * 0.04;
      trunk.castShadow = true;
      tree.add(trunk);

      const branchConfigs: [number, number, number, number, number][] = [
        [-0.24, 2.02, 0.12, 0.24, 0.5],
        [0.26, 2.08, -0.1, -0.2, -0.46],
        [0.05, 2.16, 0.22, 0.44, 0.08],
      ];
      for (const [bx, by, bz, rx, rz] of branchConfigs) {
        const branch = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.088, 0.82, 10),
          this.mats.treeBark
        );
        branch.position.set(bx, by, bz);
        branch.rotation.set(rx, 0, rz);
        tree.add(branch);
      }

      clusterOffsets.forEach(([cx, cy, cz, gIdx], cIdx) => {
        const crownMat =
          (cIdx + idx) % 2 === 0 ? this.mats.foliageRich : this.mats.foliageSunlit;
        const cluster = new THREE.Mesh(tuftGeos[gIdx], crownMat);
        cluster.position.set(cx, cy, cz);
        cluster.scale.set(1.14, 0.84, 1.08);
        cluster.rotation.set(cIdx * 0.5, idx * 0.9, cIdx * 0.3);
        cluster.castShadow = true;
        tree.add(cluster);
      });

      this.scene.add(tree);
    });

    // 5. Cast-Iron Streetlamps, Slatted Timber Benches, Municipal Waste Bins & Illuminated Poster Kiosk
    for (const [lx, lz, armDir] of [
      [-6.8, 9.15, 1],
      [3.65, 9.15, 1],
      [6.8, 9.15, 1],
      [-5.6, 19.05, -1],
      [5.4, 19.05, -1],
    ]) {
      const lampPost = new THREE.Group();
      lampPost.position.set(lx, 0, lz);

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.22, 0.45, 12),
        this.mats.darkIron
      );
      base.position.y = 0.225;
      lampPost.add(base);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.08, 3.6, 10),
        this.mats.darkIron
      );
      pole.position.y = 2.0;
      lampPost.add(pole);

      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, 0.65),
        this.mats.darkIron
      );
      arm.position.set(0, 3.75, armDir * 0.28);
      lampPost.add(arm);

      const lantern = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.1, 0.28, 8),
        this.mats.neonSignWarm
      );
      lantern.position.set(0, 3.58, armDir * 0.55);
      lampPost.add(lantern);

      this.scene.add(lampPost);
    }

    // Slatted Hardwood & Cast-Iron Sidewalk Benches (Banklar)
    const buildStreetBench = (bx: number, bz: number, yaw: number) => {
      const bench = new THREE.Group();
      bench.position.set(bx, 0, bz);
      bench.rotation.y = yaw;
      for (const side of [-0.62, 0.62]) {
        const legFront = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.44, 0.48),
          this.mats.darkIron
        );
        legFront.position.set(side, 0.22, 0);
        const armrest = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.18, 0.46),
          this.mats.darkIron
        );
        armrest.position.set(side, 0.52, -0.02);
        bench.add(legFront, armrest);
      }
      for (let s = 0; s < 3; s++) {
        const seatSlat = new THREE.Mesh(
          new THREE.BoxGeometry(1.38, 0.035, 0.12),
          this.mats.woodOak
        );
        seatSlat.position.set(0, 0.44, -0.14 + s * 0.14);
        const backSlat = new THREE.Mesh(
          new THREE.BoxGeometry(1.38, 0.11, 0.035),
          this.mats.woodOak
        );
        backSlat.position.set(0, 0.56 + s * 0.13, -0.22);
        backSlat.rotation.x = -0.15;
        bench.add(seatSlat, backSlat);
      }
      this.scene.add(bench);
    };
    buildStreetBench(-6.7, 8.85, 0);
    buildStreetBench(5.8, 19.35, Math.PI);

    // Municipal Cast-Iron Sidewalk Waste Bins (Çöp Kutuları)
    for (const [wx, wz] of [
      [-3.5, 9.05],
      [2.0, 19.25],
    ]) {
      const binGroup = new THREE.Group();
      binGroup.position.set(wx, 0, wz);
      const binBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.19, 0.72, 14),
        this.mats.darkIron
      );
      binBody.position.y = 0.36;
      const binBand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.226, 0.226, 0.06, 14),
        this.mats.brassAccent
      );
      binBand.position.y = 0.56;
      const binDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
        this.mats.darkIron
      );
      binDome.position.y = 0.72;
      binGroup.add(binBody, binBand, binDome);
      this.scene.add(binGroup);
    }

    // Illuminated City Poster Kiosk / MUPI (Reklam Panosu)
    const kioskGroup = new THREE.Group();
    kioskGroup.position.set(6.4, 0, 8.2);
    kioskGroup.rotation.y = -0.32;
    const kioskBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.18, 0.26),
      this.mats.darkIron
    );
    kioskBase.position.y = 0.09;
    const kioskFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 1.52, 0.16),
      this.mats.darkIron
    );
    kioskFrame.position.y = 0.94;
    kioskGroup.add(kioskBase, kioskFrame);
    if (typeof document !== 'undefined') {
      const kc = document.createElement('canvas');
      kc.width = 256;
      kc.height = 384;
      const kctx = kc.getContext('2d');
      if (kctx) {
        kctx.fillStyle = '#0f172a';
        kctx.fillRect(0, 0, 256, 384);
        kctx.fillStyle = '#f59e0b';
        kctx.fillRect(16, 16, 224, 8);
        kctx.fillStyle = '#fef3c7';
        kctx.font = 'bold 28px sans-serif';
        kctx.textAlign = 'center';
        kctx.fillText('BURGER', 128, 76);
        kctx.fillText('DISTRICT', 128, 110);
        kctx.fillStyle = '#fb923c';
        kctx.beginPath();
        kctx.arc(128, 210, 56, 0, Math.PI * 2);
        kctx.fill();
        kctx.fillStyle = '#4ade80';
        kctx.fillRect(68, 204, 120, 12);
        kctx.fillStyle = '#78350f';
        kctx.fillRect(64, 216, 128, 18);
        kctx.fillStyle = '#f8fafc';
        kctx.font = 'bold 20px sans-serif';
        kctx.fillText('%100 TAZE IZGARA', 128, 316);
        kctx.fillStyle = '#fbbf24';
        kctx.font = '600 16px sans-serif';
        kctx.fillText('SICAK SERVİS • HER GÜN', 128, 346);
        const ktex = new THREE.CanvasTexture(kc);
        ktex.colorSpace = THREE.SRGBColorSpace;
        const posterMat = new THREE.MeshBasicMaterial({ map: ktex });
        for (const pz of [-0.085, 0.085]) {
          const poster = new THREE.Mesh(
            new THREE.PlaneGeometry(0.76, 1.32),
            posterMat
          );
          poster.position.set(0, 0.96, pz);
          if (pz < 0) poster.rotation.y = Math.PI;
          kioskGroup.add(poster);
        }
      }
    }
    this.scene.add(kioskGroup);

    // 6. Sculpted 3D Multi-Part Automobiles with Tapered Cabin Greenhouse, Wheel Arches & Alloy Rims
    const lowerBodyShape = new THREE.Shape();
    lowerBodyShape.moveTo(-1.96, 0.24);
    lowerBodyShape.lineTo(1.94, 0.24);
    lowerBodyShape.quadraticCurveTo(2.04, 0.30, 2.01, 0.58);
    lowerBodyShape.lineTo(1.86, 0.78);
    lowerBodyShape.lineTo(0.88, 0.88);
    lowerBodyShape.lineTo(-1.46, 0.88);
    lowerBodyShape.lineTo(-1.90, 0.82);
    lowerBodyShape.quadraticCurveTo(-2.00, 0.66, -1.96, 0.24);

    const lowerBodyGeo = new THREE.ExtrudeGeometry(lowerBodyShape, {
      depth: 1.66,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.06,
      bevelThickness: 0.06,
    });
    lowerBodyGeo.translate(0, 0, -0.83);

    const upperCabinShape = new THREE.Shape();
    upperCabinShape.moveTo(0.84, 0.84);
    upperCabinShape.lineTo(0.28, 1.32);
    upperCabinShape.quadraticCurveTo(-0.34, 1.37, -0.96, 1.28);
    upperCabinShape.lineTo(-1.44, 0.84);
    upperCabinShape.closePath();

    // Narrower upper cabin greenhouse (tumblehome) so the car has realistic 3D shoulder fenders
    const upperCabinBodyGeo = new THREE.ExtrudeGeometry(upperCabinShape, {
      depth: 1.34,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.05,
      bevelThickness: 0.05,
    });
    upperCabinBodyGeo.translate(0, 0, -0.67);

    const cabinWindowShape = new THREE.Shape();
    cabinWindowShape.moveTo(0.72, 0.87);
    cabinWindowShape.lineTo(0.24, 1.26);
    cabinWindowShape.quadraticCurveTo(-0.34, 1.30, -0.90, 1.22);
    cabinWindowShape.lineTo(-1.32, 0.87);
    cabinWindowShape.closePath();

    const cabinGlassGeo = new THREE.ExtrudeGeometry(cabinWindowShape, {
      depth: 1.42,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    });
    cabinGlassGeo.translate(0, 0, -0.71);

    const buildParkedCar = (
      x: number,
      z: number,
      bodyColor: number,
      facing: number
    ) => {
      const car = new THREE.Group();
      car.position.set(x, 0, z);
      car.rotation.y = facing;

      const paintMat = new THREE.MeshPhysicalMaterial({
        color: bodyColor,
        roughness: 0.24,
        metalness: 0.58,
        clearcoat: 0.85,
        clearcoatRoughness: 0.14,
      });
      const cabinGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0x0f172a,
        roughness: 0.08,
        metalness: 0.85,
        clearcoat: 0.9,
      });

      const carShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(4.25, 2.05),
        this.mats.contactShadow
      );
      carShadow.rotation.x = -Math.PI / 2;
      carShadow.position.y = -0.012;
      car.add(carShadow);

      // 1. Wide Lower Body with Sculpted Hood & Trunk Shoulders
      const lowerChassis = new THREE.Mesh(lowerBodyGeo, paintMat);
      lowerChassis.castShadow = true;
      lowerChassis.receiveShadow = true;
      car.add(lowerChassis);

      // 2. Tapered Upper Cabin Greenhouse (Tumblehome)
      const upperCabin = new THREE.Mesh(upperCabinBodyGeo, paintMat);
      upperCabin.castShadow = true;
      upperCabin.receiveShadow = true;
      car.add(upperCabin);

      // 3. Recessed Tinted Side, Front & Rear Windshields + B-Pillar Divider
      const windshields = new THREE.Mesh(cabinGlassGeo, cabinGlassMat);
      car.add(windshields);

      const bPillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.10, 0.38, 1.45),
        this.mats.darkIron
      );
      bPillar.position.set(-0.28, 1.06, 0);
      car.add(bPillar);

      // 4. Flared Wheel Arch Fenders & Lower Side Rocker Skirts
      const archGeo = new THREE.CylinderGeometry(0.39, 0.39, 0.18, 20, 1, false, 0, Math.PI);
      archGeo.rotateX(Math.PI / 2);
      for (const wx of [-1.18, 1.18]) {
        for (const wz of [-0.84, 0.84]) {
          const arch = new THREE.Mesh(archGeo, paintMat);
          arch.position.set(wx, 0.34, wz);
          car.add(arch);
        }
      }
      for (const sz of [-0.86, 0.86]) {
        const rockerSkirt = new THREE.Mesh(
          new THREE.BoxGeometry(1.75, 0.09, 0.08),
          this.mats.darkIron
        );
        rockerSkirt.position.set(0, 0.25, sz);
        car.add(rockerSkirt);

        const doorHandle = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.035, 0.04),
          this.mats.stainlessSteel
        );
        doorHandle.position.set(-0.08, 0.78, sz * 1.02);
        car.add(doorHandle);
      }

      // 5. Front & Rear Molded Bumpers, Radiator Grille & License Plates
      const frontBumper = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.22, 1.78),
        this.mats.darkIron
      );
      frontBumper.position.set(1.98, 0.32, 0);
      const rearBumper = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.24, 1.78),
        this.mats.darkIron
      );
      rearBumper.position.set(-1.95, 0.34, 0);
      car.add(frontBumper, rearBumper);

      const grille = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.24, 1.12),
        this.mats.darkIron
      );
      grille.position.set(2.01, 0.52, 0);
      const grilleChrome = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.035, 1.08),
        this.mats.stainlessSteel
      );
      grilleChrome.position.set(2.02, 0.54, 0);
      const plateMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
      const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.11, 0.42), plateMat);
      frontPlate.position.set(2.06, 0.34, 0);
      const rearPlate = frontPlate.clone();
      rearPlate.position.set(-2.03, 0.42, 0);
      car.add(grille, grilleChrome, frontPlate, rearPlate);

      for (const mz of [-0.82, 0.82]) {
        const mirror = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.09, 0.18),
          paintMat
        );
        mirror.position.set(0.54, 0.90, mz);
        car.add(mirror);
      }

      // 6. Sculpted Rubber Tires & Multi-Spoke Alloy Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 22);
      wheelGeo.rotateX(Math.PI / 2);
      const hubGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.26, 16);
      hubGeo.rotateX(Math.PI / 2);
      const tireMat = new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.88,
      });
      for (const wx of [-1.18, 1.18]) {
        for (const wz of [-0.82, 0.82]) {
          const wheel = new THREE.Mesh(wheelGeo, tireMat);
          wheel.position.set(wx, 0.32, wz);
          const hub = new THREE.Mesh(hubGeo, this.mats.stainlessSteel);
          hub.position.set(wx, 0.32, wz);
          car.add(wheel, hub);
        }
      }

      const headMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      const tailMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      for (const lz of [-0.62, 0.62]) {
        const hl = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.14, 0.30),
          headMat
        );
        hl.position.set(1.99, 0.62, lz);
        const tl = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.15, 0.34),
          tailMat
        );
        tl.position.set(-1.96, 0.60, lz);
        car.add(hl, tl);
      }

      this.scene.add(car);
      return car;
    };

    buildParkedCar(-6.8, 11.2, 0x1d4ed8, 0);
    buildParkedCar(6.4, 16.9, 0xb91c1c, Math.PI);

    const passingCar1 = buildParkedCar(-18.0, 13.3, 0xf59e0b, 0);
    const passingCar2 = buildParkedCar(18.0, 15.1, 0x10b981, Math.PI);
    this.passingCars.push(
      { group: passingCar1, speed: 4.8, minX: -24, maxX: 24 },
      { group: passingCar2, speed: -4.2, minX: -24, maxX: 24 }
    );

    // 7. Cast-Iron Sidewalk Bollards & Rigged 3D Human Pedestrians (Living Street 3.0)
    for (const bx of [-10.5, -6.2, -1.2, 1.8, 6.2, 10.5]) {
      const bollard = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.085, 0.78, 12),
        this.mats.darkIron
      );
      bollard.position.set(bx, 0.39, 9.25);
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.068, 10, 10),
        this.mats.brassAccent
      );
      cap.position.set(0, 0.39, 0);
      bollard.add(cap);
      this.scene.add(bollard);
    }

    // Spawn 6 rigged 3D pedestrians covering all 5 movement vectors:
    // +X (East), -X (West), +Z (North across crosswalk), -Z (South across crosswalk), and Diagonal
    const pedestrianSpecs = [
      {
        id: 'ped_near_east',
        seedIndex: 101,
        walkSpeed: 1.36,
        loopWrap: true,
        startWaypointIndex: 0,
        startProgressToNext: 0.35,
        waypoints: [
          { x: -16.5, z: 7.25 },
          { x: -3.2, z: 7.25, pauseSeconds: 2.1, lookYaw: Math.PI },
          { x: 16.5, z: 7.25 },
        ],
      },
      {
        id: 'ped_near_west',
        seedIndex: 102,
        walkSpeed: 1.32,
        loopWrap: true,
        startWaypointIndex: 0,
        startProgressToNext: 0.42,
        waypoints: [
          { x: 16.5, z: 8.55 },
          { x: 5.2, z: 8.45, pauseSeconds: 1.8, lookYaw: Math.PI * 0.85 },
          { x: -16.5, z: 8.55 },
        ],
      },
      {
        id: 'ped_crosswalk_north_diag',
        seedIndex: 103,
        walkSpeed: 1.42,
        loopWrap: false,
        startWaypointIndex: 0,
        startProgressToNext: 0.15,
        waypoints: [
          { x: -2.4, z: 8.8 }, // Start at near crosswalk ramp
          { x: -2.4, z: 19.2 }, // Walk Forward (+Z) across crosswalk
          { x: 2.8, z: 20.85, pauseSeconds: 2.2, lookYaw: 0 }, // Walk Diagonally NE (+X, +Z) to Artisan Bakery window
          { x: -2.4, z: 19.2 }, // Walk Diagonally SW (-X, -Z) back to crosswalk
          { x: -2.4, z: 8.8 }, // Walk Backward (-Z) across crosswalk
          { x: 1.4, z: 7.55, pauseSeconds: 1.6, lookYaw: Math.PI }, // Walk Diagonally SE (+X, -Z) toward restaurant window
        ],
      },
      {
        id: 'ped_crosswalk_south_diag',
        seedIndex: 104,
        walkSpeed: 1.38,
        loopWrap: false,
        startWaypointIndex: 0,
        startProgressToNext: 0.2,
        waypoints: [
          { x: -2.4, z: 19.2 }, // Start at far crosswalk ramp
          { x: -2.4, z: 8.8 }, // Walk South (-Z) across crosswalk
          { x: -6.2, z: 7.85, pauseSeconds: 1.9, lookYaw: Math.PI }, // Walk Diagonally NW (-X, -Z) along near sidewalk
          { x: -2.4, z: 8.8 }, // Walk Diagonally SE (+X, +Z) to crosswalk
          { x: -2.4, z: 19.2 }, // Walk North (+Z) across crosswalk
          { x: -4.4, z: 20.85, pauseSeconds: 2.3, lookYaw: 0 }, // Walk Diagonally NW (-X, +Z) to Pera Bookstore window
        ],
      },
      {
        id: 'ped_far_east',
        seedIndex: 105,
        walkSpeed: 1.34,
        loopWrap: true,
        startWaypointIndex: 0,
        startProgressToNext: 0.28,
        waypoints: [
          { x: -16.5, z: 20.15 },
          { x: -7.8, z: 20.75 },
          { x: 9.8, z: 20.55, pauseSeconds: 2.0, lookYaw: 0 },
          { x: 16.5, z: 20.15 },
        ],
      },
      {
        id: 'ped_far_west',
        seedIndex: 106,
        walkSpeed: 1.3,
        loopWrap: true,
        startWaypointIndex: 0,
        startProgressToNext: 0.5,
        waypoints: [
          { x: 16.5, z: 19.45 },
          { x: -10.4, z: 19.65, pauseSeconds: 2.2, lookYaw: 0 },
          { x: -16.5, z: 19.45 },
        ],
      },
    ];

    for (const spec of pedestrianSpecs) {
      const ped = new StreetPedestrianActor(spec);
      this.scene.add(ped.root);
      this.streetPedestrians.push(ped);
    }
  }

  updateExteriorTraffic(dt: number): void {
    this.streetElapsed += dt;
    for (const v of this.passingCars) {
      v.group.position.x += v.speed * dt;
      if (v.speed > 0 && v.group.position.x > v.maxX) {
        v.group.position.x = v.minX;
      } else if (v.speed < 0 && v.group.position.x < v.minX) {
        v.group.position.x = v.maxX;
      }
    }

    for (const ped of this.streetPedestrians) {
      ped.update(dt, this.streetElapsed);
    }
  }

  private buildMainCounterAndPOS(): void {
    // Front Main Counter Base with Architectural Wood Slats, Recessed Toe-Kick & Brass Rail
    const counterGroup = new THREE.Group();

    // Floor Contact AO Shadow under Main Counter
    const counterAO = new THREE.Mesh(
      new THREE.PlaneGeometry(7.25, 1.15),
      this.mats.contactShadow
    );
    counterAO.rotation.x = -Math.PI / 2;
    counterAO.position.set(-0.6, 0.007, -0.45);
    counterGroup.add(counterAO);

    // Recessed dark iron toe-kick
    const toeKick = new THREE.Mesh(
      new THREE.BoxGeometry(6.92, 0.12, 0.78),
      this.mats.darkIron
    );
    toeKick.position.set(-0.6, 0.06, -0.45);
    counterGroup.add(toeKick);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(7.0, 0.78, 0.86),
      this.mats.woodDarkWalnut
    );
    base.position.set(-0.6, 0.51, -0.45);
    base.castShadow = true;
    base.receiveShadow = true;
    counterGroup.add(base);

    // Decorative vertical oak fluting / slats across customer-facing front of counter (Single InstancedMesh)
    const slatGeo = new THREE.BoxGeometry(0.045, 0.74, 0.025);
    const slatPositions: number[] = [];
    for (let sx = -3.95; sx <= 2.75; sx += 0.22) {
      slatPositions.push(sx);
    }
    const slatsInstanced = new THREE.InstancedMesh(
      slatGeo,
      this.mats.woodOak,
      slatPositions.length
    );
    const dummy = new THREE.Object3D();
    slatPositions.forEach((sx, idx) => {
      dummy.position.set(sx, 0.51, -0.01);
      dummy.updateMatrix();
      slatsInstanced.setMatrixAt(idx, dummy.matrix);
    });
    slatsInstanced.instanceMatrix.needsUpdate = true;
    counterGroup.add(slatsInstanced);

    // Thick beveled oak countertop slab + dark iron edge trim
    const topSlab = new THREE.Mesh(
      new THREE.BoxGeometry(7.18, 0.065, 0.98),
      this.mats.woodOak
    );
    topSlab.position.set(-0.6, 0.93, -0.45);
    topSlab.castShadow = true;
    topSlab.receiveShadow = true;
    counterGroup.add(topSlab);

    // Brushed Brass Customer Purse/Tray Rail along front of counter
    const frontRail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 6.8, 12),
      this.mats.brassAccent
    );
    frontRail.rotation.z = Math.PI / 2;
    frontRail.position.set(-0.6, 0.76, 0.08);
    counterGroup.add(frontRail);

    this.scene.add(counterGroup);

    // 1. Digital POS Cash Register Terminal at STATIONS.posTerminal.position
    const posGroup = new THREE.Group();
    posGroup.position.copy(STATIONS.posTerminal.position);

    const cashDrawer = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.09, 0.36),
      this.mats.darkIron
    );
    cashDrawer.position.y = -0.06;
    posGroup.add(cashDrawer);

    const stand = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.16),
      this.mats.stainlessSteel
    );
    stand.position.y = 0.04;
    posGroup.add(stand);

    const monitorHousing = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.34, 0.055),
      this.mats.darkIron
    );
    monitorHousing.position.set(0, 0.22, 0);
    monitorHousing.rotation.x = -0.18;
    posGroup.add(monitorHousing);

    const screenMat = new THREE.MeshBasicMaterial({ map: this.posScreenTexture });
    const screenPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28), screenMat);
    screenPlane.position.set(0, 0.22, -0.03);
    screenPlane.rotation.y = Math.PI;
    screenPlane.rotation.x = 0.18;
    posGroup.add(screenPlane);

    // Contactless Customer Card Reader Terminal next to POS
    const cardReader = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.14, 0.16),
      this.mats.darkIron
    );
    cardReader.position.set(-0.34, 0.02, 0.14);
    cardReader.rotation.x = 0.45;
    posGroup.add(cardReader);

    this.scene.add(posGroup);
    this.registerInteractable(posGroup, {
      id: STATIONS.posTerminal.id,
      type: 'pos_terminal',
      label: STATIONS.posTerminal.label,
    });

    // 2. Order Pickup / Delivery Counter Pad at STATIONS.pickupTray.position
    const pickupGroup = new THREE.Group();
    pickupGroup.position.copy(STATIONS.pickupTray.position);

    const matRim = new THREE.Mesh(
      new THREE.BoxGeometry(0.89, 0.024, 0.6),
      this.mats.darkIron
    );
    pickupGroup.add(matRim);

    const matPad = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.032, 0.56),
      this.mats.stainlessSteel
    );
    matPad.receiveShadow = true;
    pickupGroup.add(matPad);

    // Classic Service Call Bell with Brass Dome
    const bellBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.065, 0.02, 16),
      this.mats.darkIron
    );
    bellBase.position.set(0.34, 0.025, -0.18);
    pickupGroup.add(bellBase);

    const bellDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      this.mats.brassAccent
    );
    bellDome.position.set(0.34, 0.03, -0.18);
    pickupGroup.add(bellDome);

    this.scene.add(pickupGroup);
    this.registerInteractable(pickupGroup, {
      id: STATIONS.pickupTray.id,
      type: 'pickup_tray',
      label: STATIONS.pickupTray.label,
    });

    // 3. Service Tray Stack Station at STATIONS.trayStack.position
    const trayStackGroup = this.assets.createTrayStackStationMesh();
    trayStackGroup.position.copy(STATIONS.trayStack.position);
    this.scene.add(trayStackGroup);
    this.registerInteractable(trayStackGroup, {
      id: STATIONS.trayStack.id,
      type: 'tray_stack',
      label: STATIONS.trayStack.label,
    });

    // 4. Physical 3D Burger District Handbook on Walnut Lectern Stand at STATIONS.handbookShelf.position
    const handbookStand = this.assets.createHandbookStandMesh();
    handbookStand.position.copy(STATIONS.handbookShelf.position);
    this.scene.add(handbookStand);
    this.registerInteractable(handbookStand, {
      id: STATIONS.handbookShelf.id,
      type: 'handbook_shelf',
      label: STATIONS.handbookShelf.label,
    });

    // 5. Bussing & Tray Return Station at STATIONS.bussingStation.position (right end of main counter)
    const bussingStation = this.assets.createBussingStationMesh();
    bussingStation.position.copy(STATIONS.bussingStation.position);
    this.scene.add(bussingStation);
    this.registerInteractable(bussingStation, {
      id: STATIONS.bussingStation.id,
      type: 'bussing_station',
      label: STATIONS.bussingStation.label,
    });
  }

  private buildKitchenStations(): Promise<void> {
    // Floor Contact AO Shadows under Back Kitchen Counter & Left Prep Counter
    const backCounterAO = new THREE.Mesh(
      new THREE.PlaneGeometry(11.0, 1.32),
      this.mats.contactShadow
    );
    backCounterAO.rotation.x = -Math.PI / 2;
    backCounterAO.position.set(-1.2, 0.007, -5.12);
    this.scene.add(backCounterAO);

    const leftCounterAO = new THREE.Mesh(
      new THREE.PlaneGeometry(1.18, 4.48),
      this.mats.contactShadow
    );
    leftCounterAO.rotation.x = -Math.PI / 2;
    leftCounterAO.position.set(-6.12, 0.007, -2.65);
    this.scene.add(leftCounterAO);

    // 1. Load High-Poly Beveled PBR Industrial Kitchen & Charbroiler GLB Asset (/models/industrial_kitchen.glb)
    const loader = new GLTFLoader();
    const tLoadStart = performance.now();
    const glbPromise = new Promise<void>((resolve) => {
      loader.load(
        '/models/industrial_kitchen.glb',
        (gltf) => {
          const loadTimeMs = Number((performance.now() - tLoadStart).toFixed(2));
          let meshCount = 0;
          let vertexCount = 0;
          let triangleCount = 0;
          const matSet = new Set<THREE.Material>();

          gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              meshCount++;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              const geo = mesh.geometry;
              const posAttr = geo.getAttribute('position');
              if (posAttr) vertexCount += posAttr.count;
              if (geo.index) triangleCount += geo.index.count / 3;
              else if (posAttr) triangleCount += posAttr.count / 3;

              const mat = mesh.material as THREE.MeshStandardMaterial;
              if (mat && mat.isMeshStandardMaterial) {
                matSet.add(mat);
                mat.envMapIntensity = 1.15;
                for (const tex of [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.aoMap]) {
                  if (tex) {
                    tex.anisotropy = 8;
                    tex.needsUpdate = true;
                  }
                }
                mat.needsUpdate = true;
              }
            }
          });

          this.kitchenGlbStats = {
            loaded: true,
            loadTimeMs,
            meshCount,
            materialCount: matSet.size,
            vertexCount,
            triangleCount,
            activeMode: 'glb',
            legacyAttachedToScene: Boolean(this.legacyKitchenGroup.parent),
          };
          this.kitchenGlbGroup.add(gltf.scene);
          resolve();
        },
        undefined,
        (err) => {
          console.error('Failed to load industrial_kitchen.glb:', err);
          resolve();
        }
      );
    });

    // 2. Four Interactive Grill Slots aligned directly over the GLB's 24 Cast-Iron Grate Bars (Y = 0.978)
    const hitPadMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });

    STATIONS.grill.slots.forEach((slotPos, idx) => {
      const slotPad = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.035, 0.28),
        hitPadMat
      );
      slotPad.position.copy(slotPos);
      slotPad.position.y = 0.98;
      this.scene.add(slotPad);

      const visualHolder = new THREE.Group();
      visualHolder.position.copy(slotPos);
      visualHolder.position.y = 0.982;
      this.scene.add(visualHolder);
      this.grillSlotVisuals.push(visualHolder);

      this.registerInteractable(slotPad, {
        id: `grill_slot_${idx}`,
        type: 'grill_slot',
        slotIndex: idx,
        label: `Izgara Bölmesi #${idx + 1}`,
      });
    });

    // 3. Interactive Butcher Block Assembly Station at STATIONS.assemblyBoard.position
    const boardGroup = new THREE.Group();
    boardGroup.position.copy(STATIONS.assemblyBoard.position);

    const boardHitBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.055, 0.68),
      hitPadMat
    );
    boardGroup.add(boardHitBox);

    const traySpotRing = new THREE.Mesh(
      new THREE.RingGeometry(0.145, 0.162, 28),
      this.mats.brassAccent
    );
    traySpotRing.rotation.x = -Math.PI / 2;
    traySpotRing.position.set(-0.18, 0.028, 0.02);
    boardGroup.add(traySpotRing);

    // Stainless Chef Burger Spatula resting on right edge of the GLB Butcher Block
    const spatulaGroup = new THREE.Group();
    spatulaGroup.position.set(0.38, 0.032, 0.12);
    spatulaGroup.rotation.y = -0.35;
    const spatulaBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.006, 0.15),
      this.mats.stainlessSteel
    );
    const spatulaHandle = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.016, 0.12, 6, 8),
      this.mats.woodDarkWalnut
    );
    spatulaHandle.rotation.x = Math.PI / 2;
    spatulaHandle.position.set(0, 0.014, 0.13);
    spatulaGroup.add(spatulaBlade, spatulaHandle);
    boardGroup.add(spatulaGroup);

    this.scene.add(boardGroup);
    this.registerInteractable(boardGroup, {
      id: STATIONS.assemblyBoard.id,
      type: 'assembly_board',
      label: STATIONS.assemblyBoard.label,
    });

    // 3. Soda Dispenser Machine at STATIONS.sodaDispenser.position
    const sodaGroup = new THREE.Group();
    sodaGroup.position.copy(STATIONS.sodaDispenser.position);

    const machineBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.62, 0.48),
      this.mats.stainlessSteel
    );
    machineBody.position.set(0, 0.12, -0.04);
    machineBody.castShadow = true;
    sodaGroup.add(machineBody);

    // Slotted Stainless Drip Tray & Cup Rest
    const dripTray = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.05, 0.24),
      this.mats.darkIron
    );
    dripTray.position.set(0, -0.16, 0.22);
    sodaGroup.add(dripTray);

    const dispenserHeader = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.24, 0.58),
      new THREE.MeshStandardMaterial({
        color: 0xd62828,
        roughness: 0.28,
        emissive: 0x7f1d1d,
        emissiveIntensity: 0.45,
      })
    );
    dispenserHeader.position.set(0, 0.46, 0.02);
    sodaGroup.add(dispenserHeader);

    // 3 Nozzles + Chromed Push Levers + Flavor Badges
    const badgeColors = [0xef4444, 0xf97316, 0x22c55e];
    [-0.18, 0, 0.18].forEach((nx, i) => {
      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.018, 0.09, 12),
        this.mats.darkIron
      );
      nozzle.position.set(nx, 0.28, 0.26);
      sodaGroup.add(nozzle);

      const lever = new THREE.Mesh(
        new THREE.BoxGeometry(0.016, 0.11, 0.01),
        this.mats.stainlessSteel
      );
      lever.position.set(nx, 0.21, 0.24);
      lever.rotation.x = 0.18;
      sodaGroup.add(lever);

      const badge = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.07, 0.015),
        new THREE.MeshBasicMaterial({ color: badgeColors[i] })
      );
      badge.position.set(nx, 0.44, 0.315);
      sodaGroup.add(badge);
    });

    this.scene.add(sodaGroup);
    this.registerInteractable(sodaGroup, {
      id: STATIONS.sodaDispenser.id,
      type: 'soda_dispenser',
      label: STATIONS.sodaDispenser.label,
      stockKey: 'soda',
    });

    // 4. Trash Bin at STATIONS.trashBin.position
    const trashGroup = new THREE.Group();
    trashGroup.position.copy(STATIONS.trashBin.position);

    const binBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.26, 0.85, 20),
      this.mats.darkIron
    );
    binBody.castShadow = true;
    trashGroup.add(binBody);

    const binRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.032, 12, 24),
      this.mats.stainlessSteel
    );
    binRim.rotation.x = Math.PI / 2;
    binRim.position.y = 0.42;
    trashGroup.add(binRim);

    this.scene.add(trashGroup);
    this.registerInteractable(trashGroup, {
      id: STATIONS.trashBin.id,
      type: 'trash_bin',
      label: STATIONS.trashBin.label,
    });

    // 5. Left Prep Counter Gastronorm Pans & Glass Sneeze Guard (Counter body is part of industrial_kitchen.glb)
    const sneezeGuardGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.32, 4.1),
      this.mats.glassWindow
    );
    sneezeGuardGlass.position.set(-5.92, 1.28, -2.65);
    sneezeGuardGlass.rotation.z = -0.35;
    this.scene.add(sneezeGuardGlass);

    for (const binCfg of Object.values(STATIONS.bins)) {
      const binGroup = new THREE.Group();
      binGroup.position.copy(binCfg.position);

      // Stainless Steel Gastronorm (GN 1/3) Hotel Pan Rim + Recessed Interior
      const panRim = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.035, 0.69),
        this.mats.stainlessSteel
      );
      panRim.position.y = 0.025;
      binGroup.add(panRim);

      const trayPan = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.09, 0.63),
        this.mats.darkIron
      );
      binGroup.add(trayPan);

      // Decorative stacked samples inside bin
      for (let i = 0; i < 2; i++) {
        const sample = this.assets.createIngredientMesh(binCfg.ingredient);
        sample.position.set(0, 0.05 + i * 0.045, (i - 0.5) * 0.14);
        binGroup.add(sample);
      }

      this.scene.add(binGroup);
      this.registerInteractable(binGroup, {
        id: binCfg.id,
        type: 'ingredient_bin',
        ingredient: binCfg.ingredient,
        stockKey: binCfg.stockKey,
        label: binCfg.label,
      });
    }

    // 6. Back-of-House Cold Supply & Dry Storage Zone (DEPO & STOK ALANI) at X = 5.95, Z = -3.9
    const rackGroup = new THREE.Group();
    rackGroup.position.set(6.02, 0, -3.95);

    // Non-slip rubber floor mat under storage rack
    const storageFloorMat = new THREE.Mesh(
      new THREE.PlaneGeometry(1.06, 2.55),
      this.mats.contactShadow
    );
    storageFloorMat.rotation.x = -Math.PI / 2;
    storageFloorMat.position.y = 0.006;
    rackGroup.add(storageFloorMat);

    // 6 Heavy-Duty Stainless Metro Rack Posts
    for (const px of [-0.38, 0.38]) {
      for (const pz of [-1.12, 0, 1.12]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.026, 0.026, 2.24, 12),
          this.mats.stainlessSteel
        );
        post.position.set(px, 1.12, pz);
        rackGroup.add(post);
      }
    }

    const crateMatBun = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.65 });
    const crateMatCold = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45 });
    const crateMatDairy = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.55 });
    const crateMatProduce = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.62 });

    const shelfLevels = [0.38, 0.88, 1.38, 1.88];
    shelfLevels.forEach((sy, tierIdx) => {
      const shelf = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.036, 2.32),
        this.mats.stainlessSteel
      );
      shelf.position.y = sy;
      shelf.castShadow = true;
      shelf.receiveShadow = true;
      rackGroup.add(shelf);

      if (tierIdx === 0) {
        // Bottom Tier: Stainless CO2 & District Cola Syrup Cylinders + Cold Patty Boxes
        for (const cz of [-0.78, -0.38]) {
          const tank = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.14, 0.42, 16),
            this.mats.stainlessSteel
          );
          tank.position.set(0, sy + 0.22, cz);
          const cap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.12, 0.06, 12),
            new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 })
          );
          cap.position.y = 0.24;
          tank.add(cap);
          rackGroup.add(tank);
        }
        for (const bz of [0.25, 0.78]) {
          const coldBox = new THREE.Mesh(
            new THREE.BoxGeometry(0.56, 0.28, 0.42),
            crateMatCold
          );
          coldBox.position.set(0, sy + 0.16, bz);
          rackGroup.add(coldBox);
        }
      } else if (tierIdx === 1) {
        // Second Tier: Insulated Beef Patty Cold Boxes & Aged Cheddar Packs
        for (const bz of [-0.72, -0.15]) {
          const meatCrate = new THREE.Mesh(
            new THREE.BoxGeometry(0.58, 0.24, 0.44),
            crateMatCold
          );
          meatCrate.position.set(0, sy + 0.14, bz);
          rackGroup.add(meatCrate);
        }
        for (const cz of [0.42, 0.86]) {
          const cheeseBox = new THREE.Mesh(
            new THREE.BoxGeometry(0.52, 0.20, 0.36),
            crateMatDairy
          );
          cheeseBox.position.set(0, sy + 0.12, cz);
          rackGroup.add(cheeseBox);
        }
      } else if (tierIdx === 2) {
        // Third Tier: Golden Brioche Bakery Crates & Fresh Lettuce Produce Crates
        for (const bz of [-0.72, -0.16]) {
          const bunCrate = new THREE.Mesh(
            new THREE.BoxGeometry(0.60, 0.18, 0.46),
            crateMatBun
          );
          bunCrate.position.set(0, sy + 0.11, bz);
          rackGroup.add(bunCrate);
          const bunSample = this.assets.createIngredientMesh('bun_top');
          bunSample.position.set(0, sy + 0.21, bz);
          rackGroup.add(bunSample);
        }
        for (const lz of [0.42, 0.86]) {
          const produceCrate = new THREE.Mesh(
            new THREE.BoxGeometry(0.56, 0.20, 0.38),
            crateMatProduce
          );
          produceCrate.position.set(0, sy + 0.12, lz);
          rackGroup.add(produceCrate);
        }
      } else {
        // Top Tier: Extra Brioche Bun Trays & Paper Packaging Stacks
        for (const bz of [-0.68, 0, 0.68]) {
          const bun = this.assets.createIngredientMesh('bun_top');
          bun.position.set(0, sy + 0.02, bz);
          rackGroup.add(bun);
        }
      }
    });

    // Overhead Diegetic Storage Zone Sign ("DEPO & SOĞUK STOK")
    if (typeof document !== 'undefined') {
      const sc = document.createElement('canvas');
      sc.width = 256;
      sc.height = 64;
      const sctx = sc.getContext('2d');
      if (sctx) {
        sctx.fillStyle = '#0f172a';
        sctx.fillRect(0, 0, 256, 64);
        sctx.strokeStyle = '#38bdf8';
        sctx.lineWidth = 4;
        sctx.strokeRect(4, 4, 248, 56);
        sctx.fillStyle = '#f8fafc';
        sctx.font = 'bold 20px sans-serif';
        sctx.textAlign = 'center';
        sctx.fillText('DEPO & SOĞUK STOK', 128, 39);
        const stex = new THREE.CanvasTexture(sc);
        stex.colorSpace = THREE.SRGBColorSpace;
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(0.95, 0.24),
          new THREE.MeshBasicMaterial({ map: stex })
        );
        sign.position.set(-0.42, 2.34, 0);
        sign.rotation.y = -Math.PI / 2;
        rackGroup.add(sign);
      }
    }

    this.scene.add(rackGroup);
    return glbPromise;
  }

  private buildDiningArea(): void {
    // 1. Architectural Dining Hall Wall Wainscoting, Brick Pilasters, Wall Sconces & Ceiling Beams
    for (const side of [-1, 1]) {
      const wallX = side * 6.58;

      // Lower Dark Walnut Wainscot Paneling (Z = 0.0 to 5.6, Y = 0.0 to 1.18)
      const wainscotBase = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 1.16, 5.65),
        this.mats.woodDarkWalnut
      );
      wainscotBase.position.set(wallX, 0.58, 2.82);
      wainscotBase.receiveShadow = true;
      this.scene.add(wainscotBase);

      // Brushed Brass Chair Rail Cap at Y = 1.18
      const chairRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.085, 0.042, 5.7),
        this.mats.brassAccent
      );
      chairRail.position.set(wallX, 1.18, 2.82);
      this.scene.add(chairRail);

      // Raised Oak Molding Picture-Frame Panels along the Wainscot
      for (const pz of [0.85, 2.15, 3.65, 4.95]) {
        const panelInset = new THREE.Mesh(
          new THREE.BoxGeometry(0.075, 0.76, 0.96),
          this.mats.woodOak
        );
        panelInset.position.set(wallX, 0.6, pz);
        this.scene.add(panelInset);
      }

      // Full-Height Architectural Heritage Brick & Iron Pilasters framing the Booth Alcove (Z = 0.45 and Z = 5.25)
      for (const pilasterZ of [0.45, 5.25]) {
        const pilasterGroup = new THREE.Group();
        pilasterGroup.position.set(side * 6.46, 0, pilasterZ);

        const brickColumn = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 3.85, 0.44),
          this.mats.wallBrick
        );
        brickColumn.position.y = 1.925;
        brickColumn.castShadow = true;
        brickColumn.receiveShadow = true;
        pilasterGroup.add(brickColumn);

        // Dark Iron I-Beam Corner Trim & Walnut Plinth/Capital
        const ironTrim = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 3.85, 0.08),
          this.mats.darkIron
        );
        ironTrim.position.y = 1.925;
        pilasterGroup.add(ironTrim);

        const colPlinth = new THREE.Mesh(
          new THREE.BoxGeometry(0.33, 0.24, 0.48),
          this.mats.woodDarkWalnut
        );
        colPlinth.position.y = 0.12;
        pilasterGroup.add(colPlinth);

        const colCapital = new THREE.Mesh(
          new THREE.BoxGeometry(0.34, 0.18, 0.5),
          this.mats.woodDarkWalnut
        );
        colCapital.position.y = 3.72;
        pilasterGroup.add(colCapital);

        // Warm Brass Architectural Wall Sconce Lantern mounted on Pilaster Face
        const sconceBack = new THREE.Mesh(
          new THREE.CylinderGeometry(0.065, 0.065, 0.025, 14),
          this.mats.brassAccent
        );
        sconceBack.rotation.z = Math.PI / 2;
        sconceBack.position.set(-side * 0.155, 2.22, 0);
        pilasterGroup.add(sconceBack);

        const sconceArm = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.024, 0.024),
          this.mats.brassAccent
        );
        sconceArm.position.set(-side * 0.2, 2.18, 0);
        pilasterGroup.add(sconceArm);

        const sconceGlobe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.058, 0.044, 0.18, 14),
          this.mats.neonSignWarm
        );
        sconceGlobe.position.set(-side * 0.24, 2.25, 0);
        pilasterGroup.add(sconceGlobe);

        const sconceCap = new THREE.Mesh(
          new THREE.ConeGeometry(0.072, 0.04, 14),
          this.mats.brassAccent
        );
        sconceCap.position.set(-side * 0.24, 2.35, 0);
        pilasterGroup.add(sconceCap);

        this.scene.add(pilasterGroup);
      }
    }

    // Overhead Architectural Coffer Beams spanning the Dining Hall Ceiling
    for (const beamZ of [1.15, 2.9, 4.65]) {
      const ceilingBeam = new THREE.Mesh(
        new THREE.BoxGeometry(13.2, 0.18, 0.24),
        this.mats.woodDarkWalnut
      );
      ceilingBeam.position.set(0, 3.82, beamZ);
      this.scene.add(ceilingBeam);

      const ironFlange = new THREE.Mesh(
        new THREE.BoxGeometry(13.22, 0.035, 0.28),
        this.mats.darkIron
      );
      ironFlange.position.set(0, 3.72, beamZ);
      this.scene.add(ironFlange);
    }

    // 2. Sculpted Ergonomic Booths & Beveled Solid Oak Tables (Exact coordinates preserved: X = ±4.9, Z = 2.9)
    const tableSides = [-4.9, 4.9];

    // Sculpted seat cushion profile with rounded waterfall front knee bolster
    const seatShape = new THREE.Shape();
    seatShape.moveTo(-0.27, 0.0);
    seatShape.lineTo(0.24, 0.0);
    seatShape.quadraticCurveTo(0.305, 0.0, 0.305, 0.15);
    seatShape.quadraticCurveTo(0.305, 0.295, 0.20, 0.305);
    seatShape.quadraticCurveTo(0.0, 0.29, -0.27, 0.275);
    seatShape.closePath();
    const seatCushionGeo = new THREE.ExtrudeGeometry(seatShape, {
      depth: 1.5,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.026,
      bevelThickness: 0.026,
    });
    seatCushionGeo.translate(0, 0, -0.75);
    seatCushionGeo.rotateY(Math.PI / 2);

    // Sculpted ergonomic S-curve lumbar & upper backrest cushion profile
    const backShape = new THREE.Shape();
    backShape.moveTo(-0.09, 0.0);
    backShape.lineTo(0.08, 0.0);
    backShape.quadraticCurveTo(0.125, 0.16, 0.095, 0.34); // lumbar support swell
    backShape.quadraticCurveTo(0.075, 0.48, 0.09, 0.58);
    backShape.quadraticCurveTo(0.09, 0.65, 0.0, 0.65);
    backShape.quadraticCurveTo(-0.09, 0.64, -0.09, 0.54);
    backShape.closePath();
    const backCushionGeo = new THREE.ExtrudeGeometry(backShape, {
      depth: 1.5,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.024,
      bevelThickness: 0.024,
    });
    backCushionGeo.translate(0, 0, -0.75);
    backCushionGeo.rotateY(Math.PI / 2);

    // Sculpted curved walnut booth side-armrest end frame profile
    const sideFrameShape = new THREE.Shape();
    sideFrameShape.moveTo(-0.32, 0.0);
    sideFrameShape.lineTo(0.31, 0.0);
    sideFrameShape.lineTo(0.31, 0.46);
    sideFrameShape.quadraticCurveTo(0.31, 0.56, 0.16, 0.58);
    sideFrameShape.quadraticCurveTo(0.02, 0.60, -0.06, 0.88);
    sideFrameShape.quadraticCurveTo(-0.10, 0.98, -0.22, 0.98);
    sideFrameShape.lineTo(-0.32, 0.98);
    sideFrameShape.closePath();
    const sideFrameGeo = new THREE.ExtrudeGeometry(sideFrameShape, {
      depth: 0.048,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.012,
      bevelThickness: 0.012,
    });
    sideFrameGeo.translate(0, 0, -0.024);
    sideFrameGeo.rotateY(Math.PI / 2);

    // Rounded-corner beveled solid oak tabletop geometry (1.52m x 1.06m)
    const tw = 1.48;
    const td = 1.02;
    const tr = 0.08;
    const tableShape = new THREE.Shape();
    tableShape.moveTo(-tw / 2 + tr, -td / 2);
    tableShape.lineTo(tw / 2 - tr, -td / 2);
    tableShape.quadraticCurveTo(tw / 2, -td / 2, tw / 2, -td / 2 + tr);
    tableShape.lineTo(tw / 2, td / 2 - tr);
    tableShape.quadraticCurveTo(tw / 2, td / 2, tw / 2 - tr, td / 2);
    tableShape.lineTo(-tw / 2 + tr, td / 2);
    tableShape.quadraticCurveTo(-tw / 2, td / 2, -tw / 2, td / 2 - tr);
    tableShape.lineTo(-tw / 2, -td / 2 + tr);
    tableShape.quadraticCurveTo(-tw / 2, -td / 2, -tw / 2 + tr, -td / 2);
    const beveledTableTopGeo = new THREE.ExtrudeGeometry(tableShape, {
      depth: 0.048,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.016,
      bevelThickness: 0.014,
    });
    beveledTableTopGeo.rotateX(Math.PI / 2);

    // Lathe-turned cast-iron bistro pedestal column profile
    const pedestalProfile = [
      new THREE.Vector2(0.36, 0.0),
      new THREE.Vector2(0.35, 0.028),
      new THREE.Vector2(0.26, 0.055),
      new THREE.Vector2(0.14, 0.12),
      new THREE.Vector2(0.085, 0.22),
      new THREE.Vector2(0.072, 0.62),
      new THREE.Vector2(0.12, 0.71),
      new THREE.Vector2(0.28, 0.74),
    ];
    const pedestalLatheGeo = new THREE.LatheGeometry(pedestalProfile, 24);

    tableSides.forEach((tx, idx) => {
      const boothGroup = new THREE.Group();
      boothGroup.position.set(tx, 0, 2.9);

      // Soft Floor Contact AO Shadow under Booth & Table
      const boothAO = new THREE.Mesh(
        new THREE.PlaneGeometry(2.42, 3.18),
        this.mats.contactShadow
      );
      boothAO.rotation.x = -Math.PI / 2;
      boothAO.position.y = 0.006;
      boothGroup.add(boothAO);

      // Beveled Solid Oak Tabletop (Top surface at Y = 0.798)
      const tableTop = new THREE.Mesh(beveledTableTopGeo, this.mats.woodOak);
      tableTop.position.y = 0.784;
      tableTop.castShadow = true;
      tableTop.receiveShadow = true;
      boothGroup.add(tableTop);

      // Under-table Dark Iron Structural Apron & Brass Edge Trim
      const tableApron = new THREE.Mesh(
        new THREE.BoxGeometry(1.38, 0.045, 0.92),
        this.mats.darkIron
      );
      tableApron.position.y = 0.715;
      boothGroup.add(tableApron);

      const brassEdgeBand = new THREE.Mesh(
        new THREE.BoxGeometry(1.525, 0.014, 1.065),
        this.mats.brassAccent
      );
      brassEdgeBand.position.y = 0.758;
      boothGroup.add(brassEdgeBand);

      // Inlaid Brushed Brass Center Strip & Cross Medallions along Tabletop
      const tableInlay = new THREE.Mesh(
        new THREE.BoxGeometry(1.42, 0.003, 0.024),
        this.mats.brassAccent
      );
      tableInlay.position.set(0, 0.798, 0);
      boothGroup.add(tableInlay);

      // Sculpted Cast-Iron Pedestal Column + Brushed Brass Decorative Collar Ring
      const pedestal = new THREE.Mesh(pedestalLatheGeo, this.mats.darkIron);
      pedestal.castShadow = true;
      pedestal.receiveShadow = true;
      boothGroup.add(pedestal);

      const pedestalBrassRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.092, 0.012, 10, 24),
        this.mats.brassAccent
      );
      pedestalBrassRing.rotation.x = Math.PI / 2;
      pedestalBrassRing.position.y = 0.19;
      boothGroup.add(pedestalBrassRing);

      // Tabletop Walnut & Brass Condiment Tray + Napkin Dispenser + Shakers + Bistro Lamp
      const caddyTray = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.016, 0.44),
        this.mats.woodDarkWalnut
      );
      caddyTray.position.set(tx < 0 ? -0.42 : 0.42, 0.804, 0);
      boothGroup.add(caddyTray);

      const napkinHolder = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.14, 0.085),
        this.mats.stainlessSteel
      );
      napkinHolder.position.set(tx < 0 ? -0.48 : 0.48, 0.86, 0);
      boothGroup.add(napkinHolder);

      const napkinStack = new THREE.Mesh(
        new THREE.BoxGeometry(0.085, 0.12, 0.098),
        this.mats.trayPaperMaterial
      );
      napkinStack.position.set(tx < 0 ? -0.48 : 0.48, 0.87, 0);
      boothGroup.add(napkinStack);

      // Glass Salt & Pepper Shakers with Brushed Steel Tops
      const shakerBodyGeo = new THREE.CylinderGeometry(0.018, 0.021, 0.068, 12);
      const shakerCapGeo = new THREE.CylinderGeometry(0.017, 0.018, 0.016, 12);
      const saltGlassMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
      const pepperGlassMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.35 });
      for (const [sz, sMat] of [
        [-0.16, saltGlassMat],
        [0.16, pepperGlassMat],
      ] as const) {
        const shaker = new THREE.Group();
        shaker.position.set(tx < 0 ? -0.43 : 0.43, 0.84, sz);
        const body = new THREE.Mesh(shakerBodyGeo, sMat);
        const cap = new THREE.Mesh(shakerCapGeo, this.mats.stainlessSteel);
        cap.position.y = 0.042;
        shaker.add(body, cap);
        boothGroup.add(shaker);
      }

      const ketchup = this.assets.createSqueezeBottleMesh(0xdc2626);
      ketchup.position.set(tx < 0 ? -0.32 : 0.32, 0.808, 0.085);
      boothGroup.add(ketchup);

      const mustard = this.assets.createSqueezeBottleMesh(0xeab308);
      mustard.position.set(tx < 0 ? -0.32 : 0.32, 0.808, -0.085);
      boothGroup.add(mustard);

      // Warm Cordless Brass Pleated Bistro Table Lamp
      const bistroLamp = new THREE.Group();
      bistroLamp.position.set(tx < 0 ? -0.52 : 0.52, 0.808, -0.26);
      const lampBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.046, 0.058, 0.022, 16),
        this.mats.brassAccent
      );
      const lampStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.013, 0.19, 12),
        this.mats.brassAccent
      );
      lampStem.position.y = 0.095;
      const lampShade = new THREE.Mesh(
        new THREE.ConeGeometry(0.092, 0.098, 20),
        this.mats.neonSignWarm
      );
      lampShade.position.y = 0.198;
      const lampFinial = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 10, 10),
        this.mats.brassAccent
      );
      lampFinial.position.y = 0.25;
      bistroLamp.add(lampBase, lampStem, lampShade, lampFinial);
      boothGroup.add(bistroLamp);

      // Brass Table Number Tent (#1 / #2)
      const tent = new THREE.Mesh(
        new THREE.ConeGeometry(0.045, 0.075, 4),
        this.mats.brassAccent
      );
      tent.position.set(tx < 0 ? -0.20 : 0.20, 0.835, -0.25);
      tent.rotation.y = Math.PI / 4 + idx * 0.1;
      boothGroup.add(tent);

      // Front & Back Sculpted Upholstered Benches with Curved Walnut Side Frames & Stitched Leather
      const buttonGeo = new THREE.SphereGeometry(0.015, 10, 10);
      for (const dir of [-1, 1]) {
        // Recessed Dark Iron Toe-Kick + Walnut Base Plinth
        const toeKick = new THREE.Mesh(
          new THREE.BoxGeometry(1.52, 0.05, 0.52),
          this.mats.darkIron
        );
        toeKick.position.set(0, 0.025, dir * 0.96);
        boothGroup.add(toeKick);

        const plinth = new THREE.Mesh(
          new THREE.BoxGeometry(1.58, 0.14, 0.58),
          this.mats.woodDarkWalnut
        );
        plinth.position.set(0, 0.10, dir * 0.95);
        boothGroup.add(plinth);

        // Brushed Brass Kickplate Trim along Plinth Base
        const kickTrim = new THREE.Mesh(
          new THREE.BoxGeometry(1.59, 0.022, 0.59),
          this.mats.brassAccent
        );
        kickTrim.position.set(0, 0.045, dir * 0.95);
        boothGroup.add(kickTrim);

        // Sculpted Waterfall Leather Seat Cushion
        const seat = new THREE.Mesh(seatCushionGeo, this.mats.boothLeatherRed);
        seat.position.set(0, 0.16, dir * 0.95);
        if (dir === 1) {
          seat.rotation.y = Math.PI;
        }
        seat.castShadow = true;
        seat.receiveShadow = true;
        boothGroup.add(seat);

        // Contrasting Tan Leather Piping Welt along Front Seat Knee Bolster
        const frontPiping = new THREE.Mesh(
          new THREE.CylinderGeometry(0.013, 0.013, 1.54, 12),
          this.mats.boothLeatherTan
        );
        frontPiping.rotation.z = Math.PI / 2;
        frontPiping.position.set(0, 0.435, dir * 0.675);
        boothGroup.add(frontPiping);

        // Sculpted S-Curve Lumbar & Thoracic Backrest Cushion
        const backrest = new THREE.Mesh(backCushionGeo, this.mats.boothLeatherTan);
        backrest.position.set(0, 0.42, dir * 1.15);
        if (dir === 1) {
          backrest.rotation.y = Math.PI;
        }
        backrest.castShadow = true;
        backrest.receiveShadow = true;
        boothGroup.add(backrest);

        // Architectural Walnut Back Shell behind the Booth Backrest
        const backWoodShell = new THREE.Mesh(
          new THREE.BoxGeometry(1.62, 0.92, 0.045),
          this.mats.woodDarkWalnut
        );
        backWoodShell.position.set(0, 0.56, dir * 1.255);
        backWoodShell.castShadow = true;
        boothGroup.add(backWoodShell);

        // Sculpted Curved Walnut Side Armrest End Panels with Brass Cap Trim
        for (const endSide of [-1, 1]) {
          const endPanel = new THREE.Mesh(
            sideFrameGeo,
            this.mats.woodDarkWalnut
          );
          endPanel.position.set(endSide * 0.80, 0.04, dir * 0.96);
          if (dir === 1) {
            endPanel.rotation.y = Math.PI;
          }
          endPanel.castShadow = true;
          endPanel.receiveShadow = true;
          boothGroup.add(endPanel);

          const armBrassAccent = new THREE.Mesh(
            new THREE.CylinderGeometry(0.014, 0.014, 0.56, 10),
            this.mats.brassAccent
          );
          armBrassAccent.rotation.x = Math.PI / 2;
          armBrassAccent.position.set(endSide * 0.80, 0.62, dir * 0.92);
          boothGroup.add(armBrassAccent);
        }

        // Rounded Top Headrest Bolster Roll with Brass End Caps
        const headRoll = new THREE.Mesh(
          new THREE.CylinderGeometry(0.084, 0.084, 1.56, 18),
          this.mats.boothLeatherRed
        );
        headRoll.rotation.z = Math.PI / 2;
        headRoll.position.set(0, 1.04, dir * 1.17);
        headRoll.castShadow = true;
        boothGroup.add(headRoll);

        // Vertical Tufted Cushion Channels + Contrasting Seam Welts + Brass Upholstery Studs
        for (let cx = -0.6; cx <= 0.6; cx += 0.24) {
          const channel = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.052, 0.46, 10, 14),
            this.mats.boothLeatherRed
          );
          channel.position.set(cx, 0.72, dir * 1.075);
          channel.rotation.x = dir * 0.07;
          channel.castShadow = true;
          boothGroup.add(channel);

          const studTop = new THREE.Mesh(buttonGeo, this.mats.brassAccent);
          studTop.position.set(cx, 0.83, dir * 1.022);
          const studBot = new THREE.Mesh(buttonGeo, this.mats.brassAccent);
          studBot.position.set(cx, 0.59, dir * 1.038);
          boothGroup.add(studTop, studBot);
        }
      }

      this.scene.add(boothGroup);
    });

    // 3. Framed Gallery Wall Artwork & Acoustic Oak Slat Feature Panels on Dining Side Walls
    for (const side of [-1, 1]) {
      const frameGroup = new THREE.Group();
      frameGroup.position.set(side * 6.59, 2.22, 2.9);
      frameGroup.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;

      // Dark Iron Acoustic Backing Plate
      const slatBacker = new THREE.Mesh(
        new THREE.BoxGeometry(2.15, 1.48, 0.018),
        this.mats.darkIron
      );
      slatBacker.position.set(0, 0, -0.02);
      frameGroup.add(slatBacker);

      // Vertical Acoustic Oak Slat Backing behind Wall Art
      for (let sx = -0.99; sx <= 0.99; sx += 0.11) {
        const slat = new THREE.Mesh(
          new THREE.BoxGeometry(0.052, 1.44, 0.026),
          this.mats.woodOak
        );
        slat.position.set(sx, 0, -0.008);
        frameGroup.add(slat);
      }

      const outerFrame = new THREE.Mesh(
        new THREE.BoxGeometry(1.38, 1.02, 0.052),
        this.mats.woodDarkWalnut
      );
      frameGroup.add(outerFrame);

      const brassInnerTrim = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 0.89, 0.058),
        this.mats.brassAccent
      );
      frameGroup.add(brassInnerTrim);

      const poster = new THREE.Mesh(
        new THREE.PlaneGeometry(1.18, 0.82),
        side < 0 ? this.mats.posterArtWarm : this.mats.posterArtVintage
      );
      poster.position.z = 0.032;
      frameGroup.add(poster);

      // Gallery Brass Picture Light Bar + Warm Glow Tube above Artwork
      const picLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.76, 0.034, 0.14),
        this.mats.brassAccent
      );
      picLight.position.set(0, 0.58, 0.06);
      frameGroup.add(picLight);

      const picGlow = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.016, 0.04),
        this.mats.neonSignWarm
      );
      picGlow.position.set(0, 0.562, 0.08);
      frameGroup.add(picGlow);

      this.scene.add(frameGroup);
    }

    // 4. Sculpted Monstera / Ficus Botanical Planters flanking the Storefront Entrance & Booth Dividers
    for (const [px, pz] of [
      [-2.35, 5.15],
      [2.35, 5.15],
      [-5.65, 1.05],
      [5.65, 1.05],
    ]) {
      const planter = this.createSculptedBotanicalPlanter(false);
      planter.position.set(px, 0, pz);
      this.scene.add(planter);
    }
  }

  private createSculptedBotanicalPlanter(isBrassPot: boolean): THREE.Group {
    const planter = new THREE.Group();

    // Soft contact AO shadow disc under planter
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.68, 0.68),
      this.mats.contactShadow
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    planter.add(shadow);

    // Brushed Brass Base Plinth
    const basePlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.21, 0.045, 24),
      this.mats.brassAccent
    );
    basePlinth.position.y = 0.0225;
    planter.add(basePlinth);

    // Sculpted Fluted Architectural Ceramic / Brass Planter Pot
    const ceramicPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.185, 0.44, 24),
      isBrassPot ? this.mats.brassAccent : this.mats.darkIron
    );
    ceramicPot.position.y = 0.25;
    ceramicPot.castShadow = true;
    ceramicPot.receiveShadow = true;
    planter.add(ceramicPot);

    // Vertical Architectural Fluting Ribs around the Planter Exterior
    for (let r = 0; r < 12; r++) {
      const ra = (r / 12) * Math.PI * 2;
      const rib = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.009, 0.40, 8),
        isBrassPot ? this.mats.woodDarkWalnut : this.mats.brassAccent
      );
      rib.position.set(Math.cos(ra) * 0.218, 0.25, Math.sin(ra) * 0.218);
      rib.rotation.z = -Math.cos(ra) * 0.12;
      rib.rotation.x = Math.sin(ra) * 0.12;
      planter.add(rib);
    }

    const brassRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.252, 0.016, 10, 28),
      this.mats.brassAccent
    );
    brassRim.rotation.x = Math.PI / 2;
    brassRim.position.y = 0.47;
    planter.add(brassRim);

    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.23, 0.04, 20),
      this.mats.woodDarkWalnut
    );
    soil.position.y = 0.45;
    planter.add(soil);

    // Decorative river pebbles atop planter soil
    const pebbleGeo = new THREE.DodecahedronGeometry(0.024, 0);
    for (let p = 0; p < 10; p++) {
      const pa = (p / 10) * Math.PI * 2;
      const pr = 0.10 + (p % 3) * 0.04;
      const pebble = new THREE.Mesh(pebbleGeo, this.mats.concreteCurb);
      pebble.position.set(Math.cos(pa) * pr, 0.472, Math.sin(pa) * pr);
      pebble.scale.set(1.2, 0.55, 0.9);
      pebble.rotation.y = pa;
      planter.add(pebble);
    }

    // Sculpted heart-shaped / split-leaf Monstera frond geometry with central midrib
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.14, 0.04, 0.15, 0.19);
    leafShape.quadraticCurveTo(0.12, 0.34, 0, 0.42);
    leafShape.quadraticCurveTo(-0.12, 0.34, -0.15, 0.19);
    leafShape.quadraticCurveTo(-0.14, 0.04, 0, 0);
    const frondGeo = new THREE.ExtrudeGeometry(leafShape, {
      depth: 0.006,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.004,
      bevelThickness: 0.003,
    });
    frondGeo.rotateX(-Math.PI * 0.32);

    // 13 multi-height arched botanical stems with lush fanned Monstera & Ficus leaves
    for (let i = 0; i < 13; i++) {
      const angle = (i / 13) * Math.PI * 2 + (i % 2) * 0.18;
      const tier = i % 3;
      const stemHeight = 0.30 + tier * 0.14;
      const radialSpread = 0.04 + tier * 0.038;

      const stemGroup = new THREE.Group();
      stemGroup.position.set(
        Math.cos(angle) * radialSpread,
        0.46,
        Math.sin(angle) * radialSpread
      );
      stemGroup.rotation.y = -angle + Math.PI / 2;

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.014, stemHeight, 8),
        this.mats.treeBark
      );
      stem.position.set(0, stemHeight * 0.5, 0.045);
      stem.rotation.x = 0.24 + tier * 0.09;
      stemGroup.add(stem);

      const leafMat = i % 2 === 0 ? this.mats.foliageRich : this.mats.foliageSunlit;
      const frond = new THREE.Mesh(frondGeo, leafMat);
      const scale = 0.85 + tier * 0.18;
      frond.scale.set(scale, scale, scale);
      frond.position.set(0, stemHeight * 0.92, 0.085 + tier * 0.032);
      frond.rotation.z = ((i % 3) - 1) * 0.15;
      frond.castShadow = true;
      stemGroup.add(frond);

      planter.add(stemGroup);
    }

    return planter;
  }

  private buildLightingFixturesAndSignage(): void {
    // 1. Illuminated Wall Menu Board shifted right of the range hood (X = 0.85) so hood never blocks it
    const menuFrame = new THREE.Group();
    menuFrame.position.set(0.85, 2.55, -5.68);

    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(3.64, 1.28, 0.09),
      this.mats.darkIron
    );
    menuFrame.add(housing);

    const brassTrim = new THREE.Mesh(
      new THREE.BoxGeometry(3.56, 1.2, 0.095),
      this.mats.brassAccent
    );
    menuFrame.add(brassTrim);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(3.44, 1.1),
      this.mats.menuScreenGlow
    );
    screen.position.z = 0.05;
    menuFrame.add(screen);
    this.scene.add(menuFrame);

    // 1b. Warm Wainscot Trim & Oak Spice Shelf along Kitchen Back Wall (Segmented stainless backsplash panels are in industrial_kitchen.glb)
    const wainscot = new THREE.Mesh(
      new THREE.BoxGeometry(13.4, 0.08, 0.06),
      this.mats.woodDarkWalnut
    );
    wainscot.position.set(0, 2.08, -5.7);
    this.scene.add(wainscot);

    // Floating oak shelf with condiment bottles & stainless canisters above prep area
    const prepShelf = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.05, 0.28),
      this.mats.woodOak
    );
    prepShelf.position.set(-4.8, 1.75, -5.58);
    this.scene.add(prepShelf);

    const bottleColors = [0xd62828, 0xfbbf24, 0x4ade80, 0xe07a5f];
    for (let i = 0; i < 4; i++) {
      const bottle = this.assets.createSqueezeBottleMesh(bottleColors[i]);
      bottle.position.set(-5.4 + i * 0.38, 1.775, -5.58);
      this.scene.add(bottle);
    }

    // 2. Storefront Brand Sign ("BURGER DISTRICT") hung high at Y=3.38
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 96;
    const sctx = signCanvas.getContext('2d')!;
    sctx.fillStyle = '#181412';
    sctx.fillRect(0, 0, 512, 96);
    sctx.strokeStyle = '#f59e0b';
    sctx.lineWidth = 4;
    sctx.strokeRect(6, 6, 500, 84);
    sctx.fillStyle = '#fbbf24';
    sctx.font = 'bold 42px sans-serif';
    sctx.textAlign = 'center';
    sctx.fillText('BURGER DISTRICT', 256, 62);

    const signTex = new THREE.CanvasTexture(signCanvas);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissiveMap: signTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.72,
    });

    const interiorSignFrame = new THREE.Mesh(
      new THREE.BoxGeometry(3.28, 0.64, 0.08),
      this.mats.darkIron
    );
    interiorSignFrame.position.set(0.6, 3.38, -0.46);
    this.scene.add(interiorSignFrame);

    const interiorSign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.58), signMat);
    interiorSign.position.set(0.6, 3.38, -0.415);
    this.scene.add(interiorSign);

    // 3. Warm Industrial Pendant Lamps with Brass Collar over counter & dining booths
    const pendantCoords = [
      [-1.55, 2.95, -0.45],
      [1.55, 2.95, -0.45],
      [-4.9, 2.85, 2.9],
      [4.9, 2.85, 2.9],
    ];
    for (const [lx, ly, lz] of pendantCoords) {
      const lamp = new THREE.Group();
      lamp.position.set(lx, ly, lz);

      const cord = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.85, 8),
        this.mats.darkIron
      );
      cord.position.y = 0.42;
      lamp.add(cord);

      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.055, 0.08, 12),
        this.mats.brassAccent
      );
      collar.position.y = 0.13;
      lamp.add(collar);

      const shade = new THREE.Mesh(
        new THREE.ConeGeometry(0.26, 0.22, 20, 1, true),
        this.mats.darkIron
      );
      lamp.add(shade);

      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.068, 12, 12),
        this.mats.neonSignWarm
      );
      bulb.position.y = -0.05;
      lamp.add(bulb);

      this.scene.add(lamp);
    }
  }

  private buildUpgradeVisualGroups(): void {
    // 1. Premium Decor Upgrade Visuals: Warm Neon Wall Emblem, Brass Planters with Sculpted Monstera Plants
    const planterPositions: [number, number][] = [
      [-2.6, 5.1],
      [2.6, 5.1],
      [-5.9, 0.85],
      [5.9, 0.85],
    ];
    for (const [px, pz] of planterPositions) {
      const planter = this.createSculptedBotanicalPlanter(true);
      planter.position.set(px, 0, pz);
      this.decorUpgradeGroup.add(planter);
    }

    // Warm Neon Accent Strips on Dining Side Walls
    for (const side of [-1, 1]) {
      const neonTube = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.06, 2.8),
        this.mats.neonSignWarm
      );
      neonTube.position.set(side * 6.58, 2.85, 2.9);
      this.decorUpgradeGroup.add(neonTube);
    }

    // 2. Cold Storage Upgrade Visuals: Commercial Stainless Steel Chiller Expansion Tower in Kitchen
    const chillerGroup = new THREE.Group();
    chillerGroup.position.set(5.85, 0, -1.65);

    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 2.1, 0.92),
      this.mats.stainlessSteel
    );
    cabinet.position.y = 1.05;
    cabinet.castShadow = true;
    cabinet.receiveShadow = true;
    chillerGroup.add(cabinet);

    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 1.82, 0.82),
      this.mats.darkIron
    );
    doorFrame.position.set(-0.43, 1.08, 0);
    chillerGroup.add(doorFrame);

    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.48, 10),
      this.mats.brassAccent
    );
    handle.position.set(-0.47, 1.1, 0.28);
    chillerGroup.add(handle);

    const tempDisplay = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.1, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    tempDisplay.position.set(-0.44, 1.96, 0);
    chillerGroup.add(tempDisplay);

    this.coldStorageUpgradeGroup.add(chillerGroup);
  }

  /**
   * Builds invisible raycast hit planes over valid placement surfaces (counters & dining tables).
   */
  private buildPlacementSurfaces(): void {
    const surfaceHitMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });

    for (const surf of PLACEMENT_SURFACES) {
      const w = surf.maxX - surf.minX;
      const d = surf.maxZ - surf.minZ;
      const cx = (surf.minX + surf.maxX) * 0.5;
      const cz = (surf.minZ + surf.maxZ) * 0.5;

      const plane = new THREE.Mesh(new THREE.BoxGeometry(w, 0.016, d), surfaceHitMat);
      plane.position.set(cx, surf.y, cz);
      this.scene.add(plane);

      this.registerInteractable(plane, {
        id: `surface_${surf.id}`,
        type: 'placement_surface',
        surfaceId: surf.id,
        label: surf.label,
      });
    }
  }

  /**
   * Updates the 3D Smart Placement ghost silhouette at the raycasted surface point.
   */
  syncGhostPreview(
    evaluation: PlacementEvaluation | null,
    heldItem: HeldItem | null,
    elapsed = 0
  ): void {
    if (!evaluation || !heldItem) {
      this.ghostPreviewGroup.visible = false;
      return;
    }

    const cacheKey = `${heldItem.type}|${heldItem.burgerRecipe || ''}|${Boolean(
      heldItem.hasSoda
    )}|${evaluation.valid}`;

    if (this.ghostCacheKey !== cacheKey) {
      this.ghostCacheKey = cacheKey;
      while (this.ghostPreviewGroup.children.length > 0) {
        this.ghostPreviewGroup.remove(this.ghostPreviewGroup.children[0]);
      }
      const mesh = this.assets.createGhostPreviewMesh(heldItem, evaluation.valid);
      this.ghostPreviewGroup.add(mesh);
    }

    this.ghostPreviewGroup.visible = true;
    const pulseY = Math.sin(elapsed * 6.0) * 0.003;
    this.ghostPreviewGroup.position.set(
      evaluation.x,
      evaluation.y + pulseY,
      evaluation.z
    );
    this.ghostPreviewGroup.rotation.set(0, evaluation.rotationY, 0);
  }

  /**
   * Reconciles all items placed on counters/tables via Smart Placement and registers them for raycasting.
   */
  syncPlacedSurfaceItems(placedItems: readonly PlacedSurfaceItem[]): void {
    // Remove previous placed item meshes from interactableMeshes
    for (const child of this.placedSurfaceGroup.children) {
      const idx = this.interactableMeshes.indexOf(child);
      if (idx !== -1) {
        this.interactableMeshes.splice(idx, 1);
      }
    }
    while (this.placedSurfaceGroup.children.length > 0) {
      this.placedSurfaceGroup.remove(this.placedSurfaceGroup.children[0]);
    }

    for (const p of placedItems) {
      const visual = this.assets.createHeldItemVisual(p.item);
      visual.position.set(p.x, p.y, p.z);
      visual.rotation.set(0, p.rotationY, 0);

      // Add a generous invisible interaction hit box around the placed item so picking up or combining is effortless
      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(p.radius * 2.1, 0.24, p.radius * 2.1),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0.0,
          depthWrite: false,
        })
      );
      hitBox.position.y = 0.11;
      visual.add(hitBox);

      const target: InteractableTarget = {
        id: p.id,
        type: 'placed_item',
        placedItemId: p.id,
        surfaceId: p.surfaceId,
        label: p.item.label,
        mesh: visual,
      };
      visual.userData.interactable = target;
      visual.traverse((c) => {
        c.userData.interactable = target;
      });

      this.placedSurfaceGroup.add(visual);
      this.interactableMeshes.push(visual);
    }
  }

  /**
   * Reconciles all 2-stage table cleaning visuals (`dirty_tray` -> `needs_wipe`) left behind on dining tables:
   * - Stage 1 (`dirty_tray`): Used service tray + crumbs/napkins (`type: 'dirty_table_tray'`)
   * - Stage 2 (`needs_wipe`): Remaining crumbs, sauce smudges, and used napkins (`type: 'dirty_table_crumbs'`)
   */
  syncDirtyTableTrays(seats: readonly DiningSeatState[]): void {
    for (const child of this.dirtyTableTraysGroup.children) {
      const idx = this.interactableMeshes.indexOf(child);
      if (idx !== -1) {
        this.interactableMeshes.splice(idx, 1);
      }
    }
    while (this.dirtyTableTraysGroup.children.length > 0) {
      this.dirtyTableTraysGroup.remove(this.dirtyTableTraysGroup.children[0]);
    }

    for (const seat of seats) {
      if (seat.status === 'dirty_tray' && seat.dirtyTrayItem) {
        const visual = new THREE.Group();
        const trayMesh = this.assets.createDirtyTrayMesh(
          seat.dirtyTrayItem.hasSoda ?? true
        );
        const crumbsMesh = this.assets.createTableCrumbsMesh();
        visual.add(trayMesh, crumbsMesh);

        visual.position.set(
          seat.trayPosition.x,
          seat.trayPosition.y,
          seat.trayPosition.z
        );
        visual.rotation.set(0, seat.trayRotationY, 0);

        const hitBox = new THREE.Mesh(
          new THREE.BoxGeometry(0.58, 0.28, 0.46),
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
          })
        );
        hitBox.position.y = 0.12;
        visual.add(hitBox);

        const target: InteractableTarget = {
          id: `dirty_tray_${seat.id}`,
          type: 'dirty_table_tray',
          seatId: seat.id,
          label: `${seat.label} · Kullanılmış Servis Tepsisi`,
          mesh: visual,
        };
        visual.userData.interactable = target;
        visual.traverse((c) => {
          c.userData.interactable = target;
        });

        this.dirtyTableTraysGroup.add(visual);
        this.interactableMeshes.push(visual);
      } else if (seat.status === 'needs_wipe') {
        const visual = this.assets.createTableCrumbsMesh();
        visual.userData.seatId = seat.id;
        visual.position.set(
          seat.trayPosition.x,
          seat.trayPosition.y,
          seat.trayPosition.z
        );
        visual.rotation.set(0, seat.trayRotationY, 0);

        const hitBox = new THREE.Mesh(
          new THREE.BoxGeometry(0.62, 0.22, 0.48),
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
          })
        );
        hitBox.userData.isHitBox = true;
        hitBox.position.y = 0.08;
        visual.add(hitBox);

        const target: InteractableTarget = {
          id: `dirty_crumbs_${seat.id}`,
          type: 'dirty_table_crumbs',
          seatId: seat.id,
          label: `${seat.label} · Kırıntı ve Sos Lekeleri`,
          mesh: visual,
        };
        visual.userData.interactable = target;
        visual.traverse((c) => {
          c.userData.interactable = target;
        });

        this.applyCrumbsWipeProgress(visual, seat.wipeProgress ?? 0);
        this.dirtyTableTraysGroup.add(visual);
        this.interactableMeshes.push(visual);
      }
    }
  }

  /**
   * Progressively hides and shrinks crumbs, napkins, and sauce smudges on a `'needs_wipe'` seat
   * as the player wipes the table surface with the microfiber cloth (`0.0 -> 1.0`).
   */
  updateSeatWipeVisual(seatId: string, wipeProgress: number): void {
    for (const child of this.dirtyTableTraysGroup.children) {
      if (child.userData.seatId === seatId) {
        this.applyCrumbsWipeProgress(child, wipeProgress);
      }
    }
  }

  private applyCrumbsWipeProgress(crumbsGroup: THREE.Object3D, wipeProgress: number): void {
    const clamped = Math.max(0, Math.min(1, wipeProgress));
    crumbsGroup.children.forEach((child, idx) => {
      if (child.userData.isHitBox) return;
      const threshold: number =
        typeof child.userData.wipeThreshold === 'number'
          ? child.userData.wipeThreshold
          : ((idx % 4) + 1) * 0.22;
      if (clamped >= threshold) {
        child.visible = false;
      } else {
        child.visible = true;
        const fadeRatio = Math.max(
          0.25,
          Math.min(1, (threshold - clamped) / Math.max(0.15, threshold))
        );
        if (!child.userData.baseScale) {
          child.userData.baseScale = child.scale.clone();
        }
        const base: THREE.Vector3 = child.userData.baseScale;
        child.scale.set(
          base.x * fadeRatio,
          base.y * fadeRatio,
          base.z * fadeRatio
        );
      }
    });
  }

  syncUpgradesVisuals(decorUpgraded: boolean, coldStorageUpgraded: boolean): void {
    this.decorUpgradeGroup.visible = decorUpgraded;
    this.coldStorageUpgradeGroup.visible = coldStorageUpgraded;
  }

  updatePOSScreen(
    shopOpen: boolean,
    money: number,
    day: number,
    reputation = 50
  ): void {
    const ctx = this.posScreenCanvas.getContext('2d')!;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 160);

    ctx.fillStyle = shopOpen ? '#10b981' : '#f59e0b';
    ctx.fillRect(0, 0, 256, 36);

    ctx.fillStyle = '#090d16';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(shopOpen ? `GÜN ${day} — AÇIK` : `GÜN ${day} — HAZIRLIK`, 14, 24);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`KASA: ${money} $`, 14, 74);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`İTİBAR: ★ %${reputation}`, 14, 104);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText('[E] Kasa & Geliştirmeler', 14, 138);

    this.posScreenTexture.needsUpdate = true;
  }

  syncGrillVisuals(slots: GrillSlot[], isUpgraded: boolean): void {
    if (this.grillBodyMesh) {
      this.grillBodyMesh.material = isUpgraded ? this.mats.stainlessSteel : this.mats.grillGrate;
    }

    slots.forEach((slot, idx) => {
      const holder = this.grillSlotVisuals[idx];
      if (!holder) return;

      while (holder.children.length > 0) {
        holder.remove(holder.children[0]);
      }

      if (slot.state === 'empty') return;

      const pattyType: IngredientType =
        slot.state === 'cooking'
          ? 'patty_raw'
          : slot.state === 'cooked'
          ? 'patty_cooked'
          : 'patty_burnt';

      const mesh = this.assets.createIngredientMesh(pattyType);

      // Multi-stage progressive sear transition (raw red -> searing pink-amber -> caramelized crust brown)
      if (slot.state === 'cooking') {
        const p = Math.max(0, Math.min(1, slot.progress));
        const rawTint = new THREE.Color(0xffffff);
        const midSearTint = new THREE.Color(0xc07a5a);
        const cookedCrustTint = new THREE.Color(0x5c3422);
        const targetColor = new THREE.Color();
        if (p < 0.5) {
          targetColor.lerpColors(rawTint, midSearTint, p * 2.0);
        } else {
          targetColor.lerpColors(midSearTint, cookedCrustTint, (p - 0.5) * 2.0);
        }

        mesh.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            const cloned = m.clone();
            cloned.color.copy(targetColor);
            cloned.roughness = THREE.MathUtils.lerp(0.62, 0.78, p);
            (child as THREE.Mesh).material = cloned;
          }
        });
      }

      holder.add(mesh);
    });
  }

  syncAssemblyVisuals(layers: IngredientType[], hasSoda: boolean): void {
    const prevCount = this.assemblyVisualGroup.userData.layerCount ?? 0;
    this.assemblyVisualGroup.userData.layerCount = layers.length;

    while (this.assemblyVisualGroup.children.length > 0) {
      this.assemblyVisualGroup.remove(this.assemblyVisualGroup.children[0]);
    }

    let y = STATIONS.assemblyBoard.stackOrigin.y;
    layers.forEach((layer, idx) => {
      const m = this.assets.createIngredientMesh(layer);
      const targetY = y;
      m.position.set(
        STATIONS.assemblyBoard.stackOrigin.x,
        targetY,
        STATIONS.assemblyBoard.stackOrigin.z
      );

      // Subtle tactile settle bounce on the newly added top layer
      if (idx === layers.length - 1 && layers.length > prevCount) {
        m.scale.set(1.12, 0.86, 1.12);
        setTimeout(() => {
          m.scale.set(1.0, 1.0, 1.0);
        }, 95);
      }

      this.assemblyVisualGroup.add(m);
      y += this.assets.getLayerHeight(layer);
    });

    if (hasSoda) {
      const soda = this.assets.createSodaCupMesh();
      soda.position.copy(STATIONS.assemblyBoard.sodaSpot);
      this.assemblyVisualGroup.add(soda);
    }
  }

  flashDeliveryTray(layers?: IngredientType[], hasSoda?: boolean): void {
    while (this.pickupVisualGroup.children.length > 0) {
      this.pickupVisualGroup.remove(this.pickupVisualGroup.children[0]);
    }

    const item = this.assets.createHeldItemVisual({
      type: 'order_tray',
      label: 'Teslim Edilen Sipariş',
      layers: layers || ['bun_bottom', 'patty_cooked', 'lettuce', 'bun_top'],
      hasSoda,
    });
    item.position.copy(STATIONS.pickupTray.position);
    item.position.y += 0.02;
    this.pickupVisualGroup.add(item);

    setTimeout(() => {
      while (this.pickupVisualGroup.children.length > 0) {
        this.pickupVisualGroup.remove(this.pickupVisualGroup.children[0]);
      }
    }, 1200);
  }
}
