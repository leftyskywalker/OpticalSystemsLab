// === OPTICS COMPONENTS - V1.7 (Corrected Spherical Mirror Focusing) ===
// Contains the factory functions for creating optical elements.

import { Ray, getRaySphereIntersection } from './optics-core.js';

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

export function createSphericalMirror(name, position, radius, envMap, elementGroup) {
    const mirrorMaterial = new THREE.MeshStandardMaterial({
        color: 0xeeeeee, metalness: 1.0, roughness: 0.0, envMap: envMap
    });
    const mirrorGeometry = new THREE.PlaneGeometry(5, 5);
    const mesh = new THREE.Mesh(mirrorGeometry, mirrorMaterial);
    mesh.name = name;
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.y = -Math.PI / 2; 
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mirrorGeometry), new THREE.LineBasicMaterial({ color: 0x333333 })));
    elementGroup.add(mesh);

    const element = {
        mesh: mesh, type: 'spherical-mirror', radius: radius,
        processRay: function(ray) {
            const plane = new THREE.Plane();
            const normal = new THREE.Vector3(1, 0, 0); // Normal points towards the laser
            plane.setFromNormalAndCoplanarPoint(normal, this.mesh.position);
            const intersectPoint = new THREE.Vector3();

            if (plane.intersectLine(new THREE.Line3(ray.origin, ray.origin.clone().add(ray.direction.clone().multiplyScalar(100))), intersectPoint)) {
                if (ray.direction.dot(intersectPoint.clone().sub(ray.origin)) < 0) return null;
                const localPoint = this.mesh.worldToLocal(intersectPoint.clone());

                if (Math.abs(localPoint.x) <= mirrorGeometry.parameters.width / 2 && Math.abs(localPoint.y) <= mirrorGeometry.parameters.height / 2) {
                    
                    // --- FIX: A concave mirror (negative R) should have a positive focal length for this formula. ---
                    const focalLength = -this.radius / 2;
                    
                    const y = intersectPoint.y - this.mesh.position.y;
                    const z = intersectPoint.z - this.mesh.position.z;
                    
                    const reflectedDir = ray.direction.clone().reflect(normal);
                    const newDir = new THREE.Vector3(
                        reflectedDir.x,
                        reflectedDir.y - y / focalLength,
                        reflectedDir.z - z / focalLength
                    ).normalize();

                    return { newRay: new Ray(intersectPoint, newDir, ray.wavelength) };
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


