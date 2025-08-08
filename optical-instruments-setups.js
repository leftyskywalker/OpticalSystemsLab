import { createLens, createDetector, createReflectiveGrating, createSphericalMirror, createOpticalSlit } from './optics-components.js';

export const instrumentSetups = {
    'czerny-turner': {
        name: 'Czerny-Turner Spectrometer',
        init: function({ opticalElements, elementGroup, traceRaysCallback, envMap, simulationConfig, laserSource }) {
            // --- Design Calculations based on the provided guide ---
            const phi_deg = 30.0;
            const G = 1000; // lines/mm
            const lambda_c = 550; // nm, center wavelength (400-700nm range)
            
            const phi_rad = phi_deg * (Math.PI / 180);

            // Calculate alpha and beta
            const alpha_rad = Math.asin((lambda_c * G * 1e-6) / (2 * Math.cos(phi_rad / 2))) - (phi_rad / 2);
            const beta_rad = phi_rad - alpha_rad;
            
            // Assume 1:1 magnification (M=1) and a detector width of 5mm (0.5 cm)
            const detectorWidth = 0.5; // cm
            const wavelengthRange = 300; // nm (700 - 400)
            const M = 1.0;

            const Lf_cm = (detectorWidth * Math.cos(beta_rad)) / (G * wavelengthRange * 1e-7); // 1e-7 converts G*lambda to cm
            const Lc_cm = Lf_cm * (Math.cos(alpha_rad) / (M * Math.cos(beta_rad)));

            // --- Component Creation and Positioning ---
            
            laserSource.position.set(-12, 0, 0);
            const slitPos = { x: -10, y: 0, z: 0 };
            const slitData = createOpticalSlit('slit1', slitPos, { slitWidth: 50 / 10000, slitHeight: 1.2 }, elementGroup);

            const collimatingMirrorPos = { x: slitPos.x + Lc_cm, y: 0, z: 0 };
            const collimatingMirrorAngle_deg = -20;
            const collimatingMirrorData = createSphericalMirror('collimating_mirror', collimatingMirrorPos, -2 * Lc_cm, collimatingMirrorAngle_deg, envMap, elementGroup);

            const gratingPos = { x: slitPos.x + Lc_cm - (10 * Math.cos(2 *collimatingMirrorAngle_deg * (Math.PI / 180))), y: 0, z: -10 * Math.sin(2 *collimatingMirrorAngle_deg * (Math.PI / 180))};
            const gratingAngle_deg = (alpha_rad * (180 / Math.PI)) + 2 * collimatingMirrorAngle_deg;
            const gratingData = createReflectiveGrating('grating', gratingPos, gratingAngle_deg, { linesPerMM: G, lineOrientation: 'vertical' }, envMap, elementGroup);
            gratingData.mesh.rotateY(Math.PI);

            const focusingMirrorPos = { x: gratingPos.x - (10 * Math.cos((gratingAngle_deg - 33.36) * (Math.PI / 180))), y: 0, z: gratingPos.z + (10 * Math.sin((gratingAngle_deg - 33.36) * (Math.PI / 180))) };
            const focusingMirrorAngle_deg = -90;
            const focusingMirrorData = createSphericalMirror('focusing_mirror', focusingMirrorPos, -2 * Lf_cm, focusingMirrorAngle_deg, envMap, elementGroup);
            
            const detectorPos = { x: focusingMirrorPos.x, y: 0, z: focusingMirrorPos.z + Lf_cm };
            const detectorData = createDetector('detector1', detectorPos, elementGroup);
            detectorData.mesh.rotation.y = Math.PI;
            
            opticalElements.push(
                slitData.element, 
                collimatingMirrorData.element, 
                gratingData.element, 
                focusingMirrorData.element, 
                detectorData.element
            );

            document.getElementById('setup-controls').innerHTML = `<div class="setup-title">Crossed Czerny-Turner</div><p>This is a pre-configured setup.</p>`;
            
            simulationConfig.rayCount = 100;
            document.getElementById('ray-count-slider').value = 100;
            document.getElementById('ray-count-value').textContent = 100;
        }
    },
    'camera-laser': {
        name: 'Camera (Laser)',
        init: function({ opticalElements, elementGroup, traceRaysCallback, laserSource }) {
            const lensData = createLens('lens1', {x: 0, y: 0, z: 0}, 5, elementGroup);
            const detectorData = createDetector('detector1', {x: 8, y: 0, z: 0}, elementGroup);
            opticalElements.push(lensData.element, detectorData.element);

            document.getElementById('pixel-viewer-container').style.display = 'block';

            const controlsDiv = document.getElementById('setup-controls');
            controlsDiv.innerHTML = `
                <div class="control-row"><label for="laser-y">Laser Vertical Pos:</label><input type="range" id="laser-y" min="-1.5" max="1.5" value="0" step="0.1"><span id="laser-y-value">0.0 cm</span></div>
                <div class="control-row"><label for="laser-z">Laser Horizontal Pos:</label><input type="range" id="laser-z" min="-1.5" max="1.5" value="0" step="0.1"><span id="laser-z-value">0.0 cm</span></div>
                <hr>
                <div class="setup-title">Lens</div>
                <div class="control-row"><label for="lens-x">Position (X):</label><input type="range" id="lens-x" min="-5" max="5" value="0" step="0.1"><span id="lens-x-value">0.0 cm</span></div>
                <div class="control-row"><label for="focal-length">Focal Length:</label><input type="range" id="focal-length" min="1" max="10" value="5" step="0.1"><span id="focal-length-value">5.0 cm</span></div>
                <hr>
                <div class="setup-title">Detector</div>
                <div class="control-row"><label for="detector-x">Position (X):</label><input type="range" id="detector-x" min="1" max="15" value="8" step="0.1"><span id="detector-x-value">8.0 cm</span></div>
                <div class="control-row"><button id="autofocus-btn" style="width: 100%;">Auto-Focus</button></div>
            `;

            const focalLengthSlider = document.getElementById('focal-length');
            const focalLengthValue = document.getElementById('focal-length-value');

            document.getElementById('laser-y').addEventListener('input', (e) => { 
                laserSource.position.y = parseFloat(e.target.value); 
                document.getElementById('laser-y-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm'; 
                traceRaysCallback(); 
            });
            document.getElementById('laser-z').addEventListener('input', (e) => { 
                laserSource.position.z = parseFloat(e.target.value); 
                document.getElementById('laser-z-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm'; 
                traceRaysCallback(); 
            });
            document.getElementById('lens-x').addEventListener('input', (e) => { 
                lensData.mesh.position.x = parseFloat(e.target.value); 
                document.getElementById('lens-x-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm'; 
                traceRaysCallback(); 
            });
            focalLengthSlider.addEventListener('input', (e) => { 
                lensData.element.focalLength = parseFloat(e.target.value); 
                focalLengthValue.textContent = parseFloat(e.target.value).toFixed(1) + ' cm'; 
                traceRaysCallback(); 
            });
            document.getElementById('detector-x').addEventListener('input', (e) => { 
                detectorData.mesh.position.x = parseFloat(e.target.value); 
                document.getElementById('detector-x-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm'; 
                traceRaysCallback(); 
            });
            document.getElementById('autofocus-btn').addEventListener('click', () => {
                const so = Math.abs(laserSource.position.x - lensData.mesh.position.x);
                const si = Math.abs(detectorData.mesh.position.x - lensData.mesh.position.x);
                const f = 1 / (1 / so + 1 / si);
                
                lensData.element.focalLength = f;
                focalLengthSlider.value = f;
                focalLengthValue.textContent = f.toFixed(1) + ' cm';
                traceRaysCallback();
            });
        }
    },
    'camera-image-object': {
        name: 'Camera (Image Object)',
        init: function({ opticalElements, elementGroup, traceRaysCallback, imageObject, loadImageCallback }) {
            const lensData = createLens('lens1', {x: 0, y: 0, z: 0}, 5, elementGroup);
            const detectorData = createDetector('detector1', {x: 8, y: 0, z: 0}, elementGroup);
            opticalElements.push(lensData.element, detectorData.element);

            document.getElementById('pixel-viewer-container').style.display = 'block';

            const controlsDiv = document.getElementById('setup-controls');
            controlsDiv.innerHTML = `
                <div class="setup-title">Image Object</div>
                <div class="control-row">
                    <label for="image-select">Image Source:</label>
                    <select id="image-select">
                        <option value="color-chart" selected>Color Chart</option>
                        <option value="dolphin">Dolphin</option>
                        <option value="cityscape">Cityscape</option>
                        <option value="building">Building</option>
                        <option value="boardwalk">Boardwalk</option>
                        <option value="corals">Corals</option>
                        <option value="lagoon">Lagoon</option>
                    </select>
                </div>
                <div class="control-row"><label for="image-x">Position (X):</label><input type="range" id="image-x" min="-15" max="-1" value="-10" step="0.1"><span id="image-x-value">-10.0 cm</span></div>
                <hr>
                <div class="setup-title">Lens</div>
                <div class="control-row"><label for="lens-x">Position (X):</label><input type="range" id="lens-x" min="-5" max="5" value="0" step="0.1"><span id="lens-x-value">0.0 cm</span></div>
                <div class="control-row"><label for="focal-length">Focal Length:</label><input type="range" id="focal-length" min="1" max="10" value="5" step="0.1"><span id="focal-length-value">5.0 cm</span></div>
                <hr>
                <div class="setup-title">Detector</div>
                <div class="control-row"><label for="detector-x">Position (X):</label><input type="range" id="detector-x" min="1" max="15" value="8" step="0.1"><span id="detector-x-value">8.0 cm</span></div>
                <div class="control-row"><button id="autofocus-btn" style="width: 100%;">Auto-Focus</button></div>
            `;
            
            document.getElementById('image-select').addEventListener('change', (e) => {
                if (loadImageCallback) {
                    loadImageCallback(e.target.value);
                }
            });

            document.getElementById('image-x').addEventListener('input', (e) => { 
                imageObject.position.x = parseFloat(e.target.value); 
                document.getElementById('image-x-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm'; 
                traceRaysCallback(); 
            });

            const focalLengthSlider = document.getElementById('focal-length');
            const focalLengthValue = document.getElementById('focal-length-value');

            document.getElementById('lens-x').addEventListener('input', (e) => { 
                lensData.mesh.position.x = parseFloat(e.target.value); 
                document.getElementById('lens-x-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm'; 
                traceRaysCallback(); 
            });
            focalLengthSlider.addEventListener('input', (e) => { 
                lensData.element.focalLength = parseFloat(e.target.value); 
                focalLengthValue.textContent = parseFloat(e.target.value).toFixed(1) + ' cm'; 
                traceRaysCallback(); 
            });
            document.getElementById('detector-x').addEventListener('input', (e) => { 
                detectorData.mesh.position.x = parseFloat(e.target.value); 
                document.getElementById('detector-x-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm'; 
                traceRaysCallback(); 
            });
            document.getElementById('autofocus-btn').addEventListener('click', () => {
                const so = Math.abs(imageObject.position.x - lensData.mesh.position.x);
                const si = Math.abs(detectorData.mesh.position.x - lensData.mesh.position.x);
                const f = 1 / (1 / so + 1 / si);

                lensData.element.focalLength = f;
                focalLengthSlider.value = f;
                focalLengthValue.textContent = f.toFixed(1) + ' cm';
                traceRaysCallback();
            });
        }
    },
};
