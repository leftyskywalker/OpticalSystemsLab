// === OPTICS CORE ENGINE - V2.3 (Detector Bug Fix) ===
// Contains the fundamental physics, ray class, and the main tracing loop.
// MODIFIED: Implemented realistic ray cone generation for the image object setup.

/**
 * Represents a light ray with an origin, direction, and wavelength.
 */
export class Ray {
    constructor(origin, direction, wavelength = 532, color = null) {
        this.origin = origin;
        this.direction = direction.normalize();
        this.wavelength = wavelength;
        this.color = color; // Can be a THREE.Color object
    }
}

/**
 * A helper function to convert a wavelength in nanometers to an RGB color for VISUALIZATION ONLY.
 */
export function wavelengthToRGB(wavelength) {
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

/**
 * Helper function for ray-sphere intersection.
 */
export function getRaySphereIntersection(ray, sphereCenter, sphereRadius) {
    const L = sphereCenter.clone().sub(ray.origin);
    const tca = L.dot(ray.direction);
    if (tca < 0 && sphereRadius < 0) return null;

    const d2 = L.dot(L) - tca * tca;
    const radius2 = sphereRadius * sphereRadius;
    if (d2 > radius2) return null;

    const thc = Math.sqrt(radius2 - d2);
    let t0 = tca - thc;
    let t1 = tca + thc;

    if (t0 > t1) [t0, t1] = [t1, t0];

    if (t0 > 1e-6) return ray.origin.clone().add(ray.direction.clone().multiplyScalar(t0));
    if (t1 > 1e-6) return ray.origin.clone().add(ray.direction.clone().multiplyScalar(t1));
    
    return null;
}

/**
 * --- Unified Ray Tracing Engine ---
 */
export function traceRays(config) {
    const { rayGroup, opticalElements, laserSource, imageObject, pixelCtx, pixelCanvas, pixelGridSize, wavelength, laserPattern, setupKey, sensorType, rayCount = 100, backgroundColor = 'white' } = config;

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

    const sensorIntensities = Array(pixelGridSize).fill(null).map(() => Array(pixelGridSize).fill(null).map(() => ({ r: 0, g: 0, b: 0 })));
    const trueColorIntensities = Array(pixelGridSize).fill(null).map(() => Array(pixelGridSize).fill(null).map(() => ({ r: 0, g: 0, b: 0 })));
    let maxSensorIntensity = 0;
    let maxTrueColorIntensity = 0;

    // 2. Generate initial rays
    let initialRays = [];
    let activePaths = [];

    if (setupKey === 'camera-image-object') {
        const lensElement = opticalElements.find(el => el.type === 'thin-lens');
        if (!lensElement) {
             console.error("Camera setup requires a lens, but none was found.");
             return; 
        }
        const lensCenter = lensElement.mesh.position;
        const lensRadius = lensElement.mesh.geometry.parameters.radiusTop;

        const texture = imageObject.material.map;
        if (texture && texture.image && texture.image.width > 0) {
            const image = texture.image;
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, image.width, image.height);
            const imageData = ctx.getImageData(0, 0, image.width, image.height).data;

            const planeWidth = imageObject.geometry.parameters.width;
            const planeHeight = imageObject.geometry.parameters.height;
            
            const PIXEL_SAMPLING_RATE = 25; // Adjusted sampling rate for the new ray model

            for (let y = 0; y < image.height; y += PIXEL_SAMPLING_RATE) {
                for (let x = 0; x < image.width; x += PIXEL_SAMPLING_RATE) {
                    const index = (y * image.width + x) * 4;
                    const r = imageData[index] / 255;
                    const g = imageData[index + 1] / 255;
                    const b = imageData[index + 2] / 255;
                    const a = imageData[index + 3] / 255;

                    if (a > 0) {
                        const localX = (x / image.width - 0.5) * planeWidth;
                        const localY = -(y / image.height - 0.5) * planeHeight;
                        
                        const origin = imageObject.localToWorld(new THREE.Vector3(localX, localY, 0));
                        const color = new THREE.Color(r, g, b);
                        
                        // --- MODIFICATION START: Generate a cone of rays ---

                        // 1. Chief Ray (from object point through lens center)
                        const chiefDir = lensCenter.clone().sub(origin).normalize();
                        initialRays.push(new Ray(origin.clone(), chiefDir, 555, color));

                        // 2. Marginal Rays (from object point to the 4 edges of the lens)
                        const marginalPoints = [
                            lensCenter.clone().add(new THREE.Vector3(0, lensRadius, 0)),  // Top edge
                            lensCenter.clone().add(new THREE.Vector3(0, -lensRadius, 0)), // Bottom edge
                            lensCenter.clone().add(new THREE.Vector3(0, 0, lensRadius)),  // Right edge (from camera's perspective)
                            lensCenter.clone().add(new THREE.Vector3(0, 0, -lensRadius))  // Left edge (from camera's perspective)
                        ];

                        marginalPoints.forEach(point => {
                            const marginalDir = point.clone().sub(origin).normalize();
                            initialRays.push(new Ray(origin.clone(), marginalDir, 555, color));
                        });
                        
                        // --- MODIFICATION END ---
                    }
                }
            }
        }
    } else {
        const wavelengths = (wavelength === 'white') ? [450, 532, 650] : [wavelength];
        const beamSize = 1.0; 
    
        wavelengths.forEach(wl => {
            let patternRays = [];
            const parallelDirection = new THREE.Vector3(1, 0, 0);
            switch (laserPattern) {
                case 'line':
                    for (let i = 0; i < rayCount; i++) {
                        const yOffset = (rayCount === 1) ? 0 : -beamSize / 2 + beamSize * (i / (rayCount - 1));
                        patternRays.push(new Ray(new THREE.Vector3(-9.75, laserSource.position.y + yOffset, laserSource.position.z), parallelDirection, wl));
                    }
                    break;
                case 'radial':
                     for (let i = 0; i < rayCount; i++) {
                        const angle = (i / rayCount) * 2 * Math.PI;
                        const yOffset = Math.sin(angle) * beamSize / 2;
                        const zOffset = Math.cos(angle) * beamSize / 2;
                        const startPoint = new THREE.Vector3(-9.75, laserSource.position.y + yOffset, laserSource.position.z + zOffset);
                        patternRays.push(new Ray(startPoint, parallelDirection, wl));
                    }
                    break;
                case 'cross':
                    const halfCount = Math.floor(rayCount / 2);
                    for (let i = 0; i < halfCount; i++) {
                        const yOffset = (halfCount <= 1) ? 0 : -beamSize / 2 + beamSize * (i / (halfCount - 1));
                        patternRays.push(new Ray(new THREE.Vector3(-9.75, laserSource.position.y + yOffset, laserSource.position.z), parallelDirection, wl));
                    }
                    for (let i = 0; i < halfCount; i++) {
                        const zOffset = (halfCount <= 1) ? 0 : -beamSize / 2 + beamSize * (i / (halfCount - 1));
                        patternRays.push(new Ray(new THREE.Vector3(-9.75, laserSource.position.y, laserSource.position.z + zOffset), parallelDirection, wl));
                    }
                    break;
                case 'disc':
                    for (let i = 0; i < rayCount; i++) {
                        const radius = (beamSize / 2) * Math.sqrt(Math.random());
                        const angle = Math.random() * 2 * Math.PI;
                        const yOffset = radius * Math.sin(angle);
                        const zOffset = radius * Math.cos(angle);
                        const startPoint = new THREE.Vector3(-9.75, laserSource.position.y + yOffset, laserSource.position.z + zOffset);
                        patternRays.push(new Ray(startPoint, parallelDirection, wl));
                    }
                    break;
            }
            initialRays.push(...patternRays);
        });
    }
    
    activePaths = initialRays.map(ray => ({ ray: ray, originalRay: ray, path: [ray.origin], terminated: false, hasSplit: false }));

    // 3. Unified Tracing Loop
    for (const element of opticalElements) {
        let nextActivePaths = [];
        for (const currentPath of activePaths) {
            if (currentPath.terminated) {
                nextActivePaths.push(currentPath);
                continue;
            }

            const result = element.processRay(currentPath.ray, currentPath.originalRay, config);
            if (result) {
                if (result.newRays) { 
                    result.newRays.forEach(newRay => {
                        nextActivePaths.push({ ray: newRay, originalRay: currentPath.originalRay, path: [...currentPath.path, newRay.origin], terminated: false, hasSplit: true });
                    });
                } else if (result.newRay) { 
                    currentPath.path.push(result.newRay.origin);
                    currentPath.ray = result.newRay;
                    nextActivePaths.push(currentPath);
                } else if (result.intersection) { 
                    currentPath.path.push(result.intersection);
                    currentPath.terminated = true;
                    nextActivePaths.push(currentPath);
                    
                    const detector = element.mesh;
                    const localPoint = detector.worldToLocal(result.intersection.clone());
                    const detectorWidth = detector.geometry.parameters.width;
                    const detectorHeight = detector.geometry.parameters.height;
                    
                    const pixelX = Math.floor((localPoint.x / detectorWidth + 0.5) * pixelGridSize);
                    const pixelY = Math.floor((-localPoint.y / detectorHeight + 0.5) * pixelGridSize);

                    if (pixelX >= 0 && pixelX < pixelGridSize && pixelY >= 0 && pixelY < pixelGridSize) {
                         const sensorPixel = sensorIntensities[pixelY][pixelX];
                         const trueColorPixel = trueColorIntensities[pixelY][pixelX];

                         if (result.color) {
                             sensorPixel.r += result.color.r;
                             sensorPixel.g += result.color.g;
                             sensorPixel.b += result.color.b;

                             trueColorPixel.r += result.color.r;
                             trueColorPixel.g += result.color.g;
                             trueColorPixel.b += result.color.b;
                         } else {
                             sensorPixel.r += getFilterResponse(result.wavelength, 'R');
                             sensorPixel.g += getFilterResponse(result.wavelength, 'G');
                             sensorPixel.b += getFilterResponse(result.wavelength, 'B');
                             
                             const trueColor = wavelengthToRGB(result.wavelength);
                             trueColorPixel.r += trueColor.r;
                             trueColorPixel.g += trueColor.g;
                             trueColorPixel.b += trueColor.b;
                         }
                         
                         maxSensorIntensity = Math.max(maxSensorIntensity, sensorPixel.r, sensorPixel.g, sensorPixel.b);
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
        
        const whiteLightColor = (backgroundColor === 'black') ? 0xffffff : 0x000000;
        let rayColor;

        if (finalPath.ray.color) {
            rayColor = finalPath.ray.color;
        } else {
            rayColor = (wavelength === 'white') ? whiteLightColor : wavelengthToRGB(finalPath.ray.wavelength);
        }

        if (wavelength === 'white' && finalPath.hasSplit) {
            const grating = opticalElements.find(el => el.type === 'grating');
            if (grating) {
                const gratingX = grating.mesh.position.x;
                let splitIndex = finalPath.path.findIndex(p => p.x.toPrecision(5) === gratingX.toPrecision(5));
                if (splitIndex === -1) splitIndex = 1;

                const preSplitPath = finalPath.path.slice(0, splitIndex + 1);
                const postSplitPath = finalPath.path.slice(splitIndex);

                if (preSplitPath.length > 1) {
                    const whiteMaterial = new THREE.LineBasicMaterial({ color: whiteLightColor, transparent: true, opacity: 0.5 });
                    rayGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(preSplitPath), whiteMaterial));
                }
                if (postSplitPath.length > 1) {
                    const color = finalPath.ray.diffractionOrder === 0 ? whiteLightColor : wavelengthToRGB(finalPath.ray.wavelength);
                    const colorMaterial = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.5 });
                    rayGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(postSplitPath), colorMaterial));
                }
            }
        } else {
            const beamMaterial = new THREE.LineBasicMaterial({ color: rayColor, transparent: true, opacity: 0.5 });
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
                                    if (isLeftColumn) pixelCtx.fillStyle = `rgb(0, ${g}, 0)`;
                                    else pixelCtx.fillStyle = `rgb(${r}, 0, 0)`;
                                } else {
                                    if (isLeftColumn) pixelCtx.fillStyle = `rgb(0, 0, ${b})`;
                                    else pixelCtx.fillStyle = `rgb(0, ${g}, 0)`;
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