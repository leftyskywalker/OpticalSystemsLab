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

// --- Image Plane Object & Loading Logic ---
const textureLoader = new THREE.TextureLoader();
const imageSources = {
    'color-chart': 'https://raw.githubusercontent.com/leftyskywalker/OpticalSystemsLab/main/Images/ColorChart.png',
    'dolphin': 'https://raw.githubusercontent.com/leftyskywalker/OpticalSystemsLab/main/Images/Dolphin.jpeg'
};

// Create a placeholder mesh. It will be updated when the texture loads.
const imageObject = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1), 
    new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.DoubleSide })
);
imageObject.position.set(-10, 0, 0);
imageObject.rotation.y = Math.PI / 2;
imageObject.visible = false;
scene.add(imageObject);

// NEW: Function to load and resize the selected image
function loadImage(sourceKey) {
    const imageUrl = imageSources[sourceKey];
    if (!imageUrl) {
        console.error("Invalid image source key:", sourceKey);
        return;
    }
    
    // Show a placeholder color while loading
    imageObject.material = new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.DoubleSide });

    textureLoader.load(imageUrl, (loadedTexture) => {
        const image = loadedTexture.image;
        const aspectRatio = image.width / image.height;
        
        // Set a fixed height for the plane and calculate the width dynamically.
        // This automatically scales the plane to match the source image aspect ratio.
        const planeHeight = 4;
        const planeWidth = planeHeight * aspectRatio;
        
        imageObject.geometry.dispose(); 
        imageObject.geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
        imageObject.material = new THREE.MeshBasicMaterial({ map: loadedTexture, side: THREE.DoubleSide });
        
        updateSimulation();
    },
    undefined, // onProgress callback not needed
    (error) => {
        console.error('An error occurred loading the texture:', error);
        imageObject.material = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide }); // Show red on error
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

// === PIXEL VIEWER STATE ===
const pixelCanvas = document.getElementById('pixel-canvas');
const pixelCtx = pixelCanvas.getContext('2d');
const pixelGridSize = 50;

// === UI ELEMENT REFERENCES ===
const wavelengthControls = document.getElementById('wavelength-controls');
const wavelengthSelect = document.getElementById('wavelength-select');
const wavelengthSliderContainer = document.getElementById('wavelength-slider-container');
const wavelengthSlider = document.getElementById('wavelength-slider');
const wavelengthValue = document.getElementById('wavelength-value');
const laserPatternControls = document.getElementById('laser-pattern-controls');
const laserPatternSelect = document.getElementById('laser-pattern-select');
const sensorTypeContainer = document.getElementById('sensor-type-container');
const sensorTypeSelect = document.getElementById('sensor-type-select');
const rayCountSlider = document.getElementById('ray-count-slider');
const rayCountValue = document.getElementById('ray-count-value');
const backgroundToggle = document.getElementById('bg-toggle');

// === CORE APPLICATION LOGIC ===

function updateSimulation() {
    // A small delay to ensure the new image texture is ready for the GPU before tracing
    requestAnimationFrame(() => {
        scene.updateMatrixWorld(true);
        traceRays({
            rayGroup,
            opticalElements,
            laserSource,
            imageObject,
            pixelCtx,
            pixelCanvas,
            pixelGridSize,
            wavelength: simulationConfig.wavelength,
            laserPattern: simulationConfig.laserPattern,
            sensorType: simulationConfig.sensorType,
            rayCount: simulationConfig.rayCount,
            backgroundColor: simulationConfig.backgroundColor,
            setupKey: document.getElementById('setup-select').value
        });
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
    // Hide all sources and restore all controls to their default visible state
    laserSource.visible = false;
    imageObject.visible = false;
    wavelengthControls.style.display = 'flex';
    laserPatternControls.style.display = 'flex';
    rayCountSlider.parentElement.style.display = 'flex';


    document.getElementById('setup-controls').innerHTML = '';
    document.getElementById('pixel-viewer-container').style.display = 'none';
    sensorTypeContainer.style.display = 'none';
    laserSource.position.y = 0;
    laserSource.position.z = 0;
}

function switchSetup(setupKey) {
    clearSetup();
    
    // Show/hide UI and sources based on setup
    if (setupKey.startsWith('camera')) {
        sensorTypeContainer.style.display = 'flex';
    }

    if (setupKey === 'camera-image-object') {
        imageObject.visible = true;
        // Hide controls that are not relevant for this setup
        wavelengthControls.style.display = 'none';
        laserPatternControls.style.display = 'none';
        rayCountSlider.parentElement.style.display = 'none';
    } else {
        laserSource.visible = true;
    }

    const setup = setups[setupKey];
    if (setup) {
        setup.init({
            opticalElements,
            elementGroup,
            traceRaysCallback: updateSimulation,
            laserSource,
            imageObject,
            envMap: cubeCamera.renderTarget.texture,
            simulationConfig,
            loadImageCallback: loadImage // Pass the loadImage function to the setup
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

backgroundToggle.addEventListener('change', (e) => {
    simulationConfig.backgroundColor = e.target.checked ? 'black' : 'white';
    scene.background.set(simulationConfig.backgroundColor === 'black' ? 0x000000 : 0xffffff);
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
loadImage('color-chart'); // Load the default image initially
wavelengthSelect.dispatchEvent(new Event('change'));
switchSetup('single-lens');
animate();