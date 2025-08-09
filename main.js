import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { traceRays } from './optics-core.js';
import { componentSetups } from './optical-components-setups.js';
import { instrumentSetups } from './optical-instruments-setups.js';

// Combine all setup configurations into a single object for easy access.
const setups = { ...componentSetups, ...instrumentSetups };

// === SCENE SETUP ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 12);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// === SETUP FOR REAL-TIME REFLECTIONS (for mirrors, etc.) ===
const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
const cubeCamera = new THREE.CubeCamera(1, 1000, cubeRenderTarget);
scene.add(cubeCamera);

// === CONTROLS ===
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;

// === LIGHTING ===
const ambientLight = new THREE.AmbientLight(0xffdcb1, 0.5); // Warm ambient light with softer intensity
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Brighter main light
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// === APPLICATION STATE & SCENE OBJECTS ===
let opticalElements = []; // Holds the logical optical components for ray tracing.
const elementGroup = new THREE.Group(); // Holds the visible 3D meshes of all components.
const rayGroup = new THREE.Group(); // Holds the line objects representing light rays.
scene.add(elementGroup, rayGroup);

// A simple box used as a placeholder light source for ray tracing setups.
const laserSource = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 2.5, 1),
    new THREE.MeshStandardMaterial({ color: 0x808080 })
);
laserSource.position.set(-10, 0, 0);
scene.add(laserSource);

// --- Image Plane Object & Loading Logic (for camera simulation) ---
const textureLoader = new THREE.TextureLoader();
const imageSources = {
    'color-chart': 'https://raw.githubusercontent.com/leftyskywalker/OpticalSystemsLab/main/Images/ColorChart.png',
    'dolphin': 'https://raw.githubusercontent.com/leftyskywalker/OpticalSystemsLab/main/Images/Dolphin.jpeg',
    'cityscape': 'https://raw.githubusercontent.com/leftyskywalker/OpticalSystemsLab/main/Images/Cityscape.jpeg',
    'building': 'https://raw.githubusercontent.com/leftyskywalker/OpticalSystemsLab/main/Images/Building.jpeg',
    'boardwalk': 'https://raw.githubusercontent.com/leftyskywalker/OpticalSystemsLab/main/Images/Boardwalk.jpeg',
    'corals': 'https://raw.githubusercontent.com/leftyskywalker/OpticalSystemsLab/main/Images/Corals.jpeg',
    'lagoon': 'https://raw.githubusercontent.com/leftyskywalker/OpticalSystemsLab/main/Images/Lagoon.jpeg'
};
const imageObject = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.DoubleSide })
);
imageObject.position.set(-10, 0, 0);
imageObject.rotation.y = Math.PI / 2;
imageObject.visible = false;
scene.add(imageObject);

function loadImage(sourceKey) {
    const imageUrl = imageSources[sourceKey];
    if (!imageUrl) return;
    textureLoader.load(imageUrl, (texture) => {
        const aspectRatio = texture.image.width / texture.image.height;
        const planeHeight = 4;
        imageObject.geometry.dispose();
        imageObject.geometry = new THREE.PlaneGeometry(planeHeight * aspectRatio, planeHeight);
        imageObject.material.map = texture;
        imageObject.material.needsUpdate = true;
        updateSimulation();
    });
}

// Central config for simulation parameters
const simulationConfig = {
    wavelength: 'white',
    laserPattern: 'line',
    sensorType: 'grayscale',
    rayCount: 100,
    backgroundColor: 'white'
};

// === UI & CORE LOGIC ===
const pixelCanvas = document.getElementById('pixel-canvas');
const pixelCtx = pixelCanvas.getContext('2d');

function updateSimulation() {
    requestAnimationFrame(() => {
        scene.updateMatrixWorld(true);
        // Only trace rays if there are functional optical elements present.
        if (opticalElements.length > 0) {
            traceRays({
                rayGroup, opticalElements, laserSource, imageObject, pixelCtx, pixelCanvas,
                pixelGridSize: 50, ...simulationConfig,
                setupKey: document.getElementById('setup-select').value
            });
        }
    });
}

