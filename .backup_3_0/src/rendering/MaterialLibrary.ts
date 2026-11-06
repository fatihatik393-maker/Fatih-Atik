import * as THREE from 'three';

export class MaterialLibrary {
  readonly floorTile: THREE.MeshStandardMaterial;
  readonly kitchenFloorTile: THREE.MeshStandardMaterial;
  readonly wallWarm: THREE.MeshStandardMaterial;
  readonly wallBrick: THREE.MeshStandardMaterial;
  readonly ceilingMatte: THREE.MeshStandardMaterial;
  readonly woodOak: THREE.MeshStandardMaterial;
  readonly woodDarkWalnut: THREE.MeshStandardMaterial;
  readonly stainlessSteel: THREE.MeshStandardMaterial;
  readonly darkIron: THREE.MeshStandardMaterial;
  readonly brassAccent: THREE.MeshStandardMaterial;
  readonly grillGrate: THREE.MeshStandardMaterial;
  readonly glassWindow: THREE.MeshPhysicalMaterial;
  readonly boothLeatherRed: THREE.MeshStandardMaterial;
  readonly boothLeatherTan: THREE.MeshStandardMaterial;
  readonly neonSignWarm: THREE.MeshStandardMaterial;
  readonly menuScreenGlow: THREE.MeshStandardMaterial;

  // Exterior urban environment shared materials
  readonly asphaltRoad: THREE.MeshStandardMaterial;
  readonly concreteCurb: THREE.MeshStandardMaterial;
  readonly treeBark: THREE.MeshStandardMaterial;
  readonly foliageRich: THREE.MeshStandardMaterial;
  readonly foliageSunlit: THREE.MeshStandardMaterial;

  // High-detail food & ingredient materials
  readonly bunMaterial: THREE.MeshPhysicalMaterial;
  readonly bunCrumbMaterial: THREE.MeshStandardMaterial;
  readonly sesameMaterial: THREE.MeshStandardMaterial;
  readonly pattyRawMaterial: THREE.MeshStandardMaterial;
  readonly pattyCookedMaterial: THREE.MeshStandardMaterial;
  readonly pattyBurntMaterial: THREE.MeshStandardMaterial;
  readonly cheeseMaterial: THREE.MeshPhysicalMaterial;
  readonly lettuceMaterial: THREE.MeshStandardMaterial;
  readonly sodaCupMaterial: THREE.MeshStandardMaterial;
  readonly sodaLidMaterial: THREE.MeshPhysicalMaterial;
  readonly trayMaterial: THREE.MeshStandardMaterial;
  readonly trayPaperMaterial: THREE.MeshStandardMaterial;
  readonly skyDomeMat: THREE.MeshBasicMaterial;
  readonly contactShadow: THREE.MeshBasicMaterial;
  readonly posterArtWarm: THREE.MeshStandardMaterial;
  readonly posterArtVintage: THREE.MeshStandardMaterial;

  private textures: THREE.Texture[] = [];
  private materials: THREE.Material[] = [];

