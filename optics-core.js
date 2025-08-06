// === OPTICS CORE ENGINE - V3.3 (New Laser Shapes) ===
// Contains the fundamental physics, ray class, and the main tracing loop.
// MODIFIED: Added 'heart', 'star', and 'smile' cases to the laser pattern
// generation logic using parametric equations and vertex interpolation.

export class Ray {
    constructor(origin, direction, wavelength = 532, color = null) {
        this.origin = origin;
        this.direction = direction.normalize();
        this.wavelength = wavelength;
        this.color = color;
    }
}

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

export function traceRays(config) {
    const { rayGroup, opticalElements, laserSource, imageObject, pixelCtx, pixelCanvas, pixelGridSize, wavelength, laserPattern, setupKey, sensorType, rayCount = 100, backgroundColor = 'white' } = config;

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
    
    let initialRays = [];
    
    if (setupKey === 'camera-image-object') {
        const detector = opticalElements.find(el => el.type === 'detector');
        const lens = opticalElements.find(el => el.type === 'thin-lens');
        const texture = imageObject.material.map;

        if (!detector || !lens || !texture || !texture.image || texture.image.width === 0) return;

        const image = texture.image;
        const imgCanvas = document.createElement('canvas');
        imgCanvas.width = image.width;
        imgCanvas.height = image.height;
        const imgCtx = imgCanvas.getContext('2d', { willReadFrequently: true });
        imgCtx.drawImage(image, 0, 0, image.width, image.height);
        const imageData = imgCtx.getImageData(0, 0, image.width, image.height).data;
        
        const perfectImageGrid = Array(pixelGridSize).fill(null).map(() => Array(pixelGridSize).fill(null));
        const sourceDataGrid = Array(pixelGridSize).fill(null).map(() => Array(pixelGridSize).fill(null));

        for (let py = 0; py < pixelGridSize; py++) {
            for (let px = 0; px < pixelGridSize; px++) {
                const localX = (px / pixelGridSize - 0.5) * detector.mesh.geometry.parameters.width;
                const localY = (py / pixelGridSize - 0.5) * detector.mesh.geometry.parameters.height;
                const sensorPoint = detector.mesh.localToWorld(new THREE.Vector3(localX, -localY, 0));
                const dirToLens = lens.mesh.position.clone().sub(sensorPoint).normalize();
                const intersectOnLens = sensorPoint.clone().add(dirToLens.clone().multiplyScalar((lens.mesh.position.x - sensorPoint.x) / dirToLens.x));
                let color = { r: 0, g: 0, b: 0 };
                const so_calc = Math.abs(sensorPoint.x - lens.mesh.position.x);
                const denominator = 1 / lens.focalLength - 1 / so_calc;

                if (Math.abs(denominator) < 1e-9) {
                    perfectImageGrid[py][px] = color;
                    sourceDataGrid[py][px] = { origin: null, color: new THREE.Color(0,0,0) };
                    continue; 
                }
                
                const si_calc = 1 / denominator;
                const M = -si_calc / so_calc;
                const ho_y_calc = sensorPoint.y - lens.mesh.position.y;
                const ho_z_calc = sensorPoint.z - lens.mesh.position.z;
                const objectPlanePoint = new THREE.Vector3(lens.mesh.position.x + si_calc, lens.mesh.position.y + (ho_y_calc * M), lens.mesh.position.z + (ho_z_calc * M));
                const dirFromLens = objectPlanePoint.clone().sub(intersectOnLens).normalize();

                if (Math.abs(dirFromLens.x) < 1e-9) {
                    perfectImageGrid[py][px] = color;
                    sourceDataGrid[py][px] = { origin: null, color: new THREE.Color(0,0,0) };
                    continue; 
                }

                const objectHitPoint = intersectOnLens.clone().add(dirFromLens.clone().multiplyScalar((imageObject.position.x - intersectOnLens.x) / dirFromLens.x));
                const localIntersect = imageObject.worldToLocal(objectHitPoint.clone());
                const u = (localIntersect.x / imageObject.geometry.parameters.width) + 0.5;
                const v = 1.0 - ((localIntersect.y / imageObject.geometry.parameters.height) + 0.5);

                if (u >= 0 && u < 1 && v >= 0 && v < 1) {
                    const imgX = Math.floor(u * image.width);
                    const imgY = Math.floor(v * image.height);
                    const C_idx = (imgY * image.width + imgX) * 4;
                    color = { r: imageData[C_idx], g: imageData[C_idx + 1], b: imageData[C_idx + 2] };
                }
                
                perfectImageGrid[py][px] = color;
                sourceDataGrid[py][px] = { origin: objectHitPoint, color: new THREE.Color(color.r/255, color.g/255, color.b/255) };
            }
        }
        
        const so_center = Math.abs(imageObject.position.x - lens.mesh.position.x);
        const si_focused = 1 / (1 / lens.focalLength - 1 / so_center);
        const si_actual = Math.abs(detector.mesh.position.x - lens.mesh.position.x);
        const R_lens = lens.mesh.geometry.parameters.radiusTop;
        let coc_radius_world = 0;
        if (Math.abs(si_focused) > 1e-6) {
             coc_radius_world = (R_lens * Math.abs(si_actual - si_focused)) / Math.abs(si_focused);
        }
        const detector_pixel_size_world = detector.mesh.geometry.parameters.width / pixelGridSize;
        const coc_radius_pixels = coc_radius_world / detector_pixel_size_world;
        const coc_radius_pixels_sq = coc_radius_pixels * coc_radius_pixels;
        const pixelSize = pixelCanvas.width / pixelGridSize;

        for (let py = 0; py < pixelGridSize; py++) {
            for (let px = 0; px < pixelGridSize; px++) {
                let color;
                if (coc_radius_pixels < 0.5) {
                     color = perfectImageGrid[py][px];
                } else {
                    let totalColor = { r: 0, g: 0, b: 0 };
                    let sampleCount = 0;
                    const startY = Math.max(0, Math.floor(py - coc_radius_pixels));
                    const endY = Math.min(pixelGridSize - 1, Math.ceil(py + coc_radius_pixels));
                    const startX = Math.max(0, Math.floor(px - coc_radius_pixels));
                    const endX = Math.min(pixelGridSize - 1, Math.ceil(px + coc_radius_pixels));
                    
                    for (let y = startY; y <= endY; y++) {
                        for (let x = startX; x <= endX; x++) {
                            const dx = x - px;
                            const dy = y - py;
                            if (dx*dx + dy*dy <= coc_radius_pixels_sq) {
                                const sampleColor = perfectImageGrid[y][x];
                                if (sampleColor) {
                                    totalColor.r += sampleColor.r;
                                    totalColor.g += sampleColor.g;
                                    totalColor.b += sampleColor.b;
                                    sampleCount++;
                                }
                            }
                        }
                    }
                    
                    let finalColor = { r: 0, g: 0, b: 0 };
                    if (sampleCount > 0) {
                        finalColor.r = Math.round(totalColor.r / sampleCount);
                        finalColor.g = Math.round(totalColor.g / sampleCount);
                        finalColor.b = Math.round(totalColor.b / sampleCount);
                    }
                    color = finalColor;
                }

                if (sensorType === 'grayscale') {
                    const gray = Math.round(color.r * 0.299 + color.g * 0.587 + color.b * 0.114);
                    pixelCtx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                } else if (sensorType === 'bayer') {
                    const isTopRow = py % 2 === 0;
                    const isLeftColumn = px % 2 === 0;
                    if (isTopRow) {
                        if (isLeftColumn) pixelCtx.fillStyle = `rgb(0, ${color.g}, 0)`;
                        else pixelCtx.fillStyle = `rgb(${color.r}, 0, 0)`;
                    } else {
                        if (isLeftColumn) pixelCtx.fillStyle = `rgb(0, 0, ${color.b})`;
                        else pixelCtx.fillStyle = `rgb(0, ${color.g}, 0)`;
                    }
                } else {
                    pixelCtx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
                }
                pixelCtx.fillRect(px * pixelSize, py * pixelSize, pixelSize, pixelSize);
            }
        }

        const CONES_TO_VISUALIZE = 30;
        const visualizationSpacing = Math.floor((pixelGridSize * pixelGridSize) / CONES_TO_VISUALIZE);
        for (let py = 0; py < pixelGridSize; py++) {
            for (let px = 0; px < pixelGridSize; px++) {
                 if ((py * pixelGridSize + px) % visualizationSpacing === 0) {
                    const sourceData = sourceDataGrid[py][px];
                    if (sourceData && sourceData.origin && (sourceData.color.r > 0 || sourceData.color.g > 0 || sourceData.color.b > 0)) {
                         const { origin, color } = sourceData;
                         const lensCenter = lens.mesh.position;
                         const lensRadius = lens.mesh.geometry.parameters.radiusTop;
                         const rayTargets = [
                             lensCenter,
                             lensCenter.clone().add(new THREE.Vector3(0, lensRadius, 0)), lensCenter.clone().add(new THREE.Vector3(0, -lensRadius, 0)),
                             lensCenter.clone().add(new THREE.Vector3(0, 0, lensRadius)), lensCenter.clone().add(new THREE.Vector3(0, 0, -lensRadius))
                         ];
                         rayTargets.forEach(target => {
                             initialRays.push(new Ray(origin.clone(), target.clone().sub(origin), 555, color));
                         });
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
                case 'heart':
                    for (let i = 0; i < rayCount; i++) {
                        const t = (i / rayCount) * 2 * Math.PI;
                        const zOffset = (16 * Math.pow(Math.sin(t), 3)) / 16 * (beamSize / 1.5);
                        const yOffset = (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) / 16 * (beamSize / 1.5);
                        const startPoint = new THREE.Vector3(-9.75, laserSource.position.y - yOffset, laserSource.position.z + zOffset);
                        patternRays.push(new Ray(startPoint, parallelDirection, wl));
                    }
                    break;
                case 'star':
                    const numPoints = 5;
                    const vertices = [];
                    const outerRadius = beamSize / 2;
                    const innerRadius = outerRadius * 0.5;
                    const angleStep = Math.PI / numPoints;

                    for (let i = 0; i < 2 * numPoints; i++) {
                        const radius = (i % 2 === 0) ? outerRadius : innerRadius;
                        const angle = i * angleStep - Math.PI / 2;
                        vertices.push(new THREE.Vector2(
                            radius * Math.cos(angle),
                            radius * Math.sin(angle)
                        ));
                    }

                    for (let i = 0; i < rayCount; i++) {
                        const t = (i / rayCount) * (2 * numPoints);
                        const startIndex = Math.floor(t);
                        const endIndex = (startIndex + 1) % (2 * numPoints);
                        const segmentT = t - startIndex;

                        const startVec = vertices[startIndex];
                        const endVec = vertices[endIndex];
                        
                        const point = startVec.clone().lerp(endVec, segmentT);

                        const yOffset = point.y;
                        const zOffset = point.x;
                        const startPoint = new THREE.Vector3(-9.75, laserSource.position.y + yOffset, laserSource.position.z + zOffset);
                        patternRays.push(new Ray(startPoint, parallelDirection, wl));
                    }
                    break;
                case 'smile':
                    const headRays = Math.floor(rayCount * 0.5);
                    const eyeRays = Math.floor(rayCount * 0.15);
                    const mouthRays = rayCount - headRays - (2 * eyeRays);

                    for (let i = 0; i < headRays; i++) {
                        const angle = (i / headRays) * 2 * Math.PI;
                        const yOffset = (beamSize / 2) * Math.sin(angle);
                        const zOffset = (beamSize / 2) * Math.cos(angle);
                        patternRays.push(new Ray(new THREE.Vector3(-9.75, laserSource.position.y + yOffset, laserSource.position.z + zOffset), parallelDirection, wl));
                    }
                    for (let i = 0; i < eyeRays; i++) {
                        const angle = (i / eyeRays) * 2 * Math.PI;
                        let yOffset = (beamSize * 0.1) * Math.sin(angle) + (beamSize * 0.2);
                        let zOffset = (beamSize * 0.1) * Math.cos(angle) - (beamSize * 0.2);
                        patternRays.push(new Ray(new THREE.Vector3(-9.75, laserSource.position.y + yOffset, laserSource.position.z + zOffset), parallelDirection, wl));
                        zOffset = (beamSize * 0.1) * Math.cos(angle) + (beamSize * 0.2);
                        patternRays.push(new Ray(new THREE.Vector3(-9.75, laserSource.position.y + yOffset, laserSource.position.z + zOffset), parallelDirection, wl));
                    }
                    for (let i = 0; i < mouthRays; i++) {
                        const angle = Math.PI + (i / mouthRays) * Math.PI;
                        const yOffset = (beamSize * 0.3) * Math.sin(angle) - (beamSize * 0.1);
                        const zOffset = (beamSize * 0.3) * Math.cos(angle);
                        patternRays.push(new Ray(new THREE.Vector3(-9.75, laserSource.position.y + yOffset, laserSource.position.z + zOffset), parallelDirection, wl));
                    }
                    break;
            }
            initialRays.push(...patternRays);
        });
    }
    
    const sensorIntensities = Array(pixelGridSize).fill(null).map(() => Array(pixelGridSize).fill(null).map(() => ({ r: 0, g: 0, b: 0 })));
    const trueColorIntensities = Array(pixelGridSize).fill(null).map(() => Array(pixelGridSize).fill(null).map(() => ({ r: 0, g: 0, b: 0 })));
    let maxSensorIntensity = 0;
    let maxTrueColorIntensity = 0;
    let activePaths = initialRays.map(ray => ({ ray: ray, originalRay: ray, path: [ray.origin], terminated: false, hasSplit: false }));

    for (const element of opticalElements) {
        let nextActivePaths = [];
        for (const currentPath of activePaths) {
            if (currentPath.terminated) {
                nextActivePaths.push(currentPath); continue;
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
                    if (element.type === 'detector' && setupKey !== 'camera-image-object') {
                        const detector = element.mesh;
                        const localPoint = detector.worldToLocal(result.intersection.clone());
                        const pixelX = Math.floor((localPoint.x / detector.geometry.parameters.width + 0.5) * pixelGridSize);
                        const pixelY = Math.floor((-localPoint.y / detector.geometry.parameters.height + 0.5) * pixelGridSize);

                        if (pixelX >= 0 && pixelX < pixelGridSize && pixelY >= 0 && pixelY < pixelGridSize) {
                             const sensorPixel = sensorIntensities[pixelY][pixelX];
                             const trueColorPixel = trueColorIntensities[pixelY][pixelX];

                             if (result.color || (currentPath.originalRay && currentPath.originalRay.color)) {
                                 const color = result.color || currentPath.originalRay.color;
                                 sensorPixel.r += color.r; sensorPixel.g += color.g; sensorPixel.b += color.b;
                                 trueColorPixel.r += color.r; trueColorPixel.g += color.g; trueColorPixel.b += color.b;
                             } else {
                                 sensorPixel.r += getFilterResponse(result.wavelength, 'R');
                                 sensorPixel.g += getFilterResponse(result.wavelength, 'G');
                                 sensorPixel.b += getFilterResponse(result.wavelength, 'B');
                                 
                                 const trueColor = wavelengthToRGB(result.wavelength);
                                 trueColorPixel.r += trueColor.r; trueColorPixel.g += trueColor.g; trueColorPixel.b += trueColor.b;
                             }
                             
                             maxSensorIntensity = Math.max(maxSensorIntensity, sensorPixel.r, sensorPixel.g, sensorPixel.b);
                             maxTrueColorIntensity = Math.max(maxTrueColorIntensity, trueColorPixel.r, trueColorPixel.g, trueColorPixel.b);
                        }
                    }
                } else { nextActivePaths.push(currentPath); }
            } else { nextActivePaths.push(currentPath); }
        }
        activePaths = nextActivePaths;
    }

    activePaths.forEach(finalPath => {
        if (!finalPath.terminated) {
            finalPath.path.push(finalPath.ray.origin.clone().add(finalPath.ray.direction.clone().multiplyScalar(25)));
        }
        
        const whiteLightColor = (backgroundColor === 'black') ? 0xffffff : 0x000000;

        if (wavelength === 'white' && finalPath.hasSplit) {
            const grating = opticalElements.find(el => el.type === 'grating' || el.type === 'reflective-grating');
            if (grating) {
                if (finalPath.path.length < 2) return;

                const preSplitPath = finalPath.path.slice(0, -1);
                const postSplitPath = finalPath.path.slice(-2);

                if (preSplitPath.length > 0) {
                    rayGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(preSplitPath), new THREE.LineBasicMaterial({ color: whiteLightColor, transparent: true, opacity: 0.6 })));
                }
                if (postSplitPath.length > 1) {
                    const m = finalPath.ray.diffractionOrder;
                    const color = (m === 0) ? whiteLightColor : wavelengthToRGB(finalPath.ray.wavelength);
                    rayGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(postSplitPath), new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.6 })));
                }
                return;
            }
        }
        
        const rayColor = finalPath.originalRay.color || ((wavelength === 'white') ? whiteLightColor : wavelengthToRGB(finalPath.ray.wavelength));
        rayGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(finalPath.path), new THREE.LineBasicMaterial({ color: rayColor, transparent: true, opacity: 0.6 })));
    });

    if (pixelCtx && setupKey !== 'camera-image-object') {
        const pixelSize = pixelCanvas.width / pixelGridSize;
        for (let y = 0; y < pixelGridSize; y++) {
            for (let x = 0; x < pixelGridSize; x++) {
                 let r = 0, g = 0, b = 0;
                 if (sensorType === 'demosaiced') {
                    if (maxTrueColorIntensity > 0) {
                        const pixel = trueColorIntensities[y][x];
                        r = Math.round(255 * (pixel.r / maxTrueColorIntensity));
                        g = Math.round(255 * (pixel.g / maxTrueColorIntensity));
                        b = Math.round(255 * (pixel.b / maxTrueColorIntensity));
                    }
                     pixelCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                } else {
                    if (maxSensorIntensity > 0) {
                        const pixel = sensorIntensities[y][x];
                        r = Math.round(255 * (pixel.r / maxSensorIntensity));
                        g = Math.round(255 * (pixel.g / maxSensorIntensity));
                        b = Math.round(255 * (pixel.b / maxSensorIntensity));
                        
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
                        } else {
                            const gray = Math.round((r + g + b) / 3);
                            pixelCtx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                        }
                    } else {
                        pixelCtx.fillStyle = 'rgb(0,0,0)';
                    }
                }
                 pixelCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            }
        }
    }
}

