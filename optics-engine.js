// === OPTICS ENGINE - V1 (Simple) with Upgraded Mirror ===

/**
 * Represents a light ray with an origin and direction.
 */
export class Ray {
    constructor(origin, direction) {
        this.origin = origin;
        this.direction = direction.normalize();
    }
}

/**
 * Creates a thin convex lens object using the simple "focalLength" model.
 * @returns {{mesh: THREE.Mesh, element: object}}
 */
export function createLens(name, position, focalLength, elementGroup) {
    const lensMaterial = new THREE.MeshPhysicalMaterial({ color: 0x22dd22, transparent: true, opacity: 0.75, roughness: 0.1, transmission: 0.8, ior: 1.5, thickness: 0.2 });
    const lensGeometry = new THREE.CylinderGeometry(2.5, 2.5, 0.2, 32);
    const mesh = new THREE.Mesh(lensGeometry, lensMaterial);
    mesh.name = name;
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.z = Math.PI / 2;
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(lensGeometry), new THREE.LineBasicMaterial({ color: 0x003300 })));
    elementGroup.add(mesh);

    const element = {
        mesh: mesh, type: 'thin-lens', focalLength: focalLength,
        processRay: function(ray) {
            if (ray.direction.x === 0) return null;
            const t = (this.mesh.position.x - ray.origin.x) / ray.direction.x;
            if (t > 1e-6) {
                const intersectPoint = ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
                const intersectPointLocal = this.mesh.worldToLocal(intersectPoint.clone());
                const distFromCenter = Math.sqrt(intersectPointLocal.y**2 + intersectPointLocal.z**2);
                if (distFromCenter <= lensGeometry.parameters.radiusTop) {
                    const y = intersectPoint.y;
                    const newDir = new THREE.Vector3(ray.direction.x, -y / this.focalLength + ray.direction.y, ray.direction.z).normalize();
                    return { newRay: new Ray(intersectPoint, newDir) };
                }
            }
            return null;
        }
    };
    return { mesh, element };
}


/**
 * Creates a realistic, reflective flat mirror.
 * @param {string} name - The name of the object.
 * @param {THREE.Texture} envMap - The environment map (a CubeTexture) for reflections.
 * @returns {{mesh: THREE.Mesh, element: object}}
 */
export function createMirror(name, position, angle, envMap, elementGroup) {
    // This material uses the envMap to create real-time reflections.
    const mirrorMaterial = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        metalness: 1.0,      // A value of 1.0 makes it a perfect mirror.
        roughness: 0.0,      // A value of 0.0 makes the reflection sharp.
        envMap: envMap       // Apply the real-time reflection map.
    });
    const mirrorGeometry = new THREE.PlaneGeometry(5, 5);
    const mesh = new THREE.Mesh(mirrorGeometry, mirrorMaterial);
    mesh.name = name;
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.y = -angle * (Math.PI / 180);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mirrorGeometry), new THREE.LineBasicMaterial({ color: 0x333333 })));
    elementGroup.add(mesh);

    const element = {
        mesh: mesh, type: 'mirror',
        processRay: function(ray) {
            const plane = new THREE.Plane();
            const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
            plane.setFromNormalAndCoplanarPoint(normal, this.mesh.position);
            const intersectPoint = new THREE.Vector3();
            if (plane.intersectLine(new THREE.Line3(ray.origin, ray.origin.clone().add(ray.direction.clone().multiplyScalar(100))), intersectPoint)) {
                if (ray.direction.dot(intersectPoint.clone().sub(ray.origin)) < 0) return null;
                const localPoint = this.mesh.worldToLocal(intersectPoint.clone());
                if (Math.abs(localPoint.x) <= mirrorGeometry.parameters.width / 2 && Math.abs(localPoint.y) <= mirrorGeometry.parameters.height / 2) {
                    const reflectedDir = ray.direction.clone().reflect(normal);
                    return { newRay: new Ray(intersectPoint, reflectedDir) };
                }
            }
            return null;
        }
    };
    return { mesh, element };
}

/**
 * Creates a detector/sensor object and its 3D mesh.
 * @returns {{mesh: THREE.Mesh, element: object}}
 */
