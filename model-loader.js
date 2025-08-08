import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Loads a GLTF model, scales it to a specific size, and adds it to the scene.
 * This ensures visual components like the laser body are in scale with the optical elements.
 * @param {object} options - The options for loading the model.
 * @param {THREE.Group} options.elementGroup - The group to add the loaded model to.
 * @param {string} options.url - The URL of the .gltf model file.
 * @param {number} options.targetDiameter - The desired diameter in scene units (cm).
 * @param {THREE.Vector3} options.position - The final position of the model.
 * @param {THREE.Euler} options.rotation - The final rotation of the model.
 */
export function loadVisualModel({ elementGroup, url, targetDiameter, position, rotation }) {
    const loader = new GLTFLoader();

    loader.load(url,
        (gltf) => {
            const model = gltf.scene;

            // --- Scaling Logic ---
            const initialBox = new THREE.Box3().setFromObject(model);
            const initialSize = initialBox.getSize(new THREE.Vector3());
            const currentDiameter = Math.min(initialSize.x, initialSize.y);
            if (currentDiameter > 0) {
                const scale = targetDiameter / currentDiameter;
                model.scale.set(scale, scale, scale);
            }

            // --- Positioning Logic ---
            const scaledBox = new THREE.Box3().setFromObject(model);
            const center = scaledBox.getCenter(new THREE.Vector3());
            model.position.sub(center);
            model.rotation.copy(rotation);
            model.position.add(position);

            elementGroup.add(model);
        },
        undefined, 
        (error) => console.error(`An error occurred loading the model from ${url}:`, error)
    );
}
