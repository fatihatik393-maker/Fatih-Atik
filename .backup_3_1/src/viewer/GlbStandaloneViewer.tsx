import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type ViewerCameraPreset =
  | 'front'
  | 'persp45'
  | 'grill_closeup'
  | 'hood_worktop_closeup';

export type ViewerShadingMode = 'pbr' | 'normals' | 'wireframe';

export interface GlbInspectionStats {
  loaded: boolean;
  loadTimeMs: number;
  fileSizeBytes: number;
  meshPrimitiveCount: number;
  materialCount: number;
  materialNames: string[];
  vertexCount: number;
  triangleCount: number;
  drawCalls: number;
  hasNormals: boolean;
  hasTangents: boolean;
  hasUV0: boolean;
  hasUV1: boolean;
  uvMin: [number, number];
  uvMax: [number, number];
  bboxSize: [number, number, number];
  activeCamera: ViewerCameraPreset;
  shadingMode: ViewerShadingMode;
}

declare global {
  interface Window {
    __glbViewerStats?: GlbInspectionStats;
    __setGlbViewerCamera?: (
      preset: ViewerCameraPreset,
      shading?: ViewerShadingMode
    ) => void;
  }
}

const CAMERA_PRESETS: Record<
  ViewerCameraPreset,
  { pos: [number, number, number]; target: [number, number, number]; fov: number; label: string }
> = {
  front: {
    pos: [-1.45, 1.58, 0.25],
    target: [-1.45, 1.42, -5.15],
    fov: 50,
    label: '1. Ön Görünüm (Front View)',
  },
  persp45: {
    pos: [3.15, 2.38, -0.65],
    target: [-2.15, 1.22, -4.65],
    fov: 52,
    label: '2. 45° Perspektif (45° Studio Perspective)',
  },
  grill_closeup: {
    pos: [-1.88, 1.32, -3.88],
    target: [-2.82, 0.96, -5.12],
    fov: 42,
    label: '3. Izgara Yakın Çekim (Charbroiler Close-Up)',
  },
  hood_worktop_closeup: {
    pos: [-0.35, 1.76, -2.25],
    target: [-1.35, 1.52, -5.15],
    fov: 50,
    label: '4. Davlumbaz & Çalışma Tezgâhı Yakın Çekim',
  },
};

function buildStudioEnvironmentScene(): THREE.Scene {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x18202c);

  const skyBand = new THREE.Mesh(
    new THREE.SphereGeometry(18, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x243044, side: THREE.BackSide })
  );
  envScene.add(skyBand);

  const softboxWarm = new THREE.MeshBasicMaterial({ color: 0xfff3dc });
  const softboxCool = new THREE.MeshBasicMaterial({ color: 0xdbeafe });
  const bounceWarm = new THREE.MeshBasicMaterial({ color: 0xff9e5e });

  for (const z of [-4.5, -1.5, 2.0]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), softboxWarm);
    strip.rotation.x = Math.PI / 2;
    strip.position.set(0, 6.0, z);
    envScene.add(strip);
  }

  const frontKeyPanel = new THREE.Mesh(new THREE.PlaneGeometry(14, 5.5), softboxCool);
  frontKeyPanel.position.set(0, 2.8, 6.5);
  frontKeyPanel.rotation.y = Math.PI;
  envScene.add(frontKeyPanel);

  const sideRimPanel = new THREE.Mesh(new THREE.PlaneGeometry(10, 5.0), softboxWarm);
  sideRimPanel.position.set(7.5, 2.8, -2.0);
  sideRimPanel.rotation.y = -Math.PI / 2;
  envScene.add(sideRimPanel);

  const grillWarmBounce = new THREE.Mesh(new THREE.PlaneGeometry(5, 3), bounceWarm);
  grillWarmBounce.position.set(-2.8, 1.2, -6.5);
  envScene.add(grillWarmBounce);

  return envScene;
}

