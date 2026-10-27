
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const viewer = document.getElementById("viewer");
const viewerPanel = viewer.closest(".viewer-panel");
const loading = document.getElementById("loading");
const loadingText = document.getElementById("loadingText");
const errorBox = document.getElementById("error");
const errorText = document.getElementById("errorText");
const boneInfo = document.getElementById("boneInfo");
const boneTooltip = document.getElementById("boneTooltip");

const selectedName = document.getElementById("selectedName");
const boneDescription = document.getElementById("boneDescription");

const resetButton = document.getElementById("resetView");
const autoRotateButton = document.getElementById("autoRotateToggle");
const boneSearch = document.getElementById("boneSearch");
const boneSearchResults = document.getElementById("boneSearchResults");
const searchResultCount = document.getElementById("searchResultCount");

let skeleton = null;
let mixer = null;
let meshes = [];
let selectedBone = null;
let hoveredBone = null;
let hoverParticles = null;
let particleStartedAt = 0;
const originalScales = new Map();

const fullscreenToggle = document.getElementById("fullscreenToggle");
const fullscreenLabel = document.getElementById("fullscreenLabel");
const fullscreenIcon = document.getElementById("fullscreenIcon");

let lastClickedBone = null;
let lastClickTime = 0;
const DOUBLE_CLICK_DELAY = 350;

let isolated = false;

let initialCameraPosition = null;
let initialTarget = null;
let cameraMotion = null;

const originalMaterials = new Map();
const highlightMaterials = new Map();
const originalVisibility = new Map();

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(
  40,
  viewer.clientWidth / viewer.clientHeight,
  0.01,
  10000
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: "high-performance"
});

renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
viewer.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.HemisphereLight(0xe6efff, 0x55505a, 2));

const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
keyLight.position.set(4, 7, 5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xc2d3ca, 1.2);
fillLight.position.set(-5, 2, -4);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffdfbd, 1);
rimLight.position.set(1, 4, -6);
scene.add(rimLight);

// Camera controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = true;
controls.minDistance = 0.1;
controls.maxDistance = 10000;
controls.autoRotate = false;
controls.autoRotateSpeed = 0.7;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const clock = new THREE.Clock();

