// === OPTICS ENGINE - V2.2 (Demosaiced Sensor Mode) ===

/**
 * Represents a light ray with an origin, direction, and wavelength.
 */
export class Ray {
    constructor(origin, direction, wavelength = 532) { // Default to green
        this.origin = origin;
        this.direction = direction.normalize();
        this.wavelength = wavelength;
    }
}

/**
 * A helper function to convert a wavelength in nanometers to an RGB color.
 * @param {number} wavelength - Wavelength in nm (e.g., 400-700).
 * @returns {THREE.Color} A three.js Color object.
 */
function wavelengthToRGB(wavelength) {
    let r, g, b;
    if (wavelength >= 380 && wavelength < 440) {
        r = -(wavelength - 440) / (440 - 380); g = 0.0; b = 1.0;
    } else if (wavelength >= 440 && wavelength < 490) {
        r = 0.0; g = (wavelength - 440) / (490 - 440); b = 1.0;
    } else if (wavelength >= 490 && wavelength < 510) {
        r = 0.0; g = 1.0; b = -(wavelength - 510) / (510 - 490);
    } else if (wavelength >= 510 && wavelength < 580) {
        r = (wavelength - 510) / (580 - 510); g = 1.0; b = 0.0;
    } else if (wavelength >= 580 && wavelength < 645) {
        r = 1.0; g = -(wavelength - 645) / (645 - 580); b = 0.0;
    } else if (wavelength >= 645 && wavelength <= 780) {
        r = 1.0; g = 0.0; b = 0.0;
    } else {
        r = 0.0; g = 0.0; b = 0.0;
    }
    let factor = 0.0;
    if (wavelength >= 380 && wavelength < 420) {
        factor = 0.3 + 0.7 * (wavelength - 380) / (420 - 380);
    } else if (wavelength >= 420 && wavelength < 701) {
        factor = 1.0;
    } else if (wavelength >= 701 && wavelength <= 780) {
        factor = 0.3 + 0.7 * (780 - wavelength) / (780 - 701);
    }
    return new THREE.Color(r * factor, g * factor, b * factor);
}

// --- COMPONENT FACTORIES (Unchanged) ---

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
                    const z = intersectPoint.z;
                    const newDirY = -y / this.focalLength + ray.direction.y;
                    const newDirZ = -z / this.focalLength + ray.direction.z;
                    const newDir = new THREE.Vector3(ray.direction.x, newDirY, newDirZ).normalize();
                    return { newRay: new Ray(intersectPoint, newDir, ray.wavelength) };
                }
            }
            return null;
        }
    };
    return { mesh, element };
}

