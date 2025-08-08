import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Loads a GLTF model, assuming its source units are meters, and scales it
 * to the app's universal scale (1 unit = 1 cm). It then centers the model
 * before applying its final position and rotation.
 * @param {object} options - The options for loading the model.
 * @param {THREE.Group} options.elementGroup - The group to add the loaded model to.
 * @param {string} options.url - The URL of the .gltf model file.
 * @param {THREE.Vector3} options.position - The final position of the model.
 * @param {THREE.Euler} options.rotation - The final rotation of the model.
 */
export function loadVisualModel({ elementGroup, url, position, rotation }) {
    const loader = new GLTFLoader();

    loader.load(url,
        (gltf) => {
            const model = gltf.scene;
            const wrapper = new THREE.Group();

            // The glTF standard unit is meters. The app's universal scale is 1 unit = 1 cm.
            // A universal scaling factor of 100 is applied to convert from meters to centimeters.
            const modelScale = 100;
            model.scale.set(modelScale, modelScale, modelScale);
            
            // To properly center the model, we compute its bounding box *after* scaling.
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());

            // Center the model's geometry inside the wrapper group.
            model.position.sub(center);
            
            wrapper.add(model);

            // Apply the final desired position and rotation to the wrapper.
            wrapper.position.copy(position);
            wrapper.rotation.copy(rotation);
            
            elementGroup.add(wrapper);
        },
        undefined, 
        (error) => console.error(`An error occurred loading the model from ${url}:`, error)
    );
}
