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

        // This arbitrary distance '10' is from your original code. 
        // For a more robust design, you might base this on system focal lengths.
        const gratingDistance = 10; 
        const gratingPos = { 
            x: collimatingMirrorPos.x - gratingDistance * Math.cos(2 * collimatingMirrorAngle_deg * (Math.PI / 180)), 
            y: 0, 
            z: collimatingMirrorPos.z - gratingDistance * Math.sin(2 * collimatingMirrorAngle_deg * (Math.PI / 180))
        };
        const gratingAngle_deg = (alpha_rad * (180 / Math.PI)) + 2 * collimatingMirrorAngle_deg;
        const gratingData = createReflectiveGrating('grating', gratingPos, gratingAngle_deg, { linesPerMM: G, lineOrientation: 'vertical' }, envMap, elementGroup);
        gratingData.mesh.rotateY(Math.PI);

        // --- CORRECTED FOCUSING MIRROR LOGIC ---

        // 1. Calculate the angle of the diffracted beam
        const beta_deg = beta_rad * (180 / Math.PI); 
        const diffractedBeamAngle_deg = gratingAngle_deg + beta_deg;
        const diffractedBeamAngle_rad = diffractedBeamAngle_deg * (Math.PI / 180);

        // 2. NEW: Calculate the mirror's position along the diffracted beam's path
        // It's placed at a distance equal to its focal length (Lf_cm) from the grating.
        const focusingMirrorPos = { 
            x: gratingPos.x + 10 * Math.cos(diffractedBeamAngle_rad), 
            y: 0, 
            z: gratingPos.z + 10 * Math.sin(diffractedBeamAngle_rad) 
        };
        
        // 3. UPDATED: Calculate the mirror's angle to be orthogonal to the beam
        const focusingMirrorAngle_deg = diffractedBeamAngle_deg;
        
        // 4. Create the mirror with the new position and angle
        const focusingMirrorData = createSphericalMirror('focusing_mirror', focusingMirrorPos, -2 * Lf_cm, focusingMirrorAngle_deg, envMap, elementGroup);
        
        // --- END CORRECTION ---
        
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
}}