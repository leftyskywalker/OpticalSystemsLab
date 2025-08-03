import { traceRays } from './optics-core.js';
import { setups } from './optical-setups.js';

// === SCENE SETUP ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 12);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// === SETUP FOR REAL-TIME REFLECTIONS ===
const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
const cubeCamera = new THREE.CubeCamera(1, 1000, cubeRenderTarget);
scene.add(cubeCamera);


// === CONTROLS ===
const orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;

// === LIGHTING ===
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// === APPLICATION STATE & SCENE OBJECTS ===
let opticalElements = [];
const elementGroup = new THREE.Group();
const rayGroup = new THREE.Group();
scene.add(elementGroup, rayGroup);

const laserSource = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 2.5, 1),
    new THREE.MeshStandardMaterial({ color: 0x808080 })
);
laserSource.position.set(-10, 0, 0);
scene.add(laserSource);

// Central config for simulation parameters
const simulationConfig = {
    wavelength: 'white',
    laserPattern: 'line',
    sensorType: 'grayscale',
    rayCount: 100 // NEW: Added rayCount to config
};

// === PIXEL VIEWER STATE ===
const pixelCanvas = document.getElementById('pixel-canvas');
const pixelCtx = pixelCanvas.getContext('2d');
const pixelGridSize = 50;

// === UI ELEMENT REFERENCES ===
const wavelengthSelect = document.getElementById('wavelength-select');
const wavelengthSliderContainer = document.getElementById('wavelength-slider-container');
const wavelengthSlider = document.getElementById('wavelength-slider');
const wavelengthValue = document.getElementById('wavelength-value');
const laserPatternSelect = document.getElementById('laser-pattern-select');
const sensorTypeContainer = document.getElementById('sensor-type-container');
const sensorTypeSelect = document.getElementById('sensor-type-select');
// NEW: References for ray count controls
const rayCountSlider = document.getElementById('ray-count-slider');
const rayCountValue = document.getElementById('ray-count-value');

// === CORE APPLICATION LOGIC ===

function updateSimulation() {
    traceRays({
        rayGroup,
        opticalElements,
        laserSource,
        pixelCtx,
        pixelCanvas,
        pixelGridSize,
        wavelength: simulationConfig.wavelength,
        laserPattern: simulationConfig.laserPattern,
        sensorType: simulationConfig.sensorType,
        rayCount: simulationConfig.rayCount, // NEW: Pass rayCount to the tracer
        setupKey: document.getElementById('setup-select').value
    });
}

function clearSetup() {
    opticalElements = [];
    while(elementGroup.children.length > 0){
        const obj = elementGroup.children[0];
        elementGroup.remove(obj);
        if(obj.geometry) obj.geometry.dispose();
        if(obj.material) obj.material.dispose();
        if (obj.children.length > 0) {
            const child = obj.children[0];
            if(child.geometry) child.geometry.dispose();
            if(child.material) child.material.dispose();
        }
    }
    document.getElementById('setup-controls').innerHTML = '';
    document.getElementById('pixel-viewer-container').style.display = 'none';
    sensorTypeContainer.style.display = 'none';
    laserSource.position.y = 0;
    laserSource.position.z = 0;
}

function switchSetup(setupKey) {
    clearSetup();
    if (setupKey === 'camera-sensor') {
        sensorTypeContainer.style.display = 'flex';
    }
    const setup = setups[setupKey];
    if (setup) {
        setup.init({
            opticalElements,
            elementGroup,
            traceRaysCallback: updateSimulation,
            laserSource,
            envMap: cubeCamera.renderTarget.texture,
            simulationConfig
        });
    }
    updateSimulation();
}

// === EVENT LISTENERS & INITIALIZATION ===
document.getElementById('setup-select').addEventListener('change', (e) => switchSetup(e.target.value));

wavelengthSelect.addEventListener('change', (e) => {
    if (e.target.value === 'single') {
        wavelengthSliderContainer.style.display = 'flex';
        simulationConfig.wavelength = parseInt(wavelengthSlider.value);
    } else {
        wavelengthSliderContainer.style.display = 'none';
        simulationConfig.wavelength = 'white';
    }
    updateSimulation();
});

wavelengthSlider.addEventListener('input', (e) => {
    const wl = parseInt(e.target.value);
    simulationConfig.wavelength = wl;
    wavelengthValue.textContent = `${wl} nm`;
    updateSimulation();
});

laserPatternSelect.addEventListener('change', (e) => {
    simulationConfig.laserPattern = e.target.value;
    updateSimulation();
});

// NEW: Event listener for the ray count slider
rayCountSlider.addEventListener('input', (e) => {
    const count = parseInt(e.target.value);
    simulationConfig.rayCount = count;
    rayCountValue.textContent = count;
    updateSimulation();
});

sensorTypeSelect.addEventListener('change', (e) => {
    simulationConfig.sensorType = e.target.value;
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

    const mirror = elementGroup.children.find(c => c.name === 'mirror1' || c.name.startsWith('spherical_mirror'));

    if (mirror) {
        mirror.visible = false;
        rayGroup.visible = false;
        cubeCamera.position.copy(mirror.position);
        cubeCamera.update(renderer, scene);
        mirror.visible = true;
        rayGroup.visible = true;
    }

    scene.environment = cubeCamera.renderTarget.texture;
    orbitControls.update();
    renderer.render(scene, camera);
}

// --- START THE APP ---
wavelengthSelect.dispatchEvent(new Event('change'));
switchSetup('single-lens');
animate();