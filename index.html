<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Virtual Optics Lab - Refined Engine</title>
    <style>
        body { margin: 0; overflow: hidden; background-color: #fff; color: black; font-family: 'Inter', sans-serif; }
        canvas { display: block; }
        #controls-container {
            position: absolute;
            top: 10px;
            left: 10px;
            padding: 10px;
            background: rgba(255,255,255,0.8);
            border: 1px solid #ccc;
            border-radius: 8px;
            min-width: 340px;
            z-index: 10;
        }
        .control-row { margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }
        label { margin-right: 10px; }
        input[type="range"] { vertical-align: middle; width: 120px;}
        .value-span { min-width: 40px; text-align: left; }
        hr { border: 0; border-top: 1px solid #ccc; margin: 12px 0; }
        .setup-title { font-weight: bold; margin-bottom: 5px; text-align: center; }
        #pixel-viewer-container {
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px;
            background: rgba(0,0,0,0.7);
            border-radius: 8px;
            text-align: center;
            z-index: 10;
        }
        #pixel-viewer-container label { color: white; font-weight: bold; margin-bottom: 5px; display: block; }
        #pixel-canvas { background-color: #333; border-radius: 4px; }
    </style>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
</head>
<body>
    <div id="controls-container">
        <div id="global-controls">
            <div class="setup-title">Global Controls</div>
            <div class="control-row">
                <label for="laser-y">Laser Vertical Pos:</label>
                <input type="range" id="laser-y" min="-1.5" max="1.5" value="0" step="0.1"><span id="laser-y-value" class="value-span">0.0</span>
            </div>
        </div>
        <hr>
        <div class="control-row">
            <label for="setup-select">Optical Setup:</label>
            <select id="setup-select">
                <option value="single-lens">Single Convex Lens</option>
                <option value="flat-mirror">Flat Mirror</option>
                <option value="two-lens-system">Two Lens System</option>
                <option value="camera-sensor">Camera Sensor</option>
            </select>
        </div>
        <hr>
        <div id="setup-controls"></div>
    </div>

    <div id="pixel-viewer-container" style="display: none;">
        <label>Pixel Sensor Array</label>
        <canvas id="pixel-canvas" width="200" height="200"></canvas>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>

    <script>
        // === REFINED ENGINE ===

        // --- CORE CLASSES ---
        class Ray {
            constructor(origin, direction) {
                this.origin = origin;
                this.direction = direction.normalize();
                this.color = new THREE.Color(0x0000ff); // Consistent blue color
            }
        }

        class OpticalElement {
            constructor(position) {
                this.mesh = null; // The THREE.Mesh object
                this.position = new THREE.Vector3(position.x, position.y, position.z);
            }
            // This method must be implemented by subclasses
            processRay(ray, pathPoints) { throw new Error("processRay() must be implemented by subclass."); }
            
            // Helper to add the mesh to the scene group
            addToGroup(group) { if (this.mesh) group.add(this.mesh); }
        }

        class Lens extends OpticalElement {
            constructor(position, focalLength = 5) {
                super(position);
                this.focalLength = focalLength;
                
                const material = new THREE.MeshPhysicalMaterial({ color: 0x22dd22, transparent: true, opacity: 0.75, roughness: 0.1, transmission: 0.8, ior: 1.5, thickness: 0.2 });
                const geometry = new THREE.CylinderGeometry(2.5, 2.5, 0.2, 32);
                this.mesh = new THREE.Mesh(geometry, material);
                this.mesh.position.copy(this.position);
                this.mesh.rotation.z = Math.PI / 2;
                this.mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x003300 })));
            }

            processRay(ray, pathPoints) {
                if (ray.direction.x === 0) return ray; // Ray is parallel to the lens plane
                const t = (this.mesh.position.x - ray.origin.x) / ray.direction.x;
                if (t > 1e-6) {
                    const intersectPoint = ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
                    const distFromCenter = Math.hypot(intersectPoint.y - this.mesh.position.y, intersectPoint.z - this.mesh.position.z);
                    if (distFromCenter <= this.mesh.geometry.parameters.radiusTop) {
                        pathPoints.push(intersectPoint);
                        const y = intersectPoint.y;
                        const newDir = new THREE.Vector3(ray.direction.x, -y / this.focalLength + ray.direction.y, ray.direction.z).normalize();
                        return new Ray(intersectPoint, newDir);
                    }
                }
                return ray; // Ray misses the lens
            }
        }

        class Mirror extends OpticalElement {
            constructor(position, angleDeg = 45) {
                super(position);
                const material = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 1.0, roughness: 0.1 });
                const geometry = new THREE.PlaneGeometry(5, 5);
                this.mesh = new THREE.Mesh(geometry, material);
                this.mesh.position.copy(position);
                this.mesh.rotation.y = -angleDeg * (Math.PI / 180);
                this.mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x333333 })));
            }

            processRay(ray, pathPoints) {
                const plane = new THREE.Plane();
                const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
                plane.setFromNormalAndCoplanarPoint(normal, this.mesh.position);
                const intersectPoint = new THREE.Vector3();
                if (plane.intersectLine(new THREE.Line3(ray.origin, ray.origin.clone().add(ray.direction.clone().multiplyScalar(100))), intersectPoint)) {
                    if (ray.direction.dot(intersectPoint.clone().sub(ray.origin)) > 0) {
                        const localPoint = this.mesh.worldToLocal(intersectPoint.clone());
                        if (Math.abs(localPoint.x) <= this.mesh.geometry.parameters.width / 2 && Math.abs(localPoint.y) <= this.mesh.geometry.parameters.height / 2) {
                            pathPoints.push(intersectPoint);
                            const reflectedDir = ray.direction.clone().reflect(normal);
                            return new Ray(intersectPoint, reflectedDir);
                        }
                    }
                }
                return ray; // Ray misses the mirror
            }
        }
        
        class Detector extends OpticalElement {
            constructor(position) {
                super(position);
                const material = new THREE.MeshStandardMaterial({ color: 0x555555, side: THREE.DoubleSide });
                const geometry = new THREE.PlaneGeometry(5, 5);
                this.mesh = new THREE.Mesh(geometry, material);
                this.mesh.position.copy(position);
                this.mesh.rotation.y = Math.PI / 2;
            }

            processRay(ray, pathPoints) {
                const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), this.mesh.position);
                const intersectPoint = new THREE.Vector3();
                if (plane.intersectLine(new THREE.Line3(ray.origin, ray.origin.clone().add(ray.direction.clone().multiplyScalar(100))), intersectPoint)) {
                    if (ray.direction.dot(intersectPoint.clone().sub(ray.origin)) > 0) {
                        pathPoints.push(intersectPoint);
                        return { intersection: intersectPoint, isDetectorHit: true };
                    }
                }
                return ray; // Ray misses the detector
            }
        }

        // --- MAIN APPLICATION ---
        class VirtualOpticsLab {
            constructor() {
                this.scene = new THREE.Scene();
                this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
                this.renderer = new THREE.WebGLRenderer({ antialias: true });
                this.controls = null;
                this.opticalElements = [];
                this.elementGroup = new THREE.Group();
                this.rayGroup = new THREE.Group();
                this.laserSource = null;
                this.laserParams = { y: 0 };
                this.pixelCanvas = document.getElementById('pixel-canvas');
                this.pixelCtx = this.pixelCanvas.getContext('2d');
                this.pixelGridSize = 20;
                this.pixelSize = this.pixelCanvas.width / this.pixelGridSize;
                
                this.initScene();
                this.setupUI();
                this.switchSetup('single-lens');
                this.animate();
            }

            initScene() {
                this.scene.background = new THREE.Color(0xffffff);
                this.camera.position.set(0, 5, 12);
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                document.body.appendChild(this.renderer.domElement);
                this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true;
                const ambientLight = new THREE.AmbientLight(0xffffff, 1);
                const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
                directionalLight.position.set(5, 10, 7.5);
                this.scene.add(ambientLight, directionalLight, this.elementGroup, this.rayGroup);
                this.laserSource = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.5, 1), new THREE.MeshStandardMaterial({ color: 0x808080 }));
                this.laserSource.position.set(-10, 0, 0);
                this.scene.add(this.laserSource);
            }

            setupUI() {
                document.getElementById('setup-select').addEventListener('change', (e) => this.switchSetup(e.target.value));
                document.getElementById('laser-y').addEventListener('input', (e) => {
                    this.laserParams.y = parseFloat(e.target.value);
                    this.laserSource.position.y = this.laserParams.y;
                    document.getElementById('laser-y-value').textContent = this.laserParams.y.toFixed(1);
                    this.traceRays();
                });
                window.addEventListener('resize', () => this.onWindowResize());
            }
            
            onWindowResize() {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.traceRays();
            }

            createSliderControl(container, label, options, callback, formatFn) {
                const row = document.createElement('div');
                row.className = 'control-row';

                const labelEl = document.createElement('label');
                labelEl.textContent = label;

                const slider = document.createElement('input');
                slider.type = 'range';
                slider.min = options.min;
                slider.max = options.max;
                slider.step = options.step;
                slider.value = options.value;

                const valueEl = document.createElement('span');
                valueEl.className = 'value-span';
                
                const updateValueText = (val) => {
                    valueEl.innerHTML = formatFn ? formatFn(val) : parseFloat(val).toFixed(1);
                };

                slider.addEventListener('input', (e) => {
                    const val = e.target.value;
                    updateValueText(val);
                    callback(parseFloat(val));
                });
                
                updateValueText(options.value);

                row.appendChild(labelEl);
                row.appendChild(slider);
                row.appendChild(valueEl);
                container.appendChild(row);
            }

            clearSetup() {
                this.opticalElements = [];
                while(this.elementGroup.children.length > 0){ 
                    const obj = this.elementGroup.children[0];
                    this.elementGroup.remove(obj);
                    if(obj.geometry) obj.geometry.dispose();
                    if(obj.material) obj.material.dispose();
                    if (obj.children.length > 0) {
                        obj.children.forEach(child => {
                            if(child.geometry) child.geometry.dispose();
                            if(child.material) child.material.dispose();
                        });
                    }
                }
                document.getElementById('setup-controls').innerHTML = '';
                document.getElementById('pixel-viewer-container').style.display = 'none';
            }

            switchSetup(setupKey) {
                this.clearSetup();
                const controlsDiv = document.getElementById('setup-controls');
                
                if (setupKey === 'single-lens') {
                    const lens = new Lens({x: 0, y: 0, z: 0}, 4);
                    this.opticalElements.push(lens);
                    lens.addToGroup(this.elementGroup);
                    this.createSliderControl(controlsDiv, 'Position (X):', {min: -5, max: 5, step: 0.1, value: 0}, (val) => { lens.mesh.position.x = val; this.traceRays(); });
                    this.createSliderControl(controlsDiv, 'Focal Length:', {min: 1, max: 10, step: 0.1, value: 4}, (val) => { lens.focalLength = val; this.traceRays(); });
                } else if (setupKey === 'flat-mirror') {
                    const mirror = new Mirror({x:0, y:0, z:0}, 45);
                    this.opticalElements.push(mirror);
                    mirror.addToGroup(this.elementGroup);
                    this.createSliderControl(controlsDiv, 'Position (X):', {min: -5, max: 5, step: 0.1, value: 0}, (val) => { mirror.mesh.position.x = val; this.traceRays(); });
                    this.createSliderControl(controlsDiv, 'Angle:', {min: -90, max: 90, step: 1, value: 45}, (val) => { mirror.mesh.rotation.y = -val * (Math.PI/180); this.traceRays(); }, (val) => `${val}&deg;`);
                } else if (setupKey === 'two-lens-system') {
                    const lens1 = new Lens({x: -3, y: 0, z: 0}, 4);
                    const lens2 = new Lens({x: 3, y: 0, z: 0}, 4);
                    this.opticalElements.push(lens1, lens2);
                    lens1.addToGroup(this.elementGroup);
                    lens2.addToGroup(this.elementGroup);
                    
                    controlsDiv.innerHTML = `<div class="setup-title">Lens 1</div>`;
                    this.createSliderControl(controlsDiv, 'Position (X):', {min: -8, max: 8, step: 0.1, value: -3}, (val) => { lens1.mesh.position.x = val; this.traceRays(); });
                    this.createSliderControl(controlsDiv, 'Focal Length:', {min: 1, max: 10, step: 0.1, value: 4}, (val) => { lens1.focalLength = val; this.traceRays(); });
                    controlsDiv.appendChild(document.createElement('hr'));
                    controlsDiv.innerHTML += `<div class="setup-title">Lens 2</div>`;
                    this.createSliderControl(controlsDiv, 'Position (X):', {min: -8, max: 8, step: 0.1, value: 3}, (val) => { lens2.mesh.position.x = val; this.traceRays(); });
                    this.createSliderControl(controlsDiv, 'Focal Length:', {min: 1, max: 10, step: 0.1, value: 4}, (val) => { lens2.focalLength = val; this.traceRays(); });
                    controlsDiv.appendChild(document.createElement('hr'));
                    controlsDiv.innerHTML += `<div class="control-row"><label>Collimation:</label><span id="collimation-percent" class="value-span" style="font-weight: bold;">--%</span></div>`;
                } else if (setupKey === 'camera-sensor') {
                    const lens = new Lens({x: 0, y: 0, z: 0}, 5);
                    const detector = new Detector({x: 8, y: 0, z: 0});
                    this.opticalElements.push(lens, detector);
                    lens.addToGroup(this.elementGroup);
                    detector.addToGroup(this.elementGroup);
                    document.getElementById('pixel-viewer-container').style.display = 'block';
                    controlsDiv.innerHTML = `<div class="setup-title">Lens</div>`;
                    this.createSliderControl(controlsDiv, 'Position (X):', {min: -5, max: 8, step: 0.1, value: 0}, (val) => { lens.mesh.position.x = val; this.traceRays(); });
                    this.createSliderControl(controlsDiv, 'Focal Length:', {min: 1, max: 10, step: 0.1, value: 5}, (val) => { lens.focalLength = val; this.traceRays(); });
                }
                this.traceRays();
            }

            traceRays() {
                while(this.rayGroup.children.length > 0){ 
                    const obj = this.rayGroup.children[0];
                    this.rayGroup.remove(obj);
                    if(obj.geometry) obj.geometry.dispose();
                    if(obj.material) obj.material.dispose();
                }
                this.clearPixels();

                const initialRays = [];
                const finalRays = [];
                const numRays = 11;
                const beamHeight = 0.5;
                
                for (let i = 0; i < numRays; i++) {
                    const yOffset = numRays > 1 ? -beamHeight / 2 + (beamHeight / (numRays - 1)) * i : 0;
                    initialRays.push(new Ray(new THREE.Vector3(-9.75, this.laserParams.y + yOffset, 0), new THREE.Vector3(1, 0, 0)));
                }
                
                initialRays.forEach(ray => {
                    let currentRay = ray;
                    let pathPoints = [currentRay.origin];
                    
                    this.opticalElements.sort((a, b) => a.mesh.position.x - b.mesh.position.x);

                    for (const element of this.opticalElements) {
                        let result = element.processRay(currentRay, pathPoints);
                        if(result && result.isDetectorHit) {
                            this.processDetectorHit(result.intersection);
                            currentRay = null; // Stop ray
                            break;
                        }
                        currentRay = result;
                        if (!currentRay) break; // Ray was terminated (e.g., missed lens)
                    }
                    
                    if (currentRay) {
                        pathPoints.push(currentRay.origin.clone().add(currentRay.direction.clone().multiplyScalar(25)));
                        finalRays.push(currentRay);
                    }
                    
                    const beamMaterial = new THREE.LineBasicMaterial({ color: ray.color, linewidth: 1.5 });
                    const beamGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
                    this.rayGroup.add(new THREE.Line(beamGeometry, beamMaterial));
                });
                
                this.updateMetrics(finalRays);
            }
            
            processDetectorHit(intersection) {
                const detector = this.opticalElements.find(el => el instanceof Detector).mesh;
                const localPoint = detector.worldToLocal(intersection.clone());
                const detectorHeight = detector.geometry.parameters.height;
                const pixelX = Math.floor((localPoint.x / detectorHeight + 0.5) * this.pixelGridSize);
                const pixelY = Math.floor((-localPoint.y / detectorHeight + 0.5) * this.pixelGridSize);
                this.drawPixel(pixelX, pixelY);
            }

            clearPixels() {
                this.pixelCtx.fillStyle = '#333';
                this.pixelCtx.fillRect(0, 0, this.pixelCanvas.width, this.pixelCanvas.height);
            }

            drawPixel(x, y) {
                if (x < 0 || x >= this.pixelGridSize || y < 0 || y >= this.pixelGridSize) return;
                this.pixelCtx.fillStyle = 'yellow';
                this.pixelCtx.fillRect(x * this.pixelSize, y * this.pixelSize, this.pixelSize, this.pixelSize);
            }

            updateMetrics(finalRays) {
                 if (document.getElementById('setup-select').value === 'two-lens-system' && finalRays.length > 1) {
                    const directionsY = finalRays.map(r => r.direction.y);
                    const meanY = directionsY.reduce((a, b) => a + b, 0) / directionsY.length;
                    const variance = finalRays.map(y => (y - meanY) ** 2).reduce((a, b) => a + b, 0) / directionsY.length;
                    const stdDev = Math.sqrt(variance);
                    const percentage = Math.max(0, 100 * (1 - stdDev * 20)); 
                    const display = document.getElementById('collimation-percent');
                    if (display) display.textContent = `${percentage.toFixed(1)}%`;
                }
            }

            animate() {
                requestAnimationFrame(() => this.animate());
                this.controls.update();
                this.renderer.render(this.scene, this.camera);
            }
        }

        const app = new VirtualOpticsLab();
    </script>
</body>
</html>
