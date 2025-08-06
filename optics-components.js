// === OPTICS COMPONENTS - V3.4 (Grating Orientation) ===
// Contains the factory functions for creating optical elements.
// MODIFIED: Added a 'lineOrientation' property to both transmissive and reflective
// gratings to allow toggling between horizontal and vertical dispersion.

import { Ray, getRaySphereIntersection } from './optics-core.js';

export function createLens(name, position, focalLength, elementGroup) {
    const lensMaterial = new THREE.MeshPhysicalMaterial({ color: 0x22dd22, transparent: true, opacity: 0.75, roughness: 0.1, transmission: 0.8, ior: 1.5, thickness: 0.2 });
    const lensGeometry = new THREE.CylinderGeometry(3.5, 3.5, 0.2, 32);
    const mesh = new THREE.Mesh(lensGeometry, lensMaterial);
    mesh.name = name;
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.z = Math.PI / 2;
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(lensGeometry), new THREE.LineBasicMaterial({ color: 0x003300 })));
    elementGroup.add(mesh);

    const element = {
        mesh: mesh, type: 'thin-lens', focalLength: focalLength,
        processRay: function(ray, originalRay, config) {
            if (ray.direction.x === 0) return null;
            const t = (this.mesh.position.x - ray.origin.x) / ray.direction.x;
            
            if (t > 1e-6) {
                const intersectPoint = ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
                const intersectPointLocal = this.mesh.worldToLocal(intersectPoint.clone());
                const distFromCenter = Math.sqrt(intersectPointLocal.x**2 + intersectPointLocal.z**2);

                if (distFromCenter <= lensGeometry.parameters.radiusTop + 1e-6) {
                    if (config && config.setupKey === 'camera-image-object') {
                        const objectPoint = originalRay.origin;
                        const lensPosition = this.mesh.position;
                        const so = Math.abs(objectPoint.x - lensPosition.x);

                        if (Math.abs(so - this.focalLength) < 1e-6) {
                            const undeviatedRayDirection = lensPosition.clone().sub(objectPoint).normalize();
                            return { newRay: new Ray(intersectPoint, undeviatedRayDirection, ray.wavelength, ray.color) };
                        }
                        
                        const si = 1 / (1 / this.focalLength - 1 / so);
                        const M = -si / so;
                        const ho_y = objectPoint.y - lensPosition.y;
                        const ho_z = objectPoint.z - lensPosition.z;
                        const hi_y = ho_y * M;
                        const hi_z = ho_z * M;
                        const imagePoint = new THREE.Vector3(lensPosition.x + si, lensPosition.y + hi_y, lensPosition.z + hi_z);
                        const newDir = imagePoint.clone().sub(intersectPoint).normalize();
                        
                        return { newRay: new Ray(intersectPoint, newDir, ray.wavelength, ray.color) };
                    } else {
                        const y = intersectPoint.y - this.mesh.position.y;
                        const z = intersectPoint.z - this.mesh.position.z;
                        const newDirY = ray.direction.y - y / this.focalLength;
                        const newDirZ = ray.direction.z - z / this.focalLength;
                        const newDir = new THREE.Vector3(ray.direction.x, newDirY, newDirZ).normalize();

                        return { newRay: new Ray(intersectPoint, newDir, ray.wavelength, ray.color) };
                    }
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
        processRay: function(ray, originalRay) {
            const plane = new THREE.Plane();
            const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
            plane.setFromNormalAndCoplanarPoint(normal, this.mesh.position);
            const intersectPoint = new THREE.Vector3();
            if (plane.intersectLine(new THREE.Line3(ray.origin, ray.origin.clone().add(ray.direction.clone().multiplyScalar(100))), intersectPoint)) {
                if (ray.direction.dot(intersectPoint.clone().sub(ray.origin)) < 0) return null;
                const localPoint = this.mesh.worldToLocal(intersectPoint.clone());
                if (Math.abs(localPoint.x) <= mirrorGeometry.parameters.width / 2 && Math.abs(localPoint.y) <= mirrorGeometry.parameters.height / 2) {
                    const reflectedDir = ray.direction.clone().reflect(normal);
                    return { newRay: new Ray(intersectPoint, reflectedDir, ray.wavelength, ray.color) };
                }
            }
            return null;
        }
    };
    return { mesh, element };
}

export function createSphericalMirror(name, position, radius, angle, envMap, elementGroup) {
    const mirrorMaterial = new THREE.MeshStandardMaterial({
        color: 0xeeeeee, metalness: 1.0, roughness: 0.0, envMap: envMap
    });
    const mirrorGeometry = new THREE.PlaneGeometry(5, 5);
    const mesh = new THREE.Mesh(mirrorGeometry, mirrorMaterial);
    mesh.name = name;
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.y = -Math.PI / 2 - angle * (Math.PI / 180); 
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mirrorGeometry), new THREE.LineBasicMaterial({ color: 0x333333 })));
    elementGroup.add(mesh);

    const element = {
        mesh: mesh, type: 'spherical-mirror', radius: radius,
        processRay: function(ray, originalRay) {
            const plane = new THREE.Plane();
            const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
            plane.setFromNormalAndCoplanarPoint(normal, this.mesh.position);
            
            const intersectPoint = new THREE.Vector3();
            if (plane.intersectLine(new THREE.Line3(ray.origin, ray.origin.clone().add(ray.direction.clone().multiplyScalar(100))), intersectPoint)) {
                if (ray.direction.dot(intersectPoint.clone().sub(ray.origin)) < 0) return null;
                
                const localPoint = this.mesh.worldToLocal(intersectPoint.clone());
                if (Math.abs(localPoint.x) <= mirrorGeometry.parameters.width / 2 && Math.abs(localPoint.y) <= mirrorGeometry.parameters.height / 2) {
                    const focalLength = -this.radius / 2;
                    const reflectedDir = ray.direction.clone().reflect(normal);
                    const displacement = intersectPoint.clone().sub(this.mesh.position);
                    const correction = displacement.multiplyScalar(-1 / focalLength);
                    const newDir = reflectedDir.add(correction).normalize();
                    return { newRay: new Ray(intersectPoint, newDir, ray.wavelength, ray.color) };
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
        processRay: function(ray, originalRay) {
            const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), this.mesh.position);
            const intersectPoint = new THREE.Vector3();
            if (plane.intersectLine(new THREE.Line3(ray.origin, ray.origin.clone().add(ray.direction.clone().multiplyScalar(100))), intersectPoint)) {
                if (ray.direction.dot(intersectPoint.clone().sub(ray.origin)) > 0) {
                    return { intersection: intersectPoint, wavelength: ray.wavelength, color: ray.color };
                }
            }
            return null;
        }
    };
    return { mesh, element };
}

