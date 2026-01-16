import * as THREE from 'three';

const waterMat = new THREE.MeshLambertMaterial({ color: 0x1e90ff, transparent: true, opacity: 0.8 });
const foamMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });

export function createWaterfall() {
    const group = new THREE.Group();
    group.name = "waterfall";
    const waterWidth = 8;
    const cliffEdgeZ = 2.5;
    const cliffTopY = 2;
    const riverLength = 100; // Match extended river length from scenery
    const riverGeo = new THREE.PlaneGeometry(waterWidth, riverLength);
    const river = new THREE.Mesh(riverGeo, waterMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(0, cliffTopY, cliffEdgeZ - riverLength / 2);
    group.add(river);

    // Main waterfall plane
    const fallHeight = 20;
    const fallGeo = new THREE.PlaneGeometry(waterWidth, fallHeight);
    const fall = new THREE.Mesh(fallGeo, waterMat);
    fall.position.set(0, cliffTopY - fallHeight / 2, cliffEdgeZ);
    group.add(fall);

    // Lower river section
    const waterfallBottomY = -18.1;
    const lowerRiverLength = 80;
    const lowerRiverStartZ = cliffEdgeZ;
    const lowerRiverGeo = new THREE.PlaneGeometry(waterWidth, lowerRiverLength);
    const lowerRiver = new THREE.Mesh(lowerRiverGeo, waterMat);
    lowerRiver.rotation.x = -Math.PI / 2;
    lowerRiver.position.set(0, waterfallBottomY + 0.1, lowerRiverStartZ + lowerRiverLength / 2); // 0.1 higher than bed
    group.add(lowerRiver);

    // Foam particles
    for (let i = 0; i < 80; i++) { // Increased total foam particles
        const foam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), foamMat);
        const locationType = Math.random();

        if (locationType < 0.4) { // On upper river
            foam.userData.location = 'upper_river';
            foam.position.set((Math.random() - 0.5) * (waterWidth - 1), cliffTopY + 0.1, cliffEdgeZ - (Math.random() * riverLength));
            foam.userData.velocity = new THREE.Vector3(0, 0, Math.random() * 0.05 + 0.05);
        } else if (locationType < 0.7) { // On waterfall
            foam.userData.location = 'fall';
            foam.position.set((Math.random() - 0.5) * (waterWidth - 1), cliffTopY - (Math.random() * fallHeight), cliffEdgeZ);
            foam.userData.velocity = new THREE.Vector3(0, -(Math.random() * 0.1 + 0.1), 0);
        } else { // On lower river
            foam.userData.location = 'lower_river';
            foam.position.set((Math.random() - 0.5) * (waterWidth - 1), waterfallBottomY + 0.2, lowerRiverStartZ + (Math.random() * lowerRiverLength));
            foam.userData.velocity = new THREE.Vector3(0, 0, Math.random() * 0.04 + 0.04);
        }
        group.add(foam);
    }
    return group;
}

export function updateWaterfall(waterfallGroup) {
    if (!waterfallGroup) return;
    const cliffEdgeZ = 2.5;
    const cliffTopY = 2;
    const fallHeight = 20;
    const riverLength = 100; // Match extended length
    const waterfallBottomY = -18.1;
    const lowerRiverLength = 80;
    const lowerRiverStartZ = cliffEdgeZ;

    waterfallGroup.children.forEach(child => {
        if (child.userData.velocity) {
            child.position.add(child.userData.velocity);

            switch (child.userData.location) {
                case 'upper_river':
                    if (child.position.z > cliffEdgeZ) {
                        // Reset to start of upper river
                        child.position.z = cliffEdgeZ - riverLength;
                    }
                    break;
                case 'fall':
                    if (child.position.y < cliffTopY - fallHeight) {
                        // Reset to top of waterfall
                        child.position.y = cliffTopY;
                    }
                    break;
                case 'lower_river':
                    if (child.position.z > lowerRiverStartZ + lowerRiverLength) {
                        // Reset to start of lower river
                        child.position.z = lowerRiverStartZ;
                    }
                    break;
            }
        }
    });
}