export function createMirror(name, position, angle, envMap, elementGroup) {
    const mirrorMaterial = new THREE.MeshStandardMaterial({
        color: 0xeeeeee, metalness: 1.0, roughness: 0.0, envMap: envMap
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
                    return { newRay: new Ray(intersectPoint, reflectedDir, ray.wavelength) };
                }
            }
            return null;
        }
    };
    return { mesh, element };
}

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
                    return { intersection: intersectPoint, wavelength: ray.wavelength };
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
    const { rayGroup, opticalElements, laserSource, pixelCtx, pixelCanvas, pixelGridSize, wavelength, laserPattern, setupKey, sensorType } = config;

    // 1. Clear previous rays and pixels
    while(rayGroup.children.length > 0){
        const obj = rayGroup.children[0];
        rayGroup.remove(obj);
        if(obj.geometry) obj.geometry.dispose();
        if(obj.material) obj.material.dispose();
    }
    if (pixelCtx) {
        pixelCtx.fillStyle = '#000';
        pixelCtx.fillRect(0, 0, pixelCanvas.width, pixelCanvas.height);
    }

    const pixelIntensities = Array(pixelGridSize).fill(null).map(() => Array(pixelGridSize).fill(null).map(() => ({ r: 0, g: 0, b: 0 })));
    let maxIntensity = 0;

    // 2. Generate initial rays
    let initialRays = [];
    const wavelengths = (wavelength === 'white') ? [450, 532, 650] : [wavelength];
    const beamSize = 1.0; 

    wavelengths.forEach(wl => {
        let patternRays = [];
        const parallelDirection = new THREE.Vector3(1, 0, 0);
        switch (laserPattern) {
            case 'line':
                for (let i = 0; i < 100; i++) {
                    const yOffset = -beamSize / 2 + beamSize * (i / 99);
                    patternRays.push(new Ray(new THREE.Vector3(-9.75, laserSource.position.y + yOffset, 0), parallelDirection, wl));
                }
                break;
            case 'radial':
                 for (let i = 0; i < 100; i++) {
                    const angle = (i / 99) * 2 * Math.PI;
                    const yOffset = Math.sin(angle) * beamSize / 2;
                    const zOffset = Math.cos(angle) * beamSize / 2;
                    const startPoint = new THREE.Vector3(-9.75, laserSource.position.y + yOffset, zOffset);
                    patternRays.push(new Ray(startPoint, parallelDirection, wl));
                }
                break;
        }
        initialRays.push(...patternRays);
    });


    // 3. Trace each ray and accumulate true color intensities
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

                    if (pixelX >= 0 && pixelX < pixelGridSize && pixelY >= 0 && pixelY < pixelGridSize) {
                         const pixel = pixelIntensities[pixelY][pixelX];
                         const color = wavelengthToRGB(ray.wavelength);
                         pixel.r += color.r;
                         pixel.g += color.g;
                         pixel.b += color.b;
                         
                         maxIntensity = Math.max(maxIntensity, pixel.r, pixel.g, pixel.b);
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
        }

        if (initialRays.indexOf(ray) % 10 === 0) {
            const beamMaterial = new THREE.LineBasicMaterial({ color: wavelengthToRGB(ray.wavelength), transparent: true, opacity: 0.5 });
            const beamGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
            const rayLine = new THREE.Line(beamGeometry, beamMaterial);
            rayGroup.add(rayLine);
        }
    });

    // 4. Draw the final image on the sensor canvas
    if (pixelCtx && maxIntensity > 0) {
        const pixelSize = pixelCanvas.width / pixelGridSize;
        for (let y = 0; y < pixelGridSize; y++) {
            for (let x = 0; x < pixelGridSize; x++) {
                const pixel = pixelIntensities[y][x];
                if (pixel.r > 0 || pixel.g > 0 || pixel.b > 0) {
                    const r = Math.round(255 * (pixel.r / maxIntensity));
                    const g = Math.round(255 * (pixel.g / maxIntensity));
                    const b = Math.round(255 * (pixel.b / maxIntensity));

                    if (sensorType === 'bayer') {
                        const isTopRow = y % 2 === 0;
                        const isLeftColumn = x % 2 === 0;
                        if (isTopRow) {
                            if (isLeftColumn) pixelCtx.fillStyle = `rgb(0, ${g}, 0)`; // Green
                            else pixelCtx.fillStyle = `rgb(${r}, 0, 0)`; // Red
                        } else {
                            if (isLeftColumn) pixelCtx.fillStyle = `rgb(0, 0, ${b})`; // Blue
                            else pixelCtx.fillStyle = `rgb(0, ${g}, 0)`; // Green
                        }
                    } else if (sensorType === 'demosaiced') {
                        // --- NEW: Demosaiced Drawing Logic ---
                        pixelCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                    } else { // Grayscale
                        const gray = Math.round((r + g + b) / 3);
                        pixelCtx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                    }
                    pixelCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            }
        }
    }
    
    // 5. Collimation Calculation
    if (setupKey === 'two-lens-system') {
        const display = document.getElementById('collimation-percent');
        if (display) {
            if (opticalElements.length === 2 && opticalElements.every(el => el.type === 'thin-lens')) {
                const sortedElements = [...opticalElements].sort((a, b) => a.mesh.position.x - b.mesh.position.x);
                const lens1 = sortedElements[0];
                const lens2 = sortedElements[1];
                const focusPointX = lens1.mesh.position.x + lens1.focalLength;
                const distanceToSecondLens = lens2.mesh.position.x - focusPointX;
                const error = Math.abs(distanceToSecondLens - lens2.focalLength);
                const maxError = 5.0;
                const percentage = Math.max(0, 100 * (1 - error / maxError));
                display.textContent = `${percentage.toFixed(1)}%`;
            } else {
                display.textContent = '--%';
            }
        }
    }
}
