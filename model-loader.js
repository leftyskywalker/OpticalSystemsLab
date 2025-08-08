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
    // The GLTFLoader is available globally from the script tag in index.html
    const loader = new THREE.GLTFLoader();

    loader.load(url,
        (gltf) => {
            const model = gltf.scene;

            // --- Scaling Logic ---
            // 1. Calculate the initial bounding box to get the model's original size.
            const initialBox = new THREE.Box3().setFromObject(model);
            const initialSize = initialBox.getSize(new THREE.Vector3());

            // 2. Determine the scale factor. We assume the smallest dimension (excluding depth/length) is the diameter.
            const currentDiameter = Math.min(initialSize.x, initialSize.y);
            if (currentDiameter === 0) {
                console.error("Could not determine a valid diameter for scaling the model.");
                return;
            }
            const scale = targetDiameter / currentDiameter;
            model.scale.set(scale, scale, scale);

            // --- Positioning Logic ---
            // 1. After scaling, recalculate the bounding box to find the new center.
            const scaledBox = new THREE.Box3().setFromObject(model);
            const center = scaledBox.getCenter(new THREE.Vector3());

            // 2. Center the model's geometry at its origin. This makes rotation and positioning predictable.
            model.position.sub(center);

            // 3. Apply the final desired rotation and position.
            model.rotation.copy(rotation);
            model.position.add(position);

            // Add the prepared model to the main element group in the scene.
            elementGroup.add(model);
        },
        undefined, // onProgress callback (not needed)
        (error) => console.error(`An error occurred loading the model from ${url}:`, error)
    );
}
