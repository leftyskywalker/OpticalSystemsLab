import { createLens, createDetector, createReflectiveGrating, createSphericalMirror, createOpticalSlit } from './optics-components.js';

export const instrumentSetups = {
    'czerny-turner': {
        name: 'Czerny-Turner Spectrometer',
        init: function({ opticalElements, elementGroup, traceRaysCallback, envMap, simulationConfig, laserSource }) {
            
            // --- Component Creation (one time) ---
            laserSource.position.set(-12, 0, 0);
            const slitPos = { x: -10, y: 0, z: 0 };
            const slitData = createOpticalSlit('slit1', slitPos, { slitWidth: 50 / 10000, slitHeight: 1.2 }, elementGroup);

            const collimatingMirrorData = createSphericalMirror('collimating_mirror', {x:0, y:0, z:0}, -20, 0, envMap, elementGroup);
            const gratingData = createReflectiveGrating('grating', {x:0, y:0, z:0}, 0, { linesPerMM: 1000, lineOrientation: 'vertical' }, envMap, elementGroup);
            gratingData.mesh.rotateY(Math.PI);
            const focusingMirrorData = createSphericalMirror('focusing_mirror', {x:0, y:0, z:0}, -20, 0, envMap, elementGroup);
            const detectorData = createDetector('detector1', {x:0, y:0, z:0}, elementGroup);

            opticalElements.push(
                slitData.element, 
                collimatingMirrorData.element, 
                gratingData.element, 
                focusingMirrorData.element, 
                detectorData.element
            );

            // --- UI Control Setup ---
            const controlsDiv = document.getElementById('setup-controls');
            controlsDiv.innerHTML = `
                <div class="setup-title">Crossed Czerny-Turner</div>
                <p>An adjustable spectrometer setup. Change the angle and grating to see how it affects the light path.</p>
                <div class="control-row">
                    <label for="cz-collimating-angle">Collimating Angle:</label>
                    <input type="range" id="cz-collimating-angle" min="-45" max="-5" value="-20" step="1">
                    <span id="cz-collimating-angle-value">-20&deg;</span>
                </div>
                <div class="control-row">
                    <label for="cz-grating-density">Grating Density (L/mm):</label>
                    <input type="range" id="cz-grating-density" min="300" max="2400" value="1000" step="50">
                    <span id="cz-grating-density-value">1000 L/mm</span>
                </div>
                <div class="control-row">
                    <label for="cz-grating-distance">Grating Distance:</label>
                    <input type="range" id="cz-grating-distance" min="5" max="20" value="10" step="0.5">
                    <span id="cz-grating-distance-value">10.0 cm</span>
                </div>
                <div class="control-row">
                    <label for="cz-focusing-distance">Focusing Distance:</label>
                    <input type="range" id="cz-focusing-distance" min="5" max="20" value="10" step="0.5">
                    <span id="cz-focusing-distance-value">10.0 cm</span>
                </div>
                <div class="control-row">
                    <label for="cz-focusing-angle">Focusing Angle:</label>
                    <input type="range" id="cz-focusing-angle" min="-90" max="0" value="10" step="1">
                    <span id="cz-focusing-angle-value">10&deg;</span>
                </div>
            `;

            const angleSlider = document.getElementById('cz-collimating-angle');
            const densitySlider = document.getElementById('cz-grating-density');
            const gratingDistSlider = document.getElementById('cz-grating-distance');
            const focusingDistSlider = document.getElementById('cz-focusing-distance');
            const focusingAngleSlider = document.getElementById('cz-focusing-angle');
            
            // --- Spectrometer Update Function ---
            const updateSpectrometerLayout = () => {
                const collimatingMirrorAngle_deg = parseFloat(angleSlider.value);
                const G = parseInt(densitySlider.value);
                const gratingDistance = parseFloat(gratingDistSlider.value);
                const focusingDistance = parseFloat(focusingDistSlider.value);
                const focusingMirrorAngle_deg = parseFloat(focusingAngleSlider.value);

                document.getElementById('cz-collimating-angle-value').innerHTML = `${collimatingMirrorAngle_deg}&deg;`;
                document.getElementById('cz-grating-density-value').textContent = `${G} L/mm`;
                document.getElementById('cz-grating-distance-value').textContent = `${gratingDistance.toFixed(1)} cm`;
                document.getElementById('cz-focusing-distance-value').textContent = `${focusingDistance.toFixed(1)} cm`;
                document.getElementById('cz-focusing-angle-value').innerHTML = `${focusingMirrorAngle_deg}&deg;`;
                
                const phi_deg = 30.0;
                const lambda_c = 550;
                const phi_rad = phi_deg * (Math.PI / 180);

                let alpha_rad, beta_rad;
                const asin_arg = (lambda_c * G * 1e-6) / (2 * Math.cos(phi_rad / 2));
                if (Math.abs(asin_arg) > 1) {
                    console.warn("Cannot calculate grating angle - invalid configuration.");
                    return;
                }
                alpha_rad = Math.asin(asin_arg) - (phi_rad / 2);
                beta_rad = phi_rad - alpha_rad;
                
                const detectorWidth = 0.5;
                const wavelengthRange = 300;
                const M = 1.0;

                const Lf_cm = (detectorWidth * Math.cos(beta_rad)) / (G * wavelengthRange * 1e-7);
                const Lc_cm = Lf_cm * (Math.cos(alpha_rad) / (M * Math.cos(beta_rad)));
                
                // 1. Collimating Mirror
                const collimatingMirrorPos = { x: slitPos.x + Lc_cm, y: 0, z: 0 };
                collimatingMirrorData.mesh.position.set(collimatingMirrorPos.x, collimatingMirrorPos.y, collimatingMirrorPos.z);
                collimatingMirrorData.mesh.rotation.y = -Math.PI / 2 - collimatingMirrorAngle_deg * (Math.PI / 180);
                collimatingMirrorData.element.radius = -2 * Lc_cm;

                // 2. Grating
                const gratingPos = { 
                    x: collimatingMirrorPos.x - gratingDistance * Math.cos(2 * collimatingMirrorAngle_deg * (Math.PI / 180)), 
                    y: 0, 
                    z: collimatingMirrorPos.z - gratingDistance * Math.sin(2 * collimatingMirrorAngle_deg * (Math.PI / 180))
                };
                const gratingAngle_deg = (alpha_rad * (180 / Math.PI)) + 2 * collimatingMirrorAngle_deg;
                
                gratingData.element.linesPerMM = G;
                gratingData.mesh.position.set(gratingPos.x, gratingPos.y, gratingPos.z);
                gratingData.mesh.rotation.y = -Math.PI / 2 - (gratingAngle_deg * (Math.PI / 180)) + Math.PI;

                // 3. Focusing Mirror
                const beta_deg = beta_rad * (180 / Math.PI); 
                const diffractedBeamAngle_deg = gratingAngle_deg + beta_deg; // Use -1 order
                const diffractedBeamAngle_rad = diffractedBeamAngle_deg * (Math.PI / 180);

                const focusingMirrorPos = { 
                    x: gratingPos.x + focusingDistance * Math.cos(diffractedBeamAngle_rad), 
                    y: 0, 
                    z: gratingPos.z + focusingDistance * Math.sin(diffractedBeamAngle_rad) 
                };

                focusingMirrorData.mesh.position.set(focusingMirrorPos.x, focusingMirrorPos.y, focusingMirrorPos.z);
                focusingMirrorData.mesh.rotation.y = -Math.PI / 2 - focusingMirrorAngle_deg * (Math.PI / 180);
                focusingMirrorData.element.radius = -2 * Lf_cm;

                // 4. Detector (Corrected Position & Orientation)
                const incidentToFocusingDir = new THREE.Vector3().subVectors(
                    new THREE.Vector3(focusingMirrorPos.x, focusingMirrorPos.y, focusingMirrorPos.z),
                    new THREE.Vector3(gratingPos.x, gratingPos.y, gratingPos.z)
                ).normalize();

                const mirrorNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(focusingMirrorData.mesh.quaternion);
                const reflectedDir = incidentToFocusingDir.clone().reflect(mirrorNormal);

                const detectorPos = new THREE.Vector3(focusingMirrorPos.x, focusingMirrorPos.y, focusingMirrorPos.z)
                    .add(reflectedDir.clone().multiplyScalar(Lf_cm));

                detectorData.mesh.position.copy(detectorPos);
                detectorData.mesh.lookAt(focusingMirrorData.mesh.position);

                traceRaysCallback();
            };

            // --- Attach Event Listeners & Initialize Layout ---
            angleSlider.addEventListener('input', updateSpectrometerLayout);
            densitySlider.addEventListener('input', updateSpectrometerLayout);
            gratingDistSlider.addEventListener('input', updateSpectrometerLayout);
            focusingDistSlider.addEventListener('input', updateSpectrometerLayout);
            focusingAngleSlider.addEventListener('input', updateSpectrometerLayout);
            
            updateSpectrometerLayout();

            // --- Final Configuration ---
            simulationConfig.rayCount = 100;
            document.getElementById('ray-count-slider').value = 100;
            document.getElementById('ray-count-value').textContent = 100;
        }
    }
};

