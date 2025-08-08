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
            
            // A wrapper group is used to cleanly handle transformations.
            const wrapper = new THREE.Group();

            // 1. Calculate the bounding box of the original, unscaled model.
            const initialBox = new THREE.Box3().setFromObject(model);
            const center = initialBox.getCenter(new THREE.Vector3());
            const size = initialBox.getSize(new THREE.Vector3());

            // 2. Determine a robust scale factor based on the model's largest dimension.
            const maxDim = Math.max(size.x, size.y, size.z);
            let scale = 1;
            if (maxDim > 0) {
                // Scale the model so its largest dimension matches the target diameter.
                scale = targetDiameter / maxDim;
            }
            model.scale.set(scale, scale, scale);

            // 3. Center the model's geometry based on its true center.
            // This is done by moving the model by the negative of its scaled center point.
            // This line implements the logic you preferred.
            model.position.sub(center.multiplyScalar(scale));
            
            // 4. Add the scaled and centered model to the wrapper group.
            wrapper.add(model);

            // 5. Apply the final desired position and rotation to the wrapper group.
            wrapper.position.copy(position);
            wrapper.rotation.copy(rotation);

            // 6. Add the finished, wrapped model to the scene.
            elementGroup.add(wrapper);
        },
        undefined, 
        (error) => console.error(`An error occurred loading the model from ${url}:`, error)
    );
}