function getDisplayName(name) {
  let result = name.trim();

  // Convert the left/right prefixes used in your Blender file.
  if (/^l[_\s]/i.test(result)) {
    result = "Left " + result.slice(2);
  } else if (/^r[_\s]/i.test(result)) {
    result = "Right " + result.slice(2);
  }

  // Add spaces before numbers, e.g. rib12 -> rib 12.
  result = result.replace(/([a-zA-Z])(\d)/g, "$1 $2");

  // Normalize separators and spacing.
  result = result.replace(/[_.]+/g, " ");
  result = result.replace(/\s+/g, " ").trim();

  // Format C1, T1 and L1 vertebrae consistently.
  result = result.replace(/\b([ctl])\s*(\d+)\b/gi, (_, letter, number) =>
    letter.toUpperCase() + number
  );

  return result
    .split(" ")
    .map((word) => {
      if (/^[CTL]\d+$/.test(word)) return word;
      if (/^\d+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function renderBoneSearch(query = "") {
  if (!boneSearchResults) return;
  const normalized = query.trim().toLowerCase();
  const matches = meshes
    .filter((mesh) => !normalized || getDisplayName(mesh.name || "Unnamed structure").toLowerCase().includes(normalized))
    .sort((a, b) => getDisplayName(a.name || "Unnamed structure").localeCompare(getDisplayName(b.name || "Unnamed structure")));

  boneSearchResults.replaceChildren();
  searchResultCount.textContent = normalized
    ? `${matches.length} matches`
    : `${meshes.length.toLocaleString()} structures`;

  if (!matches.length) {
    const empty = document.createElement("p");
    empty.className = "search-empty";
    empty.textContent = "No bones found. Try a different name.";
    boneSearchResults.appendChild(empty);
    return;
  }

  for (const mesh of matches) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bone-result";
    const label = document.createElement("span");
    label.textContent = getDisplayName(mesh.name || "Unnamed structure");
    const arrow = document.createElement("span");
    arrow.textContent = "↗";
    arrow.setAttribute("aria-hidden", "true");
    button.append(label, arrow);
    button.addEventListener("pointerenter", () => showBonePreview(mesh));
    button.addEventListener("pointerleave", clearBonePreview);
    button.addEventListener("focus", () => showBonePreview(mesh));
    button.addEventListener("blur", clearBonePreview);
    button.addEventListener("click", () => {
      if (isolated) showFullSkeleton();
      selectBone(mesh);
      focusOnSelectedBone();
    });
    boneSearchResults.appendChild(button);
  }
}

function showBonePreview(mesh) {
  if (isolated && mesh !== selectedBone) showFullSkeleton();
  if (!mesh?.visible) return;
  updateHoveredBone(mesh);
  const center = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()).project(camera);
  const rect = viewer.getBoundingClientRect();
  const x = (center.x * 0.5 + 0.5) * rect.width;
  const y = (-center.y * 0.5 + 0.5) * rect.height;
  boneTooltip.textContent = getDisplayName(mesh.name || "Unnamed structure");
  boneTooltip.hidden = false;
  boneTooltip.style.left = `${Math.max(8, Math.min(x + 14, rect.width - boneTooltip.offsetWidth - 10))}px`;
  boneTooltip.style.top = `${Math.max(8, Math.min(y + 14, rect.height - boneTooltip.offsetHeight - 10))}px`;
}

function clearBonePreview() {
  updateHoveredBone(null);
  boneTooltip.hidden = true;
}

function getBoneDescription(name) {
  const n = name.toLowerCase();

  if (n.includes("femur")) {
    return "The femur, or thigh bone, is the long bone connecting the hip and knee. It supports body weight and helps with movement.";
  }
  if (n.includes("cranium") || n.includes("skull")) {
    return "The cranium forms the protective enclosure around the brain and contributes to the structure of the head.";
  }
  if (n.includes("mandible")) {
    return "The mandible is the lower jaw bone. It moves during chewing and helps support the lower teeth.";
  }
  if (n.includes("tibia")) {
    return "The tibia, or shin bone, is the larger lower-leg bone and carries much of the body's weight.";
  }
  if (n.includes("fibula")) {
    return "The fibula is the smaller bone on the outer side of the lower leg. It helps stabilize the ankle.";
  }
  if (n.includes("humerus")) {
    return "The humerus is the upper-arm bone. It connects the shoulder to the elbow.";
  }
  if (n.includes("radius")) {
    return "The radius is a forearm bone on the thumb side. It contributes to wrist movement and forearm rotation.";
  }
  if (n.includes("ulna")) {
    return "The ulna is a forearm bone on the little-finger side and forms an important part of the elbow joint.";
  }
  if (n.includes("clavicle")) {
    return "The clavicle, or collarbone, connects the sternum to the shoulder region and helps position the shoulder.";
  }
  if (n.includes("scapula")) {
    return "The scapula, or shoulder blade, provides attachment for muscles and helps the shoulder move.";
  }
  if (n.includes("sternum")) {
    return "The sternum, or breastbone, lies in the center of the chest and connects with the ribs through cartilage.";
  }
  if (n.includes("rib")) {
    return "The ribs form the rib cage, helping protect the heart and lungs while supporting breathing movements.";
  }
  if (n.includes("vertebra") || /^[ctl]\s*\d+$/i.test(n)) {
    return "Vertebrae form the spinal column, which supports the body and protects the spinal cord.";
  }
  if (n.includes("sacrum") || n.includes("coccyx")) {
    return "This bone forms part of the lower end of the vertebral column and contributes to the structure of the pelvis.";
  }
  if (n.includes("pelvis") || n.includes("os coxa") || n.includes("oscoxa")) {
    return "The pelvic bones support the trunk, transfer body weight to the legs, and protect organs in the pelvic region.";
  }
  if (n.includes("phalange")) {
    return "Phalanges are the bones of the fingers or toes. Their arrangement supports gripping or balance and movement.";
  }
  if (n.includes("metacarpal")) {
    return "Metacarpals are the bones of the palm, linking the wrist bones to the finger bones.";
  }
  if (n.includes("metatarsal")) {
    return "Metatarsals are the long bones of the foot between the ankle region and the toes.";
  }
  if (n.includes("carpal") || n.includes("lunate") ||
      n.includes("scaphoid") || n.includes("triquetral") ||
      n.includes("pisiform") || n.includes("trapez")) {
    return "This is one of the carpal bones of the wrist. Together, these bones support wrist movement and connect the forearm to the hand.";
  }
  if (n.includes("talus") || n.includes("calcaneus") ||
      n.includes("cuboid") || n.includes("cuneiform") ||
      n.includes("navicular")) {
    return "This is a bone of the foot. The foot bones work together to support body weight, maintain balance, and enable movement.";
  }
  if (n.includes("patella")) {
    return "The patella, or kneecap, protects the front of the knee and improves the leverage of the quadriceps muscle.";
  }
  if (n.includes("hyoid")) {
    return "The hyoid is a small bone in the neck that supports the tongue and helps with swallowing and speech.";
  }
  if (n.includes("sesamoid")) {
    return "Sesamoid bones develop within certain tendons. They help reduce friction and can improve the mechanical action of muscles.";
  }

  return "This is a separately identified structure in your imported skeleton model. Explore its position and relationships with the surrounding bones.";
}

function updateSelectionPanel(mesh) {
  if (!mesh) {
    selectedName.textContent = "No bone selected";
    boneInfo.hidden = true;
    return;
  }

  selectedName.textContent = getDisplayName(mesh.name);
  boneDescription.textContent = getBoneDescription(mesh.name);
  boneInfo.hidden = false;
}

function applyHighlight(mesh) {
  if (!mesh) return;

  if (!highlightMaterials.has(mesh)) {
    const originals = originalMaterials.get(mesh);
    const originalList = Array.isArray(originals) ? originals : [originals];

    const highlighted = originalList.map((material) => {
      const copy = material.clone();

      if (copy.emissive) {
        copy.emissive.set("#62ad88");
        copy.emissiveIntensity = 0.55;
      } else if (copy.color) {
        copy.color.multiplyScalar(1.35);
      }

      return copy;
    });

    highlightMaterials.set(
      mesh,
      Array.isArray(originals) ? highlighted : highlighted[0]
    );
  }

  mesh.material = highlightMaterials.get(mesh);
}

function removeHighlight(mesh) {
  if (!mesh) return;

  const original = originalMaterials.get(mesh);
  if (original) {
    mesh.material = original;
  }
}

function selectBone(mesh) {
  if (!mesh || mesh === selectedBone) return;

  // Restore the previous bone's original materials.
  removeHighlight(selectedBone);

  selectedBone = mesh;

  applyHighlight(selectedBone);
  isolateSelectedBone();
}

function showHoverParticles(mesh) {
  if (hoverParticles) {
    scene.remove(hoverParticles);
    hoverParticles.geometry.dispose();
    hoverParticles.material.dispose();
    hoverParticles = null;
  }
  if (!mesh) return;

  const bounds = new THREE.Box3().setFromObject(mesh);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.62, 0.025);
  const positions = new Float32Array(90 * 3);
  for (let i = 0; i < 90; i++) {
    const theta = Math.random() * Math.PI * 2;
    const z = Math.random() * 2 - 1;
    const ring = Math.sqrt(1 - z * z) * radius;
    positions[i * 3] = Math.cos(theta) * ring;
    positions[i * 3 + 1] = z * radius;
    positions[i * 3 + 2] = Math.sin(theta) * ring;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0x9bcab0,
    size: Math.max(radius * 0.055, 0.006),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });
  hoverParticles = new THREE.Points(geometry, material);
  hoverParticles.position.copy(center);
  hoverParticles.renderOrder = 1;
  scene.add(hoverParticles);
  particleStartedAt = performance.now();
}

