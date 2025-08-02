// === OPTICS ENGINE - V3.6 (Correct Demosaiced Color) ===

/**
 * Represents a light ray with an origin, direction, and wavelength.
 */
export class Ray {
    constructor(origin, direction, wavelength = 532) {
        this.origin = origin;
        this.direction = direction.normalize();
        this.wavelength = wavelength;
    }
}

/**
 * A helper function to convert a wavelength in nanometers to an RGB color for VISUALIZATION ONLY.
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

/**
 * Simulates the spectral response of a color filter.
 */
function getFilterResponse(wavelength, filterType) {
    let peak, width;
    switch (filterType) {
        case 'R': peak = 600; width = 50; break;
        case 'G': peak = 540; width = 50; break;
        case 'B': peak = 450; width = 50; break;
        default: return 0;
    }
    const exponent = -((wavelength - peak) ** 2) / (2 * width ** 2);
    return Math.exp(exponent);
}


// --- COMPONENT FACTORIES ---

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

export function createDiffractionGrating(name, position, config, elementGroup) {
    const { linesPerMM } = config;
    const gratingMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaee, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    const gratingGeometry = new THREE.PlaneGeometry(5, 5);
    const mesh = new THREE.Mesh(gratingGeometry, gratingMaterial);
    mesh.name = name;
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.y = Math.PI / 2;
    elementGroup.add(mesh);

    const element = {
        mesh: mesh, type: 'grating', linesPerMM: linesPerMM,
        processRay: function(ray) {
            const t = (this.mesh.position.x - ray.origin.x) / ray.direction.x;
            if (t > 1e-6) {
                const intersectPoint = ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
                const localPoint = this.mesh.worldToLocal(intersectPoint.clone());

                if (Math.abs(localPoint.y) <= gratingGeometry.parameters.height / 2 && Math.abs(localPoint.x) <= gratingGeometry.parameters.width / 2) {
                    const newRays = [];
                    const d = 1000000 / this.linesPerMM;
                    
                    for (let m = -1; m <= 1; m++) {
                        const sin_theta_m = (m * ray.wavelength) / d;
                        if (Math.abs(sin_theta_m) <= 1) {
                            const theta_m = Math.asin(sin_theta_m);
                            const originalAngle = Math.atan2(ray.direction.y, ray.direction.x);
                            const newAngle = originalAngle + theta_m;
                            const newDir = new THREE.Vector3(Math.cos(newAngle), Math.sin(newAngle), ray.direction.z).normalize();
                            const newRay = new Ray(intersectPoint, newDir, ray.wavelength);
                            newRay.diffractionOrder = m;
                            newRays.push(newRay);
                        }
                    }
                    return { newRays: newRays };
                }
            }
            return null;
        }
    };
    return { mesh, element };
}


/**
 * --- Unified Ray Tracing Engine ---
 */
