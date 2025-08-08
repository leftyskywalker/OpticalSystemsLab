import * as THREE from 'three';
import { createLens, createMirror, createDiffractionGrating, createReflectiveGrating, createSphericalMirror, createOpticalSlit, createAperture } from './optics-components.js';
import { loadVisualModel } from './model-loader.js';

export const componentSetups = {
    'laser-model': {
        name: 'Laser 3D Model',
        init: function({ elementGroup }) {
            // This setup is purely visual. It loads the 3D model of the laser.
            loadVisualModel({
                elementGroup: elementGroup,
                url: 'https://leftyskywalker.github.io/OpticalSystemsLab/3D%20Models/Laser%20Asm.gltf',
                // The targetDiameter property is no longer needed.
                position: new THREE.Vector3(-10, 0, 0), // Standard laser position
                rotation: new THREE.Euler(0, 0, 0) // Point along the +X axis
            });
        }
    },
    'single-lens': {
        name: 'Single Convex Lens',
        init: function({ opticalElements, elementGroup, traceRaysCallback }) {
            const lensData = createLens('lens1', {x: 0, y: 0, z: 0}, 4, elementGroup);
            opticalElements.push(lensData.element);

            const controlsDiv = document.getElementById('setup-controls');
            controlsDiv.innerHTML = `
                <div class="control-row"><label for="lens-x">Lens Position (X):</label><input type="range" id="lens-x" min="-5" max="5" value="0" step="0.1"><span id="lens-x-value">0.0 cm</span></div>
                <div class="control-row"><label for="focal-length">Focal Length:</label><input type="range" id="focal-length" min="1" max="10" value="4" step="0.1"><span id="focal-length-value">4.0 cm</span></div>`;

            document.getElementById('lens-x').addEventListener('input', (e) => {
                lensData.mesh.position.x = parseFloat(e.target.value);
                document.getElementById('lens-x-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm';
                traceRaysCallback();
            });
            document.getElementById('focal-length').addEventListener('input', (e) => {
                lensData.element.focalLength = parseFloat(e.target.value);
                document.getElementById('focal-length-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm';
                traceRaysCallback();
            });
        }
    },
    'two-lens-system': {
        name: 'Two Lens System',
        init: function({ opticalElements, elementGroup, traceRaysCallback }) {
            const lens1Data = createLens('lens1', {x: -4, y: 0, z: 0}, 4, elementGroup);
            const lens2Data = createLens('lens2', {x: 4, y: 0, z: 0}, 4, elementGroup);
            opticalElements.push(lens1Data.element, lens2Data.element);

            const controlsDiv = document.getElementById('setup-controls');
            controlsDiv.innerHTML = `
                <div class="setup-title">Lens 1</div>
                <div class="control-row"><label for="lens1-x">Position (X):</label><input type="range" id="lens1-x" min="-8" max="8" value="-4" step="0.1"><span id="lens1-x-value">-4.0 cm</span></div>
                <div class="control-row"><label for="lens1-focal">Focal Length:</label><input type="range" id="lens1-focal" min="1" max="10" value="4" step="0.1"><span id="lens1-focal-value">4.0 cm</span></div>
                <hr>
                <div class="setup-title">Lens 2</div>
                <div class="control-row"><label for="lens2-x">Position (X):</label><input type="range" id="lens2-x" min="-8" max="8" value="4" step="0.1"><span id="lens2-x-value">4.0 cm</span></div>
                <div class="control-row"><label for="lens2-focal">Focal Length:</label><input type="range" id="lens2-focal" min="1" max="10" value="4" step="0.1"><span id="lens2-focal-value">4.0 cm</span></div>
            `;

            document.getElementById('lens1-x').addEventListener('input', (e) => { 
                lens1Data.mesh.position.x = parseFloat(e.target.value); 
                document.getElementById('lens1-x-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm'; 
                traceRaysCallback(); 
            });
            document.getElementById('lens1-focal').addEventListener('input', (e) => { 
                lens1Data.element.focalLength = parseFloat(e.target.value); 
                document.getElementById('lens1-focal-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm'; 
                traceRaysCallback(); 
            });
            document.getElementById('lens2-x').addEventListener('input', (e) => { 
                lens2Data.mesh.position.x = parseFloat(e.target.value); 
                document.getElementById('lens2-x-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm'; 
                traceRaysCallback(); 
            });
            document.getElementById('lens2-focal').addEventListener('input', (e) => { 
                lens2Data.element.focalLength = parseFloat(e.target.value); 
                document.getElementById('lens2-focal-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm'; 
                traceRaysCallback(); 
            });
        }
    },
    'flat-mirror': {
        name: 'Flat Mirror',
        init: function({ opticalElements, elementGroup, traceRaysCallback, envMap }) {
            const mirrorData = createMirror('mirror1', {x: 0, y: 0, z: 0}, 45, envMap, elementGroup);
            opticalElements.push(mirrorData.element);

            const controlsDiv = document.getElementById('setup-controls');
            controlsDiv.innerHTML = `
                <div class="control-row"><label for="mirror-x">Mirror Position (X):</label><input type="range" id="mirror-x" min="-5" max="5" value="0" step="0.1"><span id="mirror-x-value">0.0 cm</span></div>
                <div class="control-row"><label for="mirror-angle">Mirror Angle:</label><input type="range" id="mirror-angle" min="-90" max="90" value="45" step="1"><span id="mirror-angle-value">45&deg;</span></div>`;

            document.getElementById('mirror-x').addEventListener('input', (e) => { 
                mirrorData.mesh.position.x = parseFloat(e.target.value); 
                document.getElementById('mirror-x-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm'; 
                traceRaysCallback(); 
            });
            document.getElementById('mirror-angle').addEventListener('input', (e) => { 
                const angle = parseFloat(e.target.value); 
                mirrorData.mesh.rotation.y = -angle * (Math.PI / 180); 
                document.getElementById('mirror-angle-value').innerHTML = `${angle}&deg;`; 
                traceRaysCallback(); 
            });
            document.getElementById('mirror-angle').dispatchEvent(new Event('input'));
        }
    },
    'spherical-mirror': {
            name: 'Spherical Mirror',
            init: function({ opticalElements, elementGroup, traceRaysCallback, envMap }) {
                const mirrorData = createSphericalMirror('spherical_mirror_1', {x: 5, y: 0, z: 0}, -10, -45, envMap, elementGroup);
                opticalElements.push(mirrorData.element);

                const controlsDiv = document.getElementById('setup-controls');
                controlsDiv.innerHTML = `
                    <div class="control-row"><label for="mirror-x">Mirror Position (X):</label><input type="range" id="mirror-x" min="-5" max="8" value="5" step="0.1"><span id="mirror-x-value">5.0 cm</span></div>
                    <div class="control-row"><label for="mirror-radius">Radius of Curvature:</label><input type="range" id="mirror-radius" min="-20" max="-5" value="-10" step="0.1"><span id="mirror-radius-value">-10.0 cm</span></div>
                    <div class="control-row"><label for="mirror-angle">Mirror Angle:</label><input type="range" id="mirror-angle" min="-45" max="45" value="-45" step="1"><span id="mirror-angle-value">-45&deg;</span></div>`;

                document.getElementById('mirror-x').addEventListener('input', (e) => {
                    mirrorData.mesh.position.x = parseFloat(e.target.value);
                    document.getElementById('mirror-x-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm';
                    traceRaysCallback();
                });
                document.getElementById('mirror-radius').addEventListener('input', (e) => {
                    mirrorData.element.radius = parseFloat(e.target.value);
                    document.getElementById('mirror-radius-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm';
                    traceRaysCallback();
                });
                
                document.getElementById('mirror-angle').addEventListener('input', (e) => {
                    const angle = parseFloat(e.target.value);
                    mirrorData.mesh.rotation.y = -Math.PI / 2 - angle * (Math.PI / 180);
                    document.getElementById('mirror-angle-value').innerHTML = `${angle}&deg;`;
                    traceRaysCallback();
                });
            }
        },
    'aperture': {
        name: 'Circular Aperture',
        init: function({ opticalElements, elementGroup, traceRaysCallback }) {
            const initialConfig = { diameter: 1.0 };
            const apertureData = createAperture('aperture1', {x: 0, y: 0, z: 0}, initialConfig, elementGroup);
            opticalElements.push(apertureData.element);

            const controlsDiv = document.getElementById('setup-controls');
            controlsDiv.innerHTML = `
                <div class="control-row"><label for="aperture-x">Aperture Position (X):</label><input type="range" id="aperture-x" min="-5" max="5" value="0" step="0.1"><span id="aperture-x-value">0.0 cm</span></div>
                <div class="control-row"><label for="aperture-diameter">Diameter (mm):</label><input type="range" id="aperture-diameter" min="1" max="20" value="10" step="0.5"><span id="aperture-diameter-value">10.0 mm</span></div>
            `;

            document.getElementById('aperture-x').addEventListener('input', (e) => {
                apertureData.mesh.position.x = parseFloat(e.target.value);
                document.getElementById('aperture-x-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm';
                traceRaysCallback();
            });

            document.getElementById('aperture-diameter').addEventListener('input', (e) => {
                const newDiameterMM = parseFloat(e.target.value);
                document.getElementById('aperture-diameter-value').textContent = newDiameterMM.toFixed(1) + ' mm';
                apertureData.element.diameter = newDiameterMM / 10;
                apertureData.element._rebuildMesh();
                traceRaysCallback();
            });
        }
    },
    'optical-slit': {
        name: 'Optical Slit',
        init: function({ opticalElements, elementGroup, traceRaysCallback }) {
            const initialConfig = { slitWidth: 50 / 10000, slitHeight: 1.2 };
            const slitData = createOpticalSlit('slit1', {x: 0, y: 0, z: 0}, initialConfig, elementGroup);
            opticalElements.push(slitData.element);

            const controlsDiv = document.getElementById('setup-controls');
            controlsDiv.innerHTML = `
                <div class="control-row"><label for="slit-x">Slit Position (X):</label><input type="range" id="slit-x" min="-5" max="5" value="0" step="0.1"><span id="slit-x-value">0.0 cm</span></div>
                <div class="control-row"><label for="slit-width">Slit Width (µm):</label><input type="range" id="slit-width" min="10" max="500" value="50" step="5"><span id="slit-width-value">50 µm</span></div>
                <div class="control-row"><label for="slit-height">Slit Height (mm):</label><input type="range" id="slit-height" min="1" max="20" value="12" step="0.5"><span id="slit-height-value">12.0 mm</span></div>
            `;

            document.getElementById('slit-x').addEventListener('input', (e) => {
                slitData.mesh.position.x = parseFloat(e.target.value);
                document.getElementById('slit-x-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm';
                traceRaysCallback();
            });
    
            const widthSlider = document.getElementById('slit-width');
            const heightSlider = document.getElementById('slit-height');
    
            function updateSlitDimensions() {
                const newWidthUM = parseFloat(widthSlider.value);
                const newHeightMM = parseFloat(heightSlider.value);
    
                document.getElementById('slit-width-value').textContent = newWidthUM.toFixed(0) + ' µm';
                document.getElementById('slit-height-value').textContent = newHeightMM.toFixed(1) + ' mm';
    
                slitData.element.slitWidth = newWidthUM / 10000;
                slitData.element.slitHeight = newHeightMM / 10;
                
                slitData.element._rebuildMesh();
                traceRaysCallback();
            }
    
            widthSlider.addEventListener('input', updateSlitDimensions);
            heightSlider.addEventListener('input', updateSlitDimensions);
        }
    },
    'diffraction-grating': {
        name: 'Transmissive Grating',
        init: function({ opticalElements, elementGroup, traceRaysCallback }) {
            const gratingConfig = { linesPerMM: 600, lineOrientation: 'horizontal' };
            const gratingData = createDiffractionGrating('grating1', {x: 0, y: 0, z: 0}, gratingConfig, elementGroup);
            opticalElements.push(gratingData.element);

            const controlsDiv = document.getElementById('setup-controls');
            controlsDiv.innerHTML = `
                <div class="control-row"><label for="grating-x">Grating Position (X):</label><input type="range" id="grating-x" min="-5" max="5" value="0" step="0.1"><span id="grating-x-value">0.0 cm</span></div>
                <div class="control-row"><label for="grating-density">Groove Density (L/mm):</label><input type="range" id="grating-density" min="100" max="2000" value="600" step="50"><span id="grating-density-value">600</span></div>
                <div class="control-row">
                    <label for="grating-orientation">Line Orientation:</label>
                    <select id="grating-orientation">
                        <option value="horizontal" selected>Horizontal</option>
                        <option value="vertical">Vertical</option>
                    </select>
                </div>
            `;

            document.getElementById('grating-x').addEventListener('input', (e) => {
                gratingData.mesh.position.x = parseFloat(e.target.value);
                document.getElementById('grating-x-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm';
                traceRaysCallback();
            });

            document.getElementById('grating-density').addEventListener('input', (e) => {
                const density = parseInt(e.target.value);
                gratingData.element.linesPerMM = density;
                document.getElementById('grating-density-value').textContent = density;
                traceRaysCallback();
            });

            document.getElementById('grating-orientation').addEventListener('change', (e) => {
                gratingData.element.lineOrientation = e.target.value;
                traceRaysCallback();
            });
        }
    },
    'reflective-grating': {
        name: 'Reflective Grating',
        init: function({ opticalElements, elementGroup, traceRaysCallback, envMap }) {
            const gratingData = createReflectiveGrating('reflective_grating_1', {x: 0, y: 0, z: 0}, 0, { linesPerMM: 600, lineOrientation: 'vertical' }, envMap, elementGroup);
            opticalElements.push(gratingData.element);

            const controlsDiv = document.getElementById('setup-controls');
            controlsDiv.innerHTML = `
                <div class="control-row"><label for="grating-x">Grating Position (X):</label><input type="range" id="grating-x" min="-5" max="5" value="0" step="0.1"><span id="grating-x-value">0.0 cm</span></div>
                <div class="control-row"><label for="grating-angle">Grating Angle:</label><input type="range" id="grating-angle" min="-45" max="45" value="0" step="1"><span id="grating-angle-value">0&deg;</span></div>
                <div class="control-row"><label for="grating-density">Grooves (L/mm):</label><input type="range" id="grating-density" min="100" max="2000" value="600" step="50"><span id="grating-density-value">600</span></div>
                <div class="control-row">
                    <label for="grating-orientation">Line Orientation:</label>
                    <select id="grating-orientation">
                        <option value="vertical" selected>Vertical</option>
                        <option value="horizontal">Horizontal</option>
                    </select>
                </div>
            `;

            document.getElementById('grating-x').addEventListener('input', (e) => {
                gratingData.mesh.position.x = parseFloat(e.target.value);
                document.getElementById('grating-x-value').textContent = parseFloat(e.target.value).toFixed(1) + ' cm';
                traceRaysCallback();
            });

            document.getElementById('grating-angle').addEventListener('input', (e) => {
                const angle = parseFloat(e.target.value);
                gratingData.mesh.rotation.y = -Math.PI / 2 - angle * (Math.PI / 180);
                document.getElementById('grating-angle-value').innerHTML = `${angle}&deg;`;
                traceRaysCallback();
            });
            document.getElementById('grating-angle').dispatchEvent(new Event('input'));


            document.getElementById('grating-density').addEventListener('input', (e) => {
                const density = parseInt(e.target.value);
                gratingData.element.linesPerMM = density;
                document.getElementById('grating-density-value').textContent = density;
                traceRaysCallback();
            });
            
            document.getElementById('grating-orientation').addEventListener('change', (e) => {
                gratingData.element.lineOrientation = e.target.value;
                traceRaysCallback();
            });
        }
    },
};


