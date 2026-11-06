import * as THREE from 'three';
import { HeldItem, IngredientType } from '../core/GameConfig';
import { MaterialLibrary } from './MaterialLibrary';

export class AssetFactory {
  private mats: MaterialLibrary;

  // High-detail sculpted geometries reused across instances
  private bunBottomCrustGeo: THREE.LatheGeometry;
  private bunBottomCrumbGeo: THREE.CylinderGeometry;
  private bunTopDomeGeo: THREE.LatheGeometry;
  private bunTopUnderCrumbGeo: THREE.CylinderGeometry;
  private sesameGeo: THREE.SphereGeometry;
  private sesameMatrices: THREE.Matrix4[] = [];
  private pattySculptedGeo: THREE.BufferGeometry;
  private searBarGeo: THREE.BoxGeometry;
  private searBarMatrices: THREE.Matrix4[] = [];
  private cheeseSliceGeo: THREE.ExtrudeGeometry;
  private cheeseCornerDropGeo: THREE.ConeGeometry;
  private lettuceWaveGeo: THREE.BufferGeometry;
  private cupBodyGeo: THREE.CylinderGeometry;
  private cupRimGeo: THREE.TorusGeometry;
  private cupDomeLidGeo: THREE.SphereGeometry;
  private strawBottomGeo: THREE.CylinderGeometry;
  private strawTipGeo: THREE.CylinderGeometry;
  private trayBaseGeo: THREE.BoxGeometry;
  private trayRimLongGeo: THREE.BoxGeometry;
  private trayRimShortGeo: THREE.BoxGeometry;
  private trayPaperGeo: THREE.PlaneGeometry;
  private squeezeBottleGeo: THREE.LatheGeometry;
  private bottleLabelGeo: THREE.CylinderGeometry;

  private searBarMat = new THREE.MeshStandardMaterial({
    color: 0x160a05,
    roughness: 0.85,
  });