function updateHoveredBone(mesh) {
  if (mesh === hoveredBone) return;
  hoveredBone = mesh;
  renderer.domElement.style.cursor = mesh ? "pointer" : "grab";
  showHoverParticles(mesh);
}

function clearBoneSelection() {
  removeHighlight(selectedBone);
  selectedBone = null;
  updateSelectionPanel(null);
}

function restoreVisibility() {
  for (const mesh of meshes) {
    mesh.visible = originalVisibility.get(mesh) ?? true;
  }

  isolated = false;
}

function isolateSelectedBone() {
  if (!selectedBone) return;

  for (const mesh of meshes) {
    mesh.visible = mesh === selectedBone;
  }

  isolated = true;
  updateSelectionPanel(selectedBone);
}

function showFullSkeleton() {
  restoreVisibility();
  updateSelectionPanel(selectedBone);
}

function syncFullscreenButton() {
  const isFullscreen = document.fullscreenElement === viewerPanel;
  fullscreenLabel.textContent = isFullscreen ? "Exit Fullscreen" : "Fullscreen";
  fullscreenIcon.textContent = isFullscreen ? "↙" : "⛶";
  fullscreenToggle.title = isFullscreen ? "Exit fullscreen" : "Enter fullscreen";
  fullscreenToggle.setAttribute("aria-pressed", String(isFullscreen));
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement === viewerPanel) {
      await document.exitFullscreen();
    } else if (!document.fullscreenElement && viewerPanel.requestFullscreen) {
      await viewerPanel.requestFullscreen();
    }
  } catch (error) {
    console.error("Could not toggle fullscreen:", error);
  }
}