export function createDiffractionGrating(name, position, config, elementGroup) {
    const { linesPerMM, lineOrientation = 'horizontal' } = config;
    const gratingMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaee, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    const gratingGeometry = new THREE.PlaneGeometry(5, 5);
    const mesh = new THREE.Mesh(gratingGeometry, gratingMaterial);
    mesh.name = name;
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.y = Math.PI / 2;
    elementGroup.add(mesh);

    const element = {
        mesh: mesh, type: 'grating', linesPerMM: linesPerMM, lineOrientation: lineOrientation,
        processRay: function(ray, originalRay) {
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
                            let newDir;

                            if (this.lineOrientation === 'horizontal') {
                                const originalAngle = Math.atan2(ray.direction.y, ray.direction.x);
                                const newAngle = originalAngle + theta_m;
                                newDir = new THREE.Vector3(Math.cos(newAngle), Math.sin(newAngle), ray.direction.z).normalize();
                            } else { // vertical
                                const originalAngle = Math.atan2(ray.direction.z, ray.direction.x);
                                const newAngle = originalAngle + theta_m;
                                newDir = new THREE.Vector3(Math.cos(newAngle), ray.direction.y, Math.sin(newAngle)).normalize();
                            }
                            
                            const newRay = new Ray(intersectPoint, newDir, ray.wavelength, ray.color);
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

export function createReflectiveGrating(name, position, angle, config, envMap, elementGroup) {
    const { linesPerMM, lineOrientation = 'vertical' } = config;
    const gratingMaterial = new THREE.MeshStandardMaterial({
        color: 0xddddff, metalness: 1.0, roughness: 0.1, envMap: envMap
    });
    const gratingGeometry = new THREE.PlaneGeometry(5, 5);
    const mesh = new THREE.Mesh(gratingGeometry, gratingMaterial);
    mesh.name = name;
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.y = -Math.PI / 2 - angle * (Math.PI / 180);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(gratingGeometry), new THREE.LineBasicMaterial({ color: 0x333333 })));
    elementGroup.add(mesh);

    const element = {
        mesh: mesh, type: 'reflective-grating', linesPerMM: linesPerMM, lineOrientation: lineOrientation,
        processRay: function(ray, originalRay) {
            const plane = new THREE.Plane();
            const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
            plane.setFromNormalAndCoplanarPoint(normal, this.mesh.position);

            if (ray.direction.dot(normal) >= 0) return null;

            const intersectPoint = new THREE.Vector3();
            if (plane.intersectLine(new THREE.Line3(ray.origin, ray.origin.clone().add(ray.direction.clone().multiplyScalar(100))), intersectPoint)) {
                if (ray.direction.dot(intersectPoint.clone().sub(ray.origin)) < 0) return null;

                const localPoint = this.mesh.worldToLocal(intersectPoint.clone());
                if (Math.abs(localPoint.x) <= gratingGeometry.parameters.width / 2 && Math.abs(localPoint.y) <= gratingGeometry.parameters.height / 2) {
                    
                    const reflectedDir = ray.direction.clone().reflect(normal);
                    const d = 1000000 / this.linesPerMM;
                    const newRays = [];

                    let dispersionAxis;
                    if (this.lineOrientation === 'vertical') {
                        dispersionAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(this.mesh.quaternion);
                    } else { // horizontal
                        dispersionAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(this.mesh.quaternion);
                    }
                    
                    const rotationAxis = new THREE.Vector3().crossVectors(reflectedDir, dispersionAxis).normalize();

                    for (let m = -1; m <= 1; m++) {
                        if (m === 0) {
                            const newRay = new Ray(intersectPoint, reflectedDir, ray.wavelength, ray.color);
                            newRay.diffractionOrder = 0;
                            newRays.push(newRay);
                            continue;
                        }

                        const sin_theta_m = (m * ray.wavelength) / d;
                        if (Math.abs(sin_theta_m) <= 1) {
                            const theta_m = Math.asin(sin_theta_m);
                            const newDir = reflectedDir.clone().applyAxisAngle(rotationAxis, theta_m);
                            
                            const newRay = new Ray(intersectPoint, newDir, ray.wavelength, ray.color);
                            newRay.diffractionOrder = m;
                            newRays.push(newRay);
                        }
                    }
                    if (newRays.length > 0) return { newRays: newRays };
                }
            }
            return null;
        }
    };
    return { mesh, element };
}


export function createOpticalSlit(name, position, config, elementGroup) {
    const material = new THREE.MeshStandardMaterial({ color: 0x444444, side: THREE.DoubleSide });
    const plateSize = 5;

    const element = {
        mesh: null, type: 'optical-slit', slitWidth: config.slitWidth, slitHeight: config.slitHeight,
        _rebuildMesh: function() {
            const plateShape = new THREE.Shape();
            plateShape.moveTo(-plateSize / 2, -plateSize / 2);
            plateShape.lineTo(plateSize / 2, -plateSize / 2);
            plateShape.lineTo(plateSize / 2, plateSize / 2);
            plateShape.lineTo(-plateSize / 2, plateSize / 2);
            plateShape.closePath();

            const slitHole = new THREE.Path();
            slitHole.moveTo(-this.slitWidth / 2, -this.slitHeight / 2);
            slitHole.lineTo(this.slitWidth / 2, -this.slitHeight / 2);
            slitHole.lineTo(this.slitWidth / 2, this.slitHeight / 2);
            slitHole.lineTo(-this.slitWidth / 2, this.slitHeight / 2);
            slitHole.closePath();
            
            plateShape.holes.push(slitHole);
            const geometry = new THREE.ShapeGeometry(plateShape);

            if (this.mesh) {
                this.mesh.geometry.dispose();
                this.mesh.geometry = geometry;
            } else {
                this.mesh = new THREE.Mesh(geometry, material);
                this.mesh.name = name;
                this.mesh.position.set(position.x, position.y, position.z);
                this.mesh.rotation.y = Math.PI / 2;
                elementGroup.add(this.mesh);
            }
        },
        processRay: function(ray, originalRay) {
            const t = (this.mesh.position.x - ray.origin.x) / ray.direction.x;
            if (t > 1e-6) {
                const intersectPoint = ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
                const localPoint = this.mesh.worldToLocal(intersectPoint.clone());
                const isInsideSlit = Math.abs(localPoint.x) <= this.slitWidth / 2 && Math.abs(localPoint.y) <= this.slitHeight / 2;

                if (isInsideSlit) {
                    return { newRay: new Ray(intersectPoint, ray.direction, ray.wavelength, ray.color) };
                } else {
                    if (Math.abs(localPoint.x) <= plateSize / 2 && Math.abs(localPoint.y) <= plateSize / 2) {
                        return { intersection: intersectPoint };
                    }
                }
            }
            return null;
        }
    };
    element._rebuildMesh();
    return { mesh: element.mesh, element: element };
}

export function createAperture(name, position, config, elementGroup) {
    const material = new THREE.MeshStandardMaterial({ color: 0x444444, side: THREE.DoubleSide });
    const plateSize = 5;

    const element = {
        mesh: null, type: 'aperture', diameter: config.diameter,
        _rebuildMesh: function() {
            const plateShape = new THREE.Shape();
            plateShape.moveTo(-plateSize / 2, -plateSize / 2);
            plateShape.lineTo(plateSize / 2, -plateSize / 2);
            plateShape.lineTo(plateSize / 2, plateSize / 2);
            plateShape.lineTo(-plateSize / 2, plateSize / 2);
            plateShape.closePath();

            const apertureHole = new THREE.Path();
            apertureHole.absarc(0, 0, this.diameter / 2, 0, Math.PI * 2, false);
            plateShape.holes.push(apertureHole);
            const geometry = new THREE.ShapeGeometry(plateShape);

            if (this.mesh) {
                this.mesh.geometry.dispose();
                this.mesh.geometry = geometry;
            } else {
                this.mesh = new THREE.Mesh(geometry, material);
                this.mesh.name = name;
                this.mesh.position.set(position.x, position.y, position.z);
                this.mesh.rotation.y = Math.PI / 2;
                elementGroup.add(this.mesh);
            }
        },
        processRay: function(ray, originalRay) {
            const t = (this.mesh.position.x - ray.origin.x) / ray.direction.x;
            if (t > 1e-6) {
                const intersectPoint = ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
                const localPoint = this.mesh.worldToLocal(intersectPoint.clone());
                const distanceFromCenter = Math.sqrt(localPoint.x**2 + localPoint.y**2);

                if (distanceFromCenter <= this.diameter / 2) {
                    return { newRay: new Ray(intersectPoint, ray.direction, ray.wavelength, ray.color) };
                } else {
                    if (Math.abs(localPoint.x) <= plateSize / 2 && Math.abs(localPoint.y) <= plateSize / 2) {
                        return { intersection: intersectPoint };
                    }
                }
            }
            return null;
        }
    };
    element._rebuildMesh();
    return { mesh: element.mesh, element: element };
}