export function createDetector(name, position, elementGroup) {
    const detectorMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, side: THREE.DoubleSide });
    const detectorGeometry = new THREE.PlaneGeometry(5, 5);
    const mesh = new THREE.Mesh(detectorGeometry, detectorMaterial);
    mesh.name = name;
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.y = Math.PI / 2;
    elementGroup.add(mesh);

    const element = {
        mesh: mesh, type: 'detector',
        processRay: function(ray) {
            const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), this.mesh.position);
            const intersectPoint = new THREE.Vector3();
            if (plane.intersectLine(new THREE.Line3(ray.origin, ray.origin.clone().add(ray.direction.clone().multiplyScalar(100))), intersectPoint)) {
                if (ray.direction.dot(intersectPoint.clone().sub(ray.origin)) > 0) {
                    return { intersection: intersectPoint };
                }
            }
            return null;
        }
    };
    return { mesh, element };
}


/**
 * Clears and redraws all ray paths based on the current state.
 * @param {object} config - The configuration object.
 */
export function traceRays(config) {
    const { rayGroup, opticalElements, laserSource, pixelCtx, pixelCanvas, pixelGridSize } = config;

    // 1. Clear previous rays and pixels
    while(rayGroup.children.length > 0){
        const obj = rayGroup.children[0];
        rayGroup.remove(obj);
        if(obj.geometry) obj.geometry.dispose();
        if(obj.material) obj.material.dispose();
    }
    if (pixelCtx) {
        pixelCtx.fillStyle = '#333';
        pixelCtx.fillRect(0, 0, pixelCanvas.width, pixelCanvas.height);
    }

    // 2. Generate initial rays
    const initialRays = [];
    const finalRays = [];
    const numRays = 11;
    const beamHeight = 0.5;
    for (let i = 0; i < numRays; i++) {
        const yOffset = -beamHeight / 2 + (beamHeight / (numRays - 1)) * i;
        initialRays.push(new Ray(new THREE.Vector3(-9.75, laserSource.position.y + yOffset, 0), new THREE.Vector3(1, 0, 0)));
    }

    // 3. Trace each ray through the system
    initialRays.forEach(ray => {
        let currentRay = ray;
        let pathPoints = [currentRay.origin];

        opticalElements.sort((a, b) => a.mesh.position.x - b.mesh.position.x);

        for (const element of opticalElements) {
            const result = element.processRay(currentRay);
            if (result) {
                if(element.type === 'detector') {
                    const detector = element.mesh;
                    const localPoint = detector.worldToLocal(result.intersection.clone());
                    const detectorHeight = detector.geometry.parameters.height;
                    const pixelX = Math.floor((localPoint.x / detectorHeight + 0.5) * pixelGridSize);
                    const pixelY = Math.floor((-localPoint.y / detectorHeight + 0.5) * pixelGridSize);

                    const pixelSize = pixelCanvas.width / pixelGridSize;
                    if (pixelX >= 0 && pixelX < pixelGridSize && pixelY >= 0 && pixelY < pixelGridSize) {
                         pixelCtx.fillStyle = 'yellow';
                         pixelCtx.fillRect(pixelX * pixelSize, pixelY * pixelSize, pixelSize, pixelSize);
                    }

                    pathPoints.push(result.intersection);
                    currentRay = null;
                    break;
                } else {
                    pathPoints.push(result.newRay.origin);
                    currentRay = result.newRay;
                }
            }
        }

        if (currentRay) {
            pathPoints.push(currentRay.origin.clone().add(currentRay.direction.clone().multiplyScalar(25)));
            finalRays.push(currentRay);
        }

        const beamMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
        const beamGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
        const rayLine = new THREE.Line(beamGeometry, beamMaterial);
        rayGroup.add(rayLine);
    });

    // 4. Perform setup-specific calculations (e.g., collimation)
    if (config.setupKey === 'two-lens-system' && finalRays.length > 1) {
        const directionsY = finalRays.map(r => r.direction.y);
        const meanY = directionsY.reduce((a, b) => a + b, 0) / directionsY.length;
        const variance = directionsY.map(y => (y - meanY) ** 2).reduce((a, b) => a + b, 0) / directionsY.length;
        const stdDev = Math.sqrt(variance);
        const percentage = Math.max(0, 100 * (1 - stdDev * 20));
        const display = document.getElementById('collimation-percent');
        if (display) display.textContent = `${percentage.toFixed(1)}%`;
    }
}
   