function animateCameraTo(position, target, duration = 650) {
  cameraMotion = {
    startTime: performance.now(),
    duration,
    fromPosition: camera.position.clone(),
    toPosition: position.clone(),
    fromTarget: controls.target.clone(),
    toTarget: target.clone()
  };
}

function focusOnSelectedBone() {
  if (!selectedBone) return;

  const bounds = new THREE.Box3().setFromObject(selectedBone);

  if (bounds.isEmpty()) return;

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());

  // Use a minimum radius so tiny bones remain easy to inspect.
  const radius = Math.max(size.length() * 0.5, 0.03);

  const direction = camera.position.clone().sub(controls.target);

  if (direction.lengthSq() < 0.0001) {
    direction.set(1, 0.4, 2);
  }

  direction.normalize();

  const distance = Math.max(radius * 3.2, 0.15);
  const destination = center.clone().add(
    direction.multiplyScalar(distance)
  );

  animateCameraTo(destination, center);
}

const loader = new GLTFLoader();

function makeModelBundle(gltf, mode) {
  const root = gltf.scene;
  const bundle = {
    mode, root, meshes: [], materials: new Map(), materialStates: [],
    visibility: new Map(), scales: new Map(), mixer: null,
    baseRootScale: root.scale.clone(), baseRootRotation: root.rotation.clone(),
    center: new THREE.Vector3(), radius: 0.1
  };

  root.traverse((object) => {
    if (!object.isMesh) return;
    bundle.meshes.push(object);
    const source = object.material;
    const originals = Array.isArray(source) ? source : [source];
    const copies = originals.map((material) => {
      const copy = material.clone();
      bundle.materialStates.push({
        material: copy,
        opacity: copy.opacity,
        transparent: copy.transparent,
        depthWrite: copy.depthWrite
      });
      return copy;
    });
    object.material = Array.isArray(source) ? copies : copies[0];
    bundle.materials.set(object, object.material);
    bundle.visibility.set(object, object.visible);
    bundle.scales.set(object, object.scale.clone());
    object.frustumCulled = true;
  });

  if (gltf.animations.length > 0) {
    bundle.mixer = new THREE.AnimationMixer(root);
    gltf.animations.forEach((clip) => bundle.mixer.clipAction(clip).play());
  }
  scene.add(root);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  bundle.center.copy(bounds.getCenter(new THREE.Vector3()));
  bundle.radius = Math.max(size.length() * 0.5, 0.1);
  return bundle;
}

function configureCameraForBundle(bundle) {
  const direction = new THREE.Vector3(1.2, 0.45, 2).normalize();
  const destination = bundle.center.clone().add(direction.multiplyScalar(bundle.radius * 2.8));
  camera.near = Math.max(bundle.radius / 1000, 0.001);
  camera.far = bundle.radius * 100;
  camera.updateProjectionMatrix();
  controls.minDistance = bundle.radius * 0.08;
  controls.maxDistance = bundle.radius * 12;
  camera.position.copy(destination);
  controls.target.copy(bundle.center);
  controls.update();
  initialCameraPosition = destination.clone();
  initialTarget = bundle.center.clone();
}

