import * as THREE from 'three';
import { GraphicsQuality } from '../core/GameConfig';

export class LightingSystem {
  readonly sunLight: THREE.DirectionalLight;
  readonly hemiLight: THREE.HemisphereLight;
  readonly kitchenLight: THREE.PointLight;
  readonly diningLight: THREE.PointLight;
  readonly counterWarmLight: THREE.PointLight;
  readonly hoodTaskLight: THREE.PointLight;
  readonly grillEmberLight: THREE.PointLight;
  readonly kitchenFrontFillLight: THREE.PointLight;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    _isSoftwareGl: boolean
  ) {
    this.scene = scene;
    this.renderer = renderer;

    // 1. High-Contrast Culinary Studio PMREM Environment Map for realistic PBR metal & wood reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const studioEnvScene = this.buildCulinaryStudioEnvironment();
    scene.environment = pmremGenerator.fromScene(studioEnvScene, 0.025).texture;
    scene.environmentIntensity = 1.08;
    pmremGenerator.dispose();

    // Warm Golden-Hour Sky & Subtle Atmospheric Depth
    const skyColor = new THREE.Color(0xdbeafe);
    scene.background = skyColor;
    scene.fog = new THREE.FogExp2(0xdbeafe, 0.01);

    // 2. Balanced Sky/Ground Hemisphere Light Fill
    this.hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x3b2f26, 0.82);
    this.hemiLight.position.set(0, 12, 0);
    scene.add(this.hemiLight);

    // 3. Natural Golden-Afternoon Sunlight through Storefront Windows (Primary Shadow Caster)
    this.sunLight = new THREE.DirectionalLight(0xfff2d6, 1.85);
    this.sunLight.position.set(5.2, 9.8, 11.5);
    this.sunLight.target.position.set(-1.2, 0.5, -2.5);
    scene.add(this.sunLight.target);

    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 1.0;
    this.sunLight.shadow.camera.far = 28.0;
    const d = 8.5;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.018;
    scene.add(this.sunLight);

    // 4. Crisp Overhead Kitchen Work Light
    this.kitchenLight = new THREE.PointLight(0xf8fafc, 1.45, 12, 1.5);
    this.kitchenLight.position.set(-0.6, 3.35, -3.2);
    scene.add(this.kitchenLight);

    // 5. Kitchen Front Specular Fill Light (illuminates beveled chiller doors, handles & manifold dials)
    this.kitchenFrontFillLight = new THREE.PointLight(0xe0f2fe, 1.15, 8.5, 1.5);
    this.kitchenFrontFillLight.position.set(-2.2, 1.85, -3.35);
    scene.add(this.kitchenFrontFillLight);

    // 6. Focused Warm Halogen Range Hood Task Light over Grill & Butcher Block
    this.hoodTaskLight = new THREE.PointLight(0xffdba8, 2.1, 6.5, 1.5);
    this.hoodTaskLight.position.set(-2.8, 2.22, -4.95);
    scene.add(this.hoodTaskLight);

    // 7. Warm Infrared Charbroiler Firebox Glow
    this.grillEmberLight = new THREE.PointLight(0xff6b2b, 1.25, 3.4, 1.8);
    this.grillEmberLight.position.set(-2.8, 1.16, -5.15);
    scene.add(this.grillEmberLight);

    // 8. Cozy Warm Dining Area Light
    this.diningLight = new THREE.PointLight(0xffc570, 1.55, 13.5, 1.45);
    this.diningLight.position.set(0, 3.1, 2.75);
    scene.add(this.diningLight);

    // 9. Warm Pendant Fill over Main Order & Pickup Counter
    this.counterWarmLight = new THREE.PointLight(0xffb74d, 1.25, 8.5, 1.55);
    this.counterWarmLight.position.set(0, 2.55, -0.45);
    scene.add(this.counterWarmLight);
  }

  /**
   * Builds a high-contrast studio reflection environment with bright warm overhead softboxes,
   * cool daylight storefront panels, and dark floor/wall contrast strips so beveled stainless steel
   * and cast-iron edges catch crisp, realistic PBR reflections.
   */
  private buildCulinaryStudioEnvironment(): THREE.Scene {
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x181c22);

    const addLightPanel = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      colorHex: number,
      intensity: number
    ) => {
      const c = new THREE.Color(colorHex).multiplyScalar(intensity);
      const mat = new THREE.MeshBasicMaterial({ color: c });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      envScene.add(mesh);
    };

    // Overhead warm-white kitchen softbox strips (creates crisp horizontal specular bands on bullnose & hood)
    addLightPanel(14, 0.2, 2.2, 0, 6.5, -3.5, 0xfff7ed, 4.8);
    addLightPanel(14, 0.2, 2.2, 0, 6.5, 1.8, 0xfef3c7, 4.5);

    // Front cool-blue daylight storefront window wall
    addLightPanel(16, 5.5, 0.2, 0, 2.5, 8.5, 0xbae6fd, 3.9);

    // Left & Right warm accent studio strips for booth leather & wood bevel catch-lights
    addLightPanel(0.2, 4.5, 12, -8.0, 2.8, 0, 0xfde68a, 3.4);
    addLightPanel(0.2, 4.5, 12, 8.0, 2.8, 0, 0xe0f2fe, 3.0);

    // Warm amber grill horizon bounce
    addLightPanel(6, 1.2, 0.2, -2.5, 0.8, -7.5, 0xfb923c, 3.5);

    // Dark floor absorber for rich contrast on downward-facing bevels
    addLightPanel(18, 0.2, 18, 0, -4.0, 0, 0x090d14, 1.0);

    return envScene;
  }

  applyQualityPreset(quality: GraphicsQuality, forceSoftwareFallback = false): void {
    const effectiveQuality: GraphicsQuality = forceSoftwareFallback ? 'high' : quality;

    if (effectiveQuality === 'low') {
      this.renderer.shadowMap.enabled = false;
      this.sunLight.castShadow = false;
      this.counterWarmLight.visible = false;
      this.hoodTaskLight.visible = false;
      this.grillEmberLight.visible = false;
      this.kitchenFrontFillLight.visible = false;
      this.renderer.setPixelRatio(1);
      this.renderer.toneMappingExposure = 1.02;
      return;
    }

    this.renderer.shadowMap.enabled = true;
    this.sunLight.castShadow = true;
    this.counterWarmLight.visible = true;
    this.hoodTaskLight.visible = true;
    this.grillEmberLight.visible = true;
    this.kitchenFrontFillLight.visible =
      effectiveQuality === 'high' || effectiveQuality === 'ultra';

    const mapSize =
      effectiveQuality === 'ultra'
        ? 2048
        : effectiveQuality === 'high'
        ? 1024
        : 512;
    if (
      this.sunLight.shadow.mapSize.width !== mapSize ||
      this.sunLight.shadow.mapSize.height !== mapSize
    ) {
      this.sunLight.shadow.mapSize.set(mapSize, mapSize);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
    }

    const maxDpr =
      effectiveQuality === 'ultra'
        ? 2.0
        : effectiveQuality === 'high'
        ? 1.5
        : 1.25;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    this.renderer.toneMappingExposure = 1.05;
  }

  /**
   * Smoothly shifts outdoor sun angle/color and indoor warm lighting from
   * Morning Opening -> Midday Rush Hour -> Golden-Hour Evening Closing.
   */
  updateDayTimeAtmosphere(
    timeRemaining: number,
    totalDuration: number,
    decorUpgraded = false
  ): void {
    const progress = Math.max(
      0,
      Math.min(1, 1 - timeRemaining / Math.max(1, totalDuration))
    );

    // Sun arcs from east-morning (x=6.8, y=8.5) through midday (x=2.0, y=11.0) to golden sunset (x=-5.5, y=5.2)
    this.sunLight.position.x = 6.8 - progress * 12.3;
    this.sunLight.position.y = 8.5 + Math.sin(progress * Math.PI) * 2.8 - progress * 3.2;

    if (progress < 0.5) {
      const t = progress * 2;
      this.sunLight.color.setHex(0xfff4d6).lerp(new THREE.Color(0xffffff), t * 0.5);
      this.sunLight.intensity = 1.88 + t * 0.22;
      this.hemiLight.color.setHex(0xe0f2fe).lerp(new THREE.Color(0xfef3c7), t * 0.38);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0xdbeafe).lerp(new THREE.Color(0xe0f2fe), t);
      }
    } else {
      const t = (progress - 0.5) * 2;
      this.sunLight.color.setHex(0xfff2d6).lerp(new THREE.Color(0xff944d), t);
      this.sunLight.intensity = 2.1 - t * 0.68;
      this.hemiLight.color.setHex(0xfef3c7).lerp(new THREE.Color(0xfdba74), t * 0.78);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0xe0f2fe).lerp(new THREE.Color(0xfed7aa), t * 0.85);
      }
    }

    const decorBoost = decorUpgraded ? 0.42 : 0;
    const eveningWarmBoost = progress > 0.58 ? (progress - 0.58) * 1.15 : 0;
    this.diningLight.intensity = 1.55 + decorBoost + eveningWarmBoost;
    this.counterWarmLight.intensity = 1.25 + decorBoost * 0.8 + eveningWarmBoost * 0.82;
  }
}