export function GlbStandaloneViewer() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [stats, setStats] = useState<GlbInspectionStats | null>(null);
  const [activePreset, setActivePreset] = useState<ViewerCameraPreset>('front');
  const [shadingMode, setShadingMode] = useState<ViewerShadingMode>('pbr');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const params = new URLSearchParams(window.location.search);
    const initialCam = (params.get('cam') as ViewerCameraPreset) || 'front';
    const initialShade = (params.get('shade') as ViewerShadingMode) || 'pbr';

    const glProbe = document.createElement('canvas').getContext('webgl2');
    let isSoftwareGl = false;
    if (glProbe) {
      const ext = glProbe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : glProbe.RENDERER;
      const gpu = String(glProbe.getParameter(param));
      glProbe.getExtension('WEBGL_lose_context')?.loseContext();
      isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const rect = mount.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111621);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(buildStudioEnvironmentScene(), 0.035);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 1.35;
    pmrem.dispose();

    // Neutral Studio Pedestal Floor Grid for scale verification (1m grid lines)
    const studioFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 16),
      new THREE.MeshStandardMaterial({
        color: 0x18202c,
        roughness: 0.78,
        metalness: 0.12,
      })
    );
    studioFloor.rotation.x = -Math.PI / 2;
    studioFloor.position.set(-1.3, -0.002, -3.0);
    studioFloor.receiveShadow = true;
    scene.add(studioFloor);

    const gridHelper = new THREE.GridHelper(16, 16, 0x475569, 0x1e293b);
    gridHelper.position.set(-1.3, 0.001, -3.0);
    scene.add(gridHelper);

    // 3-Point Studio Lighting + Range Hood & Grill Task Lights
    const hemi = new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 0.85);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff5e6, 2.2);
    keyLight.position.set(3.5, 6.2, 3.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 22;
    keyLight.shadow.camera.left = -8;
    keyLight.shadow.camera.right = 8;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xc7d2fe, 1.15);
    fillLight.position.set(-5.5, 3.8, 4.5);
    scene.add(fillLight);

    const hoodLight = new THREE.PointLight(0xffdba8, 2.2, 4.5, 1.5);
    hoodLight.position.set(-2.8, 2.48, -4.88);
    scene.add(hoodLight);

    const emberLight = new THREE.PointLight(0xff6b2b, 1.35, 3.2, 1.8);
    emberLight.position.set(-2.8, 1.05, -5.18);
    scene.add(emberLight);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 50);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;

    let loadedRoot: THREE.Object3D | null = null;
    const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    const normalMaterial = new THREE.MeshNormalMaterial();

    const applyCameraAndShading = (
      preset: ViewerCameraPreset,
      shade: ViewerShadingMode
    ) => {
      const cfg = CAMERA_PRESETS[preset] || CAMERA_PRESETS.front;
      camera.fov = cfg.fov;
      camera.position.set(...cfg.pos);
      camera.updateProjectionMatrix();
      controls.target.set(...cfg.target);
      controls.update();

      if (loadedRoot) {
        loadedRoot.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const orig = originalMaterials.get(mesh);
            if (!orig) return;
            if (shade === 'normals') {
              mesh.material = normalMaterial;
            } else if (shade === 'wireframe') {
              const cloned = (orig as THREE.MeshStandardMaterial).clone();
              cloned.wireframe = true;
              mesh.material = cloned;
            } else {
              mesh.material = orig;
            }
          }
        });
      }

      renderer.render(scene, camera);
      setActivePreset(preset);
      setShadingMode(shade);

      if (window.__glbViewerStats) {
        window.__glbViewerStats.activeCamera = preset;
        window.__glbViewerStats.shadingMode = shade;
        window.__glbViewerStats.drawCalls = renderer.info.render.calls;
        setStats({ ...window.__glbViewerStats });
      }
    };

    window.__setGlbViewerCamera = (preset, shade = 'pbr') => {
      applyCameraAndShading(preset, shade);
    };

    // Fetch file size & load GLB model
    const tStart = performance.now();
    let fileSizeBytes = 0;
    fetch('/models/industrial_kitchen.glb')
      .then((r) => r.blob())
      .then((b) => {
        fileSizeBytes = b.size;
      })
      .catch(() => {});

    const loader = new GLTFLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    loader.load('/models/industrial_kitchen.glb', (gltf) => {
      const loadTimeMs = Number((performance.now() - tStart).toFixed(2));
      loadedRoot = gltf.scene;

      let meshPrimitiveCount = 0;
      const materialSet = new Set<string>();
      let vertexCount = 0;
      let triangleCount = 0;
      let hasNormals = true;
      let hasTangents = true;
      let hasUV0 = true;
      let hasUV1 = true;
      let uMin = Infinity;
      let vMin = Infinity;
      let uMax = -Infinity;
      let vMax = -Infinity;

      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          meshPrimitiveCount++;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          originalMaterials.set(mesh, mesh.material);

          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat) {
            materialSet.add(mat.name || `Material_${meshPrimitiveCount}`);
            mat.envMapIntensity = 1.35;
            for (const tex of [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.aoMap]) {
              if (tex) {
                tex.anisotropy = maxAniso;
                tex.needsUpdate = true;
              }
            }
          }

          const geo = mesh.geometry;
          const posAttr = geo.getAttribute('position');
          const normAttr = geo.getAttribute('normal');
          const tanAttr = geo.getAttribute('tangent');
          const uv0Attr = geo.getAttribute('uv');
          const uv1Attr = geo.getAttribute('uv1') || geo.getAttribute('uv2');

          if (posAttr) vertexCount += posAttr.count;
          if (geo.index) {
            triangleCount += geo.index.count / 3;
          } else if (posAttr) {
            triangleCount += posAttr.count / 3;
          }

          if (!normAttr) hasNormals = false;
          if (!tanAttr) hasTangents = false;
          if (!uv0Attr) hasUV0 = false;
          if (!uv1Attr) hasUV1 = false;

          if (uv0Attr) {
            for (let i = 0; i < uv0Attr.count; i++) {
              const u = uv0Attr.getX(i);
              const v = uv0Attr.getY(i);
              if (u < uMin) uMin = u;
              if (u > uMax) uMax = u;
              if (v < vMin) vMin = v;
              if (v > vMax) vMax = v;
            }
          }
        }
      });

      scene.add(gltf.scene);
      const bbox = new THREE.Box3().setFromObject(gltf.scene);
      const size = new THREE.Vector3();
      bbox.getSize(size);

      applyCameraAndShading(initialCam, initialShade);

      const finalStats: GlbInspectionStats = {
        loaded: true,
        loadTimeMs,
        fileSizeBytes: fileSizeBytes || 0,
        meshPrimitiveCount,
        materialCount: materialSet.size,
        materialNames: Array.from(materialSet),
        vertexCount,
        triangleCount,
        drawCalls: renderer.info.render.calls,
        hasNormals,
        hasTangents,
        hasUV0,
        hasUV1,
        uvMin: [Number(uMin.toFixed(3)), Number(vMin.toFixed(3))],
        uvMax: [Number(uMax.toFixed(3)), Number(vMax.toFixed(3))],
        bboxSize: [
          Number(size.x.toFixed(2)),
          Number(size.y.toFixed(2)),
          Number(size.z.toFixed(2)),
        ],
        activeCamera: initialCam,
        shadingMode: initialShade,
      };
      window.__glbViewerStats = finalStats;
      setStats(finalStats);
    });

    const onControlChange = () => {
      renderer.render(scene, camera);
    };
    controls.addEventListener('change', onControlChange);

    return () => {
      controls.removeEventListener('change', onControlChange);
      controls.dispose();
      renderer.dispose();
      delete window.__setGlbViewerCamera;
    };
  }, []);

  return (
    <div className="relative w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full" data-testid="glb-viewer-canvas" />

      {/* Top Left Minimal Technical Telemetry Badge */}
      <div className="absolute top-4 left-4 bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-3 text-xs font-mono shadow-xl pointer-events-none">
        <div className="text-amber-400 font-bold text-sm mb-1">
          BAĞIMSIZ 3D GLB VARLIK DENETÇİSİ — industrial_kitchen.glb
        </div>
        {stats ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-slate-300">
            <div>Kamera: <span className="text-white">{CAMERA_PRESETS[activePreset].label}</span></div>
            <div>Mod: <span className="text-emerald-400 uppercase">{shadingMode}</span></div>
            <div>Mesh / Materyal: <span className="text-white">{stats.meshPrimitiveCount} / {stats.materialCount}</span></div>
            <div>Draw Calls: <span className="text-white">{stats.drawCalls}</span></div>
            <div>Vertex / Üçgen: <span className="text-white">{stats.vertexCount.toLocaleString()} / {stats.triangleCount.toLocaleString()}</span></div>
            <div>Yükleme Süresi: <span className="text-white">{stats.loadTimeMs} ms</span></div>
            <div>Normal / Tangent / UV: <span className="text-emerald-400">{stats.hasNormals ? 'OK' : 'EKSİK'} / {stats.hasTangents ? 'OK' : 'EKSİK'} / {stats.hasUV0 ? 'OK' : 'EKSİK'}</span></div>
            <div>Boyut (m): <span className="text-white">{stats.bboxSize[0]}m × {stats.bboxSize[1]}m × {stats.bboxSize[2]}m</span></div>
          </div>
        ) : (
          <div className="text-slate-400">GLB modeli yükleniyor...</div>
        )}
      </div>

      {/* Bottom Camera & Shading Control Dock */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-wrap items-center gap-2 bg-slate-900/95 border border-slate-700/80 rounded-2xl px-4 py-2.5 shadow-2xl">
        {(Object.keys(CAMERA_PRESETS) as ViewerCameraPreset[]).map((presetKey) => (
          <button
            key={presetKey}
            type="button"
            onClick={() => window.__setGlbViewerCamera?.(presetKey, shadingMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activePreset === presetKey
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {CAMERA_PRESETS[presetKey].label}
          </button>
        ))}
        <div className="h-5 w-px bg-slate-700 mx-1" />
        {(['pbr', 'normals', 'wireframe'] as ViewerShadingMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => window.__setGlbViewerCamera?.(activePreset, mode)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono uppercase transition ${
              shadingMode === mode
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}