function activateModel(bundle) {
  clearBoneSelection();
  updateHoveredBone(null);
  if (hoverParticles) {
    scene.remove(hoverParticles);
    hoverParticles.geometry.dispose();
    hoverParticles.material.dispose();
    hoverParticles = null;
  }
  isolated = false;
  skeleton = bundle.root;
  mixer = bundle.mixer;
  meshes = bundle.meshes;
  originalMaterials.clear();
  originalVisibility.clear();
  originalScales.clear();
  for (const mesh of meshes) {
    originalMaterials.set(mesh, bundle.materials.get(mesh));
    originalVisibility.set(mesh, bundle.visibility.get(mesh));
    originalScales.set(mesh, bundle.scales.get(mesh).clone());
  }
  for (const material of highlightMaterials.values()) {
    const list = Array.isArray(material) ? material : [material];
    list.forEach((item) => item.dispose());
  }
  highlightMaterials.clear();
  renderBoneSearch(boneSearch?.value || '');
  updateSelectionPanel(null);
  configureCameraForBundle(bundle);
  loading.hidden = true;
  errorBox.hidden = true;
}
loader.load(
  "./models/skeleton.glb",
  (gltf) => {
    const bundle = makeModelBundle(gltf);
    activateModel(bundle);
    console.log("OsteoVision model loaded:", gltf);
    console.log("Mesh objects:", meshes.length);
  },
  (progress) => {
    if (progress.total > 0) loadingText.textContent = `Loading model... ${Math.round(progress.loaded / progress.total * 100)}%`;
  },
  (error) => {
    console.error("Could not load the male skeleton:", error);
    loading.hidden = true;
    errorBox.hidden = false;
    errorText.textContent = "Check that models/skeleton.glb exists and is named correctly. Check the browser console for details.";
  }
);

// Detect a click without mistaking camera dragging for selection.
let pointerStart = null;
let rightPointerStart = null;

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (event.button === 2) {
    rightPointerStart = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId
    };
    return;
  }

  if (event.button !== 0) return;

  pointerStart = {
    x: event.clientX,
    y: event.clientY,
    pointerId: event.pointerId
  };
});

renderer.domElement.addEventListener("pointermove", (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  viewer.style.setProperty("--parallax-x", `${x * 12}px`);
  viewer.style.setProperty("--parallax-y", `${y * 12}px`);
  if (!skeleton || pointerStart || event.buttons) {
    boneTooltip.hidden = true;
    return;
  }
  pointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(meshes.filter((mesh) => mesh.visible), false);
  const hovered = hits.length ? hits[0].object : null;
  updateHoveredBone(hovered);
  if (hovered) {
    boneTooltip.textContent = getDisplayName(hovered.name || "Unnamed structure");
    boneTooltip.hidden = false;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    boneTooltip.style.left = `${Math.min(x + 14, rect.width - boneTooltip.offsetWidth - 10)}px`;
    boneTooltip.style.top = `${Math.max(8, Math.min(y + 14, rect.height - boneTooltip.offsetHeight - 10))}px`;
  } else {
    boneTooltip.hidden = true;
  }
});

renderer.domElement.addEventListener("pointerleave", () => {
  viewer.style.setProperty("--parallax-x", "0px");
  viewer.style.setProperty("--parallax-y", "0px");
  updateHoveredBone(null);
  boneTooltip.hidden = true;
});