  constructor(mats: MaterialLibrary) {
    this.mats = mats;

    // 1. Sculpted Bottom Brioche Bun (LatheGeometry with rounded heel & slight waist)
    const bottomPoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.118, 0.0),
      new THREE.Vector2(0.136, 0.008),
      new THREE.Vector2(0.146, 0.024),
      new THREE.Vector2(0.144, 0.041),
      new THREE.Vector2(0.138, 0.045),
    ];
    this.bunBottomCrustGeo = new THREE.LatheGeometry(bottomPoints, 28);
    this.bunBottomCrumbGeo = new THREE.CylinderGeometry(0.138, 0.138, 0.004, 28);

    // 2. Sculpted Top Brioche Crown (Plump bakery dome profile)
    const topPoints = [
      new THREE.Vector2(0.138, 0.0),
      new THREE.Vector2(0.15, 0.015),
      new THREE.Vector2(0.146, 0.038),
      new THREE.Vector2(0.126, 0.062),
      new THREE.Vector2(0.088, 0.08),
      new THREE.Vector2(0.042, 0.09),
      new THREE.Vector2(0.0, 0.093),
    ];
    this.bunTopDomeGeo = new THREE.LatheGeometry(topPoints, 28);
    this.bunTopUnderCrumbGeo = new THREE.CylinderGeometry(0.137, 0.137, 0.004, 28);
    this.sesameGeo = new THREE.SphereGeometry(0.0065, 8, 8);

    // Precompute 24 sesame seed transform matrices sitting on the outer surface of the brioche dome
    const dummy = new THREE.Object3D();
    const rings = [
      { count: 6, radius: 0.042, y: 0.091, tilt: 0.25 },
      { count: 10, radius: 0.085, y: 0.082, tilt: 0.48 },
      { count: 8, radius: 0.122, y: 0.065, tilt: 0.72 },
    ];
    let seedIdx = 0;
    for (const ring of rings) {
      for (let i = 0; i < ring.count; i++) {
        const angle = (i / ring.count) * Math.PI * 2 + seedIdx * 0.4;
        dummy.position.set(
          Math.cos(angle) * ring.radius,
          ring.y,
          Math.sin(angle) * ring.radius
        );
        dummy.rotation.set(0, -angle, ring.tilt);
        dummy.scale.set(1.65, 0.6, 1.0);
        dummy.updateMatrix();
        this.sesameMatrices.push(dummy.matrix.clone());
        seedIdx++;
      }
    }

    // 3. Hand-Formed Burger Patty with irregular organic edges and center dimple
    this.pattySculptedGeo = this.buildOrganicPattyGeometry();
    this.searBarGeo = new THREE.BoxGeometry(0.21, 0.004, 0.013);
    for (const zOff of [-0.055, -0.018, 0.018, 0.055]) {
      dummy.position.set(0, 0.0385, zOff);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1 - Math.abs(zOff) * 3.2, 1, 1);
      dummy.updateMatrix();
      this.searBarMatrices.push(dummy.matrix.clone());
    }

    // 4. Beveled Melted Cheddar Slice + drooping corner folds
    const sq = 0.115;
    const cheeseShape = new THREE.Shape();
    cheeseShape.moveTo(-sq, -sq);
    cheeseShape.lineTo(sq, -sq);
    cheeseShape.lineTo(sq, sq);
    cheeseShape.lineTo(-sq, sq);
    cheeseShape.closePath();
    this.cheeseSliceGeo = new THREE.ExtrudeGeometry(cheeseShape, {
      depth: 0.008,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.008,
      bevelThickness: 0.004,
    });
    this.cheeseSliceGeo.rotateX(Math.PI / 2);
    this.cheeseCornerDropGeo = new THREE.ConeGeometry(0.028, 0.032, 8);

    // 5. Ruffled Crisp Lettuce Leaf Geometry (perturbed radial waves)
    this.lettuceWaveGeo = this.buildRuffledLettuceGeometry();

    // 6. Soda Cup with Rolled Rim, Clear Dome Lid, and Bent Straw
    this.cupBodyGeo = new THREE.CylinderGeometry(0.068, 0.05, 0.175, 24);
    this.cupRimGeo = new THREE.TorusGeometry(0.069, 0.005, 10, 24);
    this.cupDomeLidGeo = new THREE.SphereGeometry(
      0.068,
      20,
      12,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.42
    );
    this.strawBottomGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.09, 10);
    this.strawTipGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.045, 10);

    // 7. Serving Tray with Raised Lip & Checkerboard Paper Liner
    this.trayBaseGeo = new THREE.BoxGeometry(0.46, 0.016, 0.34);
    this.trayRimLongGeo = new THREE.BoxGeometry(0.47, 0.028, 0.016);
    this.trayRimShortGeo = new THREE.BoxGeometry(0.016, 0.028, 0.35);
    this.trayPaperGeo = new THREE.PlaneGeometry(0.41, 0.29);

    // 8. Sculpted Condiment Squeeze Bottle Profile (Base -> Waist -> Cap -> Pointed Nozzle)
    const bottlePts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.038, 0.0),
      new THREE.Vector2(0.041, 0.04),
      new THREE.Vector2(0.037, 0.09),
      new THREE.Vector2(0.04, 0.145),
      new THREE.Vector2(0.024, 0.165),
      new THREE.Vector2(0.024, 0.182),
      new THREE.Vector2(0.005, 0.225),
      new THREE.Vector2(0.0, 0.225),
    ];
    this.squeezeBottleGeo = new THREE.LatheGeometry(bottlePts, 16);
    this.bottleLabelGeo = new THREE.CylinderGeometry(0.041, 0.041, 0.055, 16, 1, true);
  }

  createSqueezeBottleMesh(colorHex: number): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      this.squeezeBottleGeo,
      new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.32 })
    );
    body.castShadow = true;
    group.add(body);

    const label = new THREE.Mesh(
      this.bottleLabelGeo,
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 })
    );
    label.position.y = 0.088;
    group.add(label);
    return group;
  }

  private buildOrganicPattyGeometry(): THREE.BufferGeometry {
    const geo = new THREE.CylinderGeometry(0.136, 0.138, 0.036, 32, 3);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const r = Math.hypot(v.x, v.z);
      const angle = Math.atan2(v.z, v.x);

      if (r > 0.05) {
        // Bulge mid-height into a plump pillow edge & add hand-pressed edge dimples
        const midFactor = 1 - Math.abs(v.y / 0.018);
        const ripple =
          1 +
          midFactor * 0.07 +
          Math.sin(angle * 7) * 0.025 +
          Math.cos(angle * 11) * 0.018;
        v.x *= ripple;
        v.z *= ripple;
      } else {
        // Subtle chef thumb-press dimple in the center of the patty
        v.y *= 0.88;
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }

    geo.computeVertexNormals();
    return geo;
  }

  private buildRuffledLettuceGeometry(): THREE.BufferGeometry {
    const geo = new THREE.CylinderGeometry(0.156, 0.135, 0.012, 36, 2);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const r = Math.hypot(v.x, v.z);
      const angle = Math.atan2(v.z, v.x);
      const edgeFactor = Math.min(1, r / 0.14);

      // Ruffled curly leaf wave along the perimeter
      const waveY =
        Math.sin(angle * 8) * 0.012 * edgeFactor +
        Math.cos(angle * 13) * 0.006 * edgeFactor;
      const waveR = 1 + Math.sin(angle * 6) * 0.08 * edgeFactor;

      v.x *= waveR;
      v.z *= waveR;
      v.y += waveY;
      pos.setXYZ(i, v.x, v.y, v.z);
    }

    geo.computeVertexNormals();
    return geo;
  }

  createIngredientMesh(type: IngredientType): THREE.Group {
    const group = new THREE.Group();

    switch (type) {
      case 'bun_bottom': {
        const crust = new THREE.Mesh(this.bunBottomCrustGeo, this.mats.bunMaterial);
        crust.castShadow = true;
        crust.receiveShadow = true;
        group.add(crust);

        // Toasted inner crumb face on top of bottom bun
        const crumbTop = new THREE.Mesh(
          this.bunBottomCrumbGeo,
          this.mats.bunCrumbMaterial
        );
        crumbTop.position.y = 0.044;
        crumbTop.receiveShadow = true;
        group.add(crumbTop);
        break;
      }

      case 'bun_top': {
        const dome = new THREE.Mesh(this.bunTopDomeGeo, this.mats.bunMaterial);
        dome.castShadow = true;
        dome.receiveShadow = true;
        group.add(dome);

        const underCrumb = new THREE.Mesh(
          this.bunTopUnderCrumbGeo,
          this.mats.bunCrumbMaterial
        );
        underCrumb.position.y = 0.002;
        group.add(underCrumb);

        // Single InstancedMesh for all 24 sesame seeds (1 draw call instead of 24)
        const seedsInstanced = new THREE.InstancedMesh(
          this.sesameGeo,
          this.mats.sesameMaterial,
          this.sesameMatrices.length
        );
        for (let i = 0; i < this.sesameMatrices.length; i++) {
          seedsInstanced.setMatrixAt(i, this.sesameMatrices[i]);
        }
        seedsInstanced.instanceMatrix.needsUpdate = true;
        group.add(seedsInstanced);
        break;
      }

      case 'patty_raw':
      case 'patty_cooked':
      case 'patty_burnt': {
        const mat =
          type === 'patty_raw'
            ? this.mats.pattyRawMaterial
            : type === 'patty_cooked'
            ? this.mats.pattyCookedMaterial
            : this.mats.pattyBurntMaterial;
        const patty = new THREE.Mesh(this.pattySculptedGeo, mat);
        patty.position.y = 0.019;
        patty.castShadow = true;
        patty.receiveShadow = true;
        group.add(patty);

        // Single InstancedMesh for 3D Raised Charred Grill Marks on cooked & burnt patties
        if (type !== 'patty_raw') {
          const searInstanced = new THREE.InstancedMesh(
            this.searBarGeo,
            this.searBarMat,
            this.searBarMatrices.length
          );
          for (let i = 0; i < this.searBarMatrices.length; i++) {
            searInstanced.setMatrixAt(i, this.searBarMatrices[i]);
          }
          searInstanced.instanceMatrix.needsUpdate = true;
          group.add(searInstanced);
        }
        break;
      }

      case 'cheese': {
        // Two overlapping melted cheddar slices rotated slightly with drooping corners
        const slice1 = new THREE.Mesh(this.cheeseSliceGeo, this.mats.cheeseMaterial);
        slice1.position.y = 0.01;
        slice1.rotation.y = Math.PI * 0.25;
        slice1.castShadow = true;
        group.add(slice1);

        // Melted corner droplets hanging down over the hot patty edge
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
          const drop = new THREE.Mesh(
            this.cheeseCornerDropGeo,
            this.mats.cheeseMaterial
          );
          drop.position.set(Math.cos(angle) * 0.145, -0.004, Math.sin(angle) * 0.145);
          drop.rotation.x = Math.PI;
          drop.scale.set(1.1, 1.0, 0.6);
          group.add(drop);
        }
        break;
      }

      case 'lettuce': {
        // Two layered ruffled lettuce leaves rotated for lush organic volume
        const leaf1 = new THREE.Mesh(this.lettuceWaveGeo, this.mats.lettuceMaterial);
        leaf1.position.y = 0.01;
        leaf1.castShadow = true;
        group.add(leaf1);

        const leaf2 = new THREE.Mesh(this.lettuceWaveGeo, this.mats.lettuceMaterial);
        leaf2.position.y = 0.017;
        leaf2.rotation.y = 1.1;
        leaf2.scale.set(0.94, 1.1, 0.94);
        leaf2.castShadow = true;
        group.add(leaf2);
        break;
      }
    }

    return group;
  }

  createSodaCupMesh(): THREE.Group {
    const group = new THREE.Group();

    const cup = new THREE.Mesh(this.cupBodyGeo, this.mats.sodaCupMaterial);
    cup.position.y = 0.088;
    cup.castShadow = true;
    group.add(cup);

    const rim = new THREE.Mesh(this.cupRimGeo, this.mats.sodaLidMaterial);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.176;
    group.add(rim);

    const domeLid = new THREE.Mesh(this.cupDomeLidGeo, this.mats.sodaLidMaterial);
    domeLid.position.y = 0.174;
    group.add(domeLid);

    // Bent two-piece striped straw
    const strawMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.3,
    });
    const strawStem = new THREE.Mesh(this.strawBottomGeo, strawMat);
    strawStem.position.set(0.0, 0.215, 0);
    group.add(strawStem);

    const strawTip = new THREE.Mesh(this.strawTipGeo, strawMat);
    strawTip.position.set(0.016, 0.265, 0);
    strawTip.rotation.z = -0.65;
    group.add(strawTip);

    return group;
  }

  getLayerHeight(type: IngredientType): number {
    switch (type) {
      case 'bun_bottom':
        return 0.044;
      case 'patty_raw':
      case 'patty_cooked':
      case 'patty_burnt':
        return 0.035;
      case 'cheese':
        return 0.012;
      case 'lettuce':
        return 0.022;
      case 'bun_top':
        return 0.09;
    }
  }

  createTrayMesh(): THREE.Group {
    const trayGroup = new THREE.Group();

    const base = new THREE.Mesh(this.trayBaseGeo, this.mats.trayMaterial);
    base.position.y = 0.008;
    base.receiveShadow = true;
    trayGroup.add(base);

    // Raised tray borders
    const frontRim = new THREE.Mesh(this.trayRimLongGeo, this.mats.trayMaterial);
    frontRim.position.set(0, 0.016, 0.165);
    const backRim = new THREE.Mesh(this.trayRimLongGeo, this.mats.trayMaterial);
    backRim.position.set(0, 0.016, -0.165);
    const leftRim = new THREE.Mesh(this.trayRimShortGeo, this.mats.trayMaterial);
    leftRim.position.set(-0.228, 0.016, 0);
    const rightRim = new THREE.Mesh(this.trayRimShortGeo, this.mats.trayMaterial);
    rightRim.position.set(0.228, 0.016, 0);
    trayGroup.add(frontRim, backRim, leftRim, rightRim);

    // Brass grip accents on left & right tray rims
    const handleGeo = new THREE.BoxGeometry(0.012, 0.01, 0.14);
    const leftGrip = new THREE.Mesh(handleGeo, this.mats.brassAccent);
    leftGrip.position.set(-0.232, 0.029, 0);
    const rightGrip = new THREE.Mesh(handleGeo, this.mats.brassAccent);
    rightGrip.position.set(0.232, 0.029, 0);
    trayGroup.add(leftGrip, rightGrip);

    // Branded wax paper liner with burger & drink slot guides
    const paper = new THREE.Mesh(this.trayPaperGeo, this.mats.trayPaperMaterial);
    paper.rotation.x = -Math.PI / 2;
    paper.position.y = 0.0175;
    trayGroup.add(paper);

    return trayGroup;
  }

  private ghostValidMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.48,
    roughness: 0.25,
    depthWrite: false,
  });

  private ghostInvalidMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0x991b1b,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.48,
    roughness: 0.25,
    depthWrite: false,
  });

  createHeldItemVisual(item: HeldItem): THREE.Group {
    const root = new THREE.Group();

    if (
      item.type === 'bun_bottom' ||
      item.type === 'patty_raw' ||
      item.type === 'patty_cooked' ||
      item.type === 'patty_burnt' ||
      item.type === 'cheese' ||
      item.type === 'lettuce' ||
      item.type === 'bun_top'
    ) {
      root.add(this.createIngredientMesh(item.type));
      return root;
    }

    if (item.type === 'soda_cup') {
      root.add(this.createSodaCupMesh());
      return root;
    }

    if (item.type === 'dirty_tray') {
      root.add(this.createDirtyTrayMesh(item.hasSoda ?? true));
      return root;
    }

    const isServiceTray = item.type === 'service_tray' || item.type === 'order_tray';
    const hasBurgerOnTray =
      Boolean(item.burgerRecipe) ||
      (Array.isArray(item.layers) && item.layers.length > 0) ||
      item.type === 'burger_classic' ||
      item.type === 'burger_cheese' ||
      item.type === 'burger_double_smash';

    if (isServiceTray || item.hasSoda) {
      root.add(this.createTrayMesh());
    } else {
      // Standalone completed burger sits on a crisp butcher parchment wrapper sheet
      const wrapper = new THREE.Mesh(
        new THREE.PlaneGeometry(0.28, 0.28),
        this.mats.trayPaperMaterial
      );
      wrapper.rotation.x = -Math.PI / 2;
      wrapper.position.y = 0.004;
      root.add(wrapper);
    }

    if (hasBurgerOnTray) {
      const recipe =
        item.burgerRecipe ||
        (item.type === 'burger_double_smash'
          ? 'double_smash'
          : item.type === 'burger_cheese'
          ? 'cheeseburger'
          : 'classic_burger');

      const layers: IngredientType[] =
        item.layers && item.layers.length > 0
          ? item.layers
          : recipe === 'double_smash'
          ? [
              'bun_bottom',
              'patty_cooked',
              'cheese',
              'patty_cooked',
              'cheese',
              'lettuce',
              'bun_top',
            ]
          : recipe === 'cheeseburger'
          ? ['bun_bottom', 'patty_cooked', 'cheese', 'lettuce', 'bun_top']
          : ['bun_bottom', 'patty_cooked', 'lettuce', 'bun_top'];

      let currentY = isServiceTray || item.hasSoda ? 0.018 : 0.006;
      const burgerOffsetX = isServiceTray || item.hasSoda ? -0.095 : 0;
      for (const layer of layers) {
        const layerMesh = this.createIngredientMesh(layer);
        layerMesh.position.set(burgerOffsetX, currentY, 0);
        root.add(layerMesh);
        currentY += this.getLayerHeight(layer);
      }
    }

    if (item.hasSoda) {
      const soda = this.createSodaCupMesh();
      soda.position.set(0.125, 0.018, 0);
      root.add(soda);
    }

    return root;
  }

  /**
   * Builds a Used Service Tray (`dirty_tray`) left on a dining table after a customer finishes eating:
   * - Molded Service Tray with liner
   * - Crumpled kraft burger wrapper paper ball
   * - Crumpled paper napkins
   * - Empty / used District Cola cup with tilted straw
   * - Leftover sesame crumbs
   */
  createDirtyTrayMesh(hadSoda = true): THREE.Group {
    const group = this.createTrayMesh();

    // 1. Crumpled kraft burger wrapper paper ball on left side of tray
    const wrapperGeo = new THREE.IcosahedronGeometry(0.068, 1);
    wrapperGeo.scale(1.22, 0.72, 1.08);
    const wrapperMat = new THREE.MeshStandardMaterial({
      color: 0xd9b98b,
      roughness: 0.88,
      metalness: 0.02,
      flatShading: true,
    });
    const crumpledWrapper = new THREE.Mesh(wrapperGeo, wrapperMat);
    crumpledWrapper.position.set(-0.085, 0.056, 0.015);
    crumpledWrapper.rotation.set(0.3, 0.7, -0.2);
    crumpledWrapper.castShadow = true;
    group.add(crumpledWrapper);

    // 2. Two crumpled white paper napkins
    const napkinMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.92,
      flatShading: true,
    });
    const napkin1 = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.038, 1),
      napkinMat
    );
    napkin1.scale.set(1.15, 0.65, 1.0);
    napkin1.position.set(-0.01, 0.038, -0.055);
    napkin1.rotation.set(0.5, 1.1, 0.2);
    group.add(napkin1);

    const napkin2 = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.032, 1),
      napkinMat
    );
    napkin2.scale.set(1.1, 0.6, 0.95);
    napkin2.position.set(-0.135, 0.034, -0.048);
    napkin2.rotation.set(-0.4, 0.4, 0.6);
    group.add(napkin2);

    // 3. Sesame & crust crumbs scattered on liner
    const crumbMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.8,
    });
    for (const [cx, cz] of [
      [-0.04, 0.05],
      [-0.11, 0.07],
      [0.02, 0.02],
      [-0.06, -0.02],
    ]) {
      const crumb = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.008, 0),
        crumbMat
      );
      crumb.position.set(cx, 0.022, cz);
      group.add(crumb);
    }

    // 4. Empty / used soda cup on right side of tray
    if (hadSoda) {
      const emptyCup = this.createSodaCupMesh();
      emptyCup.scale.set(0.95, 0.9, 0.95);
      emptyCup.position.set(0.118, 0.018, 0.01);
      emptyCup.rotation.set(0.06, 0.4, -0.08);
      group.add(emptyCup);
    }

    return group;
  }

  /**
   * Builds the 3D Tabletop Crumbs, Used Napkins & Sauce Smudges group (`needs_wipe`)
   * that remains on the dining table after the player picks up the dirty tray,
   * requiring a cloth wipe (`E / Sol Tık`) before the seat opens for new customers.
   */
  createTableCrumbsMesh(): THREE.Group {
    const group = new THREE.Group();

    // 1. Subtle sauce & grease smudge decals on the oak tabletop
    const smudgeMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.35,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const ketchupSmudgeMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.28,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });

    const ringSmudge = new THREE.Mesh(
      new THREE.RingGeometry(0.032, 0.048, 18),
      smudgeMat
    );
    ringSmudge.rotation.x = -Math.PI / 2;
    ringSmudge.position.set(0.11, 0.002, 0.02);
    ringSmudge.userData.wipeThreshold = 0.85;
    group.add(ringSmudge);

    const sauceSpot = new THREE.Mesh(
      new THREE.CircleGeometry(0.036, 14),
      ketchupSmudgeMat
    );
    sauceSpot.rotation.x = -Math.PI / 2;
    sauceSpot.scale.set(1.3, 0.85, 1);
    sauceSpot.position.set(-0.07, 0.002, -0.02);
    sauceSpot.userData.wipeThreshold = 0.62;
    group.add(sauceSpot);

    // 2. Two crumpled used paper napkins left on the table surface
    const napkinMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.92,
      flatShading: true,
    });
    const stainedNapkinMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      roughness: 0.9,
      flatShading: true,
    });

    const napkin1 = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.038, 1),
      napkinMat
    );
    napkin1.scale.set(1.25, 0.52, 1.05);
    napkin1.position.set(-0.11, 0.018, 0.045);
    napkin1.rotation.set(0.3, 0.8, 0.15);
    napkin1.castShadow = true;
    napkin1.userData.wipeThreshold = 0.34;
    group.add(napkin1);

    const napkin2 = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.032, 1),
      stainedNapkinMat
    );
    napkin2.scale.set(1.15, 0.48, 0.95);
    napkin2.position.set(0.05, 0.015, -0.055);
    napkin2.rotation.set(-0.2, 1.4, 0.4);
    napkin2.castShadow = true;
    napkin2.userData.wipeThreshold = 0.68;
    group.add(napkin2);

    // 3. Scattered toasted brioche crumbs, sesame seeds & lettuce shreds
    const crumbMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.82,
    });
    const sesameMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.65,
    });
    const lettuceBitMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.75,
    });

    const crumbOffsets: [number, number, number][] = [
      [-0.04, 0.01, 0.03],
      [-0.09, 0.009, -0.04],
      [0.01, 0.011, 0.05],
      [0.08, 0.008, 0.04],
      [-0.02, 0.009, -0.06],
      [-0.14, 0.008, 0.01],
      [0.04, 0.009, -0.01],
      [-0.06, 0.01, 0.07],
    ];

    crumbOffsets.forEach(([cx, rs, cz], idx) => {
      const mat =
        idx % 4 === 0
          ? lettuceBitMat
          : idx % 3 === 0
          ? sesameMat
          : crumbMat;
      const crumb = new THREE.Mesh(
        new THREE.DodecahedronGeometry(rs, 0),
        mat
      );
      crumb.scale.set(1.2, 0.65, 1.0);
      crumb.position.set(cx, 0.006, cz);
      crumb.rotation.y = idx * 0.9;
      crumb.userData.wipeThreshold = 0.18 + ((idx % 4) * 0.24);
      group.add(crumb);
    });

    return group;
  }

  /**
   * Builds a dedicated Bussing & Tray Return Station (Tepsi Dönüş & Atık İstasyonu)
   * positioned next to the right end of the main service counter for fast dining room cleanup.
   */
  createBussingStationMesh(): THREE.Group {
    const group = new THREE.Group();

    // 1. Stainless-steel countertop tray-return cradle sitting on top of the main counter (y = 0.96)
    const basePlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.032, 0.56),
      this.mats.stainlessSteel
    );
    basePlate.position.y = 0.974;
    basePlate.castShadow = true;
    basePlate.receiveShadow = true;
    group.add(basePlate);

    // Dark recessed waste-chute drop well in the center of the stainless cradle
    const chuteWell = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.036, 0.34),
      this.mats.darkIron
    );
    chuteWell.position.y = 0.976;
    group.add(chuteWell);

    // Left & right brushed steel tray-return side walls (y = 0.98..1.12)
    for (const sx of [-0.255, 0.255]) {
      const sideWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.14, 0.54),
        this.mats.stainlessSteel
      );
      sideWall.position.set(sx, 1.05, 0);
      sideWall.castShadow = true;
      group.add(sideWall);
    }

    // Back splash guard with brass accent bar
    const backGuard = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.18, 0.035),
      this.mats.darkIron
    );
    backGuard.position.set(0, 1.07, -0.255);
    backGuard.castShadow = true;
    group.add(backGuard);

    const brassHeader = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.045, 0.042),
      this.mats.brassAccent
    );
    brassHeader.position.set(0, 1.13, -0.255);
    group.add(brassHeader);

    // Brass tray-slide rails across the cradle
    const railGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.5, 12);
    railGeo.rotateZ(Math.PI / 2);
    for (const rz of [-0.18, 0.18]) {
      const rail = new THREE.Mesh(railGeo, this.mats.brassAccent);
      rail.position.set(0, 1.005, rz);
      group.add(rail);
    }

    // One neatly stacked clean tray resting inside the return rack
    const sampleTray = this.createTrayMesh();
    sampleTray.scale.setScalar(0.88);
    sampleTray.position.set(0, 1.01, -0.02);
    group.add(sampleTray);

    // 2. Under-counter swinging brass trash chute flap on the dining-side face (z = +0.44)
    const chuteFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.24, 0.025),
      this.mats.darkIron
    );
    chuteFrame.position.set(0, 0.66, 0.435);
    group.add(chuteFrame);

    const chuteFlap = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.18, 0.028),
      this.mats.brassAccent
    );
    chuteFlap.position.set(0, 0.66, 0.442);
    group.add(chuteFlap);

    return group;
  }

  /**
   * Builds a translucent 3D Smart Placement ghost silhouette matching the held item's real geometry.
   */
  createGhostPreviewMesh(item: HeldItem, isValid: boolean): THREE.Group {
    const ghostGroup = this.createHeldItemVisual(item);
    const overrideMat = isValid ? this.ghostValidMat : this.ghostInvalidMat;

    ghostGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = overrideMat;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });

    // Subtle surface placement footprint ring beneath the ghost preview
    const ringRadius =
      item.type === 'service_tray' ||
      item.type === 'order_tray' ||
      item.type === 'dirty_tray'
        ? 0.22
        : 0.14;
    const footprintRing = new THREE.Mesh(
      new THREE.RingGeometry(ringRadius * 0.86, ringRadius, 28),
      overrideMat
    );
    footprintRing.rotation.x = -Math.PI / 2;
    footprintRing.position.y = 0.003;
    ghostGroup.add(footprintRing);

    return ghostGroup;
  }

  /**
   * Builds the 3D Service Tray Dispenser Stack for the main service counter.
   */
  createTrayStackStationMesh(): THREE.Group {
    const group = new THREE.Group();

    // Brushed stainless base pad & 4 vertical corner guide rods
    const basePad = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.016, 0.4),
      this.mats.darkIron
    );
    basePad.position.y = 0.008;
    group.add(basePad);

    const rodGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.16, 10);
    for (const [rx, rz] of [
      [-0.245, -0.18],
      [0.245, -0.18],
      [-0.245, 0.18],
      [0.245, 0.18],
    ]) {
      const rod = new THREE.Mesh(rodGeo, this.mats.brassAccent);
      rod.position.set(rx, 0.088, rz);
      group.add(rod);
    }

    // 4 stacked Service Trays ready to grab
    for (let i = 0; i < 4; i++) {
      const tray = this.createTrayMesh();
      tray.position.set(0, 0.016 + i * 0.026, 0);
      tray.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.015;
      group.add(tray);
    }

    return group;
  }

  /**
   * Builds the 3D Burger District Handbook resting on a sculpted Walnut & Brass Lectern Stand.
   */
  createHandbookStandMesh(): THREE.Group {
    const group = new THREE.Group();

    // Sculpted walnut base & angled reading lectern
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.022, 0.3),
      this.mats.woodDarkWalnut
    );
    base.position.y = 0.011;
    group.add(base);

    const riser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.036, 0.09, 12),
      this.mats.brassAccent
    );
    riser.position.set(0, 0.055, -0.04);
    group.add(riser);

    const cradle = new THREE.Group();
    cradle.position.set(0, 0.095, 0);
    cradle.rotation.x = 0.38; // Slanted toward the chef for comfortable reading
    group.add(cradle);

    const lecternBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.014, 0.32),
      this.mats.woodDarkWalnut
    );
    cradle.add(lecternBoard);

    const lipStop = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.026, 0.016),
      this.mats.brassAccent
    );
    lipStop.position.set(0, 0.014, 0.155);
    cradle.add(lipStop);

    // 3D Hardcover Book ("BURGER DISTRICT — EL KİTABI")
    const bookGroup = new THREE.Group();
    bookGroup.position.set(0, 0.022, 0.0);
    cradle.add(bookGroup);

    // Back & Front Hardcovers + Rounded Spine + Cream Page Block
    const coverMat = new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.42,
      metalness: 0.08,
    });
    const pageBlockMat = new THREE.MeshStandardMaterial({
      color: 0xf7f1e1,
      roughness: 0.75,
    });

    const backCover = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.008, 0.25),
      coverMat
    );
    backCover.position.y = -0.012;
    bookGroup.add(backCover);

    const pageBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.305, 0.024, 0.238),
      pageBlockMat
    );
    bookGroup.add(pageBlock);

    const spine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.252, 12),
      this.mats.brassAccent
    );
    spine.rotation.x = Math.PI / 2;
    spine.position.set(-0.158, 0, 0);
    bookGroup.add(spine);

    // Embossed Front Cover Canvas Texture
    const coverCanvas = document.createElement('canvas');
    coverCanvas.width = 256;
    coverCanvas.height = 192;
    const ctx = coverCanvas.getContext('2d')!;
    ctx.fillStyle = '#3b1704';
    ctx.fillRect(0, 0, 256, 192);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 5;
    ctx.strokeRect(12, 12, 232, 168);
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 216, 152);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BURGER DISTRICT', 128, 64);
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('İŞLETME & MUTFAK', 128, 96);
    ctx.fillText('EL KİTABI', 128, 118);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('[E] VEYA [F1] İLE AÇ', 128, 152);

    const coverTex = new THREE.CanvasTexture(coverCanvas);
    coverTex.colorSpace = THREE.SRGBColorSpace;
    const frontCover = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.008, 0.25),
      new THREE.MeshStandardMaterial({
        map: coverTex,
        roughness: 0.36,
      })
    );
    frontCover.position.y = 0.014;
    bookGroup.add(frontCover);

    // Red silk bookmark ribbon extending from bottom of book
    const ribbon = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.004, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 })
    );
    ribbon.position.set(0.04, -0.008, 0.14);
    ribbon.rotation.x = 0.25;
    bookGroup.add(ribbon);

    return group;
  }
}