export function traceRays(config) {
    const { rayGroup, opticalElements, laserSource, pixelCtx, pixelCanvas, pixelGridSize, wavelength, laserPattern, setupKey, sensorType } = config;

    // 1. Clear previous state
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

    // --- CHANGE: Two separate grids for sensor simulation vs. true color ---
    const sensorIntensities = Array(pixelGridSize).fill(null).map(() => Array(pixelGridSize).fill(null).map(() => ({ r: 0, g: 0, b: 0 })));
    const trueColorIntensities = Array(pixelGridSize).fill(null).map(() => Array(pixelGridSize).fill(null).map(() => ({ r: 0, g: 0, b: 0 })));
    let maxSensorIntensity = 0;
    let maxTrueColorIntensity = 0;

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
                    patternRays.push(new Ray(new THREE.Vector3(-9.75, laserSource.position.y + yOffset, laserSource.position.z), parallelDirection, wl));
                }
                break;
            case 'radial':
                 for (let i = 0; i < 100; i++) {
                    const angle = (i / 99) * 2 * Math.PI;
                    const yOffset = Math.sin(angle) * beamSize / 2;
                    const zOffset = Math.cos(angle) * beamSize / 2;
                    const startPoint = new THREE.Vector3(-9.75, laserSource.position.y + yOffset, laserSource.position.z + zOffset);
                    patternRays.push(new Ray(startPoint, parallelDirection, wl));
                }
                break;
        }
        initialRays.push(...patternRays);
    });

    // 3. Unified Tracing Loop
    let activePaths = initialRays.map(ray => ({ ray: ray, path: [ray.origin], terminated: false, hasSplit: false }));

    for (const element of opticalElements) {
        let nextActivePaths = [];
        for (const currentPath of activePaths) {
            if (currentPath.terminated) {
                nextActivePaths.push(currentPath);
                continue;
            }

            const result = element.processRay(currentPath.ray);
            if (result) {
                if (result.newRays) { // Branching case (grating)
                    result.newRays.forEach(newRay => {
                        nextActivePaths.push({ ray: newRay, path: [...currentPath.path, newRay.origin], terminated: false, hasSplit: true });
                    });
                } else if (result.newRay) { // Single path case (lens/mirror)
                    currentPath.path.push(result.newRay.origin);
                    currentPath.ray = result.newRay;
                    nextActivePaths.push(currentPath);
                } else if (result.intersection) { // Absorbing case (detector)
                    currentPath.path.push(result.intersection);
                    currentPath.terminated = true;
                    nextActivePaths.push(currentPath);
                    
                    const detector = element.mesh;
                    const localPoint = detector.worldToLocal(result.intersection.clone());
                    const detectorHeight = detector.geometry.parameters.height;
                    const pixelX = Math.floor((localPoint.x / detectorHeight + 0.5) * pixelGridSize);
                    const pixelY = Math.floor((-localPoint.y / detectorHeight + 0.5) * pixelGridSize);

                    if (pixelX >= 0 && pixelX < pixelGridSize && pixelY >= 0 && pixelY < pixelGridSize) {
                         // --- CHANGE: Populate both intensity grids ---
                         const sensorPixel = sensorIntensities[pixelY][pixelX];
                         sensorPixel.r += getFilterResponse(result.wavelength, 'R');
                         sensorPixel.g += getFilterResponse(result.wavelength, 'G');
                         sensorPixel.b += getFilterResponse(result.wavelength, 'B');
                         maxSensorIntensity = Math.max(maxSensorIntensity, sensorPixel.r, sensorPixel.g, sensorPixel.b);
                         
                         const trueColorPixel = trueColorIntensities[pixelY][pixelX];
                         const trueColor = wavelengthToRGB(result.wavelength);
                         trueColorPixel.r += trueColor.r;
                         trueColorPixel.g += trueColor.g;
                         trueColorPixel.b += trueColor.b;
                         maxTrueColorIntensity = Math.max(maxTrueColorIntensity, trueColorPixel.r, trueColorPixel.g, trueColorPixel.b);
                    }
                } else {
                    nextActivePaths.push(currentPath);
                }
            } else {
                nextActivePaths.push(currentPath);
            }
        }
        activePaths = nextActivePaths;
    }

    // 4. Draw all completed paths
    activePaths.forEach((finalPath, index) => {
        if (!finalPath.terminated) {
            finalPath.path.push(finalPath.ray.origin.clone().add(finalPath.ray.direction.clone().multiplyScalar(25)));
        }
        
        if (initialRays.length > 20 && index % 5 !== 0) return;
        
        if (wavelength === 'white' && finalPath.hasSplit) {
            const grating = opticalElements.find(el => el.type === 'grating');
            if (grating) {
                const gratingX = grating.mesh.position.x;
                let splitIndex = finalPath.path.findIndex(p => p.x.toPrecision(5) === gratingX.toPrecision(5));
                if (splitIndex === -1) splitIndex = 1;

                const preSplitPath = finalPath.path.slice(0, splitIndex + 1);
                const postSplitPath = finalPath.path.slice(splitIndex);

                if (preSplitPath.length > 1) {
                    const whiteMaterial = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
                    rayGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(preSplitPath), whiteMaterial));
                }
                if (postSplitPath.length > 1) {
                    const color = finalPath.ray.diffractionOrder === 0 ? 0x000000 : wavelengthToRGB(finalPath.ray.wavelength);
                    const colorMaterial = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.5 });
                    rayGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(postSplitPath), colorMaterial));
                }
            }
        } else {
            const color = (wavelength === 'white') ? 0x000000 : wavelengthToRGB(finalPath.ray.wavelength);
            const beamMaterial = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.5 });
            const beamGeometry = new THREE.BufferGeometry().setFromPoints(finalPath.path);
            rayGroup.add(new THREE.Line(beamGeometry, beamMaterial));
        }
    });

    // 5. Draw the final image on the sensor canvas
    if (pixelCtx) {
        const pixelSize = pixelCanvas.width / pixelGridSize;
        for (let y = 0; y < pixelGridSize; y++) {
            for (let x = 0; x < pixelGridSize; x++) {
                if (sensorType === 'demosaiced') {
                    // --- CHANGE: Use the trueColorIntensities grid ---
                    if (maxTrueColorIntensity > 0) {
                        const pixel = trueColorIntensities[y][x];
                        if (pixel.r > 0 || pixel.g > 0 || pixel.b > 0) {
                            const r = Math.round(255 * (pixel.r / maxTrueColorIntensity));
                            const g = Math.round(255 * (pixel.g / maxTrueColorIntensity));
                            const b = Math.round(255 * (pixel.b / maxTrueColorIntensity));
                            pixelCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                            pixelCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                        }
                    }
                } else {
                    // --- CHANGE: Use the sensorIntensities grid for Bayer/Grayscale ---
                    if (maxSensorIntensity > 0) {
                        const pixel = sensorIntensities[y][x];
                        if (pixel.r > 0 || pixel.g > 0 || pixel.b > 0) {
                            const r = Math.round(255 * (pixel.r / maxSensorIntensity));
                            const g = Math.round(255 * (pixel.g / maxSensorIntensity));
                            const b = Math.round(255 * (pixel.b / maxSensorIntensity));
                            
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
                            } else { // Grayscale
                                const gray = Math.round((r + g + b) / 3);
                                pixelCtx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                            }
                            pixelCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                        }
                    }
                }
            }
        }
    }
}