renderer.domElement.addEventListener("pointerup", (event) => {
  if (event.button === 2) {
    if (rightPointerStart) {
      const distance = Math.hypot(
        event.clientX - rightPointerStart.x,
        event.clientY - rightPointerStart.y
      );
      const samePointer = event.pointerId === rightPointerStart.pointerId;
      rightPointerStart = null;

      if (samePointer && distance <= 5) {
        if (isolated) showFullSkeleton();
        if (initialCameraPosition && initialTarget) {
          animateCameraTo(initialCameraPosition, initialTarget, 450);
        }
      }
    }
    return;
  }

  if (!pointerStart || event.button !== 0) {
    pointerStart = null;
    return;
  }

  const distance = Math.hypot(
    event.clientX - pointerStart.x,
    event.clientY - pointerStart.y
  );

  const samePointer = event.pointerId === pointerStart.pointerId;
  pointerStart = null;

  // Ignore normal orbit gestures.
  if (!samePointer || distance > 5 || !skeleton) return;

  const rect = renderer.domElement.getBoundingClientRect();

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const visibleMeshes = meshes.filter((mesh) => mesh.visible);
  const hits = raycaster.intersectObjects(visibleMeshes, false);

  if (hits.length > 0) {
    const hitBone = hits[0].object;
    const now = performance.now();
    const isDoubleClick = hitBone === lastClickedBone &&
      now - lastClickTime <= DOUBLE_CLICK_DELAY;

    selectBone(hitBone);
    if (isDoubleClick) {
      isolateSelectedBone();
      focusOnSelectedBone();
      lastClickedBone = null;
      lastClickTime = 0;
    } else {
      lastClickedBone = hitBone;
      lastClickTime = now;
    }
  } else {
    clearBoneSelection();
    lastClickedBone = null;
    lastClickTime = 0;
  }
});

renderer.domElement.addEventListener("pointercancel", () => {
  pointerStart = null;
  rightPointerStart = null;
});

renderer.domElement.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

// UI actions
fullscreenToggle.addEventListener("click", toggleFullscreen);
document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "f" || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target;
  if (target instanceof HTMLElement && (
    target.isContentEditable ||
    target.matches("input, textarea, select, button")
  )) return;
  event.preventDefault();
  toggleFullscreen();
});
autoRotateButton?.addEventListener("click", () => {
  controls.autoRotate = !controls.autoRotate;
  autoRotateButton.setAttribute("aria-pressed", String(controls.autoRotate));
  autoRotateButton.classList.toggle("is-active", controls.autoRotate);
});
boneSearch?.addEventListener("input", () => renderBoneSearch(boneSearch.value));
document.addEventListener("fullscreenchange", syncFullscreenButton);
resetButton.addEventListener("click", () => {
  cameraMotion = null;

  if (initialCameraPosition && initialTarget) {
    animateCameraTo(initialCameraPosition, initialTarget, 400);
  }
});

// Responsive viewport
const resizeObserver = new ResizeObserver(() => {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;

  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});

resizeObserver.observe(viewer);

// Render loop, including smooth camera focusing.
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  for (const mesh of meshes) {
    const base = originalScales.get(mesh);
    if (!base) continue;
    const targetScale = mesh === hoveredBone ? 1.045 : 1;
    mesh.scale.lerp(base.clone().multiplyScalar(targetScale), Math.min(delta * 12, 1));
  }

  if (hoverParticles) {
    const age = (performance.now() - particleStartedAt) / 1000;
    hoverParticles.material.opacity = age < 0.12 ? age / 0.12 : Math.max(0, 1 - (age - 0.12) / 0.8);
    hoverParticles.rotation.y += delta * 0.18;
    if (age > 0.92) {
      scene.remove(hoverParticles);
      hoverParticles.geometry.dispose();
      hoverParticles.material.dispose();
      hoverParticles = null;
      if (hoveredBone?.visible) showHoverParticles(hoveredBone);
    }
  }

  if (cameraMotion) {
    const now = performance.now();
    const rawProgress = Math.min(
      (now - cameraMotion.startTime) / cameraMotion.duration,
      1
    );

    // Smooth ease-in/ease-out.
    const t = rawProgress * rawProgress * (3 - 2 * rawProgress);

    camera.position.lerpVectors(
      cameraMotion.fromPosition,
      cameraMotion.toPosition,
      t
    );

    controls.target.lerpVectors(
      cameraMotion.fromTarget,
      cameraMotion.toTarget,
      t
    );

    if (rawProgress >= 1) {
      cameraMotion = null;
    }
  }

  controls.update();
  renderer.render(scene, camera);
});

// Clean up cloned highlight materials if the page is unloaded.
window.addEventListener("beforeunload", () => {
  for (const material of highlightMaterials.values()) {
    const list = Array.isArray(material) ? material : [material];
    list.forEach((item) => item.dispose());
  }

  renderer.dispose();
});
