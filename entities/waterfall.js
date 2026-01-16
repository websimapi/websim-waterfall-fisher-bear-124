import * as THREE from 'three';

const waterMat = new THREE.MeshLambertMaterial({ color: 0x1e90ff, transparent: true, opacity: 0.8 });
const foamMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });

function createRNG(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

export function createWaterfall(seed = 12345) {
    const group = new THREE.Group();
    group.name = "waterfall";
    group.userData.seed = seed;
    const rng = createRNG(seed);
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
    for (let i = 0; i < 80; i++) {
        const foam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), foamMat);
        const locType = rng();
        let initialPos, vel;

        if (locType < 0.4) { // On upper river
            foam.userData.location = 'upper_river';
            initialPos = new THREE.Vector3((rng() - 0.5) * (waterWidth - 1), cliffTopY + 0.1, cliffEdgeZ - (rng() * riverLength));
            vel = new THREE.Vector3(0, 0, rng() * 0.05 + 0.05);
        } else if (locType < 0.7) { // On waterfall
            foam.userData.location = 'fall';
            initialPos = new THREE.Vector3((rng() - 0.5) * (waterWidth - 1), cliffTopY - (rng() * fallHeight), cliffEdgeZ);
            vel = new THREE.Vector3(0, -(rng() * 0.1 + 0.1), 0);
        } else { // On lower river
            foam.userData.location = 'lower_river';
            initialPos = new THREE.Vector3((rng() - 0.5) * (waterWidth - 1), waterfallBottomY + 0.2, lowerRiverStartZ + (rng() * lowerRiverLength));
            vel = new THREE.Vector3(0, 0, rng() * 0.04 + 0.04);
        }
        
        foam.position.copy(initialPos);
        foam.userData.initialPos = initialPos.clone();
        foam.userData.velocity = vel.clone();
        group.add(foam);
    }
    return group;
}

export function updateWaterfall(waterfallGroup, ticks = 0) {
    if (!waterfallGroup) return;
    const cliffEdgeZ = 2.5;
    const cliffTopY = 2;
    const fallHeight = 20;
    const riverLength = 100;
    const waterfallBottomY = -18.1;
    const lowerRiverLength = 80;
    const lowerRiverStartZ = cliffEdgeZ;

    waterfallGroup.children.forEach(child => {
        if (child.userData.velocity) {
            const v = child.userData.velocity;
            const start = child.userData.initialPos;
            
            // Deterministic position calculation: start + v * ticks with wrapping
            if (child.userData.location === 'upper_river') {
                const zDist = v.z * ticks;
                const offsetFromEdge = (start.z - (cliffEdgeZ - riverLength) + zDist) % riverLength;
                child.position.z = (cliffEdgeZ - riverLength) + offsetFromEdge;
            } else if (child.userData.location === 'fall') {
                const yDist = v.y * ticks;
                const offsetFromTop = (start.y - cliffTopY + yDist) % (-fallHeight);
                child.position.y = cliffTopY + offsetFromTop;
            } else if (child.userData.location === 'lower_river') {
                const zDist = v.z * ticks;
                const offsetFromStart = (start.z - lowerRiverStartZ + zDist) % lowerRiverLength;
                child.position.z = lowerRiverStartZ + offsetFromStart;
            }
        }
    });
}