function clearSetup() {
    opticalElements = [];
    const disposeObject = (obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(mat => mat.dispose());
            else obj.material.dispose();
        }
    };
    while (elementGroup.children.length > 0) {
        const obj = elementGroup.children[0];
        obj.traverse(disposeObject);
        elementGroup.remove(obj);
    }
    while (rayGroup.children.length > 0) {
        const obj = rayGroup.children[0];
        rayGroup.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
    }
    document.getElementById('setup-controls').innerHTML = '';
}

function switchSetup(setupKey) {
    clearSetup();

    const isLaserModel = setupKey === 'laser-model';
    const isImageObject = setupKey === 'camera-image-object';
    const hasSensor = setupKey.startsWith('camera') || setupKey === 'czerny-turner';

    // Toggle UI visibility based on the selected setup.
    document.getElementById('wavelength-controls').style.display = (isLaserModel || isImageObject) ? 'none' : 'flex';
    document.getElementById('laser-pattern-controls').style.display = (isLaserModel || isImageObject) ? 'none' : 'flex';
    document.getElementById('ray-count-slider').parentElement.style.display = (isLaserModel || isImageObject) ? 'none' : 'flex';
    document.getElementById('sensor-type-container').style.display = hasSensor ? 'flex' : 'none';
    document.getElementById('pixel-viewer-container').style.display = hasSensor ? 'block' : 'none';
    
    // Manage visibility of scene objects.
    laserSource.visible = !isLaserModel && !isImageObject; // Hide placeholder if model is shown
    imageObject.visible = isImageObject;
    rayGroup.visible = !isLaserModel; // Hide rays for visual-only setups

    // IMPORTANT: Update the cube camera *after* changing object visibility.
    // This prevents the camera image from "leaking" into other setups' reflections.
    cubeCamera.update(renderer, scene);

    const setup = setups[setupKey];
    if (setup) {
        setup.init({
            opticalElements, elementGroup, traceRaysCallback: updateSimulation,
            laserSource, imageObject, envMap: cubeRenderTarget.texture,
            simulationConfig, loadImageCallback: loadImage
        });
    }
    updateSimulation();
}

// === EVENT LISTENERS & INITIALIZATION ===
document.getElementById('setup-select').addEventListener('change', (e) => switchSetup(e.target.value));
document.getElementById('wavelength-select').addEventListener('change', (e) => {
    simulationConfig.wavelength = (e.target.value === 'single') ? parseInt(document.getElementById('wavelength-slider').value) : 'white';
    document.getElementById('wavelength-slider-container').style.display = (e.target.value === 'single') ? 'flex' : 'none';
    updateSimulation();
});
document.getElementById('wavelength-slider').addEventListener('input', (e) => {
    simulationConfig.wavelength = parseInt(e.target.value);
    document.getElementById('wavelength-value').textContent = `${simulationConfig.wavelength} nm`;
    updateSimulation();
});
document.getElementById('laser-pattern-select').addEventListener('change', (e) => {
    simulationConfig.laserPattern = e.target.value;
    updateSimulation();
});
document.getElementById('ray-count-slider').addEventListener('input', (e) => {
    simulationConfig.rayCount = parseInt(e.target.value);
    document.getElementById('ray-count-value').textContent = simulationConfig.rayCount;
    updateSimulation();
});
document.getElementById('sensor-type-select').addEventListener('change', (e) => {
    simulationConfig.sensorType = e.target.value;
    updateSimulation();
});
document.getElementById('bg-toggle').addEventListener('change', (e) => {
    const isDarkMode = e.target.checked;
    simulationConfig.backgroundColor = isDarkMode ? 'black' : 'white';
    scene.background.set(simulationConfig.backgroundColor === 'black' ? 0x000000 : 0xffffff);
    document.body.classList.toggle('dark-mode', isDarkMode);
    
    // Refresh the environment map for mirrors when the background changes
    cubeCamera.update(renderer, scene);

    updateSimulation();
});
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    updateSimulation();
});

function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    renderer.render(scene, camera);
}

// --- START THE APP ---
// Set initial dark mode state based on checkbox
const bgToggle = document.getElementById('bg-toggle');
if (bgToggle.checked) {
    document.body.classList.add('dark-mode');
    scene.background.set(0x000000);
    simulationConfig.backgroundColor = 'black';
}

loadImage('color-chart');
switchSetup('single-lens');
animate();