  constructor(maxAnisotropy = 4, isSoftwareGl = false) {
    const microBumpTex = this.createOrganicBumpTexture(128, 28, maxAnisotropy);
    microBumpTex.repeat.set(8, 8);

    // 1. Dining Room Warm Porcelain Terrazzo Tile Texture with Grout Bump
    const diningTileTex = this.createTileTexture('#e6dfd5', '#d8cec0', '#9e9284', 64, maxAnisotropy);
    diningTileTex.repeat.set(12, 8);
    this.floorTile = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: diningTileTex,
        bumpMap: diningTileTex,
        bumpScale: 0.003,
        roughness: 0.28,
        metalness: 0.06,
      })
    );

    // 2. Kitchen Non-Slip Quarry Ceramic Tile Texture
    const kitchenTileTex = this.createTileTexture('#2f3338', '#262a2e', '#15171a', 64, maxAnisotropy);
    kitchenTileTex.repeat.set(14, 7);
    this.kitchenFloorTile = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: kitchenTileTex,
        bumpMap: kitchenTileTex,
        bumpScale: 0.004,
        roughness: 0.42,
        metalness: 0.12,
      })
    );

    // 3. Warm Architectural Plaster Wall & Exposed Heritage Brick Wall
    this.wallWarm = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf2eadf,
        bumpMap: microBumpTex,
        bumpScale: 0.002,
        roughness: 0.78,
        metalness: 0.02,
      })
    );

    const brickTex = this.createBrickTexture(maxAnisotropy);
    brickTex.repeat.set(7, 3.5);
    this.wallBrick = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: brickTex,
        bumpMap: brickTex,
        bumpScale: 0.008,
        roughness: 0.82,
        metalness: 0.04,
      })
    );

    this.ceilingMatte = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1b1918,
        roughness: 0.88,
        metalness: 0.08,
      })
    );

    // 4. Wood Countertops & Millwork (Rich Organic Grain & Satin Varnish)
    const woodTex = this.createWoodTexture('#c2844b', '#8f5929', maxAnisotropy);
    woodTex.repeat.set(3, 1);
    this.woodOak = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        bumpMap: woodTex,
        bumpScale: 0.0045,
        roughness: 0.3,
        metalness: 0.06,
      })
    );

    const walnutTex = this.createWoodTexture('#4a2f1d', '#2b190e', maxAnisotropy);
    walnutTex.repeat.set(2, 1);
    this.woodDarkWalnut = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: walnutTex,
        bumpMap: walnutTex,
        bumpScale: 0.0045,
        roughness: 0.36,
        metalness: 0.08,
      })
    );

    // 5. Brushed Stainless Steel, Dark Anodized Iron & Warm Brushed Brass
    const metalBrushTex = this.createBrushedMetalTexture(maxAnisotropy);
    this.stainlessSteel = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xdce2e8,
        roughnessMap: metalBrushTex,
        bumpMap: metalBrushTex,
        bumpScale: 0.0015,
        roughness: 0.22,
        metalness: 0.88,
      })
    );

    this.darkIron = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x22252a,
        roughnessMap: metalBrushTex,
        roughness: 0.44,
        metalness: 0.82,
      })
    );

    this.brassAccent = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xdca858,
        roughness: 0.2,
        metalness: 0.9,
      })
    );

    this.grillGrate = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x16181b,
        bumpMap: metalBrushTex,
        bumpScale: 0.004,
        roughness: 0.42,
        metalness: 0.85,
      })
    );

    // 6. Storefront Architectural Tempered Glass
    this.glassWindow = this.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xdcf0ff,
        transparent: true,
        opacity: isSoftwareGl ? 0.24 : 0.28,
        roughness: 0.06,
        metalness: 0.12,
        reflectivity: 0.9,
        depthWrite: false,
      })
    );

    // 7. Tufted & Stitched Booth Upholstery Leather
    const redLeatherTex = this.createStitchedLeatherTexture('#9e2822', '#6e1612', '#c2463d', maxAnisotropy);
    redLeatherTex.repeat.set(3, 2);
    const leatherBumpTex = this.createStitchedLeatherTexture('#888888', '#383838', '#b8b8b8', maxAnisotropy);
    leatherBumpTex.repeat.set(3, 2);

    this.boothLeatherRed = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: redLeatherTex,
        bumpMap: leatherBumpTex,
        bumpScale: 0.0055,
        roughness: 0.38,
        metalness: 0.06,
      })
    );

    const tanLeatherTex = this.createStitchedLeatherTexture('#c88644', '#8c5622', '#dfa060', maxAnisotropy);
    tanLeatherTex.repeat.set(3, 2);
    this.boothLeatherTan = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: tanLeatherTex,
        bumpMap: leatherBumpTex,
        bumpScale: 0.005,
        roughness: 0.4,
        metalness: 0.06,
      })
    );

    // 8. Exterior Street Materials
    const asphaltTex = this.createOrganicBumpTexture(128, 55, maxAnisotropy);
    asphaltTex.repeat.set(16, 6);
    this.asphaltRoad = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x2c323b,
        bumpMap: asphaltTex,
        bumpScale: 0.008,
        roughness: 0.88,
        metalness: 0.04,
      })
    );

    const sidewalkSlabTex = this.createTileTexture('#9ca3af', '#949ba7', '#6b7280', 64, maxAnisotropy);
    sidewalkSlabTex.repeat.set(18, 3);
    this.concreteCurb = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: sidewalkSlabTex,
        bumpMap: sidewalkSlabTex,
        bumpScale: 0.004,
        roughness: 0.82,
        metalness: 0.04,
      })
    );

    const barkTex = this.createWoodTexture('#543b2c', '#3b281d', maxAnisotropy);
    this.treeBark = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: barkTex,
        bumpMap: barkTex,
        bumpScale: 0.008,
        roughness: 0.9,
      })
    );

    this.foliageRich = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x457028,
        bumpMap: microBumpTex,
        bumpScale: 0.005,
        roughness: 0.72,
      })
    );

    this.foliageSunlit = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x5c8d36,
        bumpMap: microBumpTex,
        bumpScale: 0.005,
        roughness: 0.68,
      })
    );

    // 9. Emissive Signage & Menu Board
    this.neonSignWarm = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffc266,
        emissive: 0xff9800,
        emissiveIntensity: 1.8,
        roughness: 0.18,
      })
    );

    const menuTex = this.createMenuBoardTexture(maxAnisotropy);
    this.menuScreenGlow = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: menuTex,
        emissiveMap: menuTex,
        emissive: 0xffffff,
        emissiveIntensity: 0.58,
        roughness: 0.26,
      })
    );

    // 9. Artisanal Brioche Bun & Crumb Materials
    const bunColorTex = this.createBriocheBunTexture(maxAnisotropy);
    const bunBumpTex = this.createOrganicBumpTexture(128, 22, maxAnisotropy);
    this.bunMaterial = this.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: bunColorTex,
        bumpMap: bunBumpTex,
        bumpScale: 0.004,
        roughness: 0.38,
        metalness: 0.02,
        clearcoat: 0.32,
        clearcoatRoughness: 0.35,
      })
    );

    const crumbTex = this.createCrumbTexture(maxAnisotropy);
    this.bunCrumbMaterial = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: crumbTex,
        bumpMap: bunBumpTex,
        bumpScale: 0.008,
        roughness: 0.88,
        metalness: 0.0,
      })
    );

    this.sesameMaterial = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf7e7c4,
        roughness: 0.42,
      })
    );

    // 10. Minced Beef Patty Materials (Raw, Seared with Char Marks, Burnt)
    const meatBumpTex = this.createOrganicBumpTexture(128, 95, maxAnisotropy);
    const rawMeatTex = this.createPattyTexture('raw', maxAnisotropy);
    this.pattyRawMaterial = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: rawMeatTex,
        bumpMap: meatBumpTex,
        bumpScale: 0.012,
        roughness: 0.42,
        metalness: 0.05,
      })
    );

    const cookedMeatTex = this.createPattyTexture('cooked', maxAnisotropy);
    this.pattyCookedMaterial = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: cookedMeatTex,
        bumpMap: meatBumpTex,
        bumpScale: 0.014,
        roughness: 0.46,
        metalness: 0.08,
      })
    );

    const burntMeatTex = this.createPattyTexture('burnt', maxAnisotropy);
    this.pattyBurntMaterial = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: burntMeatTex,
        bumpMap: meatBumpTex,
        bumpScale: 0.018,
        roughness: 0.92,
        metalness: 0.02,
      })
    );

    // 11. Glossy Melted Cheddar Cheese
    this.cheeseMaterial = this.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffa800,
        roughness: 0.24,
        metalness: 0.02,
        clearcoat: 0.45,
        clearcoatRoughness: 0.2,
      })
    );

    // 12. Crisp Leafy Lettuce with Vein Texture
    const lettuceTex = this.createLettuceTexture(maxAnisotropy);
    this.lettuceMaterial = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: lettuceTex,
        bumpMap: bunBumpTex,
        bumpScale: 0.006,
        roughness: 0.48,
        metalness: 0.02,
        side: THREE.DoubleSide,
      })
    );

    // 13. Branded Soda Cup & Lid
    const cupTex = this.createSodaCupTexture(maxAnisotropy);
    this.sodaCupMaterial = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: cupTex,
        roughness: 0.32,
        metalness: 0.05,
      })
    );

    this.sodaLidMaterial = this.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xf8fafc,
        roughness: 0.2,
        metalness: 0.05,
        clearcoat: 0.4,
      })
    );

    this.trayMaterial = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x2b2d42,
        roughness: 0.38,
        metalness: 0.15,
      })
    );

    const linerTex = this.createCheckerPaperTexture(maxAnisotropy);
    this.trayPaperMaterial = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: linerTex,
        roughness: 0.78,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );

    // 14. Atmospheric Sky Dome, Contact AO Shadow & Illustrated Wall Posters
    const skyTex = this.createSkyDomeTexture();
    this.skyDomeMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        map: skyTex,
        side: THREE.BackSide,
        fog: false,
      })
    );

    const softAOTex = this.createSoftAOShadowTexture();
    this.contactShadow = this.trackMat(
      new THREE.MeshBasicMaterial({
        map: softAOTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );

    const posterTex1 = this.createPosterTexture('craft_burger', maxAnisotropy);
    this.posterArtWarm = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: posterTex1,
        roughness: 0.38,
        metalness: 0.04,
      })
    );

    const posterTex2 = this.createPosterTexture('fresh_grill', maxAnisotropy);
    this.posterArtVintage = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: posterTex2,
        roughness: 0.38,
        metalness: 0.04,
      })
    );
  }

  private trackMat<T extends THREE.Material>(mat: T): T {
    this.materials.push(mat);
    return mat;
  }

  private createSoftAOShadowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 128, 128);
    // Soft feathered rounded-box / radial ambient occlusion falloff
    const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
    grad.addColorStop(0.0, 'rgba(10, 8, 6, 0.64)');
    grad.addColorStop(0.55, 'rgba(10, 8, 6, 0.38)');
    grad.addColorStop(0.82, 'rgba(10, 8, 6, 0.14)');
    grad.addColorStop(1.0, 'rgba(10, 8, 6, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const tex = new THREE.CanvasTexture(canvas);
    this.textures.push(tex);
    return tex;
  }

  private createSkyDomeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#38bdf8');
    grad.addColorStop(0.38, '#7dd3fc');
    grad.addColorStop(0.49, '#fde68a');
    grad.addColorStop(0.54, '#fed7aa');
    grad.addColorStop(1.0, '#cbd5e1');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    // Soft atmospheric clouds above horizon
    ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
    for (let i = 0; i < 18; i++) {
      const cx = (i * 79) % 512;
      const cy = 62 + (i % 5) * 11;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 38 + (i % 3) * 16, 8 + (i % 2) * 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(tex);
    return tex;
  }

  private createPosterTexture(
    theme: 'craft_burger' | 'fresh_grill',
    maxAnisotropy: number
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const ctx = canvas.getContext('2d')!;

    // Archival espresso or warm parchment canvas background
    ctx.fillStyle = theme === 'craft_burger' ? '#161311' : '#f5efe2';
    ctx.fillRect(0, 0, 512, 384);

    // Double architectural border
    ctx.strokeStyle = theme === 'craft_burger' ? '#f59e0b' : '#9a3412';
    ctx.lineWidth = 6;
    ctx.strokeRect(16, 16, 480, 352);
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 26, 460, 332);

    if (theme === 'craft_burger') {
      // Exploded Artisan Burger Anatomy Diagram
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ANATOMY OF A SMASH BURGER', 256, 64);

      ctx.fillStyle = '#a8a29e';
      ctx.font = '13px monospace';
      ctx.fillText('BURGER DISTRICT CULINARY ARCHIVE · FIG. 01', 256, 86);

      // Top Brioche Crown
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(220, 148, 64, Math.PI, 0);
      ctx.fill();

      // Sesame seeds
      ctx.fillStyle = '#fef3c7';
      for (const [sx, sy] of [
        [195, 118],
        [220, 110],
        [245, 118],
        [208, 130],
        [234, 128],
      ]) {
        ctx.beginPath();
        ctx.ellipse(sx, sy, 4, 2, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Crisp Ruffled Lettuce
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(148, 162, 144, 14);

      // Melted Aged Cheddar
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(152, 186);
      ctx.lineTo(288, 186);
      ctx.lineTo(272, 204);
      ctx.lineTo(220, 194);
      ctx.lineTo(168, 204);
      ctx.closePath();
      ctx.fill();

      // Double Seared Beef Patties
      ctx.fillStyle = '#78350f';
      ctx.fillRect(150, 210, 140, 22);
      ctx.fillRect(150, 240, 140, 22);

      // Toasted Bottom Brioche Heel
      ctx.fillStyle = '#b45309';
      ctx.fillRect(156, 272, 128, 20);

      // Callout labels on right
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      const callouts: [number, string][] = [
        [132, '01. BRIOCHE CROWN'],
        [170, '02. CRISP LETTUCE'],
        [196, '03. AGED CHEDDAR'],
        [226, '04. SEARED SMASH PATTY'],
        [284, '05. TOASTED HEEL'],
      ];
      for (const [cy, text] of callouts) {
        ctx.beginPath();
        ctx.moveTo(296, cy);
        ctx.lineTo(324, cy);
        ctx.stroke();
        ctx.fillText(text, 330, cy + 4);
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('100% DRY-AGED CHUCK · CAST-IRON SEARED AT 260°C', 256, 336);
    } else {
      // Vintage Heritage Service & Hospitality Poster
      ctx.fillStyle = '#7c2d12';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BURGER DISTRICT', 256, 66);

      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('FRESH OFF THE IRON · SERVED ON THE TRAY', 256, 92);

      // Illustrated Service Tray with Burger + District Cola
      ctx.fillStyle = '#292524';
      ctx.fillRect(110, 246, 292, 22);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(126, 240, 260, 8);

      // Burger on left of tray
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(205, 195, 48, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(154, 197, 102, 10);
      ctx.fillStyle = '#451a03';
      ctx.fillRect(156, 209, 98, 16);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(160, 227, 90, 13);

      // District Cola cup on right of tray
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(298, 152, 54, 88);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(298, 184, 54, 16);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(325, 152);
      ctx.lineTo(325, 122);
      ctx.lineTo(344, 112);
      ctx.stroke();

      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('HOT SMASH BURGER & ICE-COLD DISTRICT COLA', 256, 308);
      ctx.font = '13px monospace';
      ctx.fillStyle = '#78350f';
      ctx.fillText('CRAFTED DAILY · QUALITY GUARANTEED', 256, 334);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    this.textures.push(tex);
    return tex;
  }

  private createBriocheBunTexture(maxAnisotropy: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Radial gradient for golden-brown toasted dome top fading to warm golden side
    const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 130);
    grad.addColorStop(0, '#9c4a1a');
    grad.addColorStop(0.55, '#c96f28');
    grad.addColorStop(0.88, '#e09342');
    grad.addColorStop(1, '#ecc07c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    this.textures.push(tex);
    return tex;
  }

  private createCrumbTexture(maxAnisotropy: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#f3d5a0';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 450; i++) {
      const x = (i * 73) % 128;
      const y = (i * 41) % 128;
      ctx.fillStyle = i % 3 === 0 ? '#d8aa63' : '#fae5be';
      ctx.fillRect(x, y, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    this.textures.push(tex);
    return tex;
  }

  private createOrganicBumpTexture(size: number, contrast: number, maxAnisotropy: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 900; i++) {
      const x = (i * 97) % size;
      const y = (i * 53) % size;
      const r = 2 + (i % 4);
      const val = Math.max(0, Math.min(255, 128 + ((i % 2 === 0 ? 1 : -1) * contrast)));
      ctx.fillStyle = `rgb(${val},${val},${val})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = maxAnisotropy;
    this.textures.push(tex);
    return tex;
  }

  private createPattyTexture(mode: 'raw' | 'cooked' | 'burnt', maxAnisotropy: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const baseColor =
      mode === 'raw' ? '#b83b32' : mode === 'cooked' ? '#4a2514' : '#181412';
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 256, 256);

    // Minced beef marbling / fat & crust granules
    for (let i = 0; i < 650; i++) {
      const x = (i * 89) % 256;
      const y = (i * 131) % 256;
      const r = 1.5 + (i % 4);
      if (mode === 'raw') {
        ctx.fillStyle = i % 3 === 0 ? '#f2b8b2' : '#962922';
      } else if (mode === 'cooked') {
        ctx.fillStyle = i % 3 === 0 ? '#6e3a20' : '#2c140a';
      } else {
        ctx.fillStyle = i % 3 === 0 ? '#2b2421' : '#0c0a09';
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Authentic parallel grill sear stripes on cooked & burnt patties
    if (mode !== 'raw') {
      ctx.strokeStyle = mode === 'cooked' ? 'rgba(20, 8, 4, 0.78)' : 'rgba(5, 4, 4, 0.9)';
      ctx.lineWidth = 8;
      for (let offset = -120; offset <= 256; offset += 28) {
        ctx.beginPath();
        ctx.moveTo(offset, 0);
        ctx.lineTo(offset + 120, 256);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    this.textures.push(tex);
    return tex;
  }

  private createLettuceTexture(maxAnisotropy: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 128);
    grad.addColorStop(0, '#a3e635');
    grad.addColorStop(0.55, '#65a30d');
    grad.addColorStop(1, '#3f6212');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Leaf veins radiating from center
    ctx.strokeStyle = 'rgba(217, 249, 157, 0.5)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(128, 128);
      ctx.lineTo(128 + Math.cos(angle) * 120, 128 + Math.sin(angle) * 120);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    this.textures.push(tex);
    return tex;
  }

  private createSodaCupTexture(maxAnisotropy: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 256, 256);

    // Red & amber stripes on the cup
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 32, 256, 150);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 95, 256, 24);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DISTRICT COLA', 128, 80);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    this.textures.push(tex);
    return tex;
  }

  private createCheckerPaperTexture(maxAnisotropy: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const sq = 16;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#fffbeb' : '#dc2626';
        ctx.fillRect(x * sq, y * sq, sq, sq);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = maxAnisotropy;
    this.textures.push(tex);
    return tex;
  }

  private createTileTexture(
    colorA: string,
    colorB: string,
    groutColor: string,
    size: number,
    maxAnisotropy: number
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size * 2;
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = groutColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const pad = 2;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? colorA : colorB;
        ctx.fillRect(x * size + pad, y * size + pad, size - pad * 2, size - pad * 2);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = maxAnisotropy;
    this.textures.push(tex);
    return tex;
  }

  private createBrickTexture(maxAnisotropy: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#cfc6ba';
    ctx.fillRect(0, 0, 256, 128);

    const rows = 4;
    const cols = 4;
    const bh = 128 / rows;
    const bw = 256 / cols;
    const palette = ['#8f3d2e', '#9c4736', '#7d3427', '#a4503f'];

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (bw / 2);
      for (let c = -1; c <= cols; c++) {
        ctx.fillStyle = palette[(r * 3 + c + 4) % palette.length];
        ctx.fillRect(c * bw + offset + 2, r * bh + 2, bw - 4, bh - 4);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = maxAnisotropy;
    this.textures.push(tex);
    return tex;
  }

  private createWoodTexture(baseHex: string, grainHex: string, maxAnisotropy: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    // Rich organic wood grain rings, plank seams & subtle knots
    ctx.fillStyle = grainHex;
    for (let i = 0; i < 64; i++) {
      const y = (i * 256) / 64;
      ctx.globalAlpha = 0.14 + (i % 5) * 0.045;
      ctx.fillRect(0, y, 256, 1.5 + (i % 3));
    }

    // Wavy wood grain fibers
    ctx.strokeStyle = grainHex;
    for (let i = 0; i < 22; i++) {
      const baseY = (i * 256) / 22;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let x = 0; x <= 256; x += 16) {
        const wy = baseY + Math.sin(x * 0.045 + i * 0.8) * 4.5;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }

    // Subtle plank join lines
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = grainHex;
    ctx.fillRect(0, 84, 256, 2);
    ctx.fillRect(0, 172, 256, 2);
    ctx.globalAlpha = 1.0;

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = maxAnisotropy;
    this.textures.push(tex);
    return tex;
  }

  private createStitchedLeatherTexture(
    baseHex: string,
    seamHex: string,
    highlightHex: string,
    maxAnisotropy: number
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    // Subtle pebble leather grain micro-dots
    for (let i = 0; i < 600; i++) {
      const x = (i * 83) % 256;
      const y = (i * 47) % 256;
      ctx.fillStyle = i % 2 === 0 ? highlightHex : seamHex;
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      ctx.arc(x, y, 1.8 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }

    // Channel-tufted vertical cushion shading bands (4 channels across 256px)
    for (let c = 0; c < 4; c++) {
      const x0 = c * 64;
      const grad = ctx.createLinearGradient(x0, 0, x0 + 64, 0);
      grad.addColorStop(0.0, seamHex);
      grad.addColorStop(0.18, baseHex);
      grad.addColorStop(0.5, highlightHex);
      grad.addColorStop(0.82, baseHex);
      grad.addColorStop(1.0, seamHex);
      ctx.globalAlpha = 0.36;
      ctx.fillStyle = grad;
      ctx.fillRect(x0, 0, 64, 256);

      // Recessed seam groove
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = seamHex;
      ctx.fillRect(x0, 0, 3, 256);

      // Contrasting double-stitch dashed thread along each seam
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = highlightHex;
      for (let sy = 4; sy < 256; sy += 10) {
        ctx.fillRect(x0 + 4, sy, 1.5, 5);
        ctx.fillRect(x0 + 60, sy, 1.5, 5);
      }
    }
    ctx.globalAlpha = 1.0;

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = maxAnisotropy;
    this.textures.push(tex);
    return tex;
  }

  private createBrushedMetalTexture(maxAnisotropy: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#5c6066';
    ctx.fillRect(0, 0, 256, 256);

    // 2D brushed micro-streaks with horizontal & vertical panel seams
    for (let i = 0; i < 700; i++) {
      const x = (i * 61) % 256;
      const y = (i * 29) % 256;
      const w = 14 + (i % 28);
      const shade = 75 + ((i * 19) % 45);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x, y, w, 1);
    }

    // Subtle stainless panel seam border
    ctx.strokeStyle = 'rgba(30, 34, 40, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 254, 254);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2);
    tex.anisotropy = maxAnisotropy;
    this.textures.push(tex);
    return tex;
  }

  private createMenuBoardTexture(maxAnisotropy: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 384;
    const ctx = canvas.getContext('2d')!;

    // Deep charcoal matte digital display background
    ctx.fillStyle = '#0c0b0a';
    ctx.fillRect(0, 0, 1024, 384);

    // Top brand header bar
    const hdrGrad = ctx.createLinearGradient(0, 0, 1024, 0);
    hdrGrad.addColorStop(0, '#1c1613');
    hdrGrad.addColorStop(0.5, '#291d15');
    hdrGrad.addColorStop(1, '#1c1613');
    ctx.fillStyle = hdrGrad;
    ctx.fillRect(12, 12, 1000, 58);

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, 1000, 360);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('BURGER DISTRICT', 32, 49);

    ctx.fillStyle = '#fef3c7';
    ctx.font = '600 15px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('FRESH CAST-IRON SMASH BURGERS · EST. 2024', 990, 46);

    // 3 Commercial Digital Menu Panels
    const cards = [
      {
        num: '01',
        title: 'KLASİK BURGER',
        price: '60 $',
        sub: 'Alt Ekmek · Köfte · Marul · Üst Ekmek',
        tag: 'KLASİK LEZZET',
        patties: 1,
        cheese: false,
        accent: '#f59e0b',
      },
      {
        num: '02',
        title: 'CHEESEBURGER',
        price: '75 $',
        sub: 'Alt Ekmek · Köfte · Cheddar · Marul · Üst',
        tag: 'EN ÇOK SATAN',
        patties: 1,
        cheese: true,
        accent: '#fbbf24',
      },
      {
        num: '03',
        title: 'DOUBLE SMASH',
        price: '115 $',
        sub: 'Alt · 2x Köfte · 2x Cheddar · Marul · Üst',
        tag: 'ŞEFİN İMZASI',
        patties: 2,
        cheese: true,
        accent: '#f97316',
      },
    ];

    cards.forEach((c, idx) => {
      const cx = 26 + idx * 328;
      const cy = 82;
      const cw = 316;
      const ch = 228;

      ctx.fillStyle = '#171412';
      ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cw, ch);

      // Top category pill
      ctx.fillStyle = c.accent;
      ctx.fillRect(cx + 14, cy + 14, 116, 22);
      ctx.fillStyle = '#090807';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.tag, cx + 72, cy + 29);

      // Price badge on top right of card
      ctx.fillStyle = '#292118';
      ctx.fillRect(cx + cw - 86, cy + 12, 72, 34);
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx + cw - 86, cy + 12, 72, 34);
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(c.price, cx + cw - 50, cy + 36);

      // Illustrated Burger Icon on right side of card
      const bx = cx + cw - 56;
      let by = cy + 138;
      // Bottom bun
      ctx.fillStyle = '#b45309';
      ctx.fillRect(bx - 30, by, 60, 10);
      by -= 12;
      for (let p = 0; p < c.patties; p++) {
        ctx.fillStyle = '#5c2810';
        ctx.fillRect(bx - 32, by, 64, 10);
        if (c.cheese) {
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(bx - 30, by - 4, 60, 4);
          by -= 4;
        }
        by -= 12;
      }
      // Lettuce
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(bx - 33, by + 2, 66, 6);
      // Top bun dome
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(bx, by + 2, 30, Math.PI, 0);
      ctx.fill();

      // Burger title & recipe layers
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 23px sans-serif';
      ctx.fillText(c.title, cx + 14, cy + 78);

      ctx.fillStyle = '#d6d3d1';
      ctx.font = '13px sans-serif';
      ctx.fillText(c.sub, cx + 14, cy + 198, cw - 24);
    });

    // Bottom Drink & Combo Strip
    ctx.fillStyle = '#141e2e';
    ctx.fillRect(26, 320, 972, 40);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 320, 972, 40);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('★ BUZLU DISTRICT COLA (GAZLI İÇECEK) ................ +20 $', 44, 346);

    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('SERVİS TEPSİSİ İLE MASAYA VEYA PAKET SERVİS', 980, 345);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    this.textures.push(tex);
    return tex;
  }

  dispose(): void {
    for (const tex of this.textures) tex.dispose();
    for (const mat of this.materials) mat.dispose();
  }
}

